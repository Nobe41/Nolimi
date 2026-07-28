// 01-saas/shared/display/function.js
// Menu Affichage : axes, grille, anneaux de section, joint de moule.
// Écrit window.displayOptions → SceneSetup3D.applyDisplayOptions + updateBouteille.
// API : DisplayShared.init(), DisplayShared.syncTogglesFromOptions()

var DisplayShared = (function () {
    function defaultOpts() {
        return (typeof createDefaultDisplayOptions === 'function')
            ? createDefaultDisplayOptions()
            : { showAxes: true, showGrid: true, showSectionRings: true, showMoldJoint: true };
    }

    function readDisplayOptions() {
        if (typeof window === 'undefined') return null;
        if (!window.displayOptions) window.displayOptions = defaultOpts();
        return window.displayOptions;
    }

    // Sync checkboxes ← window.displayOptions (après restore / realtime)
    function syncTogglesFromOptions() {
        var opts = readDisplayOptions();
        if (!opts) return;
        var axesToggle = document.getElementById('display-axes-toggle');
        var gridToggle = document.getElementById('display-grid-toggle');
        var ringsToggle = document.getElementById('display-rings-toggle');
        var moldJointToggle = document.getElementById('display-mold-joint-toggle');
        if (axesToggle) axesToggle.checked = opts.showAxes !== false;
        if (gridToggle) gridToggle.checked = opts.showGrid !== false;
        if (ringsToggle) ringsToggle.checked = opts.showSectionRings !== false;
        if (moldJointToggle) moldJointToggle.checked = opts.showMoldJoint !== false;
    }

    function init() {
        var axesToggle = document.getElementById('display-axes-toggle');
        var gridToggle = document.getElementById('display-grid-toggle');
        var ringsToggle = document.getElementById('display-rings-toggle');
        var moldJointToggle = document.getElementById('display-mold-joint-toggle');
        if (!axesToggle || !gridToggle || !ringsToggle || !moldJointToggle) return;

        syncTogglesFromOptions();

        function applyDisplayOptions() {
            var displayOpts = readDisplayOptions();
            if (displayOpts) {
                displayOpts.showAxes = !!axesToggle.checked;
                displayOpts.showGrid = !!gridToggle.checked;
                displayOpts.showSectionRings = !!ringsToggle.checked;
                displayOpts.showMoldJoint = !!moldJointToggle.checked;
            }
            if (typeof SceneSetup3D !== 'undefined' && SceneSetup3D.applyDisplayOptions) {
                SceneSetup3D.applyDisplayOptions();
            }
            if (typeof updateBouteille === 'function') updateBouteille();
            if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.scheduleSave) {
                WorkspaceAutosave.scheduleSave();
            }
            if (typeof RealtimeViewSync !== 'undefined' && RealtimeViewSync.scheduleBroadcast) {
                RealtimeViewSync.scheduleBroadcast();
            }
        }

        function bindToggle(el) {
            if (!el || el.dataset.bound) return;
            el.dataset.bound = '1';
            el.addEventListener('change', applyDisplayOptions);
        }

        bindToggle(axesToggle);
        bindToggle(gridToggle);
        bindToggle(ringsToggle);
        bindToggle(moldJointToggle);
    }

    return {
        init: init,
        syncTogglesFromOptions: syncTogglesFromOptions
    };
})();
