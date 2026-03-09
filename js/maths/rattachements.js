// js/maths/rattachements.js
// Construction des liaisons (segments + arcs) du profil 2D entre sections.
// Types : 'ligne' (segment), 'courbe' (arc simple), 'courbeS' (deux arcs opposés = S).

var RattachementsMaths = (function () {
    var K = (typeof GeomKernel !== 'undefined') ? GeomKernel : null;

    function createArcBetweenPoints(P0, P1, R, normalSign) {
        var dx = P1.x - P0.x;
        var dy = P1.y - P0.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1e-6) return null;

        var minR = d * 0.5;
        var usedR = R > 0 ? R : minR;
        if (usedR < minR) usedR = minR * 1.001;

        var mx = (P0.x + P1.x) * 0.5;
        var my = (P0.y + P1.y) * 0.5;
        var nx = -dy / d;
        var ny = dx / d;
        if (normalSign < 0) { nx = -nx; ny = -ny; }

        var halfChord = d * 0.5;
        var h2 = usedR * usedR - halfChord * halfChord;
        if (h2 < 0) h2 = 0;
        var h = Math.sqrt(h2);

        var cx = mx + nx * h;
        var cy = my + ny * h;

        var startAngle = Math.atan2(P0.y - cy, P0.x - cx);
        var endAngle = Math.atan2(P1.y - cy, P1.x - cx);

        return K.ArcSegment(cx, cy, usedR, startAngle, endAngle);
    }

    /**
     * Construit les entités B-Rep (segments + arcs) du profil à partir des points de section.
     * sectionPoints : [{ x, y }, ...]
     * data.edgeTypes : ['ligne'|'courbe'|'courbeS', ...]
     * data.rhos : [R12, R23, ...]
     *
     * - 'ligne'   : segment direct entre les deux sections.
     * - 'courbe'  : un arc unique entre les deux sections (ne dépasse pas les sections).
     * - 'courbeS' : deux arcs successifs de part et d'autre de la droite (profil en S).
     */
    function buildProfileCurves(sectionPoints, data) {
        if (!K) return [];
        var points = sectionPoints || [];
        if (points.length < 2) return [];
        data = data || {};
        var edgeTypes = data.edgeTypes || [];
        var rhos = data.rhos || [];

        var entities = [];
        for (var i = 0; i < points.length - 1; i++) {
            var P0 = points[i];
            var P1 = points[i + 1];
            var type = edgeTypes[i] || 'ligne';
            var R = rhos[i] || 0;

            if (type === 'courbe' && R > 0) {
                var arc = createArcBetweenPoints(P0, P1, R, 1);
                if (arc) {
                    entities.push(arc);
                } else {
                    entities.push(K.LineSegment(P0.x, P0.y, P1.x, P1.y));
                }
            } else if (type === 'courbeS' && R > 0) {
                var mid = { x: (P0.x + P1.x) * 0.5, y: (P0.y + P1.y) * 0.5 };
                var Rhalf = R * 0.5;
                var arc1 = createArcBetweenPoints(P0, mid, Rhalf, 1);
                var arc2 = createArcBetweenPoints(mid, P1, Rhalf, -1);
                if (arc1 && arc2) {
                    entities.push(arc1);
                    entities.push(arc2);
                } else {
                    entities.push(K.LineSegment(P0.x, P0.y, P1.x, P1.y));
                }
            } else {
                entities.push(K.LineSegment(P0.x, P0.y, P1.x, P1.y));
            }
        }
        return entities;
    }

    return {
        buildProfileCurves: buildProfileCurves
    };
})();

