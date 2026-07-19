// saas/features/export/events.js
// Branche les clics du menu Fichier aux handlers d’export.
// btn-export-3d → STL (modèle 3D). btn-export-2d → PDF (plan 2D).
// Évite les doubles bindings via dataset.bound.

var ExportEvents = (function () {
    function bind(refs, handlers) {
        if (refs.btn3D && !refs.btn3D.dataset.bound) {
            refs.btn3D.dataset.bound = '1';
            refs.btn3D.addEventListener('click', handlers.onExport3D);
        }
        if (refs.btn2D && !refs.btn2D.dataset.bound) {
            refs.btn2D.dataset.bound = '1';
            refs.btn2D.addEventListener('click', handlers.onExport2D);
        }
    }

    return {
        bind: bind
    };
})();
