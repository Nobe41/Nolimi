// saas/canvas/2d/main.js
// Démarre la fenêtre 2D. API globale : draw2D(), resizeCanvas2D(), cam2D
// Papier / panneau Plan → features/2d. Caméra / rendu → ce dossier.

var canvas2d = document.getElementById(Canvas2DRules.CANVAS_ID);
var ctx2d = canvas2d ? canvas2d.getContext('2d', { alpha: true }) : null;
var view2DContainer = document.getElementById(Canvas2DRules.VIEWPORT_ID);

// Global attendu par l’export PDF (dimensions = Plans2DRules via Feature)
var paperFormats = Plans2DFeature.getFormats();
window.paperFormats = paperFormats;

// Même objet que Canvas2DView (l’export peut modifier x / y / zoom)
var cam2D = Canvas2DView.getCamera();

function draw2D() {
    if (!ctx2d || !canvas2d) return;
    Canvas2DRender.draw(ctx2d, canvas2d, cam2D, {
        applyDpr: Canvas2DView.shouldApplyDpr(),
        dpr: Canvas2DView.getDpr()
    });
}

function resizeCanvas2D() {
    Canvas2DView.resize();
}

window.addEventListener('load', function () {
    Canvas2DView.init({
        canvas: canvas2d,
        container: view2DContainer,
        onAfterResize: draw2D,
        onDraw: draw2D,
        onCameraChange: function () {
            if (typeof RealtimeViewSync !== 'undefined' && RealtimeViewSync.scheduleBroadcast) {
                RealtimeViewSync.scheduleBroadcast();
            }
        }
    });
    setTimeout(resizeCanvas2D, 100);
    Plans2DFeature.bindControlRedraw(draw2D);
});
