// saas/features/2d/rules.js
// Source UNIQUE des constantes du plan (papier, styles, IDs panneau, échelles).
// Pas de logique. Ne pas recopier PAPER_FORMATS / DRAW_STYLE ailleurs
// (canvas/2d lit ici via Plans2DFeature ou Plans2DRules).

var Plans2DRules = (function () {
    return {
        // IDs du panneau « Plan » (inspector)
        IDS: {
            paperFormat: 'paper-format-select',
            drawingScale: 'drawing-scale-select',
            showBottom: 'cb-vue-dessous',
            projectTitle: 'cartouche-title',
            planNumber: 'cartouche-plan-number',
            date: 'cartouche-date',
            drafter: 'cartouche-drafter',
            checker: 'cartouche-checker',
            index: 'cartouche-index'
        },

        // Formats feuille (mm) — portrait (_P) / paysage (_L)
        PAPER_FORMATS: {
            A4_P: { w: 210, h: 297 },
            A4_L: { w: 297, h: 210 },
            A3_P: { w: 297, h: 420 },
            A3_L: { w: 420, h: 297 },
            A2_P: { w: 420, h: 594 },
            A2_L: { w: 594, h: 420 }
        },
        DEFAULT_PAPER_FORMAT: 'A2_P',
        DEFAULT_DRAWING_SCALE: '1:1',

        // Valeur <select> → facteur géométrique du dessin (1:2 = moitié taille réelle)
        DRAWING_SCALE_FACTORS: {
            '1:1': 1,
            '1:2': 0.5,
            '1:5': 0.2,
            '2:1': 2
        },

        // Logo cartouche (chemin relatif depuis saas/app.html)
        CARTOUCHE_LOGO_SRC: '../assets/brand/nolimi-logo-cartouche.png',

        // Grille cartouche
        CARTOUCHE_COLS: 4,
        CARTOUCHE_FULL_ROWS: 5,

        // Styles canvas (mm sauf font* en px) — consommé par canvas/2d/render.js et cartouche.js
        DRAW_STYLE: {
            // Marge feuille, cadre, ombre
            page: {
                margin: 10,
                frameLineWidth: 0.5,
                shadow: { color: 'rgba(0, 0, 0, 0.2)', blur: 12, offsetX: 0, offsetY: 0 }
            },
            // Profil bouteille : traits visibles / cachés (vue dessous)
            mainView: {
                liftY: 20,
                strokeVisibleMm: 0.6,
                strokeHiddenMm: 0.25,
                hiddenDashMm: [6, 3]
            },
            // Grille cartouche (référence A4_P pour proportions)
            cartouche: {
                referenceFormat: 'A4_P',
                rowHeight: 13,
                unitRowFactor: 0.5,
                labelPadding: 1.2,
                labelPaddingY: 1,
                valueOffsetY: 1.2,
                fontLabel: '2px Arial',
                fontValue: '4.5px Arial',
                fontBrand: '9px Arial',
                fontUnit: '3.5px Arial'
            },
            // Flèches et textes de cote (canvas/2d/tools.js)
            cotation: {
                strokeColor: '#000000',
                fillColor: '#000000',
                lineWidthFactor: 0.15,
                textFontPx: 3
            }
        }
    };
})();
