// menu/pages/accueil/ — salut personnalisé + bouton Nouveau → atelier.

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;

    function fillGreeting() {
        var el = document.getElementById('accueil-greeting');
        if (!el || !Auth || !Auth.getClient) return;
        var sb = Auth.getClient();
        if (!sb) return;

        sb.auth.getSession().then(function (result) {
            var user = result && result.data && result.data.session
                ? result.data.session.user
                : null;
            var email = user && user.email ? String(user.email) : '';
            el.textContent = email ? ('Bonjour, ' + email + ' 👋') : 'Bonjour 👋';
        }).catch(function () {});
    }

    if (Auth && Auth.requireLicenseAccount) {
        Auth.requireLicenseAccount().then(function () {
            fillGreeting();
        }).catch(function () {});
    } else if (Auth && Auth.requireAccountSession) {
        Auth.requireAccountSession().then(function () {
            fillGreeting();
        }).catch(function () {});
    } else {
        fillGreeting();
    }

    var btn = document.getElementById('btn-nouveau');
    if (!btn) return;

    btn.addEventListener('click', function () {
        if (!Auth || !Auth.getAppUrl) return;
        window.location.href = Auth.getAppUrl();
    });
})();
