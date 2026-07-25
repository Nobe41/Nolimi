// menu/pages/accueil/ — accueil menu : garde auth + bouton Nouveau → atelier.

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;

    if (Auth && Auth.requireAccountSession) {
        Auth.requireAccountSession().catch(function () {});
    }

    var btn = document.getElementById('btn-nouveau');
    if (!btn) return;

    btn.addEventListener('click', function () {
        if (!Auth || !Auth.getAppUrl) return;
        window.location.href = Auth.getAppUrl();
    });
})();
