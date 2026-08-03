// 01-saas/features/gravure/rules.js
// Constantes gravure : deux couches séparées.
// DEFAULTS / LIMITS / IDS → panneau UI (cartes, sliders, SVG).
// MESH → tessellation des courbes SVG + échantillonnage surface.
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

        MESH: {
            COMPLEX_LIAISON_TYPES: ['spline', 'courbeS', 'rayon'],
            COMPLEX_LIAISON_MARGIN_MIN: 4,
            COMPLEX_LIAISON_MARGIN_RHO_FACTOR: 0.35,
            // Preview SVG → Image (chargement UI)
            MASK_SRC_MAX: 768,
            SVG_RASTER_DEFAULT: 768,
            // Tessellation des courbes (plus petit = plus fidèle aux Bézier SVG)
            SVG_FLATNESS_FRAC: 0.00055,
            SVG_MIN_FLATNESS: 0.025,
            // Échantillonnage mesh des Bézier (mm sur la gravure)
            SVG_CURVE_FLATNESS_MM: 0.06,
            // Échantillonnage surface bouteille
            PROFILE_RES_DEFAULT: 56,
            PROFILE_RES_COMPLEX: 28,
            THETA_BUCKETS_DEFAULT: 120,
            THETA_BUCKETS_COMPLEX: 72,
            // Tessellation corps quand gravure inversée
            BOTTLE_TESS_SIMPLE: { nTheta: 384, meridianRes: 192 },
            BOTTLE_TESS_COMPLEX: { nTheta: 288, meridianRes: 144 }
        }
    };
})();
