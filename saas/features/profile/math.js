// ==========================================
// GEOM KERNEL — Noyau géométrique universel (B-Rep analytique)
// Primitives : segments de droite et arcs de cercle. Algèbre 2D et congés.
// Aucune référence métier (bouteille, section, etc.). Aucune dépendance Three.js.
// ==========================================

var GeomKernel = (function () {

    // -------------------------------------------------------------------------
    // PRIMITIVES GÉOMÉTRIQUES
    // -------------------------------------------------------------------------

    function LineSegment(x1, y1, x2, y2) {
        return { type: 'line', x1: x1, y1: y1, x2: x2, y2: y2 };
    }

    function ArcSegment(cx, cy, r, startAngle, endAngle) {
        return { type: 'arc', cx: cx, cy: cy, r: r, startAngle: startAngle, endAngle: endAngle };
    }

    // -------------------------------------------------------------------------
    // ALGÈBRE VECTORIELLE 2D
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // CONGÉ : points de tangence exacts entre deux segments et arc de rayon R
    // P1 → P2 (segment 1), P2 → P3 (segment 2). Retourne { center, T1, T2, startAngle, endAngle, R } ou null.
    // -------------------------------------------------------------------------
    function computeFilletTangentPoints(P1, P2, P3, R) {
        if (R <= 0) return null;

        // Directions des segments autour du coin P2
        var v1 = normalize(sub(P1, P2)); // vers la section précédente
        var v2 = normalize(sub(P3, P2)); // vers la section suivante

        // Angle interne entre les deux segments
        var dot12 = Math.max(-1, Math.min(1, dot(v1, v2)));
        var theta = Math.acos(dot12);
        if (theta < 1e-4 || Math.abs(Math.PI - theta) < 1e-4) return null; // quasi aligné

        // Longueurs réelles disponibles de chaque côté
        var seg1Len = length(sub(P2, P1));
        var seg2Len = length(sub(P3, P2));
        if (seg1Len < 1e-6 || seg2Len < 1e-6) return null;

        // Pour un congé circulaire tangent, distance coin→tangence = R * tan(theta/2).
        // On impose que cette distance ne dépasse jamais la longueur du segment le plus court.
        var tanHalf = Math.tan(theta / 2);
        if (tanHalf < 1e-6) return null;
        var tMax = Math.min(seg1Len, seg2Len);
        var Rmax = (tMax / tanHalf) * 0.99; // marge 1 %
        if (Rmax <= 0) return null;
        if (R > Rmax) R = Rmax;

        // Reprise du calcul standard du centre et des tangences avec ce rayon bridé.
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
        var t1_param = dot(toT1, d1);
        var t2_param = dot(toT2, d2);
        var T1 = add(P1, scale(t1_param, d1));
        var T2 = add(P2, scale(t2_param, d2));

        var startAngle = Math.atan2(T1.y - C_center.y, T1.x - C_center.x);
        var endAngle = Math.atan2(T2.y - C_center.y, T2.x - C_center.x);

        return {
            center: C_center,
            T1: T1,
            T2: T2,
            startAngle: startAngle,
            endAngle: endAngle,
            R: R
        };
    }

    // -------------------------------------------------------------------------
    // PROFIL À PARTIR D'UNE POLYLIGNE ET RAYONS DE CONGÉ
    // points : [{ x, y }, ...]. edgeFilletRadii : [R0, R1, ...] pour chaque arête (0 = segment droit).
    // Un rayon > 0 donne un arc tangent (congé) entre les deux segments.
    // -------------------------------------------------------------------------
    function buildProfileFromPolyline(points, edgeFilletRadii) {
        var entities = [];
        var n = points.length;
        if (n < 2) return entities;
        edgeFilletRadii = edgeFilletRadii || [];

        var i = 0;
        var lastX = points[0].x, lastY = points[0].y;

        while (i < n - 1) {
            var pPrev = points[i];
            var pCur = points[i + 1];
            var pNext = i + 2 < n ? points[i + 2] : null;
            var R = (edgeFilletRadii[i] != null && edgeFilletRadii[i] > 0) ? edgeFilletRadii[i] : 0;

            if (R > 0 && pNext) {
                var P1 = vec2(pPrev.x, pPrev.y);
                var P2 = vec2(pCur.x, pCur.y);
                var P3 = vec2(pNext.x, pNext.y);
                var fillet = computeFilletTangentPoints(P1, P2, P3, R);
                if (fillet) {
                    entities.push(LineSegment(lastX, lastY, fillet.T1.x, fillet.T1.y));
                    entities.push(ArcSegment(fillet.center.x, fillet.center.y, fillet.R, fillet.startAngle, fillet.endAngle));
                    lastX = fillet.T2.x;
                    lastY = fillet.T2.y;
                    i += 1;
                    continue;
                }
            }
            entities.push(LineSegment(lastX, lastY, pCur.x, pCur.y));
            lastX = pCur.x;
            lastY = pCur.y;
            i += 1;
        }
        return entities;
    }

    // -------------------------------------------------------------------------
    // ÉCHANTILLONNEUR : entités → points (x, y). resolution : points par segment/arc.
    // -------------------------------------------------------------------------
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
        buildProfileFromPolyline: buildProfileFromPolyline,
        tessellateProfile: tessellateProfile,
        vec2: vec2,
        add: add,
        sub: sub,
        scale: scale,
        dot: dot,
        length: length,
        normalize: normalize,
        perpLeft: perpLeft
    };
})();

