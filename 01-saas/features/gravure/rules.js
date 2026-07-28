// 01-saas/features/gravure/rules.js
// Constantes gravure : deux couches séparées.
// DEFAULTS / LIMITS / IDS → panneau UI (cartes, sliders, PNG).
// MESH → qualité du relief 3D (grille masque, tessellation, liaisons complexes).
// Pas de logique ici.

var GravureRules = (function () {
    return {
        IDS: {
            addButton: 'btn-add-engraving',
            container: 'engravings-container'
        },

        DEFAULTS: {
            y: 150,
            angleDeg: 0,
            width: 50,
            depth: 1.5,
            flip: false,
            invert: false
        },

        LIMITS: {
            y: { min: 10, max: 350, step: 1 },
            angleDeg: { min: 0, max: 360, step: 1 },
            width: { min: 10, max: 150, step: 1 },
            depth: { min: 0.1, max: 5, step: 0.1 }
        },

        // Qualité relief (adaptatif si liaison complexe)
        MESH: {
            COMPLEX_LIAISON_TYPES: ['spline', 'courbeS', 'rayon'],
            COMPLEX_LIAISON_MARGIN_MIN: 4,
            COMPLEX_LIAISON_MARGIN_RHO_FACTOR: 0.35,
            // Résolution masque PNG (grille de relief)
            GRID_CAP_DEFAULT: 512,
            GRID_CAP_COMPLEX: 256,
            MASK_SRC_MAX: 2048,
            MASK_IMG_DIVISOR: 1,
            MASK_ALPHA_THRESHOLD: 0.3,
            // Échantillonnage surface
            PROFILE_RES_DEFAULT: 72,
            PROFILE_RES_COMPLEX: 32,
            THETA_BUCKETS_DEFAULT: 160,
            THETA_BUCKETS_COMPLEX: 96,
            // Tessellation corps quand gravure inversée
            BOTTLE_TESS_SIMPLE: { nTheta: 512, meridianRes: 256 },
            BOTTLE_TESS_COMPLEX: { nTheta: 384, meridianRes: 192 }
        }
    };
})();
