// saas/features/2d/data.js
// Profils bouteille pour le plan 2D (sections, piqûre, bague, extents).
// Préfère BottleView3D ; sinon lit les inputs DOM (même IDs que sections).
// Le dessin du profil est dans canvas/2d/render.js.
//
// Vocabulaire : h = hauteur (mm), L = diamètre, P = profondeur (ovale).
// Préfixes IDs : s{n} corps, sp{n} piqûre, sb{n} bague, rp3-h = pointe piqûre.

var Plans2DData = (function () {
    function num(id, fallback) {
        var el = document.getElementById(id);
        if (!el) return fallback;
        var v = parseFloat(el.value);
        return Number.isFinite(v) ? v : fallback;
    }

    // Liste les indices n des champs {prefix}{n}-h présents dans le DOM
    function indexed(prefix) {
        var inputs = document.querySelectorAll('input[id^="' + prefix + '"][id$="-h"]');
        var out = [];
        for (var i = 0; i < inputs.length; i++) {
            var m = (inputs[i].id || '').match(new RegExp('^' + prefix + '(\\d+)-h$'));
            if (!m) continue;
            var idx = parseInt(m[1], 10);
            if (Number.isFinite(idx)) out.push(idx);
        }
        out.sort(function (a, b) { return a - b; });
        return out.filter(function (v, i) { return i === 0 || v !== out[i - 1]; });
    }

    // Angle du joint de moule (aligné 3D si BottleView3D disponible)
    function moldJointTheta() {
        if (typeof BottleView3D !== 'undefined' && BottleView3D.MOLD_JOINT_PROFILE_THETA != null) {
            return BottleView3D.MOLD_JOINT_PROFILE_THETA;
        }
        return 0;
    }

    // Demi-largeur du profil au joint moule (x du plan 2D)
    function halfWidthAtMoldJoint(L, P) {
        var a = Math.max(0, (L || 0) / 2);
        var b = Math.max(0, (Number.isFinite(P) ? P : L) / 2);
        if (typeof BottleMaths !== 'undefined' && BottleMaths.getSectionRadiusAtAngle) {
            return Math.max(0, BottleMaths.getSectionRadiusAtAngle(a, b, 'ovale', 0, moldJointTheta()));
        }
        return a;
    }

    // Point profil : y = hauteur, x = demi-diamètre au joint
    function pushSection(list, h, L, P) {
        if (h == null || L == null) return;
        list.push({ y: h, x: halfWidthAtMoldJoint(L, P), L: L, P: P });
    }

    // Pied piqûre (section sp au niveau s1-h)
    function getPiqureBase2D() {
        var L = num('sp-L', 55);
        var P = num('sp-P', L);
        return {
            y: num('s1-h', 0),
            L: L,
            P: P,
            halfWidth: halfWidthAtMoldJoint(L, P)
        };
    }

    // Profil piqûre complet : pied sp + sections sp2… + pointe rp3-h (x=0)
    function getPiqureProfile2D() {
        if (typeof BottleView3D !== 'undefined' && BottleView3D.getPiqureProfilePointsFor2D) {
            var from3d = BottleView3D.getPiqureProfilePointsFor2D();
            if (from3d && from3d.length) return from3d;
        }
        var points = [];
        var s1h = num('s1-h', 0);
        var spL = num('sp-L', 55);
        var spP = num('sp-P', spL);
        points.push({ x: halfWidthAtMoldJoint(spL, spP), y: s1h });
        indexed('sp').forEach(function (k) {
            var h = num('sp' + k + '-h', null);
            if (h == null) return;
            var L = num('sp' + k + '-L', 40);
            var P = num('sp' + k + '-P', L);
            points.push({ x: halfWidthAtMoldJoint(L, P), y: h });
        });
        var rp3h = num('rp3-h', null);
        if (rp3h != null) points.push({ x: 0, y: rp3h });
        points.sort(function (a, b) { return a.y - b.y; });
        return points;
    }

    // Sections bague (sb1-h, sb2-h…) triées par hauteur
    function getBagueSections2D() {
        var sections = [];
        indexed('sb').forEach(function (k) {
            var h = num('sb' + k + '-h', null);
            var L = num('sb' + k + '-L', null);
            var P = num('sb' + k + '-P', L);
            pushSection(sections, h, L, P);
        });
        sections.sort(function (a, b) { return a.y - b.y; });
        return sections;
    }

    // Profil bague : points {x,y} pour le tracé 2D
    function getBagueProfile2D() {
        if (typeof BottleView3D !== 'undefined' && BottleView3D.getBagueProfilePointsFor2D) {
            var from3d = BottleView3D.getBagueProfilePointsFor2D();
            if (from3d && from3d.length) return from3d;
        }
        return getBagueSections2D().map(function (s) {
            return { x: s.x, y: s.y };
        });
    }

    // Corps principal (s1-h, s2-h…)
    function getMainSections2D() {
        var sections = [];
        indexed('s').forEach(function (k) {
            pushSection(
                sections,
                num('s' + k + '-h', null),
                num('s' + k + '-L', null),
                num('s' + k + '-P', null)
            );
        });
        sections.sort(function (a, b) { return a.y - b.y; });
        return sections;
    }

    function scanY(points, state) {
        if (!points || !points.length) return;
        for (var i = 0; i < points.length; i++) {
            var y = points[i].y;
            if (!Number.isFinite(y)) continue;
            if (!state.has) {
                state.min = y;
                state.max = y;
                state.has = true;
            } else {
                if (y < state.min) state.min = y;
                if (y > state.max) state.max = y;
            }
        }
    }

    // Bornes Y du plan (min/max avec marge) pour cadrage caméra 2D
    function getBottleVerticalExtents() {
        var state = { has: false, min: 0, max: 0 };
        scanY(getMainSections2D(), state);
        scanY(getPiqureProfile2D(), state);
        scanY(getBagueProfile2D(), state);
        if (!state.has) return { min: -120, max: 400 };
        return {
            min: Math.min(-120, Math.floor(state.min) - 10),
            max: Math.ceil(state.max) + 10
        };
    }

    // Interpolation linéaire : demi-largeur à une hauteur donnée (cotes horizontales)
    function getProfileHalfWidthAtY(profilePoints, yTarget) {
        if (!profilePoints || !profilePoints.length || !Number.isFinite(yTarget)) return 0;
        var maxR = 0;
        var eps = 1e-6;
        for (var i = 0; i < profilePoints.length; i++) {
            var p = profilePoints[i];
            if (Math.abs(p.y - yTarget) < eps) maxR = Math.max(maxR, Math.abs(p.x));
        }
        for (var j = 1; j < profilePoints.length; j++) {
            var p0 = profilePoints[j - 1];
            var p1 = profilePoints[j];
            var y0 = Math.min(p0.y, p1.y);
            var y1 = Math.max(p0.y, p1.y);
            if (yTarget < y0 - eps || yTarget > y1 + eps) continue;
            var dy = p1.y - p0.y;
            if (Math.abs(dy) < eps) continue;
            var t = (yTarget - p0.y) / dy;
            maxR = Math.max(maxR, Math.abs(p0.x + (p1.x - p0.x) * t));
        }
        return maxR;
    }

    return {
        getPiqureBase2D: getPiqureBase2D,
        getPiqureProfile2D: getPiqureProfile2D,
        getBagueProfile2D: getBagueProfile2D,
        getBagueSections2D: getBagueSections2D,
        getMainSections2D: getMainSections2D,
        getBottleVerticalExtents: getBottleVerticalExtents,
        getProfileHalfWidthAtY: getProfileHalfWidthAtY
    };
})();
