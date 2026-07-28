// 01-saas/features/export/state.js
// Cache des éléments DOM utilisés par l’export.
// Bouton 3D (STL), bouton 2D (PDF), canvas plan, titre projet, format papier.
// Rempli une fois au init via initRefs ; lu par ExportFeature.

var ExportState = (function () {
    var refs = {};

    function initRefs(ids) {
        refs.btn3D = document.getElementById(ids.export3D);
        refs.btn2D = document.getElementById(ids.export2D);
        refs.dropdown = document.getElementById(ids.dropdown);
        refs.canvas2D = document.getElementById(ids.canvas2D);
        refs.paperFormat = document.getElementById(ids.paperFormat);
        refs.projectTitle = document.getElementById(ids.projectTitle);
        return refs;
    }

    function getRefs() {
        return refs;
    }

    return {
        initRefs: initRefs,
        getRefs: getRefs
    };
})();
