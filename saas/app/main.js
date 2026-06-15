console.log("Atelier Bouteille chargé avec succès.");

function bootAtelier() {
    var pageBouteille = document.getElementById('Page-Bouteille');
    if (!pageBouteille) return;

    if (typeof NolimiAuth !== 'undefined' && NolimiAuth.bindLogoutButton) {
        NolimiAuth.bindLogoutButton('btn-logout');
    }

    if (typeof RealtimeFeature !== 'undefined' && RealtimeFeature.tryAutoJoinFromUrl) {
        RealtimeFeature.tryAutoJoinFromUrl();
    }

    setTimeout(function () {
        if (typeof initLogiciel === 'function' && !isLogicielInit) {
            initLogiciel();
            isLogicielInit = true;
        }
        if (typeof updateBouteille === 'function') updateBouteille();
        if (typeof draw2D === 'function') draw2D();
        if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.saveNow) WorkspaceAutosave.saveNow();
    }, 50);
}

(function () {
    if (typeof NolimiAuth !== 'undefined' && NolimiAuth.requireSession) {
        NolimiAuth.requireSession().then(bootAtelier).catch(function () {});
        return;
    }
    bootAtelier();
})();
