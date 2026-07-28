// 01-saas/app/ — démarrage de l’atelier (point d’entrée).
// Ce fichier : après auth, lance 3D / 2D / realtime / autosave.
// Si ?project=… → charge le projet cloud Stockage après init.

function getCloudProjectIdFromBoot() {
    if (typeof CloudProjects !== 'undefined' && CloudProjects.getProjectIdFromUrl) {
        return CloudProjects.getProjectIdFromUrl();
    }
    try {
        return new URLSearchParams(window.location.search).get('project') || '';
    } catch (e) {
        return '';
    }
}

function loadCloudProjectIfNeeded(projectId, done) {
    if (!projectId || typeof CloudProjects === 'undefined') {
        if (typeof done === 'function') done();
        return;
    }

    CloudProjects.get(projectId).then(function (row) {
        currentCloudProjectId = row.id;
        currentCloudProjectName = row.name || 'Sans titre';
        if (typeof CloudProjects.setProjectIdInUrl === 'function') {
            CloudProjects.setProjectIdInUrl(row.id);
        }
        if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.applyProjectPayload) {
            WorkspaceAutosave.applyProjectPayload(row.data || {}, function () {
                if (typeof done === 'function') done();
            });
        } else if (typeof done === 'function') {
            done();
        }
    }).catch(function (err) {
        console.error(err);
        alert(typeof CloudProjects.mapError === 'function'
            ? CloudProjects.mapError(err)
            : 'Impossible de charger le projet.');
        currentCloudProjectId = null;
        currentCloudProjectName = null;
        if (typeof done === 'function') done();
    });
}

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

    var cloudProjectId = getCloudProjectIdFromBoot();

    // 3) Lancer le logiciel (léger délai pour laisser le DOM / scripts prêts)
    setTimeout(function () {
        // Refresh = valeurs d’usine (pas de reprise autosave localStorage).
        // Pour reprendre un projet : menu Fichiers.
        if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.clear) {
            WorkspaceAutosave.clear();
        }
        if (typeof initLogiciel === 'function' && !isLogicielInit) {
            initLogiciel();
            isLogicielInit = true;
        }

        function afterReady() {
            if (typeof updateBouteille === 'function') updateBouteille();
            if (typeof draw2D === 'function') draw2D();
            if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.saveNow) {
                WorkspaceAutosave.saveNow();
            }
        }

        if (cloudProjectId) {
            loadCloudProjectIfNeeded(cloudProjectId, afterReady);
        } else {
            afterReady();
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
