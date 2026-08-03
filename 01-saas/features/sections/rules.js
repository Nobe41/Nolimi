// 01-saas/features/sections/rules.js
// Constantes métier des sections. Pas de DOM ni de calcul.
//
// Vocabulaire :
//   section  = coupe horizontale (hauteur h + diamètres L/P + forme)
//   liaison  = raccord entre 2 sections (profil + rayon rho)
//   main     = corps (pied → col)     IDs DOM : s1-h, s2-L, r12-type…
//   piqure   = fond / piqûre          IDs DOM : sp-L, sp2-h, rp1-rho…
//   bague    = bagues de col          IDs DOM : sb1-h, rb2-type…
//   rp3-h    = pointe de piqûre (hauteur fixe, lue par 3D / calcule / validator)

var SectionsRules = (function () {
    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    // Options <select> profil de liaison (ligne, courbe S, rayon, spline)
    var selectProfilOptions = ''
        + '<option value="ligne">Ligne</option>'
        + '<option value="courbeS">Courbe S</option>'
        + '<option value="rayon">Rayon</option>'
        + '<option value="spline">Spline</option>';

    // Options <select> forme de section (cylindrique → P forcé = L)
    var selectFormeOptions = ''
        + '<option value="cylindrique">Cylindrique</option>'
        + '<option value="ovale">Ovale</option>'
        + '<option value="carre">Carré</option>';

    // Alias historique « rond » → cylindrique
    function normalizeForme(shape) {
        if (!shape || shape === 'rond') return 'cylindrique';
        return shape;
    }

    // Pour une forme cylindrique, profondeur P = largeur L (consommé par features/3d/data.js)
    function resolveSectionDimensions(shape, L, P) {
        shape = normalizeForme(shape);
        if (shape === 'cylindrique') {
            return { L: L, P: L, shape: shape };
        }
        return { L: L, P: P, shape: shape };
    }

    // IDs DOM stables (panneaux inspecteur + pointe piqûre)
    var IDS = {
        panelSections: 'panel-content-sections',
        panelPiqure: 'panel-content-piqure',
        panelBague: 'panel-content-bague',
        panelInterieur: 'panel-content-interieur',
        inspector: 'inspector',
        addSectionBar: 'inspector-add-section-bar',
        addSectionFab: 'btn-add-section-fab',
        addSectionPanel: 'inspector-add-section-panel',
        addSectionBtn: 'btn-add-section',
        addSectionBetween: 'add-section-between',
        addSectionMode: 'add-section-mode',
        piqureTipHeight: 'rp3-h',
        piqureTipHeightSlider: 'rp3-h-slider'
    };

    // Défauts quand on crée une liaison manquante (piqûre / bague vs corps)
    var DEFAULT_LIAISON = { rho: 5, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 };
    var DEFAULT_LIAISON_MAIN = { rho: 10, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 };

    // Pointe de piqûre (carte « Liaison N » après les sections piqûre)
    var PIQURE_TIP = {
        height: 30,
        hMin: 0,
        hMax: 100,
        hStep: 0.5
    };

    // Rayon mini du profil méridien (x ≥ 0) — SectionsMaths
    var MIN_PROFILE_RADIUS = 0;

    // --- État initial corps (h = hauteur mm, L/P = diamètres mm) ---
    var mainSections = [
        { label: 'Pied', h: 0, hMin: 0, hMax: 80, L: 70, P: 70, LMin: 40, LMax: 120, step: 0.5, hStep: 0.5 },
        { label: 'Corps', h: 15, hMin: 0, hMax: 350, L: 78.5, P: 78.5, LMin: 40, LMax: 120, step: 0.5, hStep: 1 },
        { label: 'Épaule', h: 180, hMin: 0, hMax: 350, L: 78.5, P: 78.5, LMin: 20, LMax: 120, step: 0.5, hStep: 0.5 },
        { label: 'Bas col', h: 225, hMin: 20, hMax: 350, L: 30, P: 30, LMin: 20, LMax: 70, step: 0.5, hStep: 1 },
        { label: 'Col', h: 282, hMin: 0, hMax: 350, L: 26, P: 26, LMin: 20, LMax: 50, step: 0.1, hStep: 0.5 }
    ];

    // Liaisons corps : index i = entre section i+1 et i+2 → DOM r{from}{to}
    var mainLiaisons = [
        { rho: 5, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 },
        { rho: 40, rhoMin: 5, rhoMax: 400, rhoStep: 1 },
        { rho: 24, rhoMin: 0, rhoMax: 400, rhoStep: 0.5, type: 'courbeS' },
        { rho: 20, rhoMin: 5, rhoMax: 400, rhoStep: 1 }
    ];

    // Piqûre : key = préfixe DOM (sp, sp2, sp3…). hasHeight=false → hauteur = pied (s1-h)
    var piqureSections = [
        { key: 'sp', label: 'Piqûre', hasHeight: false, L: 55, P: 55, LMin: 10, LMax: 120, step: 0.5 },
        { key: 'sp2', label: 'Bas piqûre', hasHeight: true, h: 6, hMin: 0, hMax: 80, hStep: 0.5, L: 45, P: 45, LMin: 10, LMax: 120, step: 0.5 },
        { key: 'sp3', label: 'Haut piqûre', hasHeight: true, h: 24, hMin: 0, hMax: 80, hStep: 0.5, L: 28, P: 28, LMin: 10, LMax: 120, step: 0.5 }
    ];

    var piqureLiaisons = [
        { id: 'rp1', rho: 5, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 },
        { id: 'rp2', rho: 5, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 }
    ];

    // Bague : key = sb1, sb2, sb3…
    var bagueSections = [
        { key: 'sb1', label: 'Bas bague', h: 284, hMin: 0, hMax: 400, hStep: 0.5, L: 29.5, P: 29.5, LMin: 10, LMax: 120, step: 0.5 },
        { key: 'sb2', label: 'Haut bague', h: 298.5, hMin: 0, hMax: 400, hStep: 0.5, L: 29.5, P: 29.5, LMin: 10, LMax: 120, step: 0.5 },
        { key: 'sb3', label: 'Haut bague', h: 300, hMin: 0, hMax: 400, hStep: 0.5, L: 25.5, P: 25.5, LMin: 10, LMax: 120, step: 0.5 }
    ];

    var bagueLiaisons = [
        { id: 'rb1', rho: 5, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 },
        { id: 'rb2', rho: 5, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 }
    ];

    // Liaison Col (dernière section corps) ↔ Bas bague — id fixe rb0 (hors renumérotation rb1…)
    var bagueColLiaison = {
        id: 'rb0',
        type: 'courbeS',
        rho: 1,
        rhoMin: 1,
        rhoMax: 400,
        rhoStep: 0.5
    };

    return {
        IDS: IDS,
        DEFAULT_LIAISON: DEFAULT_LIAISON,
        DEFAULT_LIAISON_MAIN: DEFAULT_LIAISON_MAIN,
        PIQURE_TIP: PIQURE_TIP,
        MIN_PROFILE_RADIUS: MIN_PROFILE_RADIUS,
        selectProfilOptions: selectProfilOptions,
        selectFormeOptions: selectFormeOptions,
        resolveSectionDimensions: resolveSectionDimensions,
        BAGUE_COL_LIAISON_ID: 'rb0',
        // Clone profond → état runtime (SectionsState)
        createInitialState: function () {
            return {
                sectionsMain: clone(mainSections),
                liaisonsMain: clone(mainLiaisons),
                piqureSections: clone(piqureSections),
                piqureLiaisons: clone(piqureLiaisons),
                bagueSections: clone(bagueSections),
                bagueLiaisons: clone(bagueLiaisons),
                bagueColLiaison: clone(bagueColLiaison)
            };
        }
    };
})();
