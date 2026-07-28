// saas/features/2d/cotation.js
// Libellés de cotation du plan (Ø, R, courbe S…).
// Le tracé des cotes est dans canvas/2d/tools.js.
//
// L = diamètre section, P = profondeur (ovale). Égal → cylindrique → préfixe Ø.

var Plans2DCotation = (function () {
    function formatValue(v) {
        return Number.isInteger(v) ? v : v.toFixed(1);
    }

    // Cylindrique si L ≈ P (tolérance 0,05 mm)
    function isSectionRound(L, P) {
        if (!Number.isFinite(L) || !Number.isFinite(P)) return true;
        return Math.abs(L - P) < 0.05;
    }

    // Texte cote diamètre : « Ø 71 » ou valeur seule si ovale
    function getDiameterLabel(L, P, diameter) {
        var text = formatValue(diameter);
        return isSectionRound(L, P) ? ('Ø ' + text) : text;
    }

    // rattId = ex. r12 (liaison s1→s2) : lit {id}-type et {id}-rho
    function getRattachementLabel(rattId) {
        var typeEl = document.getElementById(rattId + '-type');
        var rhoEl = document.getElementById(rattId + '-rho');
        var type = typeEl ? String(typeEl.value || '').trim() : '';
        var rho = rhoEl ? parseFloat(rhoEl.value) : NaN;
        var hasRho = Number.isFinite(rho) && rho > 0;

        if (type === 'ligne') return null;
        if (type === 'rayon') return hasRho ? ('R ' + formatValue(rho)) : null;
        if (type === 'courbeS') return hasRho ? ('Courbe S R ' + formatValue(rho)) : 'Courbe S';
        if (type === 'spline') return hasRho ? ('Spline R ' + formatValue(Math.abs(rho))) : 'Spline';
        return hasRho ? ('R ' + formatValue(rho)) : 'Raccord';
    }

    return {
        formatValue: formatValue,
        getDiameterLabel: getDiameterLabel,
        getRattachementLabel: getRattachementLabel
    };
})();
