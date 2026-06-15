// Bindings UI — bouton partage et panneau session.
var RealtimeEvents = (function () {
    var bound = false;

    function getEl(id) {
        return document.getElementById(id);
    }

    function setHidden(el, hidden) {
        if (!el) return;
        if (hidden) el.classList.add('hidden');
        else el.classList.remove('hidden');
    }

    function hideDropdown() {
        var dropdown = getEl(RealtimeRules.IDS.dropdown);
        if (dropdown) dropdown.classList.add('hidden');
    }

    function copyLink() {
        var linkInput = getEl(RealtimeRules.IDS.linkInput);
        if (!linkInput || !linkInput.value) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(linkInput.value).then(showCopiedFeedback);
            return;
        }
        linkInput.select();
        document.execCommand('copy');
        showCopiedFeedback();
    }

    function showCopiedFeedback() {
        var btn = getEl(RealtimeRules.IDS.btnCopy);
        if (!btn) return;
        var prev = btn.textContent;
        btn.textContent = 'Copié ✓';
        setTimeout(function () { btn.textContent = prev; }, 1500);
    }

    function refreshUI() {
        var btnMenu = getEl(RealtimeRules.IDS.btnMenu);
        var idlePanel = getEl(RealtimeRules.IDS.idlePanel);
        var activePanel = getEl(RealtimeRules.IDS.activePanel);
        var linkInput = getEl(RealtimeRules.IDS.linkInput);
        var statusText = getEl(RealtimeRules.IDS.statusText);
        var peersText = getEl(RealtimeRules.IDS.peersText);
        var connected = RealtimeState.isConnected();
        var sessionId = RealtimeState.getSessionId();

        setHidden(idlePanel, connected);
        setHidden(activePanel, !connected);

        if (btnMenu) {
            btnMenu.classList.toggle('realtime-active', connected);
            btnMenu.title = connected ? 'Session partagée active' : 'Partager la session';
        }

        if (connected && linkInput && sessionId && typeof RealtimeFeature !== 'undefined') {
            linkInput.value = RealtimeFeature.getSessionUrl(sessionId);
        }

        if (statusText) {
            statusText.textContent = connected
                ? (RealtimeState.isHost() ? 'Session créée — vous êtes l’hôte' : 'Connecté à la session')
                : '';
        }

        if (peersText) {
            if (!connected) {
                peersText.textContent = '';
            } else {
                var n = RealtimeState.getPeerCount();
                if (typeof n !== 'number' || n < 0) n = 0;
                peersText.textContent = n === 1
                    ? '1 participant connecté'
                    : n + ' participants connectés';
            }
        }
    }

    function bind() {
        if (bound) return;
        bound = true;

        var btnCreate = getEl(RealtimeRules.IDS.btnCreate);
        var btnJoin = getEl(RealtimeRules.IDS.btnJoin);
        var joinInput = getEl(RealtimeRules.IDS.joinInput);
        var btnCopy = getEl(RealtimeRules.IDS.btnCopy);
        var btnLeave = getEl(RealtimeRules.IDS.btnLeave);

        if (btnCreate) {
            btnCreate.addEventListener('click', function () {
                btnCreate.disabled = true;
                RealtimeFeature.createSession()
                    .then(function () { refreshUI(); })
                    .catch(function (err) {
                        alert('Impossible de créer la session. Vérifiez votre connexion Supabase.');
                        console.error(err);
                    })
                    .finally(function () { btnCreate.disabled = false; });
            });
        }

        if (btnJoin && joinInput) {
            function doJoin() {
                var code = joinInput.value;
                if (!code.trim()) {
                    joinInput.focus();
                    return;
                }
                btnJoin.disabled = true;
                RealtimeFeature.joinSession(code)
                    .then(function () { refreshUI(); })
                    .catch(function (err) {
                        var msg = (typeof RealtimeFeature.getJoinErrorMessage === 'function')
                            ? RealtimeFeature.getJoinErrorMessage(err)
                            : 'Impossible de rejoindre cette session. Vérifiez le lien ou le code.';
                        alert(msg);
                        console.error(err);
                    })
                    .finally(function () { btnJoin.disabled = false; });
            }
            btnJoin.addEventListener('click', doJoin);
            joinInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') doJoin();
            });
        }

        if (btnCopy) btnCopy.addEventListener('click', copyLink);

        if (btnLeave) {
            btnLeave.addEventListener('click', function () {
                RealtimeFeature.leaveSession();
                refreshUI();
                hideDropdown();
            });
        }

        refreshUI();
    }

    function init() {
        bind();
    }

    return {
        init: init,
        refreshUI: refreshUI,
        hideDropdown: hideDropdown
    };
})();
