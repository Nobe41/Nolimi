// saas/features/2d/function.js
// Façade plan : lit le DOM (papier, échelle, vue dessous) + bind contrôles.
// Constantes → Plans2DRules. Rendu / caméra → canvas/2d (pas ici).

var Plans2DFeature = (function () {
    function ids() {
        return Plans2DRules.IDS;
    }

    // --- Papier (dimensions = Plans2DRules.PAPER_FORMATS uniquement) ---

    function getFormats() {
        return Plans2DRules.PAPER_FORMATS;
    }

    function getDefaultFormat() {
        return Plans2DRules.DEFAULT_PAPER_FORMAT;
    }

    function getSelectedFormat() {
        var el = document.getElementById(ids().paperFormat);
        return el && el.value ? el.value : getDefaultFormat();
    }

    // Dimensions feuille courante (mm) selon le <select> papier
    function getPaperInfo() {
        var formats = getFormats();
        return formats[getSelectedFormat()] || formats[getDefaultFormat()];
    }

    // --- Options d’affichage ---

    function getScaleValue() {
        var el = document.getElementById(ids().drawingScale);
        return el && el.value ? el.value : Plans2DRules.DEFAULT_DRAWING_SCALE;
    }

    function getScaleLabel() {
        var el = document.getElementById(ids().drawingScale);
        var def = Plans2DRules.DEFAULT_DRAWING_SCALE;
        if (!el || !el.options || el.selectedIndex < 0) return def;
        return el.options[el.selectedIndex].text || el.value || def;
    }

    // Facteur numérique pour le rendu (ex. 1:2 → 0.5)
    function getDrawingScale() {
        var factor = Plans2DRules.DRAWING_SCALE_FACTORS[getScaleValue()];
        return typeof factor === 'number' ? factor : 1;
    }

    function getShowBottomView() {
        var el = document.getElementById(ids().showBottom);
        return !!(el && el.checked);
    }

    // --- Panneau Plan → redessiner le canvas ---
    // drawFn = draw2D (canvas/2d). Cartouche inclus : tout changement relance le plan.

    function bindControlRedraw(drawFn) {
        var i = ids();
        var list = [
            i.paperFormat, i.drawingScale, i.showBottom,
            i.projectTitle, i.planNumber, i.date, i.drafter, i.checker, i.index
        ];
        for (var n = 0; n < list.length; n++) {
            var el = document.getElementById(list[n]);
            if (!el) continue;
            var ev = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
            el.addEventListener(ev, function () {
                if (typeof drawFn === 'function') drawFn();
            });
        }
    }

    return {
        getFormats: getFormats,
        getPaperInfo: getPaperInfo,
        getScaleLabel: getScaleLabel,
        getDrawingScale: getDrawingScale,
        getShowBottomView: getShowBottomView,
        bindControlRedraw: bindControlRedraw
    };
})();