// ==========================================
// PROFILE MATHS — Assemblage métier du profil bouteille
// ==========================================
var ProfileMath = (function () {
    var K = typeof GeomKernel !== 'undefined' ? GeomKernel : null;
    var RULES = (typeof ProfileRules !== 'undefined') ? ProfileRules : {};
    var DEFAULT_SHAPE = RULES.DEFAULT_SHAPE || 'cylindrique';
    var DEFAULT_CARRE_NIVEAU = typeof RULES.DEFAULT_CARRE_NIVEAU === 'number' ? RULES.DEFAULT_CARRE_NIVEAU : 0;
    var MIN_PROFILE_RADIUS = typeof RULES.MIN_PROFILE_RADIUS === 'number' ? RULES.MIN_PROFILE_RADIUS : 0.1;

    function getEllipseRadiusAtAngle(a, b, theta) {
        var c = Math.cos(theta), s = Math.sin(theta);
        var x = a * c, z = b * s;
        return Math.sqrt(x * x + z * z);
    }

    function getRoundedRectRadius(a, b, r, theta) {
        r = Math.max(0, Math.min(r, Math.min(a, b)));
        var c = Math.cos(theta), s = Math.sin(theta);
        var x = Math.abs(c), z = Math.abs(s);
        if (x < 1e-10) return b;
        if (z < 1e-10) return a;
        var tRight = a / x;
        var tTop = b / z;
        var hitRight = (a * z / x <= b - r);
        var hitTop = (b * x / z <= a - r);
        if (r < 1e-10) return hitRight && (!hitTop || tRight <= tTop) ? tRight : tTop;
        var Cx = a - r, Cz = b - r;
        var CdotD = Cx * x + Cz * z;
        var C2 = Cx * Cx + Cz * Cz;
        var disc = CdotD * CdotD - (C2 - r * r);
        var tArc = Infinity;
        if (disc >= 0) {
            tArc = CdotD + Math.sqrt(disc);
            var px = tArc * x, pz = tArc * z;
            if (!(px >= Cx - 1e-6 && pz >= Cz - 1e-6)) tArc = Infinity;
        }
        var out = Infinity;
        if (hitRight && tRight < out) out = tRight;
        if (hitTop && tTop < out) out = tTop;
        if (tArc !== Infinity && tArc < out) out = tArc;
        return out === Infinity ? Math.min(tRight, tTop) : out;
    }

    function getSectionRadiusAtAngle(a, b, shape, carreNiveau, theta) {
        if (shape === 'carre') {
            var r = (1 - (carreNiveau || 0) / 100) * Math.min(a, b);
            return getRoundedRectRadius(a, b, r, theta);
        }
        return getEllipseRadiusAtAngle(a, b, theta);
    }

    function getSectionPointXZ(a, b, shape, carreNiveau, u) {
        var c = Math.cos(u), s = Math.sin(u);
        if (shape === 'carre') {
            var r = (1 - (carreNiveau || 0) / 100) * Math.min(a, b);
            var R = getRoundedRectRadius(a, b, r, u);
            return { x: R * c, z: R * s };
        }
        return { x: a * c, z: b * s };
    }

    function getSectionRingPoints(a, b, shape, carreNiveau, n) {
        var pts = [];
        var i, theta, R;
        if (shape === 'carre') {
            var r = (1 - (carreNiveau || 0) / 100) * Math.min(a, b);
            for (i = 0; i <= n; i++) {
                theta = (i / n) * 2 * Math.PI;
                R = getRoundedRectRadius(a, b, r, theta);
                pts.push([R * Math.cos(theta), R * Math.sin(theta)]);
            }
        } else {
            for (i = 0; i <= n; i++) {
                theta = (i / n) * 2 * Math.PI;
                pts.push([a * Math.cos(theta), b * Math.sin(theta)]);
            }
        }
        return pts;
    }

    function buildExteriorProfile(theta, sectionsData) {
        if (!K) return [];
        sectionsData = sectionsData || {};
        var sections = sectionsData.sections || [];
        if (sections.length < 2) return [];

        var rawPoints = [];
        for (var i = 0; i < sections.length; i++) {
            var s = sections[i];
            var shape = s.shape || DEFAULT_SHAPE;
            var carreNiveau = typeof s.carreNiveau === 'number' ? s.carreNiveau : DEFAULT_CARRE_NIVEAU;
            var r = getSectionRadiusAtAngle(s.a, s.b, shape, carreNiveau, theta);
            rawPoints.push({ x: Math.max(MIN_PROFILE_RADIUS, r), y: s.H });
        }

        var sectionPoints = (typeof SectionsMaths !== 'undefined' && SectionsMaths.computeSectionPoints)
            ? SectionsMaths.computeSectionPoints(rawPoints)
            : rawPoints;

        if (typeof LiaisonsFeature !== 'undefined' && LiaisonsFeature.buildProfileCurves) {
            return LiaisonsFeature.buildProfileCurves(sectionPoints, sectionsData);
        }
        return [];
    }

    function buildPuntProfile(puntData) {
        if (!K) return [];
        return [];
    }

    function buildInteriorProfile(thickness, exteriorData) {
        if (!K) return [];
        return [];
    }

    function getRuledSurfacePoint(section1, section2, u, v) {
        var p1 = getSectionPointXZ(section1.a, section1.b, section1.shape || DEFAULT_SHAPE, section1.carreNiveau || DEFAULT_CARRE_NIVEAU, u);
        var p2 = getSectionPointXZ(section2.a, section2.b, section2.shape || DEFAULT_SHAPE, section2.carreNiveau || DEFAULT_CARRE_NIVEAU, u);
        return {
            x: (1 - v) * p1.x + v * p2.x,
            y: (1 - v) * section1.H + v * section2.H,
            z: (1 - v) * p1.z + v * p2.z
        };
    }

    function getRadialBandPoint(section1, section2, H, u, v) {
        var p1 = getSectionPointXZ(section1.a, section1.b, section1.shape || DEFAULT_SHAPE, section1.carreNiveau || DEFAULT_CARRE_NIVEAU, u);
        var p2 = getSectionPointXZ(section2.a, section2.b, section2.shape || DEFAULT_SHAPE, section2.carreNiveau || DEFAULT_CARRE_NIVEAU, u);
        return {
            x: (1 - v) * p1.x + v * p2.x,
            y: H,
            z: (1 - v) * p1.z + v * p2.z
        };
    }

    function getConeToApexPoint(section, topH, u, v) {
        var p = getSectionPointXZ(section.a, section.b, section.shape || DEFAULT_SHAPE, section.carreNiveau || DEFAULT_CARRE_NIVEAU, u);
        return {
            x: (1 - v) * p.x,
            y: (1 - v) * section.H + v * topH,
            z: (1 - v) * p.z
        };
    }

    /** Rayon méridien (x du profil) à une hauteur y sur un profil tessellé. */
    function radiusFromTessellatedProfile(profile, y) {
        if (!profile || !profile.length) return MIN_PROFILE_RADIUS;
        var nearest = profile[0];
        var nearestDy = Math.abs(nearest.y - y);
        for (var i = 0; i < profile.length - 1; i++) {
            var p0 = profile[i];
            var p1 = profile[i + 1];
            var minY = Math.min(p0.y, p1.y);
            var maxY = Math.max(p0.y, p1.y);
            var d0 = Math.abs(p0.y - y);
            if (d0 < nearestDy) {
                nearestDy = d0;
                nearest = p0;
            }
            if (y < minY || y > maxY) continue;
            var dy = p1.y - p0.y;
            if (Math.abs(dy) < 1e-9) return Math.max(MIN_PROFILE_RADIUS, p0.x);
            var t = (y - p0.y) / dy;
            return Math.max(MIN_PROFILE_RADIUS, p0.x + (p1.x - p0.x) * t);
        }
        return Math.max(MIN_PROFILE_RADIUS, nearest.x);
    }

    /**
     * Échantillonneur du rayon extérieur (y, theta) incluant courbes de liaison (S, rayon, spline).
     * Utilisé par les feuilles 3D et la gravure pour coller au corps réel.
     */
    function createExteriorRadiusSampler(sectionsData) {
        sectionsData = sectionsData || {};
        var sections = sectionsData.sections || [];
        var canUseProfile = K && sections.length >= 2
            && sectionsData.edgeTypes && sectionsData.rhos
            && typeof LiaisonsFeature !== 'undefined' && LiaisonsFeature.buildProfileCurves;
        var cache = {};

        function radiusFromSections(y, theta) {
            if (!sections.length) return MIN_PROFILE_RADIUS;
            var sec = sections[0];
            for (var i = 0; i < sections.length - 1; i++) {
                if (y >= sections[i].H && y <= sections[i + 1].H) {
                    var t = (sections[i + 1].H - sections[i].H) < 1e-9
                        ? 0
                        : (y - sections[i].H) / (sections[i + 1].H - sections[i].H);
                    var a = sections[i].a + t * (sections[i + 1].a - sections[i].a);
                    var b = sections[i].b + t * (sections[i + 1].b - sections[i].b);
                    var shape = sections[i + 1].shape || sections[i].shape || DEFAULT_SHAPE;
                    var carre = sections[i + 1].carreNiveau != null ? sections[i + 1].carreNiveau : (sections[i].carreNiveau || DEFAULT_CARRE_NIVEAU);
                    return getSectionRadiusAtAngle(a, b, shape, carre, theta);
                }
                if (y < sections[i].H) break;
                sec = sections[i + 1];
            }
            var shapeLast = sec.shape || DEFAULT_SHAPE;
            var carreLast = typeof sec.carreNiveau === 'number' ? sec.carreNiveau : DEFAULT_CARRE_NIVEAU;
            return getSectionRadiusAtAngle(sec.a, sec.b, shapeLast, carreLast, theta);
        }

        return function (y, theta) {
            if (!canUseProfile) return radiusFromSections(y, theta);
            var key = String(Math.round(theta * 10000) / 10000);
            if (!cache[key]) {
                var entities = buildExteriorProfile(theta, sectionsData);
                cache[key] = K.tessellateProfile(entities, 48) || [];
            }
            var profile = cache[key];
            if (!profile.length) return radiusFromSections(y, theta);
            return radiusFromTessellatedProfile(profile, y);
        };
    }

    return {
        getSectionRadiusAtAngle: getSectionRadiusAtAngle,
        getSectionRingPoints: getSectionRingPoints,
        buildExteriorProfile: buildExteriorProfile,
        buildPuntProfile: buildPuntProfile,
        buildInteriorProfile: buildInteriorProfile,
        getRuledSurfacePoint: getRuledSurfacePoint,
        getRadialBandPoint: getRadialBandPoint,
        getConeToApexPoint: getConeToApexPoint,
        createExteriorRadiusSampler: createExteriorRadiusSampler
    };
})();
