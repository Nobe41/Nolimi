// js/3d/sceneSetup.js
// Initialisation de la scène Three.js (caméra ortho, éclairage, grille).
// Assigne scene, camera, renderer, controls aux variables globales (state.js).

var SceneSetup3D = (function () {
    var VIEW_SIZE = 250;
    var NEAR = 1;
    var FAR = 2000;
    var CAMERA_POSITION = { x: 400, y: 300, z: 400 };
    var CONTROLS_TARGET_Y = 150;
    var DIRECTIONAL_INTENSITY = 0.45;
    var AMBIENT_INTENSITY = 0.5;
    var AXES_SIZE = 100;
    var GRID_SIZE = 400;
    var GRID_DIVISIONS = 20;
    var GRID_OPACITY = 0.6;

    function initScene(canvasElement) {
        if (!canvasElement || typeof THREE === 'undefined') return null;

        var w = canvasElement.clientWidth;
        var h = canvasElement.clientHeight;
        if (h < 1) h = 1;
        var aspect = w / h;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);

        camera = new THREE.OrthographicCamera(
            -VIEW_SIZE * aspect, VIEW_SIZE * aspect,
            VIEW_SIZE, -VIEW_SIZE,
            NEAR, FAR
        );
        camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(window.devicePixelRatio);
        canvasElement.appendChild(renderer.domElement);

        scene.add(new THREE.AxesHelper(AXES_SIZE));
        var grid = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, 0xaaaaaa, 0xcccccc);
        grid.material.opacity = GRID_OPACITY;
        grid.material.transparent = true;
        scene.add(grid);

        scene.add(camera);
        var dL1 = new THREE.DirectionalLight(0xffffff, DIRECTIONAL_INTENSITY);
        dL1.position.set(-3, 0, 1.5);
        camera.add(dL1);
        var dL2 = new THREE.DirectionalLight(0xffffff, DIRECTIONAL_INTENSITY);
        dL2.position.set(3, 0, 1.5);
        camera.add(dL2);
        scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY));

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.set(0, CONTROLS_TARGET_Y, 0);

        return { scene: scene, camera: camera, renderer: renderer, controls: controls };
    }

    return {
        initScene: initScene
    };
})();
