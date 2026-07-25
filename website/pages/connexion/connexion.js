// website/pages/connexion/ — connexion compte + rejoindre une session via lien.

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;
    var form = document.getElementById('form-login');
    var errEl = document.getElementById('error-msg');
    var submitBtn = document.getElementById('btn-submit');
    var sessionInput = document.getElementById('login-session-link');
    var linkDropdown = document.getElementById('login-link-dropdown');
    var invalidTimer = null;
    var autoJoinTimer = null;
    var joinInProgress = false;

    // Message si l’utilisateur a quitté une session invité
    if (Auth && Auth.consumeGuestExitMessage) {
        var guestMsg = Auth.consumeGuestExitMessage();
        if (guestMsg) errEl.textContent = guestMsg;
    }

    function sessionIdFrom(input) {
        return Auth && Auth.parseSessionLink ? Auth.parseSessionLink(input) : '';
    }

    function isValidLink(input) {
        var id = sessionIdFrom(input);
        return !!(Auth && Auth.isValidSessionId && Auth.isValidSessionId(id));
    }

    function goToSession(sessionId) {
        if (Auth.clearPendingSession) Auth.clearPendingSession();
        window.location.replace(Auth.getAppUrl(sessionId));
    }

    function resetSubmitBtn() {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Connexion';
    }

    // Bordure rouge 2s si le lien session est invalide
    function flashInvalid() {
        if (!sessionInput) return;
        if (linkDropdown) linkDropdown.open = true;
        clearTimeout(invalidTimer);
        sessionInput.classList.add('invalid');
        invalidTimer = setTimeout(function () {
            sessionInput.classList.remove('invalid');
            invalidTimer = null;
        }, 2000);
    }

    // Rejoindre la session (lien collé / Enter / auto)
    function tryJoinSession() {
        if (joinInProgress) return;
        if (!sessionInput || !isValidLink(sessionInput.value)) {
            flashInvalid();
            return;
        }

        joinInProgress = true;
        var sessionId = sessionIdFrom(sessionInput.value);
        if (Auth.persistPendingSession) Auth.persistPendingSession(sessionId);
        errEl.textContent = '';

        if (!Auth || !Auth.getClient) {
            errEl.textContent = 'Service de connexion indisponible.';
            joinInProgress = false;
            return;
        }
        if (!Auth.getClient()) {
            errEl.textContent = 'Configuration Supabase manquante.';
            joinInProgress = false;
            return;
        }

        sessionInput.disabled = true;
        errEl.textContent = 'Ouverture de la session…';

        Auth.ensureAuthForSessionJoin(
            document.getElementById('email').value.trim(),
            document.getElementById('password').value
        ).then(function (authResult) {
            if (authResult.error) {
                errEl.textContent = Auth.mapGuestAuthError
                    ? Auth.mapGuestAuthError(authResult.error)
                    : (authResult.error.message || 'Impossible de rejoindre la session.');
                sessionInput.disabled = false;
                joinInProgress = false;
                return;
            }
            goToSession(sessionId);
        }).catch(function () {
            errEl.textContent = 'Erreur réseau. Réessayez.';
            sessionInput.disabled = false;
            joinInProgress = false;
        });
    }

    function scheduleAutoJoin() {
        clearTimeout(autoJoinTimer);
        autoJoinTimer = setTimeout(function () {
            if (sessionInput && isValidLink(sessionInput.value)) tryJoinSession();
        }, 400);
    }

    function autoJoinIfValid() {
        if (sessionInput && isValidLink(sessionInput.value)) tryJoinSession();
    }

    // Session à garder après login (URL, storage, ou champ)
    function getSessionForRedirect() {
        var fromUrl = new URLSearchParams(window.location.search).get('session');
        if (fromUrl && isValidLink(fromUrl)) return sessionIdFrom(fromUrl);
        if (Auth && Auth.getPendingSession) {
            var pending = Auth.getPendingSession();
            if (pending) return pending;
        }
        if (sessionInput && isValidLink(sessionInput.value)) return sessionIdFrom(sessionInput.value);
        return '';
    }

    // Champ « J'ai un lien »
    if (sessionInput) {
        var sessionFromUrl = new URLSearchParams(window.location.search).get('session');
        if (sessionFromUrl) {
            sessionInput.value = sessionFromUrl;
            if (Auth && Auth.persistPendingSession) Auth.persistPendingSession(sessionFromUrl);
            if (linkDropdown) linkDropdown.open = true;
        }

        sessionInput.addEventListener('input', function () {
            sessionInput.classList.remove('invalid');
            if (isValidLink(sessionInput.value)) {
                if (Auth && Auth.persistPendingSession) {
                    Auth.persistPendingSession(sessionIdFrom(sessionInput.value));
                }
                scheduleAutoJoin();
            }
        });
        sessionInput.addEventListener('paste', function () {
            if (linkDropdown) linkDropdown.open = true;
            setTimeout(scheduleAutoJoin, 50);
        });
        sessionInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                tryJoinSession();
            }
        });
    }

    // Déjà connecté → app ; sinon auto-join si lien déjà présent
    if (Auth && Auth.redirectIfAlreadyLoggedIn) {
        Auth.redirectIfAlreadyLoggedIn(getSessionForRedirect()).then(autoJoinIfValid);
    } else {
        autoJoinIfValid();
    }

    // Submit email / mot de passe
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        errEl.textContent = '';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Connexion...';

        if (!Auth || !Auth.signInWithPassword) {
            errEl.textContent = 'Service de connexion indisponible.';
            resetSubmitBtn();
            return;
        }

        Auth.signInWithPassword(
            document.getElementById('email').value.trim(),
            document.getElementById('password').value
        ).then(function (result) {
            if (result.error) {
                errEl.textContent = result.error.message;
                resetSubmitBtn();
                return;
            }

            var sessionId = (sessionInput && isValidLink(sessionInput.value))
                ? sessionIdFrom(sessionInput.value)
                : '';
            if (sessionId) {
                goToSession(sessionId);
                return;
            }

            if (Auth.clearPendingSession) Auth.clearPendingSession();
            window.location.replace(Auth.getMenuUrl ? Auth.getMenuUrl() : Auth.getAppUrl());
        }).catch(function () {
            errEl.textContent = 'Erreur réseau. Réessayez.';
            resetSubmitBtn();
        });
    });
})();
