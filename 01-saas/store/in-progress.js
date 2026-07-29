// 01-saas/store/in-progress.js
// Brouillon local quand on quitte l’atelier vers le menu (reprise via panneau).

var NolimiInProgress = (function () {
    var STORAGE_KEY = 'nolimi-in-progress-v1';

    function safeParse(raw) {
        try {
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function load() {
        try {
            var data = safeParse(localStorage.getItem(STORAGE_KEY));
            if (!data || typeof data !== 'object') return null;
            if (!data.payload || typeof data.payload !== 'object') return null;
            return data;
        } catch (e) {
            return null;
        }
    }

    function save(entry) {
        if (!entry || !entry.payload) return false;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                version: 1,
                savedAt: Date.now(),
                projectId: entry.projectId || null,
                projectName: entry.projectName || 'Projet en cours',
                payload: entry.payload
            }));
            return true;
        } catch (e) {
            return false;
        }
    }

    function clear() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
    }

    function getDisplayName() {
        var titleInput = document.getElementById('cartouche-title');
        if (titleInput && String(titleInput.value || '').trim()) {
            return String(titleInput.value).trim();
        }
        if (typeof currentCloudProjectName === 'string' && currentCloudProjectName.trim()) {
            return currentCloudProjectName.trim();
        }
        return 'Projet en cours';
    }

    function captureFromAtelier() {
        if (typeof WorkspaceAutosave === 'undefined' || !WorkspaceAutosave.collectPayload) {
            return false;
        }
        if (typeof WorkspaceAutosave.saveNow === 'function') {
            WorkspaceAutosave.saveNow();
        }
        return save({
            projectId: (typeof currentCloudProjectId !== 'undefined' && currentCloudProjectId)
                ? currentCloudProjectId
                : null,
            projectName: getDisplayName(),
            payload: WorkspaceAutosave.collectPayload()
        });
    }

    return {
        STORAGE_KEY: STORAGE_KEY,
        load: load,
        save: save,
        clear: clear,
        captureFromAtelier: captureFromAtelier,
        getDisplayName: getDisplayName
    };
})();
