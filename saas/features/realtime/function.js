// saas/features/realtime/function.js
// Cœur de la session partagée : connexion Supabase Realtime (broadcast + présence).
// Synchronise le projet (payload autosave), les curseurs (cursor.js) et la caméra/vue (view.js).
// Rôles : hôte (crée la session, envoie l’état) et invité (reçoit et suit).
// UI du menu → events.js. Variables persistantes → state.js.

var RealtimeFeature = (function () {
    var channel = null;
    var userId = null;
    var broadcastTimer = null;
    var isApplyingRemote = false;
    var syncListenersBound = false;
    var hostLeftHandled = false;

    function generateSessionId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        }
        return Math.random().toString(36).slice(2, 14);
    }

    function getChannelName(sessionId) {
        return RealtimeRules.CHANNEL_PREFIX + sessionId;
    }

    function getSessionUrl(sessionId) {
        var url = new URL(window.location.href);
        url.searchParams.set(RealtimeRules.URL_PARAM, sessionId);
        return url.href;
    }

    function parseSessionFromUrl() {
        return new URLSearchParams(window.location.search).get(RealtimeRules.URL_PARAM);
    }

    function parseSessionInput(input) {
        var raw = String(input || '').trim();
        if (!raw) return '';
        try {
            if (raw.indexOf('http') === 0 || raw.indexOf('?') !== -1 || raw.indexOf('=') !== -1) {
                var url = new URL(raw, window.location.href);
                var fromParam = url.searchParams.get(RealtimeRules.URL_PARAM);
                if (fromParam) return fromParam.trim();
            }
        } catch (e) { /* ignore */ }
        return raw;
    }

    function updateUrlSession(sessionId) {
        var url = new URL(window.location.href);
        if (sessionId) url.searchParams.set(RealtimeRules.URL_PARAM, sessionId);
        else url.searchParams.delete(RealtimeRules.URL_PARAM);
        window.history.replaceState({}, '', url.href);
    }

    function refreshUI() {
        if (typeof RealtimeEvents !== 'undefined' && RealtimeEvents.refreshUI) {
            RealtimeEvents.refreshUI();
        }
    }

    function stopPeerServices() {
        if (typeof RealtimeViewSync !== 'undefined' && RealtimeViewSync.stop) {
            RealtimeViewSync.stop();
        }
        if (typeof RealtimeCursors !== 'undefined' && RealtimeCursors.stop) {
            RealtimeCursors.stop();
        }
    }

    // Envoie tout le projet au canal (hôte ou sur demande request-state)
    function sendFullPayload() {
        if (!channel || typeof WorkspaceAutosave === 'undefined' || !WorkspaceAutosave.collectPayload) return;
        var payload = WorkspaceAutosave.collectPayload();
        RealtimeState.setLastLocalSavedAt(payload.savedAt);
        channel.send({
            type: 'broadcast',
            event: 'payload',
            payload: payload
        });
    }

    // Applique un projet reçu seulement s’il est plus récent que le local
    function handleRemotePayload(payload) {
        if (!payload || !payload.savedAt) return;
        if (payload.savedAt <= RealtimeState.getLastLocalSavedAt()) return;
        if (payload.savedAt <= RealtimeState.getLastRemoteSavedAt()) return;

        isApplyingRemote = true;
        RealtimeState.setLastRemoteSavedAt(payload.savedAt);
        RealtimeState.setLastLocalSavedAt(payload.savedAt);

        if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.applyProjectPayload) {
            WorkspaceAutosave.applyProjectPayload(payload, function () {
                isApplyingRemote = false;
                if (typeof draw2D === 'function') draw2D();
            });
        } else {
            isApplyingRemote = false;
        }
    }

    function hasHostInPresence(activeChannel) {
        if (!activeChannel || !activeChannel.presenceState) return false;
        var state = activeChannel.presenceState();
        for (var key in state) {
            if (!Object.prototype.hasOwnProperty.call(state, key)) continue;
            var presences = state[key];
            for (var i = 0; i < presences.length; i++) {
                if (presences[i] && presences[i].role === 'host') return true;
            }
        }
        return false;
    }

    function countConnectedPeers(activeChannel) {
        if (!activeChannel || !activeChannel.presenceState) return 0;
        var state = activeChannel.presenceState();
        var total = 0;
        for (var key in state) {
            if (!Object.prototype.hasOwnProperty.call(state, key)) continue;
            var entries = state[key];
            total += (entries && entries.length) ? entries.length : 1;
        }
        return total;
    }

    function updatePresenceCount() {
        if (!channel || !RealtimeState.isConnected()) {
            RealtimeState.setPeerCount(0);
        } else {
            var total = countConnectedPeers(channel);
            RealtimeState.setPeerCount(Math.max(0, total - 1));
        }
        refreshUI();
    }

    function teardownSessionLocal() {
        stopPeerServices();
        if (channel) {
            channel.unsubscribe();
            channel = null;
        }
        if (broadcastTimer) {
            clearTimeout(broadcastTimer);
            broadcastTimer = null;
        }
        RealtimeState.reset();
        updateUrlSession(null);
        refreshUI();
    }

    // Après abonnement réussi : présence, curseurs, sync caméra, premier envoi d’état
    function completeSessionJoin(sessionId, displayName, role) {
        channel.track({
            user_id: userId,
            role: role,
            online_at: new Date().toISOString(),
            name: displayName
        });

        if (typeof RealtimeCursors !== 'undefined' && RealtimeCursors.start) {
            RealtimeCursors.start(channel, userId, displayName);
        }
        if (typeof RealtimeViewSync !== 'undefined' && RealtimeViewSync.start) {
            RealtimeViewSync.start(channel);
        }

        RealtimeState.setSessionId(sessionId);
        RealtimeState.setConnected(true);
        RealtimeState.setSessionGuest(role === 'guest');
        if (role === 'guest' && typeof NolimiAuth !== 'undefined' && NolimiAuth.isSessionGuestAccess && NolimiAuth.isSessionGuestAccess()) {
            NolimiAuth.markSessionGuestAccess();
        } else if (role !== 'guest' && typeof NolimiAuth !== 'undefined' && NolimiAuth.clearSessionGuestAccess) {
            NolimiAuth.clearSessionGuestAccess();
        }
        updateUrlSession(sessionId);
        bindSyncListeners();

        if (RealtimeState.isHost()) {
            sendFullPayload();
            if (typeof RealtimeViewSync !== 'undefined' && RealtimeViewSync.scheduleBroadcast) {
                RealtimeViewSync.scheduleBroadcast();
            }
        } else {
            channel.send({ type: 'broadcast', event: 'request-state', payload: {} });
        }

        refreshUI();
    }

    function isActiveSessionGuest() {
        if (RealtimeState.isSessionGuest()) return true;
        if (typeof NolimiAuth !== 'undefined' && NolimiAuth.isSessionGuestAccess) {
            return NolimiAuth.isSessionGuestAccess();
        }
        return false;
    }

    function kickSessionGuestToLogin(message) {
        teardownSessionLocal();
        if (typeof NolimiAuth !== 'undefined' && NolimiAuth.exitGuestAccess) {
            NolimiAuth.exitGuestAccess(message);
        }
    }

    function handleSessionEnded(message) {
        if (hostLeftHandled || RealtimeState.isHost() || !RealtimeState.isConnected()) return;
        hostLeftHandled = true;
        if (isActiveSessionGuest()) {
            kickSessionGuestToLogin(message);
        } else {
            teardownSessionLocal();
        }
        hostLeftHandled = false;
    }

    function handleHostLeft() {
        handleSessionEnded('Le créateur de la session a quitté. La session est fermée.');
    }

    function presenceLeftIncludesHost(payload) {
        if (!payload || !payload.leftPresences) return false;
        for (var i = 0; i < payload.leftPresences.length; i++) {
            if (payload.leftPresences[i] && payload.leftPresences[i].role === 'host') {
                return true;
            }
        }
        return false;
    }

    // Ouvre le canal Supabase et branche payload / curseur / vue / présence
    function subscribe(sessionId) {
        var sb = (typeof NolimiAuth !== 'undefined' && NolimiAuth.getClient) ? NolimiAuth.getClient() : null;
        if (!sb) return Promise.reject(new Error('supabase_not_configured'));

        if (channel) {
            stopPeerServices();
            channel.unsubscribe();
            channel = null;
        }

        return sb.auth.getSession().then(function (result) {
            var session = result && result.data ? result.data.session : null;
            if (!session || !session.user) {
                return Promise.reject(new Error('no_session'));
            }

            userId = session.user.id;
            var displayName = (session.user.email || session.user.id || '').toString();
            var joiningAsHost = RealtimeState.isHost();

            return new Promise(function (resolve, reject) {
                var hostWaitTimer = null;
                var joinCompleted = false;

                function failJoin(errorCode) {
                    if (joinCompleted) return;
                    joinCompleted = true;
                    if (hostWaitTimer) clearTimeout(hostWaitTimer);
                    var err = new Error(errorCode || 'join_failed');
                    teardownSessionLocal();
                    if (typeof NolimiAuth !== 'undefined' && NolimiAuth.exitGuestAccess) {
                        if (NolimiAuth.isSessionGuestAccess && NolimiAuth.isSessionGuestAccess()) {
                            NolimiAuth.exitGuestAccess(getJoinErrorMessage(err));
                            return;
                        }
                        if (NolimiAuth.isAnonymousUser) {
                            NolimiAuth.isAnonymousUser().then(function (isAnon) {
                                if (isAnon) {
                                    NolimiAuth.exitGuestAccess(getJoinErrorMessage(err));
                                    return;
                                }
                                reject(err);
                            });
                            return;
                        }
                    }
                    reject(err);
                }

                function succeedJoin(role) {
                    if (joinCompleted) return;
                    joinCompleted = true;
                    if (hostWaitTimer) clearTimeout(hostWaitTimer);
                    completeSessionJoin(sessionId, displayName, role);
                    resolve(sessionId);
                }

                function tryGuestJoin() {
                    if (joinCompleted || joiningAsHost) return;
                    if (hasHostInPresence(channel)) {
                        succeedJoin('guest');
                    }
                }

                channel = sb.channel(getChannelName(sessionId), {
                    config: {
                        broadcast: { self: false },
                        presence: { key: userId }
                    }
                });

                channel
                    .on('broadcast', { event: 'payload' }, function (msg) {
                        handleRemotePayload(msg.payload);
                    })
                    .on('broadcast', { event: 'request-state' }, function () {
                        if (RealtimeState.isHost()) sendFullPayload();
                    })
                    .on('broadcast', { event: 'cursor' }, function (msg) {
                        if (typeof RealtimeCursors !== 'undefined' && RealtimeCursors.handleBroadcast) {
                            RealtimeCursors.handleBroadcast(msg.payload);
                        }
                    })
                    .on('broadcast', { event: 'view' }, function (msg) {
                        if (typeof RealtimeViewSync !== 'undefined' && RealtimeViewSync.handleRemote) {
                            RealtimeViewSync.handleRemote(msg.payload);
                        }
                    })
                    .on('broadcast', { event: 'session-closed' }, function () {
                        handleHostLeft();
                    })
                    .on('presence', { event: 'sync' }, function () {
                        updatePresenceCount();
                        tryGuestJoin();
                        if (RealtimeState.isConnected() && !RealtimeState.isHost() && channel && !hasHostInPresence(channel)) {
                            handleSessionEnded('Le créateur de la session a quitté. La session est fermée.');
                        }
                    })
                    .on('presence', { event: 'join' }, updatePresenceCount)
                    .on('presence', { event: 'leave' }, function (payload) {
                        if (payload && payload.key && typeof RealtimeCursors !== 'undefined' && RealtimeCursors.removeUser) {
                            RealtimeCursors.removeUser(payload.key);
                        }
                        if (presenceLeftIncludesHost(payload)) {
                            handleHostLeft();
                        }
                        updatePresenceCount();
                    })
                    .subscribe(function (status) {
                        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                            if (!joinCompleted) {
                                failJoin('channel_error');
                            } else if (!RealtimeState.isHost() && RealtimeState.isConnected() && isActiveSessionGuest()) {
                                kickSessionGuestToLogin('La session partagée a été interrompue.');
                            } else if (!RealtimeState.isHost() && RealtimeState.isConnected()) {
                                teardownSessionLocal();
                            }
                            return;
                        }
                        if (status !== 'SUBSCRIBED') return;

                        if (joiningAsHost) {
                            succeedJoin('host');
                            return;
                        }

                        tryGuestJoin();
                        if (!joinCompleted) {
                            hostWaitTimer = setTimeout(function () {
                                if (!joinCompleted) failJoin('session_unavailable');
                            }, RealtimeRules.HOST_WAIT_MS);
                        }
                    });
            });
        });
    }

    function createSession() {
        if (typeof NolimiAuth !== 'undefined' && NolimiAuth.clearSessionGuestAccess) {
            NolimiAuth.clearSessionGuestAccess();
        }
        var sessionId = generateSessionId();
        RealtimeState.setHost(true);
        return subscribe(sessionId);
    }

    function joinSession(rawInput, viaInviteLink) {
        var sessionId = parseSessionInput(rawInput);
        if (!sessionId) return Promise.reject(new Error('empty_session'));
        RealtimeState.setHost(false);
        if (viaInviteLink && typeof NolimiAuth !== 'undefined' && NolimiAuth.markSessionGuestAccess) {
            NolimiAuth.markSessionGuestAccess();
        }
        return subscribe(sessionId);
    }

    function getJoinErrorMessage(err) {
        if (err && err.message === 'session_unavailable') {
            return 'Cette session n\'existe pas ou le créateur n\'est plus connecté.';
        }
        return 'Impossible de rejoindre cette session. Vérifiez le lien ou le code.';
    }

    function leaveSession() {
        var wasGuest = RealtimeState.isConnected() && !RealtimeState.isHost();

        if (RealtimeState.isHost() && channel) {
            channel.send({ type: 'broadcast', event: 'session-closed', payload: {} });
            var activeChannel = channel;
            var finishHostLeave = function () {
                setTimeout(function () {
                    if (channel === activeChannel) teardownSessionLocal();
                }, 250);
            };
            if (typeof activeChannel.untrack === 'function') {
                activeChannel.untrack().then(finishHostLeave).catch(finishHostLeave);
            } else {
                finishHostLeave();
            }
            return;
        }

        if (wasGuest || isActiveSessionGuest()) {
            kickSessionGuestToLogin('Vous avez quitté la session partagée.');
            return;
        }

        teardownSessionLocal();
    }

    // Debounce : envoie le projet après chaque modification du panneau gauche
    function onLocalChange() {
        if (isApplyingRemote || !RealtimeState.isConnected() || !channel) return;
        if (broadcastTimer) clearTimeout(broadcastTimer);
        broadcastTimer = setTimeout(sendFullPayload, RealtimeRules.DEBOUNCE_MS);
    }

    function bindSyncListeners() {
        if (syncListenersBound) return;
        syncListenersBound = true;
        var panel = document.getElementById('Panel-gauche');
        if (panel) {
            panel.addEventListener('input', onLocalChange);
            panel.addEventListener('change', onLocalChange);
        }
    }

    function tryAutoJoinFromUrl() {
        var sessionId = parseSessionFromUrl();
        if (!sessionId || RealtimeState.isConnected()) return;
        joinSession(sessionId, true).catch(function (err) {
            console.warn('Rejoindre la session depuis l’URL impossible', err);
            if (typeof NolimiAuth !== 'undefined' && NolimiAuth.exitGuestAccess) {
                if (NolimiAuth.isSessionGuestAccess && NolimiAuth.isSessionGuestAccess()) {
                    NolimiAuth.exitGuestAccess(getJoinErrorMessage(err));
                    return;
                }
                if (NolimiAuth.isAnonymousUser) {
                    NolimiAuth.isAnonymousUser().then(function (isAnon) {
                        if (isAnon) {
                            NolimiAuth.exitGuestAccess(getJoinErrorMessage(err));
                            return;
                        }
                        alert(getJoinErrorMessage(err));
                    });
                    return;
                }
            }
            alert(getJoinErrorMessage(err));
        });
    }

    function init() {
        if (typeof RealtimeEvents !== 'undefined' && RealtimeEvents.init) {
            RealtimeEvents.init();
        }
    }

    return {
        init: init,
        tryAutoJoinFromUrl: tryAutoJoinFromUrl,
        createSession: createSession,
        joinSession: joinSession,
        leaveSession: leaveSession,
        onLocalChange: onLocalChange,
        getSessionUrl: getSessionUrl,
        getJoinErrorMessage: getJoinErrorMessage
    };
})();
