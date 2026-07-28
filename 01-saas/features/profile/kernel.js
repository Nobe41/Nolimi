// 01-saas/features/profile/kernel.js
// GeomKernel = primitives géométriques 2D (segments droits + arcs de cercle).
// Couche bas niveau réutilisable : pas de notion bouteille, pas de Three.js.
// Consommé par ProfileMath et RattachementMath pour construire puis tesseller des profils.

var GeomKernel = (function () {
    // --- Primitives : objets { type: 'line' | 'arc', ... } ---
    function LineSegment(x1, y1, x2, y2) {
        return { type: 'line', x1: x1, y1: y1, x2: x2, y2: y2 };
    }

    function ArcSegment(cx, cy, r, startAngle, endAngle) {
        return { type: 'arc', cx: cx, cy: cy, r: r, startAngle: startAngle, endAngle: endAngle };
    }

    function vec2(x, y) { return { x: x, y: y }; }
    function add(u, v) { return vec2(u.x + v.x, u.y + v.y); }
    function sub(u, v) { return vec2(u.x - v.x, u.y - v.y); }
    function scale(s, v) { return vec2(s * v.x, s * v.y); }
    function dot(u, v) { return u.x * v.x + u.y * v.y; }
    function length(v) { return Math.sqrt(v.x * v.x + v.y * v.y); }
    function normalize(v) {
        var L = length(v);
        if (L < 1e-12) return v;
        return scale(1 / L, v);
    }
    function perpLeft(v) { return vec2(-v.y, v.x); }

    // Congé circulaire (fillet) tangent à deux segments qui se rencontrent en P2.
    // Retourne centre, points tangents T1/T2 et angles d'arc ; null si angle ou rayon impossible.
    function computeFilletTangentPoints(P1, P2, P3, R) {
        if (R <= 0) return null;

        var v1 = normalize(sub(P1, P2));
        var v2 = normalize(sub(P3, P2));

        var dot12 = Math.max(-1, Math.min(1, dot(v1, v2)));
        var theta = Math.acos(dot12);
        if (theta < 1e-4 || Math.abs(Math.PI - theta) < 1e-4) return null;

        var seg1Len = length(sub(P2, P1));
        var seg2Len = length(sub(P3, P2));
        if (seg1Len < 1e-6 || seg2Len < 1e-6) return null;

        var tanHalf = Math.tan(theta / 2);
        if (tanHalf < 1e-6) return null;
        var tMax = Math.min(seg1Len, seg2Len);
        var Rmax = (tMax / tanHalf) * 0.99;
        if (Rmax <= 0) return null;
        if (R > Rmax) R = Rmax;

        var d1 = normalize(sub(P2, P1));
        var d2 = normalize(sub(P3, P2));
        var n1 = perpLeft(d1);
        var n2 = perpLeft(d2);

        var rhs = scale(R, sub(n1, n2));
        var dp = sub(P2, P1);
        var A = -d1.x, B = d2.x, C = rhs.x - dp.x;
        var D = -d1.y, E = d2.y, F = rhs.y - dp.y;
        var det = A * E - B * D;
        if (Math.abs(det) < 1e-12) return null;
        var t1 = (C * E - B * F) / det;
        var t2 = (A * F - C * D) / det;
        var C_center = add(add(P1, scale(t1, d1)), scale(R, n1));

        var toT1 = sub(C_center, P1);
        var toT2 = sub(C_center, P2);
        var T1 = add(P1, scale(dot(toT1, d1), d1));
        var T2 = add(P2, scale(dot(toT2, d2), d2));

        return {
            center: C_center,
            T1: T1,
            T2: T2,
            startAngle: Math.atan2(T1.y - C_center.y, T1.x - C_center.x),
            endAngle: Math.atan2(T2.y - C_center.y, T2.x - C_center.x),
            R: R
        };
    }

    // Convertit une liste d'entités line/arc en polyline de points { x, y } pour affichage ou sampler.
    function tessellateProfile(entities, resolution) {
        resolution = Math.max(2, resolution || 32);
        var points = [];
        var i, j, t, dx, dy, angle, da, k, numArc;

        for (i = 0; i < entities.length; i++) {
            var e = entities[i];
            if (e.type === 'line') {
                dx = e.x2 - e.x1;
                dy = e.y2 - e.y1;
                for (j = 0; j < resolution; j++) {
                    t = j / (resolution - 1);
                    if (j === 0 && points.length > 0) {
                        var last = points[points.length - 1];
                        if (Math.abs(last.x - e.x1) < 1e-9 && Math.abs(last.y - e.y1) < 1e-9) continue;
                    }
                    points.push({ x: e.x1 + t * dx, y: e.y1 + t * dy });
                }
            } else if (e.type === 'arc') {
                da = e.endAngle - e.startAngle;
                if (da > Math.PI) da -= 2 * Math.PI;
                if (da < -Math.PI) da += 2 * Math.PI;
                numArc = Math.max(2, Math.ceil(Math.abs(da) / (2 * Math.PI) * resolution * 4));
                for (k = 0; k < numArc; k++) {
                    t = k / (numArc - 1);
                    angle = e.startAngle + t * (e.endAngle - e.startAngle);
                    points.push({
                        x: e.cx + e.r * Math.cos(angle),
                        y: e.cy + e.r * Math.sin(angle)
                    });
                }
            }
        }
        return points;
    }

    return {
        LineSegment: LineSegment,
        ArcSegment: ArcSegment,
        computeFilletTangentPoints: computeFilletTangentPoints,
        tessellateProfile: tessellateProfile,
        vec2: vec2
    };
})();
