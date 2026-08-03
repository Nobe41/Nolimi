// 01-saas/features/3d/rules.js
// Constantes lecture panneau → sections 3D (IDs, défauts piqûre/bague).
// Pas de logique. Consommé par features/3d/data.js.
//
// h = hauteur (mm), L = diamètre, P = profondeur. Liaisons : rp* piqûre, rb* bague, r{n}{n+1} corps.

var Bottle3DRules = (function () {
    return {
        IDS: {
            piqurePanel: 'panel-content-piqure',
            baguePanel: 'panel-content-bague'
        },

        // Pied piqûre : hauteur s1-h, diamètre sp-L / sp-P (section sp au corps)
        PIQURE_FOOT: {
            h: 's1-h',
            L: 'sp-L',
            P: 'sp-P',
            formKey: 'sp-forme',
            carreKey: 'sp-carre-niveau',
            defaultL: 55,
            defaultP: 55
        },
        PIQURE_SECTION_DEFAULT_L: 45,
        PIQURE_LIAISON_PREFIX: 'rp',       // rp1, rp2… entre sections piqûre
        PIQURE_TIP_HEIGHT_ID: 'rp3-h',     // pointe piqûre (ne pas renommer)
        PIQURE_TIP_HEIGHT_DEFAULT: 30,

        // Fallback bague si le panneau n’a pas encore d’inputs
        BAGUE_DEFAULTS: [
            { h: 'sb1-h', L: 'sb1-L', P: 'sb1-P', formKey: 'sb1-forme', carreKey: 'sb1-carre-niveau', defaultL: 29.5, defaultP: 29.5 },
            { h: 'sb2-h', L: 'sb2-L', P: 'sb2-P', formKey: 'sb2-forme', carreKey: 'sb2-carre-niveau', defaultL: 29.5, defaultP: 29.5 },
            { h: 'sb3-h', L: 'sb3-L', P: 'sb3-P', formKey: 'sb3-forme', carreKey: 'sb3-carre-niveau', defaultL: 25.5, defaultP: 25.5 }
        ],
        BAGUE_SECTION_DEFAULT_L: 35,
        BAGUE_LIAISON_PREFIX: 'rb',        // rb1, rb2… entre sections bague
        BAGUE_COL_LIAISON_ID: 'rb0',       // Col ↔ Bas bague (hors rb1…)

        // Corps : indices si le DOM n’est pas prêt
        MAIN_SECTION_FALLBACK_INDICES: [1, 2, 3, 4, 5],
        MAIN_LIAISON_RHO_DEFAULT: 10,
        SUB_LIAISON_RHO_DEFAULT: 5,
        DEFAULT_SHAPE: 'cylindrique'
    };
})();
