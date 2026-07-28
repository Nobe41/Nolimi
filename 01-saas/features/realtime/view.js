// 01-saas/features/realtime/view.js
// Synchronisation de la vue entre participants (caméra 3D, pan/zoom 2D).
// Inclut aussi onglets actifs, options d’affichage et état de l’inspecteur.
// Broadcast throttlé ; ignore les messages plus anciens que le local.

var RealtimeViewSync = (function () {
    var channel = null;
    var throttleTimer = null;
    var pendingView = null;
    var isApplyingRemote = false;
    var controlsBound = false;
    var bindRetryTimer = null;
    var lastLocalViewAt = 0;
    var lastRemoteViewAt = 0;

    function vec3(v) {
        if (!v) return null;
        if (typeof v.x !== 'number' || typeof v.y !== 'number' || typeof v.z !== 'number') return null;
        return { x: v.x, y: v.y, z: v.z };
    }

    function collect3D() {
        if (typeof camera === 'undefined' || !camera || typeof controls === 'undefined' || !controls) return null;
        return {
            position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
            zoom: camera.zoom
        };
    }

    function collect2D() {
        if (typeof Canvas2DView !== 'undefined' && Canvas2DView.getCamera) {
            var cam = Canvas2DView.getCamera();
            return { x: cam.x, y: cam.y, zoom: cam.zoom };
        }
        if (typeof cam2D !== 'undefined' && cam2D) {
            return { x: cam2D.x, y: cam2D.y, zoom: cam2D.zoom };
        }
        return null;
    }

    // Instantané complet de ce que voit l’utilisateur local
    function collectViewState() {
        var nav = (typeof NavigationState !== 'undefined' && NavigationState.getState)
            ? NavigationState.getState()
            : {};
        var state = {
            t: Date.now(),
            activeView: nav.activeView || '3d',
            activeLeftTab: nav.activeLeftTab,
            activeBarTab: nav.activeBarTab,
            view3d: collect3D(),
            view2d: collect2D()
        };
        if (typeof window !== 'undefined' && window.displayOptions) {
            state.displayOptions = Object.assign({}, window.displayOptions);
        }
        if (typeof InspectorUISync !== 'undefined' && InspectorUISync.collectState) {
            state.ui = InspectorUISync.collectState();
        }
        return state;
    }

    function apply3D(view3d) {
        if (!view3d || typeof camera === 'undefined' || !camera || typeof controls === 'undefined' || !controls) return;
        var pos = vec3(view3d.position);
        var target = vec3(view3d.target);
        if (pos) camera.position.set(pos.x, pos.y, pos.z);
        if (target) controls.target.set(target.x, target.y, target.z);
        if (typeof view3d.zoom === 'number' && isFinite(view3d.zoom)) camera.zoom = view3d.zoom;
        camera.updateProjectionMatrix();
        controls.update();
    }

    function apply2D(view2d) {
        if (!view2d) return;
        if (typeof Canvas2DView !== 'undefined' && Canvas2DView.setCamera) {
            Canvas2DView.setCamera(view2d);
        } else if (typeof cam2D !== 'undefined' && cam2D) {
            if (typeof view2d.x === 'number') cam2D.x = view2d.x;
            if (typeof view2d.y === 'number') cam2D.y = view2d.y;
            if (typeof view2d.zoom === 'number') cam2D.zoom = view2d.zoom;
        } else {
            return;
        }
        if (typeof draw2D === 'function') draw2D();
    }

    function applyDisplayOptions(opts) {
        if (!opts || typeof window === 'undefined') return;
        if (!window.displayOptions) {
            window.displayOptions = (typeof createDefaultDisplayOptions === 'function')
                ? createDefaultDisplayOptions()
                : { showAxes: true, showGrid: true, showSectionRings: true, showMoldJoint: true };
        }
        Object.assign(window.displayOptions, opts);
        if (typeof DisplayShared !== 'undefined' && DisplayShared.syncTogglesFromOptions) {
            DisplayShared.syncTogglesFromOptions();
        } else {
            var axesToggle = document.getElementById('display-axes-toggle');
            var gridToggle = document.getElementById('display-grid-toggle');
            var ringsToggle = document.getElementById('display-rings-toggle');
            var moldJointToggle = document.getElementById('display-mold-joint-toggle');
            if (axesToggle) axesToggle.checked = opts.showAxes !== false;
            if (gridToggle) gridToggle.checked = opts.showGrid !== false;
            if (ringsToggle) ringsToggle.checked = opts.showSectionRings !== false;
            if (moldJointToggle) moldJointToggle.checked = opts.showMoldJoint !== false;
        }
        if (typeof SceneSetup3D !== 'undefined' && SceneSetup3D.applyDisplayOptions) SceneSetup3D.applyDisplayOptions();
        if (typeof updateBouteille === 'function') updateBouteille();
    }

    // Reproduit la vue distante sans reboucler le broadcast
    function applyViewState(view, options) {
        if (!view) return;
        options = options || {};
        if (!options.force && view.t && view.t <= lastRemoteViewAt) return;

        isApplyingRemote = true;
        if (view.t) lastRemoteViewAt = view.t;

        try {
            if (view.activeView && typeof UIEvents !== 'undefined' && UIEvents.applyFromState) {
                UIEvents.applyFromState({
                    activeView: view.activeView,
                    activeLeftTab: view.activeLeftTab,
                    activeBarTab: view.activeBarTab
                });
            }
            if (view.displayOptions) applyDisplayOptions(view.displayOptions);
            if (view.ui && typeof InspectorUISync !== 'undefined' && InspectorUISync.applyState) {
                requestAnimationFrame(function () {
                    InspectorUISync.applyState(view.ui);
                });
            }
            if (view.view3d) apply3D(view.view3d);
            if (view.view2d) apply2D(view.view2d);
        } finally {
            isApplyingRemote = false;
        }
    }

    function flushViewBroadcast() {
        throttleTimer = null;
        if (!channel || !pendingView || isApplyingRemote) return;
        channel.send({
            type: 'broadcast',
            event: 'view',
            payload: pendingView
        });
        pendingView = null;
    }

    // Appelé quand l’utilisateur bouge la caméra 3D (controls change)
    function scheduleBroadcast() {
        if (!channel || isApplyingRemote || !RealtimeState.isConnected()) return;
        pendingView = collectViewState();
        lastLocalViewAt = pendingView.t;
        if (throttleTimer) return;
        throttleTimer = setTimeout(flushViewBroadcast, RealtimeRules.VIEW_THROTTLE_MS);
    }

    function on3DControlsChange() {
        scheduleBroadcast();
    }

    function ensure3DControlsBinding() {
        if (controlsBound || typeof controls === 'undefined' || !controls || !controls.addEventListener) return;
        controlsBound = true;
        controls.addEventListener('change', on3DControlsChange);
        if (bindRetryTimer) {
            clearInterval(bindRetryTimer);
            bindRetryTimer = null;
        }
    }

    function start(activeChannel) {
        channel = activeChannel;
        ensure3DControlsBinding();
        if (!controlsBound && !bindRetryTimer) {
            bindRetryTimer = setInterval(ensure3DControlsBinding, 500);
        }
    }

    function stop() {
        if (throttleTimer) {
            clearTimeout(throttleTimer);
            throttleTimer = null;
        }
        if (bindRetryTimer) {
            clearInterval(bindRetryTimer);
            bindRetryTimer = null;
        }
        if (controlsBound && typeof controls !== 'undefined' && controls && controls.removeEventListener) {
            controls.removeEventListener('change', on3DControlsChange);
        }
        controlsBound = false;
        channel = null;
        pendingView = null;
        lastLocalViewAt = 0;
        lastRemoteViewAt = 0;
    }

    function handleRemote(payload) {
        if (!payload || isApplyingRemote) return;
        if (payload.t && payload.t <= lastLocalViewAt) return;
        applyViewState(payload);
    }

    function isApplying() {
        return isApplyingRemote;
    }

    return {
        start: start,
        stop: stop,
        scheduleBroadcast: scheduleBroadcast,
        collectViewState: collectViewState,
        applyViewState: applyViewState,
        handleRemote: handleRemote,
        isApplying: isApplying
    };
})();
