// 02-menu/pages/mon-compte/ — profil + déconnexion + retour site web.

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;

    window.__nolimiPageCleanup = function () {
        window.__nolimiPageCleanup = null;
    };

    function setText(id, value) {
        var el = document.getElementById(id);
        if (!el) return;
        el.textContent = value || '—';
    }

    function initialsFromEmail(email) {
        var local = String(email || '').split('@')[0] || '';
        var parts = local.split(/[._+\-]+/).filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
        }
        return local.slice(0, 2).toUpperCase() || '?';
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
            var email = user.email || '';
            var isAdmin = !!(Auth.isSubscriptionAdmin && Auth.isSubscriptionAdmin(user));
            var manager = meta.license_manager_email || (isAdmin ? email : null);

            setText('compte-email-display', email || null);
            setText('compte-email', email || null);
            setText('compte-manager', manager || null);
            setText('compte-role', isAdmin ? 'Administrateur' : 'Collaborateur');

            var avatar = document.getElementById('compte-avatar');
            if (avatar) avatar.textContent = initialsFromEmail(email);
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
            window.location.href = '../../../03-website/pages/accueil/index.html';
        });
    }
})();
