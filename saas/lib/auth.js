// Auth Supabase uniquement (aucun identifiant en dur dans le code).
var NolimiAuth = (function () {
    var client = null;

    function getConfig() {
        return (typeof window !== 'undefined' && window.NOLIMI_SUPABASE_CONFIG)
            ? window.NOLIMI_SUPABASE_CONFIG
            : {};
    }

    function getClient() {
        if (client) return client;
        var cfg = getConfig();
        if (!cfg.url || !cfg.anonKey || typeof supabase === 'undefined' || !supabase.createClient) {
            return null;
        }
        client = supabase.createClient(cfg.url, cfg.anonKey);
        return client;
    }

    function resolveUrl(relativePath) {
        return new URL(relativePath, window.location.href).href;
    }

    function getLoginUrl() {
        if (window.location.pathname.indexOf('/auth/') !== -1) {
            return resolveUrl('login.html');
        }
        return resolveUrl('../auth/login.html');
    }

    function getAppUrl(sessionId) {
        var url = resolveUrl('../saas/app.html?start=1');
        if (!sessionId) return url;
        var parsed = parseSessionLink(sessionId);
        if (!parsed || !isValidSessionId(parsed)) return url;
        var u = new URL(url);
        u.searchParams.set('session', parsed);
        return u.href;
    }

    function isAnonymousSession(session) {
        if (!session || !session.user) return false;
        if (session.user.is_anonymous === true) return true;
        var provider = session.user.app_metadata && session.user.app_metadata.provider;
        if (provider === 'anonymous') return true;
        var identities = session.user.identities;
        if (Array.isArray(identities)) {
            for (var i = 0; i < identities.length; i++) {
                if (identities[i] && identities[i].provider === 'anonymous') return true;
            }
        }
        return false;
    }

    function markSessionGuestAccess() {
        try {
            sessionStorage.setItem('nolimi-session-guest', '1');
        } catch (e) { /* ignore */ }
    }

    function clearSessionGuestAccess() {
        try {
            sessionStorage.removeItem('nolimi-session-guest');
        } catch (e) { /* ignore */ }
    }

    function isSessionGuestAccess() {
        try {
            return sessionStorage.getItem('nolimi-session-guest') === '1';
        } catch (e) {
            return false;
        }
    }

    function parseSessionLink(input) {
        var raw = String(input || '').trim();
        if (!raw) return '';
        try {
            if (raw.indexOf('http') === 0 || raw.indexOf('?') !== -1 || raw.indexOf('=') !== -1) {
                var url = new URL(raw, window.location.href);
                var fromParam = url.searchParams.get('session');
                if (fromParam) return fromParam.trim();
            }
        } catch (e) { /* ignore */ }
        return raw;
    }

    function isValidSessionId(sessionId) {
        return !!(sessionId && /^[a-zA-Z0-9_-]{6,}$/.test(sessionId));
    }

    function persistPendingSession(sessionId) {
        if (!sessionId) return;
        try {
            sessionStorage.setItem('nolimi-pending-session', sessionId);
        } catch (e) { /* ignore */ }
        try {
            var loginUrl = new URL(window.location.href);
            loginUrl.searchParams.set('session', sessionId);
            window.history.replaceState({}, '', loginUrl.href);
        } catch (e2) { /* ignore */ }
    }

    function getPendingSession() {
        try {
            var fromUrl = new URLSearchParams(window.location.search).get('session');
            if (fromUrl && isValidSessionId(fromUrl.trim())) return fromUrl.trim();
        } catch (e) { /* ignore */ }
        try {
            var fromStorage = sessionStorage.getItem('nolimi-pending-session');
            if (fromStorage && isValidSessionId(fromStorage.trim())) return fromStorage.trim();
        } catch (e2) { /* ignore */ }
        return '';
    }

    function clearPendingSession() {
        try {
            sessionStorage.removeItem('nolimi-pending-session');
        } catch (e) { /* ignore */ }
        try {
            var u = new URL(window.location.href);
            if (u.searchParams.has('session')) {
                u.searchParams.delete('session');
                window.history.replaceState({}, '', u.href);
            }
        } catch (e2) { /* ignore */ }
    }

    function redirectToLogin(sessionId) {
        var url = getLoginUrl();
        if (sessionId) {
            var parsed = parseSessionLink(sessionId);
            if (parsed) {
                var u = new URL(url);
                u.searchParams.set('session', parsed);
                url = u.href;
            }
        }
        window.location.replace(url);
    }

    function exitGuestAccess(message) {
        clearSessionGuestAccess();
        clearPendingSession();
        try {
            if (message) sessionStorage.setItem('nolimi-guest-exit-msg', message);
        } catch (e) { /* ignore */ }
        var sb = getClient();
        if (!sb) {
            redirectToLogin();
            return Promise.resolve();
        }
        return sb.auth.signOut().then(function () {
            redirectToLogin();
        }).catch(function () {
            redirectToLogin();
        });
    }

    function isAnonymousUser() {
        var sb = getClient();
        if (!sb) return Promise.resolve(false);
        return sb.auth.getSession().then(function (result) {
            var session = result && result.data ? result.data.session : null;
            return isAnonymousSession(session);
        });
    }

    function consumeGuestExitMessage() {
        try {
            var msg = sessionStorage.getItem('nolimi-guest-exit-msg');
            if (msg) sessionStorage.removeItem('nolimi-guest-exit-msg');
            return msg || '';
        } catch (e) {
            return '';
        }
    }

    function requireSession() {
        var sb = getClient();
        if (!sb) {
            redirectToLogin();
            return Promise.reject(new Error('supabase_not_configured'));
        }
        var sessionFromUrl = getSessionFromCurrentUrl();
        return sb.auth.getSession().then(function (result) {
            var session = result && result.data ? result.data.session : null;
            if (session) {
                if (isAnonymousSession(session) && !sessionFromUrl) {
                    return exitGuestAccess('Accès réservé via un lien de session partagée active.');
                }
                return session;
            }

            if (sessionFromUrl) {
                return ensureGuestAuthForSessionLink(sessionFromUrl).then(function (guestSession) {
                    if (guestSession) return guestSession;
                    redirectToLogin(sessionFromUrl);
                    return Promise.reject(new Error('guest_auth_failed'));
                }).catch(function (err) {
                    redirectToLogin(sessionFromUrl);
                    return Promise.reject(err);
                });
            }

            redirectToLogin(null);
            return Promise.reject(new Error('no_session'));
        });
    }

    function signInWithPassword(email, password) {
        var sb = getClient();
        if (!sb) {
            return Promise.resolve({ error: { message: 'Configuration Supabase manquante.' } });
        }
        var credentials = {
            email: String(email || '').trim(),
            password: String(password || '')
        };
        return sb.auth.getSession().then(function (result) {
            var session = result && result.data ? result.data.session : null;
            if (session && isAnonymousSession(session)) {
                return sb.auth.signOut().then(function () {
                    return sb.auth.signInWithPassword(credentials);
                });
            }
            return sb.auth.signInWithPassword(credentials);
        });
    }

    function mapGuestAuthError(error) {
        if (!error) return 'Impossible de rejoindre la session.';
        var msg = String(error.message || '');
        var code = String(error.code || error.error_code || '');
        if (/signups not allowed|signup.*disabled|new users.*sign up/i.test(msg + ' ' + code)) {
            return 'Les inscriptions sont désactivées sur Supabase. Pour rejoindre via lien invité : Authentication → Providers → Email → activez « Allow new users to sign up » (les invités utilisent une connexion anonyme, pas l’email).';
        }
        if (/anonymous|sign-ins are disabled|provider.*disabled/i.test(msg + ' ' + code)) {
            return 'Connexion invité désactivée sur Supabase. Ouvrez votre projet → Authentication → Providers → Anonymous → activez « Enable Anonymous sign-ins », puis réessayez.';
        }
        return msg || 'Impossible de rejoindre la session.';
    }

    function signInAnonymously() {
        var sb = getClient();
        if (!sb) {
            return Promise.resolve({ error: { message: 'Configuration Supabase manquante.' } });
        }
        return sb.auth.signInAnonymously().then(function (result) {
            if (result.error) {
                return { data: result.data, error: { message: mapGuestAuthError(result.error) } };
            }
            return result;
        });
    }

    function getSessionFromCurrentUrl() {
        try {
            var fromUrl = new URLSearchParams(window.location.search).get('session');
            if (fromUrl && isValidSessionId(fromUrl.trim())) return fromUrl.trim();
        } catch (e) { /* ignore */ }
        return '';
    }

    function ensureAuthForSessionJoin(email, password) {
        var sb = getClient();
        if (!sb) {
            return Promise.resolve({ error: { message: 'Configuration Supabase manquante.' } });
        }
        return sb.auth.getSession().then(function (result) {
            var session = result && result.data ? result.data.session : null;
            var hasCredentials = String(email || '').trim() && String(password || '');

            if (hasCredentials) {
                if (session && !isAnonymousSession(session)) {
                    return { data: { session: session }, error: null };
                }
                return signInWithPassword(email, password);
            }

            if (session) {
                return { data: { session: session }, error: null };
            }
            return signInAnonymously();
        });
    }

    function ensureGuestAuthForSessionLink(sessionId) {
        var sb = getClient();
        if (!sb) {
            return Promise.reject(new Error('supabase_not_configured'));
        }
        var parsed = parseSessionLink(sessionId);
        if (!parsed || !isValidSessionId(parsed)) {
            return Promise.reject(new Error('invalid_session'));
        }
        return sb.auth.getSession().then(function (result) {
            var session = result && result.data ? result.data.session : null;
            if (session) return session;
            return signInAnonymously().then(function (authResult) {
                if (authResult.error) {
                    return Promise.reject(authResult.error);
                }
                return authResult.data && authResult.data.session ? authResult.data.session : null;
            });
        });
    }

    function signOut() {
        var sb = getClient();
        if (!sb) {
            redirectToLogin();
            return Promise.resolve();
        }
        return sb.auth.signOut().then(function () {
            redirectToLogin();
        }).catch(function () {
            redirectToLogin();
        });
    }

    function redirectIfAlreadyLoggedIn(sessionId) {
        var sb = getClient();
        if (!sb) return Promise.resolve();
        var parsedSession = sessionId ? parseSessionLink(sessionId) : '';
        return sb.auth.getSession().then(function (result) {
            var session = result && result.data ? result.data.session : null;
            if (!session) return;
            if (!isAnonymousSession(session)) {
                window.location.replace(getAppUrl(parsedSession || ''));
                return;
            }
            if (parsedSession && isValidSessionId(parsedSession)) {
                window.location.replace(getAppUrl(parsedSession));
            }
        });
    }

    function bindLogoutButton(buttonId) {
        var btn = document.getElementById(buttonId || 'btn-logout');
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function () {
            signOut();
        });
    }

    return {
        mapGuestAuthError: mapGuestAuthError,
        getClient: getClient,
        requireSession: requireSession,
        signInWithPassword: signInWithPassword,
        signInAnonymously: signInAnonymously,
        ensureAuthForSessionJoin: ensureAuthForSessionJoin,
        ensureGuestAuthForSessionLink: ensureGuestAuthForSessionLink,
        signOut: signOut,
        exitGuestAccess: exitGuestAccess,
        isAnonymousUser: isAnonymousUser,
        isAnonymousSession: isAnonymousSession,
        markSessionGuestAccess: markSessionGuestAccess,
        clearSessionGuestAccess: clearSessionGuestAccess,
        isSessionGuestAccess: isSessionGuestAccess,
        getSessionFromCurrentUrl: getSessionFromCurrentUrl,
        consumeGuestExitMessage: consumeGuestExitMessage,
        redirectIfAlreadyLoggedIn: redirectIfAlreadyLoggedIn,
        bindLogoutButton: bindLogoutButton,
        getLoginUrl: getLoginUrl,
        getAppUrl: getAppUrl,
        parseSessionLink: parseSessionLink,
        isValidSessionId: isValidSessionId,
        persistPendingSession: persistPendingSession,
        getPendingSession: getPendingSession,
        clearPendingSession: clearPendingSession
    };
})();
