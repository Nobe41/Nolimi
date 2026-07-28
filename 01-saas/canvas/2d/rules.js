// saas/canvas/2d/rules.js
// Réglages de la FENÊTRE 2D uniquement (viewport, zoom, DPR).
// Papier / styles de plan → features/2d/rules.js (Plans2DRules).

var Canvas2DRules = (function () {
    return {
        VIEWPORT_ID: 'viewport-2d',
        CANVAS_ID: 'canvas-2d',
        VIEWPORT_FIT_RATIO: 0.98,
        MAX_DPR: 2.5,
        ZOOM_MIN: 0.1,
        ZOOM_MAX: 20
    };
})();
