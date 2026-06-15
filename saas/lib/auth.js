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
        if (!parsed) return url;
        var u = new URL(url);
        u.searchParams.set('session', parsed);
        return u.href;
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

    function requireSession() {
        var sb = getClient();
        if (!sb) {
            redirectToLogin();
            return Promise.reject(new Error('supabase_not_configured'));
        }
        var sessionFromUrl = null;
        try {
            sessionFromUrl = new URLSearchParams(window.location.search).get('session');
        } catch (e) { /* ignore */ }
        return sb.auth.getSession().then(function (result) {
            var session = result && result.data ? result.data.session : null;
            if (session) return session;
            redirectToLogin(sessionFromUrl);
            return Promise.reject(new Error('no_session'));
        });
    }

    function signInWithPassword(email, password) {
        var sb = getClient();
        if (!sb) {
            return Promise.resolve({ error: { message: 'Configuration Supabase manquante.' } });
        }
        return sb.auth.signInWithPassword({
            email: String(email || '').trim(),
            password: String(password || '')
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
        return sb.auth.getSession().then(function (result) {
            var session = result && result.data ? result.data.session : null;
            if (session) window.location.replace(getAppUrl(sessionId));
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
        getClient: getClient,
        requireSession: requireSession,
        signInWithPassword: signInWithPassword,
        signOut: signOut,
        redirectIfAlreadyLoggedIn: redirectIfAlreadyLoggedIn,
        bindLogoutButton: bindLogoutButton,
        getLoginUrl: getLoginUrl,
        getAppUrl: getAppUrl,
        parseSessionLink: parseSessionLink
    };
})();
