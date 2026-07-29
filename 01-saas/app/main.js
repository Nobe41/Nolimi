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

function shouldResumeInProgress() {
    try {
        return new URLSearchParams(window.location.search).get('resume') === '1';
    } catch (e) {
        return false;
    }
}

function stripResumeParamFromUrl() {
    try {
        var u = new URL(window.location.href);
        if (!u.searchParams.has('resume')) return;
        u.searchParams.delete('resume');
        window.history.replaceState({}, '', u.pathname + u.search + u.hash);
    } catch (e) {}
}

function applyInProgressIfNeeded(done) {
    if (typeof NolimiInProgress === 'undefined' || !NolimiInProgress.load) {
        if (typeof done === 'function') done(false);
        return;
    }
    var entry = NolimiInProgress.load();
    if (!entry || !entry.payload) {
        if (typeof done === 'function') done(false);
        return;
    }

    if (entry.projectId) {
        currentCloudProjectId = entry.projectId;
        if (typeof CloudProjects !== 'undefined' && CloudProjects.setProjectIdInUrl) {
            CloudProjects.setProjectIdInUrl(entry.projectId);
        }
    }
    currentCloudProjectName = entry.projectName || 'Projet en cours';

    if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.applyProjectPayload) {
        WorkspaceAutosave.applyProjectPayload(entry.payload, function () {
            stripResumeParamFromUrl();
            if (typeof done === 'function') done(true);
        });
        return;
    }
    stripResumeParamFromUrl();
    if (typeof done === 'function') done(true);
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
    var resumeInProgress = shouldResumeInProgress();

    // 3) Lancer le logiciel (léger délai pour laisser le DOM / scripts prêts)
    setTimeout(function () {
        // Refresh = valeurs d’usine (pas de reprise autosave localStorage),
        // sauf reprise explicite depuis le panneau menu (?resume=1).
        if (!resumeInProgress && typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.clear) {
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

        if (resumeInProgress) {
            applyInProgressIfNeeded(function (ok) {
                if (ok) {
                    afterReady();
                    return;
                }
                // Pas de brouillon → comportement normal
                if (cloudProjectId) loadCloudProjectIfNeeded(cloudProjectId, afterReady);
                else afterReady();
            });
            return;
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
