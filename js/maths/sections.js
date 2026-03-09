// js/maths/sections.js
// Points de section pour le profil méridien (CAO bouteille).
// Garantit une hauteur (Y) monotone croissante pour éviter profils invalides.

var SectionsMaths = (function () {
    var EPS = 1e-9;
    var MIN_RADIUS = 0;

    /**
     * Sanitise les points de profil méridien : (x = rayon, y = hauteur).
     * Règle : Y(n+1) >= Y(n). Les x sont bornés à MIN_RADIUS si invalides.
     * @param {Array<{x: number, y: number}>} dataPoints - Points bruts (rayon, hauteur)
     * @returns {Array<{x: number, y: number}>} Points avec Y monotone, prêts pour B-Rep
     */
    function computeSectionPoints(dataPoints) {
        if (!dataPoints || dataPoints.length === 0) return [];

        var points = [];
        var n = dataPoints.length;
        var lastY = -Infinity;
        var i, p, x, y;

        for (i = 0; i < n; i++) {
            p = dataPoints[i];
            x = typeof p.x === 'number' && isFinite(p.x) ? Math.max(MIN_RADIUS, p.x) : MIN_RADIUS;
            y = typeof p.y === 'number' && isFinite(p.y) ? p.y : lastY;
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
