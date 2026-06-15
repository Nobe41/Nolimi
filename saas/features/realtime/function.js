// Session partagée via Supabase Realtime (broadcast + présence).
var RealtimeFeature = (function () {
    var channel = null;
    var userId = null;
    var broadcastTimer = null;
    var isApplyingRemote = false;
    var syncListenersBound = false;

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

    function updatePresenceCount() {
        if (!channel || !channel.presenceState) return;
        var state = channel.presenceState();
        var count = Object.keys(state).length;
        RealtimeState.setPeerCount(count);
        if (typeof RealtimeEvents !== 'undefined' && RealtimeEvents.refreshUI) {
            RealtimeEvents.refreshUI();
        }
    }

    function subscribe(sessionId) {
        var sb = (typeof NolimiAuth !== 'undefined' && NolimiAuth.getClient) ? NolimiAuth.getClient() : null;
        if (!sb) return Promise.reject(new Error('supabase_not_configured'));

        if (channel) {
            if (typeof RealtimeCursors !== 'undefined' && RealtimeCursors.stop) {
                RealtimeCursors.stop();
            }
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
                    sendFullPayload();
                })
                .on('broadcast', { event: 'cursor' }, function (msg) {
                    if (typeof RealtimeCursors !== 'undefined' && RealtimeCursors.handleBroadcast) {
                        RealtimeCursors.handleBroadcast(msg.payload);
                    }
                })
                .on('presence', { event: 'sync' }, updatePresenceCount)
                .on('presence', { event: 'join' }, updatePresenceCount)
                .on('presence', { event: 'leave' }, function (payload) {
                    if (payload && payload.key && typeof RealtimeCursors !== 'undefined' && RealtimeCursors.removeUser) {
                        RealtimeCursors.removeUser(payload.key);
                    }
                    updatePresenceCount();
                })
                .subscribe(function (status) {
                    if (status !== 'SUBSCRIBED') return;

                    channel.track({
                        user_id: userId,
                        online_at: new Date().toISOString(),
                        name: displayName
                    });

                    if (typeof RealtimeCursors !== 'undefined' && RealtimeCursors.start) {
                        RealtimeCursors.start(channel, userId, displayName);
                    }

                    RealtimeState.setSessionId(sessionId);
                    RealtimeState.setConnected(true);
                    updateUrlSession(sessionId);
                    bindSyncListeners();

                    if (RealtimeState.isHost()) {
                        sendFullPayload();
                    } else {
                        channel.send({ type: 'broadcast', event: 'request-state', payload: {} });
                    }

                    if (typeof RealtimeEvents !== 'undefined' && RealtimeEvents.refreshUI) {
                        RealtimeEvents.refreshUI();
                    }
                });

            return sessionId;
        });
    }

    function createSession() {
        var sessionId = generateSessionId();
        RealtimeState.setHost(true);
        return subscribe(sessionId);
    }

    function joinSession(rawInput) {
        var sessionId = parseSessionInput(rawInput);
        if (!sessionId) return Promise.reject(new Error('empty_session'));
        RealtimeState.setHost(false);
        return subscribe(sessionId);
    }

    function leaveSession() {
        if (typeof RealtimeCursors !== 'undefined' && RealtimeCursors.stop) {
            RealtimeCursors.stop();
        }
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
        if (typeof RealtimeEvents !== 'undefined' && RealtimeEvents.refreshUI) {
            RealtimeEvents.refreshUI();
        }
    }

    function scheduleBroadcast() {
        if (isApplyingRemote || !RealtimeState.isConnected() || !channel) return;
        if (broadcastTimer) clearTimeout(broadcastTimer);
        broadcastTimer = setTimeout(sendFullPayload, RealtimeRules.DEBOUNCE_MS);
    }

    function onLocalChange() {
        scheduleBroadcast();
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
        joinSession(sessionId).catch(function (err) {
            console.warn('Rejoindre la session depuis l’URL impossible', err);
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
        scheduleBroadcast: scheduleBroadcast,
        onLocalChange: onLocalChange,
        getSessionUrl: getSessionUrl,
        parseSessionInput: parseSessionInput,
        isApplyingRemote: function () { return isApplyingRemote; }
    };
})();
