// saas/features/sections/math.js
// Nettoyage des points du profil méridien (avant construction géométrique).
//
// Entrée  : [{ x: rayon_mm, y: hauteur_mm }, …]
// Sortie  : mêmes points, avec :
//   - x ≥ MIN_PROFILE_RADIUS (pas de rayon négatif)
//   - y monotone non décroissant (évite les plis du profil)
//
// Consommé par ProfileMath.buildExteriorProfile (features/profile/math.js).

var SectionsMaths = (function () {
    var R = typeof SectionsRules !== 'undefined' ? SectionsRules : {};
    var MIN_RADIUS = R.MIN_PROFILE_RADIUS != null ? R.MIN_PROFILE_RADIUS : 0;

    function computeSectionPoints(dataPoints) {
        if (!dataPoints || dataPoints.length === 0) return [];

        var points = [];
        var lastY = -Infinity;

        for (var i = 0; i < dataPoints.length; i++) {
            var p = dataPoints[i];
            // x = rayon horizontal du profil
            var x = typeof p.x === 'number' && isFinite(p.x) ? Math.max(MIN_RADIUS, p.x) : MIN_RADIUS;
            // y = hauteur le long de l’axe de la bouteille
            var y = typeof p.y === 'number' && isFinite(p.y) ? p.y : lastY;
            if (y < lastY) y = lastY;
            lastY = y;
            points.push({ x: x, y: y });
        }
        return points;
    }

    return {
        computeSectionPoints: computeSectionPoints
    };
})();
