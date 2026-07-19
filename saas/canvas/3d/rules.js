// saas/canvas/3d/ — réglages (qualité maillage, couleurs, caméra, grille).
// Source unique des constantes 3D ; pas de logique métier ici.

var Canvas3DRules = (function () {
    return {
        VIEWPORT_ID: 'viewport-3d',

        // Qualité du maillage (plus = plus lisse, plus lourd)
        TESSELLATION: {
            N_SEGMENTS: 128,
            N_FEUILLE_V: 32,
            MERIDIAN_RESOLUTION: 64
        },

        // Anneaux de section (traits collés à la surface, épaisseur en pixels d’écran)
        SECTION_RING: {
            COLOR_NORMAL: 0x000000,
            COLOR_HIGHLIGHT: 0xff0040,
            // Aucun décalage géométrique : même niveau que la feuille
            SURFACE_BIAS: 0,
            HIGHLIGHT_SURFACE_BIAS: 0,
            // Largeur constante à l’écran (fil fin ; rouge plus marqué)
            NORMAL_LINE_WIDTH: 0.75,
            HIGHLIGHT_LINE_WIDTH: 2.75
        },

        // Surbrillance d’une liaison (teinte de la feuille, coupe pile aux traits)
        LIAISON_HIGHLIGHT: {
            COLOR: 0xff0040,
            TINT_MIX: 0.42
        },

        // Caméra, lumières, grille
        SCENE: {
            VIEWPORT_FIT_RATIO: 0.92,
            VIEW_SIZE_BASE: 250,
            VIEW_SIZE: 230,
            NEAR: 1,
            FAR: 2000,
            CAMERA_POSITION: { x: 400, y: 300, z: 400 },
            CONTROLS_TARGET_Y: 150,
            DIRECTIONAL_INTENSITY: 0.45,
            AMBIENT_INTENSITY: 0.5,
            AXES_SIZE: 100,
            GRID_SIZE: 400,
            GRID_DIVISIONS: 20,
            GRID_OPACITY: 0.6
        }
    };
})();
