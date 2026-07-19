// saas/canvas/3d/scene/ — monde Three.js (caméra, renderer, axes, grille).
// Remplit les globals : scene, camera, renderer, controls.
// Fond / lumières de base → Scene3DBackground ; pipeline mode rendu → RenderScene.
// API publique : SceneSetup3D (initScene, resize, setBackgroundScene, …).

var SceneSetup3D = (function () {
    // --- Réglages (Canvas3DRules.SCENE) ---
    var sceneRules = (typeof Canvas3DRules !== 'undefined' && Canvas3DRules.SCENE) ? Canvas3DRules.SCENE : {};
    var VIEW_SIZE_BASE = sceneRules.VIEW_SIZE_BASE || 250;
    var VIEWPORT_FIT_RATIO = sceneRules.VIEWPORT_FIT_RATIO != null ? sceneRules.VIEWPORT_FIT_RATIO : 0.98;
    var VIEW_SIZE = sceneRules.VIEW_SIZE != null
        ? sceneRules.VIEW_SIZE
        : (VIEW_SIZE_BASE * VIEWPORT_FIT_RATIO);
    var NEAR = sceneRules.NEAR || 1;
    var FAR = sceneRules.FAR || 2000;
    var CAMERA_POSITION = sceneRules.CAMERA_POSITION || { x: 400, y: 300, z: 400 };
    var CONTROLS_TARGET_Y = sceneRules.CONTROLS_TARGET_Y || 150;
    var DIRECTIONAL_INTENSITY = sceneRules.DIRECTIONAL_INTENSITY || 0.45;
    var AMBIENT_INTENSITY = sceneRules.AMBIENT_INTENSITY || 0.5;
    var AXES_SIZE = sceneRules.AXES_SIZE || 100;
    var GRID_SIZE = sceneRules.GRID_SIZE || 400;
    var GRID_DIVISIONS = sceneRules.GRID_DIVISIONS || 20;
    var GRID_OPACITY = sceneRules.GRID_OPACITY || 0.6;

    var axesHelper = null;
    var gridHelper = null;

    function renderScene() {
        return (typeof RenderScene !== 'undefined') ? RenderScene : null;
    }

    function baseBackground() {
        return (typeof Scene3DBackground !== 'undefined') ? Scene3DBackground : null;
    }

    function applyDisplayOptions() {
        if (!scene) return;
        var rs = renderScene();
        if (rs && rs.applyHelperVisibility) {
            rs.applyHelperVisibility(axesHelper, gridHelper);
            return;
        }
        var opts = (typeof window !== 'undefined' && window.displayOptions) ? window.displayOptions : {};
        if (axesHelper) axesHelper.visible = opts.showAxes !== false;
        if (gridHelper) gridHelper.visible = opts.showGrid !== false;
    }

    function initScene(canvasElement) {
        if (!canvasElement || typeof THREE === 'undefined') return null;

        var w = canvasElement.clientWidth;
        var h = canvasElement.clientHeight;
        if (h < 1) h = 1;
        var aspect = w / h;
        var base = baseBackground();
        var rs = renderScene();

        scene = new THREE.Scene();
        if (base && base.applyBaseBackground) base.applyBaseBackground();

        camera = new THREE.OrthographicCamera(
            -VIEW_SIZE * aspect, VIEW_SIZE * aspect,
            VIEW_SIZE, -VIEW_SIZE,
            NEAR, FAR
        );
        camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        canvasElement.appendChild(renderer.domElement);

        axesHelper = new THREE.AxesHelper(AXES_SIZE);
        scene.add(axesHelper);
        gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, 0xaaaaaa, 0xcccccc);
        gridHelper.material.opacity = GRID_OPACITY;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);
        applyDisplayOptions();

        scene.add(camera);
        if (base && base.createDefaultLights) {
            base.createDefaultLights(camera, DIRECTIONAL_INTENSITY, AMBIENT_INTENSITY);
        }

        if (rs && rs.syncRendererPipeline) rs.syncRendererPipeline();

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.set(0, CONTROLS_TARGET_Y, 0);
        controls.enableDamping = false;
        controls.zoomSpeed = 1.0;

        return { scene: scene, camera: camera, renderer: renderer, controls: controls };
    }

    function resize(width, height) {
        if (!camera || !renderer) return;
        var w = width || (viewport3D ? viewport3D.clientWidth : 0);
        var h = height || (viewport3D ? viewport3D.clientHeight : 0);
        if (!w || !h) return;
        var aspect = w / h;
        camera.left = -VIEW_SIZE * aspect;
        camera.right = VIEW_SIZE * aspect;
        camera.top = VIEW_SIZE;
        camera.bottom = -VIEW_SIZE;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    function disposeScene() {
        if (controls && controls.dispose) controls.dispose();
        if (renderer && renderer.dispose) renderer.dispose();
        if (renderer && renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        scene = null;
        camera = null;
        controls = null;
        renderer = null;
        axesHelper = null;
        gridHelper = null;
    }

    return {
        initScene: initScene,
        resize: resize,
        disposeScene: disposeScene,
        applyDisplayOptions: applyDisplayOptions,
        setBackgroundScene: function (sceneName) {
            var rs = renderScene();
            if (rs && rs.setActive) rs.setActive(sceneName);
            else if (baseBackground() && baseBackground().applyBaseBackground) {
                baseBackground().applyBaseBackground();
            }
            applyDisplayOptions();
            if (rs && rs.syncRendererPipeline) rs.syncRendererPipeline();
        },
        syncRendererPipeline: function () {
            var rs = renderScene();
            if (rs && rs.syncRendererPipeline) rs.syncRendererPipeline();
        }
    };
})();
