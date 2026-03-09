// js/3d/viewer.js
// Manager 3D : init scène (SceneSetup3D), vue bouteille (BottleView3D), boucle de rendu.
// API globale : initLogiciel(), updateBouteille() — utilisées par main, ui, storage, gravure.

var VIEWPORT_ID = 'viewport-3d';

function initLogiciel() {
    if (renderer) return;
    viewport3D = document.getElementById(VIEWPORT_ID);
    if (!viewport3D || typeof SceneSetup3D === 'undefined') return;

    SceneSetup3D.initScene(viewport3D);
    if (typeof BottleView3D !== 'undefined' && BottleView3D.updateView) {
        BottleView3D.updateView();
    }
    if (typeof setupListeners === 'function') setupListeners();

    function renderLoop() {
        requestAnimationFrame(renderLoop);
        if (controls) controls.update();
        if (renderer && scene && camera) renderer.render(scene, camera);
    }
    renderLoop();
}

function updateBouteille() {
    if (typeof BottleView3D !== 'undefined' && BottleView3D.updateView) {
        BottleView3D.updateView();
    }
}
