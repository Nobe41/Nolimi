// js/3d/viewer.js
// Manager 3D : init scène (SceneSetup3D), vue bouteille (BottleView3D), boucle de rendu.
// API globale : initLogiciel(), updateBouteille() — utilisées par main, ui, storage, gravure.

var Canvas3DLifecycle = (function () {
    var viewPortId = (typeof Canvas3DRules !== 'undefined' && Canvas3DRules.VIEWPORT_ID) ? Canvas3DRules.VIEWPORT_ID : 'viewport-3d';
    var rafId = 0;
    var isBound = false;
    var webglContextLost = false;
    var lifecycleHooksBound = false;

    function renderLoop() {
        rafId = requestAnimationFrame(renderLoop);
        if (webglContextLost) return;
        if (controls) controls.update();
        if (renderer && scene && camera) renderer.render(scene, camera);
    }

    function handleResize() {
        if (!viewport3D || viewport3D.classList.contains('hidden')) return;
        if (typeof SceneSetup3D !== 'undefined' && SceneSetup3D.resize) {
            SceneSetup3D.resize(viewport3D.clientWidth, viewport3D.clientHeight);
        }
        if (typeof controls !== 'undefined' && controls && controls.update) controls.update();
    }

    function recoverWebGL() {
        webglContextLost = false;
        dispose();
        if (typeof window !== 'undefined') window.isLogicielInit = false;
        init();
        update();
    }

    function refreshViewsAfterWake() {
        handleResize();
        if (typeof updateBouteille === 'function') updateBouteille();
        var view2D = document.getElementById('viewport-2d');
        if (view2D && !view2D.classList.contains('hidden')) {
            if (typeof resizeCanvas2D === 'function') resizeCanvas2D();
            if (typeof draw2D === 'function') draw2D();
        }
    }

    function bindLifecycleHooks() {
        if (lifecycleHooksBound) return;
        lifecycleHooksBound = true;
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState !== 'visible') return;
            if (webglContextLost) recoverWebGL();
            else refreshViewsAfterWake();
        });
        window.addEventListener('pageshow', function (event) {
            if (event && event.persisted) refreshViewsAfterWake();
        });
    }

    function bindWebGLContextHandlers(domElement) {
        if (!domElement || domElement.dataset.contextHooksBound === '1') return;
        domElement.dataset.contextHooksBound = '1';
        domElement.addEventListener('webglcontextlost', function (event) {
            if (event && event.preventDefault) event.preventDefault();
            webglContextLost = true;
        }, false);
        domElement.addEventListener('webglcontextrestored', function () {
            recoverWebGL();
        }, false);
    }

    function init() {
        if (renderer) return;
        viewport3D = document.getElementById(viewPortId);
        if (!viewport3D || typeof SceneSetup3D === 'undefined') return;
        SceneSetup3D.initScene(viewport3D);
        if (renderer && renderer.domElement) bindWebGLContextHandlers(renderer.domElement);
        if (typeof BottleView3D !== 'undefined' && BottleView3D.updateView) BottleView3D.updateView();
        if (typeof setupListeners === 'function' && !window.nolimiSetupListenersDone) {
            setupListeners();
            window.nolimiSetupListenersDone = true;
        } else if (typeof bindInspectorWheelScroll === 'function') {
            bindInspectorWheelScroll();
        }
        bindLifecycleHooks();
        if (!isBound) {
            isBound = true;
            window.addEventListener('resize', handleResize);
            if (typeof ResizeObserver !== 'undefined' && viewport3D) {
                var resizeObserver3D = new ResizeObserver(handleResize);
                resizeObserver3D.observe(viewport3D);
            }
        }
        webglContextLost = false;
        renderLoop();
    }

    var updateRaf = 0;

    function update() {
        if (updateRaf) return;
        updateRaf = requestAnimationFrame(function () {
            updateRaf = 0;
            if (typeof BottleView3D !== 'undefined' && BottleView3D.updateView) BottleView3D.updateView();
        });
    }

    function dispose() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        webglContextLost = false;
        if (typeof BottleView3D !== 'undefined' && BottleView3D.dispose) BottleView3D.dispose();
        if (typeof SceneSetup3D !== 'undefined' && SceneSetup3D.disposeScene) SceneSetup3D.disposeScene();
        if (isBound) {
            window.removeEventListener('resize', handleResize);
            isBound = false;
        }
    }

    return {
        init: init,
        update: update,
        resize: handleResize,
        dispose: dispose
    };
})();

function initLogiciel() { Canvas3DLifecycle.init(); }
function updateBouteille() { Canvas3DLifecycle.update(); }
