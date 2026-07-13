var ExportRules = (function () {
    return {
        IDS: {
            export3D: 'btn-export-3d',
            export2D: 'btn-export-2d',
            dropdown: 'fichier-dropdown',
            canvas2D: 'canvas-2d',
            paperFormat: 'paper-format-select',
            projectTitle: 'cartouche-title'
        },
        DEFAULTS: {
            file3D: 'Bouteille',
            file2D: 'Plan_Bouteille',
            paperFormat: 'A2_P',
            jpegQuality: 1.0,
            exportScaleFactor: 8
        },
        /** Tessellation export STL : plus légère que le viewport, mais lisse au minimum. */
        STL_EXPORT: {
            N_SEGMENTS: 64,
            N_FEUILLE_V: 16,
            N_THETA: 64,
            MERIDIAN_RES: 32
        },
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
