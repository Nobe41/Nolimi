// ==========================================
// BOTTLE MATHS — Constructeur de profil bouteille (métier)
// Utilise GeomKernel pour générer contours en segments et arcs uniquement.
// Aucune dépendance Three.js.
// ==========================================

var BottleMaths = (function () {
    var K = typeof GeomKernel !== 'undefined' ? GeomKernel : null;

    // -------------------------------------------------------------------------
    // RAYON D'UNE SECTION À UN ANGLE (plan horizontal : ellipse ou rectangle arrondi)
    // -------------------------------------------------------------------------

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
        if (r < 1e-10) {
            return hitRight && (!hitTop || tRight <= tTop) ? tRight : tTop;
        }
        var Cx = a - r, Cz = b - r;
        var CdotD = Cx * x + Cz * z;
        var C2 = Cx * Cx + Cz * Cz;
        var disc = CdotD * CdotD - (C2 - r * r);
        var tArc = Infinity;
        if (disc >= 0) {
            tArc = CdotD + Math.sqrt(disc);
            var px = tArc * x, pz = tArc * z;
            if (px >= Cx - 1e-6 && pz >= Cz - 1e-6) { } else tArc = Infinity;
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

    /**
     * Point (x, z) sur le contour de la section au paramètre u in [0, 2*PI].
     * Ellipse : (a*cos(u), b*sin(u)). Carré arrondi : (R(u)*cos(u), R(u)*sin(u)).
     */
    function getSectionPointXZ(a, b, shape, carreNiveau, u) {
        var c = Math.cos(u), s = Math.sin(u);
        if (shape === 'carre') {
            var r = (1 - (carreNiveau || 0) / 100) * Math.min(a, b);
            var R = getRoundedRectRadius(a, b, r, u);
            return { x: R * c, z: R * s };
        }
        return { x: a * c, z: b * s };
    }

    // -------------------------------------------------------------------------
    // POINTS DU CONTOUR D'UNE SECTION (anneau horizontal) : [[x, z], ...]
    // Pour l'affichage des cercles/ellipses de section.
    // -------------------------------------------------------------------------
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

    /**
     * Contour extérieur : entités B-Rep (segments et arcs) pour un méridien à l'angle theta.
     * sectionsData = { sections: [...], edgeTypes: ['ligne'|'courbe', ...], rhos: [R12, R23, ...] }
     * courbe = 1 arc tangent (congé) avec le rayon rho.
     */
    function buildExteriorProfile(theta, sectionsData) {
        if (!K) return [];
        sectionsData = sectionsData || {};
        var sections = sectionsData.sections || [];
        if (sections.length < 2) return [];

        // 1) Calcul des points bruts de section pour ce méridien (rayon en fonction de theta).
        var rawPoints = [];
        for (var i = 0; i < sections.length; i++) {
            var s = sections[i];
            var r = getSectionRadiusAtAngle(s.a, s.b, s.shape || 'rond', s.carreNiveau || 0, theta);
            rawPoints.push({ x: Math.max(0.1, r), y: s.H });
        }

        // 2) Application des règles de sécurité sur les hauteurs (Y(n+1) >= Y(n)).
        var sectionPoints = (typeof SectionsMaths !== 'undefined' && SectionsMaths.computeSectionPoints)
            ? SectionsMaths.computeSectionPoints(rawPoints)
            : rawPoints;

        // 3) Construction des liaisons (segments + congés circulaires bridés) via GeomKernel.
        if (typeof RattachementsMaths !== 'undefined' && RattachementsMaths.buildProfileCurves) {
            return RattachementsMaths.buildProfileCurves(sectionPoints, sectionsData);
        } else {
            // Fallback : comportement historique si les modules ne sont pas chargés.
            var edgeTypes = sectionsData.edgeTypes || [];
            var rhos = sectionsData.rhos || [];
            var edgeFilletRadii = [];
            for (var j = 0; j < sectionPoints.length - 1; j++) {
                edgeFilletRadii.push((edgeTypes[j] === 'courbe' && rhos[j] > 0) ? rhos[j] : 0);
            }
            return K.buildProfileFromPolyline(sectionPoints, edgeFilletRadii);
        }
    }

    /**
     * Profil de la piqûre (fond). Utilise le kernel. Pour l'instant vide.
     */
    function buildPuntProfile(puntData) {
        if (!K) return [];
        // TODO: construire entités (segments + arcs) à partir de puntData
        return [];
    }

    /**
     * Profil intérieur (épaisseur de paroi). Utilise le kernel. Pour l'instant vide.
     */
    function buildInteriorProfile(thickness, exteriorData) {
        if (!K) return [];
        // TODO: déduire contour intérieur à partir de exteriorData et thickness
        return [];
    }

    // -------------------------------------------------------------------------
    // SURFACES PARAMÉTRIQUES EXACTES (feuilles CAO)
    // section = { H, a, b, shape, carreNiveau }
    // u = angle [0, 2*PI], v = paramètre [0, 1]
    // -------------------------------------------------------------------------

    /**
     * Surface réglée entre deux sections (équation exacte).
     * S(u,v) = (1-v)*C1(u) + v*C2(u), Ci(u) = (xi(u), Hi, zi(u)) avec (xi,zi) sur le contour.
     * Retourne { x, y, z } en mm.
     */
    function getRuledSurfacePoint(section1, section2, u, v) {
        var p1 = getSectionPointXZ(section1.a, section1.b, section1.shape || 'rond', section1.carreNiveau || 0, u);
        var p2 = getSectionPointXZ(section2.a, section2.b, section2.shape || 'rond', section2.carreNiveau || 0, u);
        return {
            x: (1 - v) * p1.x + v * p2.x,
            y: (1 - v) * section1.H + v * section2.H,
            z: (1 - v) * p1.z + v * p2.z
        };
    }

    /**
     * Bande radiale horizontale entre deux contours à la même hauteur H (équation exacte).
     * S(u,v) = ((1-v)*p1(u) + v*p2(u), H) en (x,z).
     */
    function getRadialBandPoint(section1, section2, H, u, v) {
        var p1 = getSectionPointXZ(section1.a, section1.b, section1.shape || 'rond', section1.carreNiveau || 0, u);
        var p2 = getSectionPointXZ(section2.a, section2.b, section2.shape || 'rond', section2.carreNiveau || 0, u);
        return {
            x: (1 - v) * p1.x + v * p2.x,
            y: H,
            z: (1 - v) * p1.z + v * p2.z
        };
    }

    /**
     * Cône (surface réglée) de la section vers l'apex (0, topH, 0) (équation exacte).
     * S(u,v) = (1-v)*C(u) + v*Apex.
     */
    function getConeToApexPoint(section, topH, u, v) {
        var p = getSectionPointXZ(section.a, section.b, section.shape || 'rond', section.carreNiveau || 0, u);
        return {
            x: (1 - v) * p.x,
            y: (1 - v) * section.H + v * topH,
            z: (1 - v) * p.z
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
        getConeToApexPoint: getConeToApexPoint
    };
})();
