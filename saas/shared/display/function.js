var DisplayShared = (function () {
    function init() {
        var axesToggle = document.getElementById('display-axes-toggle');
        var gridToggle = document.getElementById('display-grid-toggle');
        var ringsToggle = document.getElementById('display-rings-toggle');
        var moldJointToggle = document.getElementById('display-mold-joint-toggle');
        if (!axesToggle || !gridToggle || !ringsToggle || !moldJointToggle) return;

        var opts = (typeof window !== 'undefined' && window.displayOptions) ? window.displayOptions : null;
        if (opts) {
            axesToggle.checked = opts.showAxes !== false;
            gridToggle.checked = opts.showGrid !== false;
            ringsToggle.checked = opts.showSectionRings !== false;
            moldJointToggle.checked = opts.showMoldJoint !== false;
        }

        function applyDisplayOptions() {
            if (opts) {
                opts.showAxes = !!axesToggle.checked;
                opts.showGrid = !!gridToggle.checked;
                opts.showSectionRings = !!ringsToggle.checked;
                opts.showMoldJoint = !!moldJointToggle.checked;
            }
            if (typeof SceneSetup3D !== 'undefined' && SceneSetup3D.applyDisplayOptions) SceneSetup3D.applyDisplayOptions();
            if (typeof updateBouteille === 'function') updateBouteille();
            if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.scheduleSave) WorkspaceAutosave.scheduleSave();
            if (typeof RealtimeViewSync !== 'undefined' && RealtimeViewSync.scheduleBroadcast) RealtimeViewSync.scheduleBroadcast();
        }

        if (!axesToggle.dataset.bound) {
            axesToggle.dataset.bound = '1';
            axesToggle.addEventListener('change', applyDisplayOptions);
        }
        if (!gridToggle.dataset.bound) {
            gridToggle.dataset.bound = '1';
            gridToggle.addEventListener('change', applyDisplayOptions);
        }
        if (!ringsToggle.dataset.bound) {
            ringsToggle.dataset.bound = '1';
            ringsToggle.addEventListener('change', applyDisplayOptions);
        }
        if (!moldJointToggle.dataset.bound) {
            moldJointToggle.dataset.bound = '1';
            moldJointToggle.addEventListener('change', applyDisplayOptions);
        }
    }

    return {
        init: init
    };
})();
