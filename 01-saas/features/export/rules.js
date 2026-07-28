// 01-saas/features/export/rules.js
// Constantes du module export (deux sorties distinctes).
// Export 3D → fichier STL (maillage pour impression / CAO).
// Export 2D → fichier PDF (plan dessiné, capture du canvas).
// Pas de logique ici : IDs DOM, défauts, résolution STL, mapping format papier → jsPDF.
// Dimensions mm du plan → features/2d (Plans2DRules).

var ExportRules = (function () {
    var planIds = (typeof Plans2DRules !== 'undefined' && Plans2DRules.IDS) ? Plans2DRules.IDS : {};
    var defaultPaper = (typeof Plans2DRules !== 'undefined' && Plans2DRules.DEFAULT_PAPER_FORMAT)
        ? Plans2DRules.DEFAULT_PAPER_FORMAT
        : 'A2_P';

    return {
        IDS: {
            export3D: 'btn-export-3d',
            export2D: 'btn-export-2d',
            dropdown: 'fichier-dropdown',
            canvas2D: 'canvas-2d',
            // Alignés sur features/2d
            paperFormat: planIds.paperFormat || 'paper-format-select',
            projectTitle: planIds.projectTitle || 'cartouche-title'
        },

        DEFAULTS: {
            file3D: 'Bouteille',
            file2D: 'Plan_Bouteille',
            paperFormat: defaultPaper,
            jpegQuality: 1.0,
            exportScaleFactor: 8
        },

        // Tessellation STL (plus légère que le viewport)
        STL_EXPORT: {
            N_SEGMENTS: 64,
            N_FEUILLE_V: 16,
            N_THETA: 64,
            MERIDIAN_RES: 32
        },

        // Clé plan (A2_P…) → options jsPDF (pas les mm : ceux-ci sont dans Plans2DRules)
        PAPER_MAP: {
            A4_P: { orientation: 'p', format: 'a4' },
            A4_L: { orientation: 'l', format: 'a4' },
            A3_P: { orientation: 'p', format: 'a3' },
            A3_L: { orientation: 'l', format: 'a3' },
            A2_P: { orientation: 'p', format: 'a2' },
            A2_L: { orientation: 'l', format: 'a2' }
        }
    };
})();
