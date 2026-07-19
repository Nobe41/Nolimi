// calcule/rules.js — constantes pour volume, dégarnie et poids verre.
// Rôle : IDs panneau/overlay, bornes utilisateur, précision d'intégration numérique.
// Consommé par : math.js (CalculeVolumeMath), function.js (CalculeVolumeFeature).
// Pas de logique ici.

var CalculeRules = (function () {
    return {
        // IDs HTML : panneau latéral, overlay 3D, champs capacité / bouchon / densité
        IDS: {
            overlay: 'volume-total-overlay',
            resultsPanel: 'calcule-results-display',
            panel: 'panel-content-calcule',
            viewport3d: 'viewport-3d',
            capaciteUtileCl: 'calcule-capacite-utile-cl',
            capaciteUtileClSlider: 'calcule-capacite-utile-cl-slider',
            bouchonOn: 'calcule-bouchon-rentrant-on',
            bouchonGroup: 'calcule-bouchon-rentrant-group',
            bouchonMm: 'calcule-bouchon-rentrant-mm',
            bouchonMmSlider: 'calcule-bouchon-rentrant-mm-slider',
            densite: 'calcule-densite-verre',
            densiteSlider: 'calcule-densite-verre-slider'
        },

        MOBILE_MQ: '(max-width: 768px)',

        // Entrées panneau : capacité utile (cl), bouchon rentrant (mm), densité verre (g/cm³)
        DEFAULT_CAPACITE_UTILE_CL: 75,
        CAPACITE_UTILE_CL_MIN: 10,
        CAPACITE_UTILE_CL_MAX: 600,

        DEFAULT_BOUCHON_RENTRANT_ON: false,
        DEFAULT_BOUCHON_RENTRANT_MM: 0,
        BOUCHON_RENTRANT_MM_MAX: 70,

        DEFAULT_DENSITE_VERRE: 2.5,
        DENSITE_VERRE_MIN: 2.30,
        DENSITE_VERRE_MAX: 2.60,

        // Précision des intégrations volume (math.js) : méridien, bisection dégarnie
        THETA_SAMPLES: 360,
        MERIDIAN_RESOLUTION: 128,
        AREA_INTEGRATION_STEPS: 160,
        DEGARNIE_BISECT_ITERS: 36,
        EPS: 1e-9,

        // 1 cl = 10 000 mm³ (10 cm³)
        MM3_PER_CL: 10000
    };
})();
