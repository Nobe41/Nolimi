// Règles et valeurs par défaut des sections (sans logique d'affichage).
var SectionsRules = (function () {
    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    var selectProfilOptions = ''
        + '<option value="ligne">Ligne</option>'
        + '<option value="courbeS">Courbe S</option>'
        + '<option value="rayon">Rayon</option>'
        + '<option value="spline">Spline</option>';

    var selectFormeOptions = '<option value="rond">Rond (actuel)</option><option value="carre">Carré</option>';

    var mainSections = [
        { label: 'Pied', h: 0, hMin: 0, hMax: 80, L: 70, P: 70, LMin: 40, LMax: 120, step: 0.5, hStep: 0.5 },
        { label: 'Corps', h: 15, hMin: 0, hMax: 350, L: 78.5, P: 78.5, LMin: 40, LMax: 120, step: 0.5, hStep: 1 },
        { label: 'Épaule', h: 180, hMin: 0, hMax: 350, L: 78.5, P: 78.5, LMin: 20, LMax: 120, step: 0.5, hStep: 0.5 },
        { label: 'Bas col', h: 225, hMin: 20, hMax: 350, L: 30, P: 30, LMin: 20, LMax: 70, step: 0.5, hStep: 1 },
        { label: 'Col', h: 282, hMin: 0, hMax: 350, L: 26, P: 26, LMin: 20, LMax: 50, step: 0.1, hStep: 0.5 }
    ];

    var mainLiaisons = [
        { rho: 5, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 },
        { rho: 40, rhoMin: 5, rhoMax: 400, rhoStep: 1 },
        { rho: 24, rhoMin: 0, rhoMax: 400, rhoStep: 0.5, type: 'courbeS' },
        { rho: 20, rhoMin: 5, rhoMax: 400, rhoStep: 1 }
    ];

    var piqureSections = [
        { key: 'sp', label: 'Piqûre', hasHeight: false, L: 55, P: 55, LMin: 10, LMax: 120, step: 0.5 },
        { key: 'sp2', label: 'Bas piqûre', hasHeight: true, h: 6, hMin: 0, hMax: 80, hStep: 0.5, L: 45, P: 45, LMin: 10, LMax: 120, step: 0.5 },
        { key: 'sp3', label: 'Haut piqûre', hasHeight: true, h: 24, hMin: 0, hMax: 80, hStep: 0.5, L: 28, P: 28, LMin: 10, LMax: 120, step: 0.5 }
    ];

    var piqureLiaisons = [
        { id: 'rp1', rho: 5, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 },
        { id: 'rp2', rho: 5, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 }
    ];

    var bagueSections = [
        { key: 'sb1', label: 'Bas bague', h: 284, hMin: 0, hMax: 400, hStep: 0.5, L: 29.5, P: 29.5, LMin: 10, LMax: 120, step: 0.5 },
        { key: 'sb2', label: 'Haut bague', h: 298.5, hMin: 0, hMax: 400, hStep: 0.5, L: 29.5, P: 29.5, LMin: 10, LMax: 120, step: 0.5 },
        { key: 'sb3', label: 'Haut bague', h: 300, hMin: 0, hMax: 400, hStep: 0.5, L: 25.5, P: 25.5, LMin: 10, LMax: 120, step: 0.5 }
    ];

    var bagueLiaisons = [
        { id: 'rb1', rho: 5, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 },
        { id: 'rb2', rho: 5, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 }
    ];

    return {
        selectProfilOptions: selectProfilOptions,
        selectFormeOptions: selectFormeOptions,
        createInitialState: function () {
            return {
                sectionsMain: clone(mainSections),
                liaisonsMain: clone(mainLiaisons),
                piqureSections: clone(piqureSections),
                piqureLiaisons: clone(piqureLiaisons),
                bagueSections: clone(bagueSections),
                bagueLiaisons: clone(bagueLiaisons)
            };
        }
    };
})();
