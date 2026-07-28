// 01-saas/features/rattachement/sliderLimits.js
// Indicateur UI : marque une carte « courbe S impossible » (classe CSS courbe-s-impossible).
// Lit les champs DOM des sections ; les bornes min/max du slider rho sont dans layout/function.js.
// Appelé par le store/validator via applyRhoMinConstraints.

var SliderLimits = (function () {
    var R = typeof RattachementRules !== 'undefined' ? RattachementRules : {};

    function getNumberValue(id, fallback) {
        var el = document.getElementById(id);
        if (!el) return fallback;
        var v = parseFloat(el.value);
        return isFinite(v) ? v : fallback;
    }

    function getSectionPoint(sectionIndex) {
        var H = getNumberValue('s' + sectionIndex + '-h', 0);
        var L = getNumberValue('s' + sectionIndex + '-L', 0);
        return { x: Math.max(0, L / 2), y: H };
    }

    function mainSectionCount() {
        var n = 0;
        while (document.getElementById('s' + (n + 1) + '-h')) n += 1;
        return n;
    }

    function forEachMainRattachement(fn) {
        var n = mainSectionCount();
        for (var si = 1; si < n; si++) {
            var id = 'r' + si + (si + 1);
            if (!document.getElementById(id + '-type')) continue;
            fn({ id: id, fromSection: si, toSection: si + 1 });
        }
    }

    // Parcourt chaque rattachement principal et ajoute/retire la classe si rho max < min géométrique
    function updateCourbeSValidityIndicator() {
        var factor = R.COURBE_S_MIN_RADIUS_FACTOR != null ? R.COURBE_S_MIN_RADIUS_FACTOR : 0.5;
        forEachMainRattachement(function (cfg) {
            var typeSelect = document.getElementById(cfg.id + '-type');
            var inputEl = document.getElementById(cfg.id + '-rho');
            var card = inputEl ? inputEl.closest('.setting-card') : null;
            if (!card) return;
            if (!typeSelect || typeSelect.value !== 'courbeS') {
                card.classList.remove('courbe-s-impossible');
                return;
            }
            var p0 = getSectionPoint(cfg.fromSection);
            var p1 = getSectionPoint(cfg.toSection);
            var d = Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2));
            var minR_S = d * factor;
            var inputMax = inputEl && isFinite(parseFloat(inputEl.max)) ? parseFloat(inputEl.max) : 0;
            if (inputMax < minR_S) card.classList.add('courbe-s-impossible');
            else card.classList.remove('courbe-s-impossible');
        });
    }

    // Point d'entrée externe : recalcule uniquement l'indicateur visuel (pas les bornes du slider)
    function applyRhoMinConstraints() {
        updateCourbeSValidityIndicator();
    }

    return {
        applyRhoMinConstraints: applyRhoMinConstraints
    };
})();
