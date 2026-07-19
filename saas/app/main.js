// saas/app/ — démarrage de l’atelier (point d’entrée).
// Ce fichier : après auth, lance 3D / 2D / realtime / autosave.

function bootAtelier() {
    // Page atelier absente → rien à faire
    if (!document.getElementById('Page-Bouteille')) return;

    // 1) Bouton déconnexion
    if (typeof NolimiAuth !== 'undefined' && NolimiAuth.bindLogoutButton) {
        NolimiAuth.bindLogoutButton('btn-logout');
    }

    // 2) Rejoindre une session partagée si ?session=… dans l’URL
    if (typeof RealtimeFeature !== 'undefined' && RealtimeFeature.tryAutoJoinFromUrl) {
        RealtimeFeature.tryAutoJoinFromUrl();
    }

    // 3) Lancer le logiciel (léger délai pour laisser le DOM / scripts prêts)
    setTimeout(function () {
        // Restore localStorage AVANT saveNow (sinon on écrase le projet sauvegardé).
        // Doit tourner ici : tous les scripts (gravure, render, storage) sont déjà chargés.
        if (typeof WorkspaceAutosave !== 'undefined') {
            if (WorkspaceAutosave.prepareRestoreFromStorage) WorkspaceAutosave.prepareRestoreFromStorage();
            if (WorkspaceAutosave.applyRestoredValues) WorkspaceAutosave.applyRestoredValues();
        }
        if (typeof initLogiciel === 'function' && !isLogicielInit) {
            initLogiciel();
            isLogicielInit = true;
        }
        if (typeof updateBouteille === 'function') updateBouteille();
        if (typeof draw2D === 'function') draw2D();
        if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.saveNow) {
            WorkspaceAutosave.saveNow();
        }
    }, 50);
}

// Auth requise → boot après session ; sinon boot direct
(function () {
    if (typeof NolimiAuth !== 'undefined' && NolimiAuth.requireSession) {
        NolimiAuth.requireSession().then(bootAtelier).catch(function () {});
        return;
    }
    bootAtelier();
})();
