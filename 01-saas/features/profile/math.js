// 01-saas/features/profile/math.js
// ProfileMath = géométrie métier du profil bouteille (sections → méridien 2D, surfaces 3D).
// GeomKernel (kernel.js) = primitives 2D. LiaisonsFeature = raccords entre sections (ligne/rayon/courbeS/spline).
// Constantes → ProfileRules. Point d'entrée stable pour le reste de l'app → BottleMaths (function.js).

var ProfileMath = (function () {
    var K = typeof GeomKernel !== 'undefined' ? GeomKernel : null;
    var RULES = (typeof ProfileRules !== 'undefined') ? ProfileRules : {};
    var DEFAULT_SHAPE = RULES.DEFAULT_SHAPE || 'cylindrique';
    var DEFAULT_CARRE_NIVEAU = typeof RULES.DEFAULT_CARRE_NIVEAU === 'number' ? RULES.DEFAULT_CARRE_NIVEAU : 0;
    var MIN_PROFILE_RADIUS = typeof RULES.MIN_PROFILE_RADIUS === 'number' ? RULES.MIN_PROFILE_RADIUS : 0.1;
    var SAMPLER_RES = typeof RULES.SAMPLER_TESSELLATION_RES === 'number' ? RULES.SAMPLER_TESSELLATION_RES : 48;

    // Rayon d'une section elliptique à l'angle theta (distance origine → contour).
    function getEllipseRadiusAtAngle(a, b, theta) {
        var c = Math.cos(theta), s = Math.sin(theta);
        var x = a * c, z = b * s;
        return Math.sqrt(x * x + z * z);
    }

    // Rayon d'une section carrée/rectangulaire avec coins arrondis (carreNiveau = % d'arrondi).
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

    // Choix ellipse vs rectangle arrondi selon shape et carreNiveau.
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

    // Profil extérieur 2D pour un angle theta : points (rayon, hauteur) + liaisons via LiaisonsFeature.
    function buildExteriorProfile(theta, sectionsData) {
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

        // Délégation aux raccords (ligne / rayon / courbeS / spline) → rattachement/function.js
        if (typeof LiaisonsFeature !== 'undefined' && LiaisonsFeature.buildProfileCurves) {
            return LiaisonsFeature.buildProfileCurves(sectionPoints, sectionsData);
        }
        return [];
    }

    // Surface réglée entre deux sections : interpolation linéaire en u (angle) et v (hauteur).
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

    // Sampler (y, theta) → rayon extérieur ; cache le profil tessellé par theta pour la 3D / gravure.
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
                cache[key] = K.tessellateProfile(entities, SAMPLER_RES) || [];
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
        getRuledSurfacePoint: getRuledSurfacePoint,
        getRadialBandPoint: getRadialBandPoint,
        getConeToApexPoint: getConeToApexPoint,
        createExteriorRadiusSampler: createExteriorRadiusSampler
    };
})();
