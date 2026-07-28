// 01-saas/canvas/3d/scene/ — fond blanc + lumières de base (hors mode rendu).
// Les scènes studio / EXR / tonemapping → features/render/scene.js (RenderScene).

var Scene3DBackground = (function () {
    var defaultLightLeft = null;
    var defaultLightRight = null;
    var defaultAmbient = null;

    function applyBaseBackground() {
        if (!scene || typeof THREE === 'undefined') return;
        scene.background = new THREE.Color(0xffffff);
        scene.environment = null;
    }

    function createDefaultLights(cam, directionalIntensity, ambientIntensity) {
        if (!scene || !cam || typeof THREE === 'undefined') return;
        var dir = directionalIntensity != null ? directionalIntensity : 0.45;
        var amb = ambientIntensity != null ? ambientIntensity : 0.5;

        defaultLightLeft = new THREE.DirectionalLight(0xffffff, dir);
        defaultLightLeft.position.set(-3, 0, 1.5);
        cam.add(defaultLightLeft);

        defaultLightRight = new THREE.DirectionalLight(0xffffff, dir);
        defaultLightRight.position.set(3, 0, 1.5);
        cam.add(defaultLightRight);

        defaultAmbient = new THREE.AmbientLight(0xffffff, amb);
        scene.add(defaultAmbient);
    }

    function setDefaultLightsVisible(visible) {
        if (defaultLightLeft) defaultLightLeft.visible = !!visible;
        if (defaultLightRight) defaultLightRight.visible = !!visible;
        if (defaultAmbient) defaultAmbient.visible = !!visible;
    }

    return {
        applyBaseBackground: applyBaseBackground,
        createDefaultLights: createDefaultLights,
        setDefaultLightsVisible: setDefaultLightsVisible
    };
})();
