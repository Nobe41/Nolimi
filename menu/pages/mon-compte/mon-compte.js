// menu/pages/mon-compte/ — déconnexion + retour site web.

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;

    if (Auth && Auth.requireAccountSession) {
        Auth.requireAccountSession().catch(function () {});
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
