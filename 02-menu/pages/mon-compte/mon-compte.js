// menu/pages/mon-compte/ — infos compte + déconnexion + retour site web.

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;

    function setText(id, value) {
        var el = document.getElementById(id);
        if (!el) return;
        el.textContent = value || 'Non renseigné';
    }

    function planLabel(meta) {
        if (!meta) return null;
        if (meta.license_plan) return String(meta.license_plan);
        var count = parseInt(meta.license_count, 10);
        if (count === 1) return '1 licence';
        if (count > 1) return count + ' licences';
        return null;
    }

    function fillAccountInfo() {
        if (!Auth || !Auth.getClient) return;
        var sb = Auth.getClient();
        if (!sb) return;

        sb.auth.getSession().then(function (result) {
            var user = result && result.data && result.data.session
                ? result.data.session.user
                : null;
            if (!user) return;

            var meta = user.user_metadata || {};
            setText('compte-email', user.email || null);
            setText('compte-manager', meta.license_manager_email || null);
            setText('compte-plan', planLabel(meta));
        }).catch(function () {});
    }

    if (Auth && Auth.requireLicenseAccount) {
        Auth.requireLicenseAccount().then(function () {
            fillAccountInfo();
        }).catch(function () {});
    } else if (Auth && Auth.requireAccountSession) {
        Auth.requireAccountSession().then(function () {
            fillAccountInfo();
        }).catch(function () {});
    } else {
        fillAccountInfo();
    }

    if (Auth && Auth.bindLogoutButton) {
        Auth.bindLogoutButton('btn-logout');
    }

    var btnWebsite = document.getElementById('btn-back-website');
    if (btnWebsite) {
        btnWebsite.addEventListener('click', function () {
            window.location.href = '../../../website/pages/accueil/index.html';
        });
    }
})();
