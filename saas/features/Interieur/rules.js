// Interieur/rules.js — constantes de la feature « Intérieur ».
// Rôle : épaisseur du verre (mm), IDs panneau, bornes géométrie (inset).
// Consommé par : math.js (géométrie peau intérieure), function.js (UI panneau).
// Pas de logique ici, uniquement des valeurs fixes.

var InterieurRules = (function () {
    return {
        // IDs des éléments HTML du panneau latéral
        IDS: {
            panel: 'panel-content-interieur',
            epaisseur: 'interieur-epaisseur',
            epaisseurSlider: 'interieur-epaisseur-slider'
        },

        // Épaisseur verre par défaut et bornes du slider (mm)
        DEFAULT_GLASS_THICKNESS_MM: 3.5,
        THICKNESS_MIN: 0,
        THICKNESS_MAX: 12,
        THICKNESS_STEP: 0.1,

        // Sécurité géométrique : demi-axes minimum et marge avant inset de section
        MIN_HALF_AXIS: 0.1,
        INSET_SECTION_MARGIN: 0.2
    };
})();
