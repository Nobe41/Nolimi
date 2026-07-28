// 01-saas/lib/auth.js
// Auth Supabase (navigateur) — aucun identifiant en dur ici.
// Config → config/supabase.config.js (window.NOLIMI_SUPABASE_CONFIG).
// Utilisé par : app/main.js, features/realtime, 03-website/pages/connexion, 02-menu/*.
//
// Vocabulaire :
//   session compte  = utilisateur connecté (email) ou anonyme
//   session partagée = id ?session=… (Realtime), pas la session Supabase
//   invité           = accès via lien partagé (anonyme + flag sessionStorage)
//   menu             = hub post-login (Accueil / Stockage) avant l’atelier

var NolimiAuth = (function () {
    var client = null;

    // --- Config / client Supabase ---

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

    // --- URLs pages (connexion ↔ menu ↔ atelier) ---

    function resolveUrl(relativePath) {
        return new URL(relativePath, window.location.href).href;
    }

    // Depuis /connexion/ → index.html local ; sinon chemin relatif vers le site
    function getLoginUrl() {
        if (window.location.pathname.indexOf('/connexion/') !== -1) {
            return resolveUrl('index.html');
        }
        if (window.location.pathname.indexOf('/02-menu/') !== -1) {
            return resolveUrl('../../../03-website/pages/connexion/index.html');
        }
        if (window.location.pathname.indexOf('/01-saas/') !== -1) {
            return resolveUrl('../03-website/pages/connexion/index.html');
        }
        return resolveUrl('../03-website/pages/connexion/index.html');
    }

    function getWebsiteUrl() {
        if (window.location.pathname.indexOf('/02-menu/') !== -1) {
            return resolveUrl('../../../03-website/pages/accueil/index.html');
        }
        if (window.location.pathname.indexOf('/01-saas/') !== -1) {
            return resolveUrl('../03-website/pages/accueil/index.html');
        }
        if (window.location.pathname.indexOf('/03-website/') !== -1) {
            return resolveUrl('../accueil/index.html');
        }
        return resolveUrl('../03-website/pages/accueil/index.html');
    }

    function redirectToWebsite() {
        window.location.replace(getWebsiteUrl());
    }

    // Après login (sans lien de session) → menu (accueil ou abonnement admin)
    function getAdminMenuUrl() {
        if (window.location.pathname.indexOf('/02-menu/') !== -1) {
            return resolveUrl('../abonnement/index.html');
        }
        if (window.location.pathname.indexOf('/01-saas/') !== -1) {
            return resolveUrl('../02-menu/pages/abonnement/index.html');
        }
        return resolveUrl('../../../02-menu/pages/abonnement/index.html');
    }

    function getMenuUrl(user) {
        if (user && isSubscriptionAdmin(user) && !hasLicenseSeat(user)) {
            return getAdminMenuUrl();
        }
        if (window.location.pathname.indexOf('/02-menu/') !== -1) {
            return resolveUrl('../accueil/index.html');
        }
        if (window.location.pathname.indexOf('/01-saas/') !== -1) {
            return resolveUrl('../02-menu/pages/accueil/index.html');
        }
        return resolveUrl('../../../02-menu/pages/accueil/index.html');
    }

    function isSubscriptionAdmin(user) {
        var meta = user && user.user_metadata ? user.user_metadata : {};
        return meta.account_role === 'admin';
    }

    // Admin qui a aussi pris un siège licence (menu complet)
    function hasLicenseSeat(user) {
        var meta = user && user.user_metadata ? user.user_metadata : {};
        return !!meta.has_license_seat;
    }

    function isAccessSuspended(user) {
        var meta = user && user.user_metadata ? user.user_metadata : {};
        return !!meta.access_suspended;
    }

    function isAdminWithLicenseSeat(user) {
        return isSubscriptionAdmin(user) && hasLicenseSeat(user);
    }

    function redirectSuspendedLicense() {
        var url = getLoginUrl();
        try {
            var u = new URL(url);
            u.searchParams.set('error', 'license_suspended');
            window.location.replace(u.href);
        } catch (e) {
            window.location.replace(url);
        }
    }

    function getAccountRole(user) {
        if (isAdminWithLicenseSeat(user)) return 'admin-license';
        if (isSubscriptionAdmin(user)) return 'admin';
        return 'license';
    }

    function redirectToMenuForUser(user) {
        window.location.replace(getMenuUrl(user));
    }

    function getAppUrl(sessionId, projectId) {
        var url;
        if (window.location.pathname.indexOf('/01-saas/') !== -1) {
            url = resolveUrl('app.html?start=1');
        } else {
            url = resolveUrl('../../../01-saas/app.html?start=1');
        }
        var u = new URL(url);
        if (sessionId) {
            var parsed = parseSessionLink(sessionId);
            if (parsed && isValidSessionId(parsed)) {
                u.searchParams.set('session', parsed);
            }
        }
        if (projectId) {
            u.searchParams.set('project', String(projectId));
        }
        return u.href;
    }

    // --- Session partagée (?session=) ---

    // Accepte un id brut ou une URL contenant ?session=
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

    function getSessionFromCurrentUrl() {
        try {
            var fromUrl = new URLSearchParams(window.location.search).get('session');
            if (fromUrl && isValidSessionId(fromUrl.trim())) return fromUrl.trim();
        } catch (e) { /* ignore */ }
        return '';
    }

    // Mémorise l’id avant login (URL + sessionStorage)
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

    // --- Accès invité (flag local) ---

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

    // Message affiché sur la page connexion après sortie invité
    function consumeGuestExitMessage() {
        try {
            var msg = sessionStorage.getItem('nolimi-guest-exit-msg');
            if (msg) sessionStorage.removeItem('nolimi-guest-exit-msg');
            return msg || '';
        } catch (e) {
            return '';
        }
    }

    // --- Détection anonyme Supabase ---

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

    function isAnonymousUser() {
        var sb = getClient();
        if (!sb) return Promise.resolve(false);
        return sb.auth.getSession().then(function (result) {
            var session = result && result.data ? result.data.session : null;
            return isAnonymousSession(session);
        });
    }

    // --- Redirections ---

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

    // Déjà connecté sur la page login → menu (ou atelier si lien de session)
    function redirectIfAlreadyLoggedIn(sessionId) {
        var sb = getClient();
        if (!sb) return Promise.resolve();
        var parsedSession = sessionId ? parseSessionLink(sessionId) : '';
        return sb.auth.getSession().then(function (result) {
            var session = result && result.data ? result.data.session : null;
            if (!session) return;
            if (!isAnonymousSession(session)) {
                if (isAccessSuspended(session.user) && !isSubscriptionAdmin(session.user)) {
                    return sb.auth.signOut().catch(function () {}).then(function () {
                        redirectSuspendedLicense();
                    });
                }
                if (parsedSession && isValidSessionId(parsedSession) && (!isSubscriptionAdmin(session.user) || hasLicenseSeat(session.user))) {
                    window.location.replace(getAppUrl(parsedSession));
                } else {
                    redirectToMenuForUser(session.user);
                }
                return;
            }
            if (parsedSession && isValidSessionId(parsedSession)) {
                window.location.replace(getAppUrl(parsedSession));
            }
        });
    }

    // --- Sign-in / sign-out ---

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

    // Connexion email : si une session anonyme est ouverte, on la ferme d’abord
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

    function signOut() {
        var sb = getClient();
        if (!sb) {
            redirectToWebsite();
            return Promise.resolve();
        }
        return sb.auth.signOut().then(function () {
            redirectToWebsite();
        }).catch(function () {
            redirectToWebsite();
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

    // Quitte l’atelier invité → login (+ message optionnel)
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

    // --- Garde d’accès atelier / rejoindre session ---

    // Auth pour rejoindre une session : credentials → login ; sinon anonyme
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

    // Lien ?session= sans compte : crée une auth anonyme si besoin
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

    // Point d’entrée atelier : session valide requise (sinon redirect login)
    function requireSession() {
        var sb = getClient();
        if (!sb) {
            redirectToLogin();
            return Promise.reject(new Error('supabase_not_configured'));
        }
        var sessionFromUrl = getSessionFromCurrentUrl();
        return sb.auth.getSession().then(function (result) {
            var session = result && result.data ? result.data.session : null;
            if (session && !isAnonymousSession(session) && isSubscriptionAdmin(session.user) && !hasLicenseSeat(session.user)) {
                redirectToMenuForUser(session.user);
                return Promise.reject(new Error('admin_restricted'));
            }
            if (session && !isAnonymousSession(session) && isAccessSuspended(session.user)) {
                redirectSuspendedLicense();
                return Promise.reject(new Error('license_suspended'));
            }
            if (session) {
                // Anonyme sans ?session= → pas d’accès libre à l’atelier
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

    // Point d’entrée menu : compte connecté requis (pas d’invité anonyme)
    function requireAccountSession() {
        var sb = getClient();
        if (!sb) {
            redirectToLogin();
            return Promise.reject(new Error('supabase_not_configured'));
        }
        return sb.auth.getSession().then(function (result) {
            var session = result && result.data ? result.data.session : null;
            if (!session || isAnonymousSession(session)) {
                redirectToLogin(null);
                return Promise.reject(new Error('no_account_session'));
            }
            if (isAccessSuspended(session.user) && !isSubscriptionAdmin(session.user)) {
                redirectSuspendedLicense();
                return Promise.reject(new Error('license_suspended'));
            }
            return session;
        });
    }

    // Pages menu licence (accueil, fichiers…) — licences + admin avec siège licence
    function requireLicenseAccount() {
        return requireAccountSession().then(function (session) {
            if (isAccessSuspended(session.user)) {
                redirectSuspendedLicense();
                return Promise.reject(new Error('license_suspended'));
            }
            if (isSubscriptionAdmin(session.user) && !hasLicenseSeat(session.user)) {
                redirectToMenuForUser(session.user);
                return Promise.reject(new Error('admin_restricted'));
            }
            return session;
        });
    }

    // Page abonnement — uniquement le compte admin
    function requireAdminAccount() {
        return requireAccountSession().then(function (session) {
            if (!isSubscriptionAdmin(session.user)) {
                redirectToMenuForUser(session.user);
                return Promise.reject(new Error('license_restricted'));
            }
            return session;
        });
    }

    return {
        getClient: getClient,
        requireSession: requireSession,
        requireAccountSession: requireAccountSession,
        requireLicenseAccount: requireLicenseAccount,
        requireAdminAccount: requireAdminAccount,
        signInWithPassword: signInWithPassword,
        ensureAuthForSessionJoin: ensureAuthForSessionJoin,
        mapGuestAuthError: mapGuestAuthError,
        signOut: signOut,
        exitGuestAccess: exitGuestAccess,
        isAnonymousUser: isAnonymousUser,
        isSubscriptionAdmin: isSubscriptionAdmin,
        hasLicenseSeat: hasLicenseSeat,
        isAdminWithLicenseSeat: isAdminWithLicenseSeat,
        isAccessSuspended: isAccessSuspended,
        getAccountRole: getAccountRole,
        markSessionGuestAccess: markSessionGuestAccess,
        clearSessionGuestAccess: clearSessionGuestAccess,
        isSessionGuestAccess: isSessionGuestAccess,
        consumeGuestExitMessage: consumeGuestExitMessage,
        redirectIfAlreadyLoggedIn: redirectIfAlreadyLoggedIn,
        bindLogoutButton: bindLogoutButton,
        getAppUrl: getAppUrl,
        getMenuUrl: getMenuUrl,
        getAdminMenuUrl: getAdminMenuUrl,
        getWebsiteUrl: getWebsiteUrl,
        parseSessionLink: parseSessionLink,
        isValidSessionId: isValidSessionId,
        persistPendingSession: persistPendingSession,
        getPendingSession: getPendingSession,
        clearPendingSession: clearPendingSession
    };
})();
