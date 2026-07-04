// Calculs géométriques des liaisons du profil 2D.
var RattachementMath = (function () {
    var K = (typeof GeomKernel !== 'undefined') ? GeomKernel : null;
    var SPLINE_STEPS = (typeof RattachementRules !== 'undefined' && RattachementRules.SPLINE_STEPS) || 48;
    var MIN_SAFE_X = (typeof RattachementRules !== 'undefined' && RattachementRules.MIN_SAFE_X) || 1;
    var DEFAULT_EDGE_TYPE = (typeof RattachementRules !== 'undefined' && RattachementRules.DEFAULT_EDGE_TYPE) || 'ligne';
    var DEFAULT_RHO = (typeof RattachementRules !== 'undefined' && RattachementRules.DEFAULT_RHO) || 0;

    function dist2d(A, B) {
        var dx = B.x - A.x;
        var dy = B.y - A.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    var RULES = (typeof RattachementRules !== 'undefined') ? RattachementRules : {};
    var RAYON_TOL_MM = RULES.QUARTER_ARC_TOLERANCE_MM || 0.5;
    var RAYON_MIN_ANGLE_DEG = RULES.RAYON_MIN_CORNER_ANGLE_DEG || 25;
    var RAYON_MAX_ANGLE_DEG = RULES.RAYON_MAX_CORNER_ANGLE_DEG || 155;

    /** T ∈ [A,B] (sur le segment fini, pas sur le prolongement de la droite). */
    function pointOnSegment(A, B, T, tol) {
        tol = tol != null ? tol : 1e-4;
        var abx = B.x - A.x;
        var aby = B.y - A.y;
        var ab2 = abx * abx + aby * aby;
        if (ab2 < 1e-12) return dist2d(A, T) <= tol;
        var t = ((T.x - A.x) * abx + (T.y - A.y) * aby) / ab2;
        if (t < -tol || t > 1 + tol) return false;
        var qx = A.x + t * abx;
        var qy = A.y + t * aby;
        return dist2d({ x: qx, y: qy }, T) <= tol;
    }

    function distPointToLine(P, A, B) {
        var dx = B.x - A.x;
        var dy = B.y - A.y;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1e-9) return dist2d(P, A);
        return Math.abs(dx * (A.y - P.y) - (A.x - P.x) * dy) / len;
    }

    /** Les deux segments (droites) admettent-ils un centre à égale distance ? (non parallèles) */
    function segmentsAllowEqualDistanceCenter(P0, corner, P1) {
        var leg1 = dist2d(P0, corner);
        var leg2 = dist2d(corner, P1);
        if (leg1 < 1e-6 || leg2 < 1e-6) return false;
        var ux = (P0.x - corner.x) / leg1;
        var uy = (P0.y - corner.y) / leg1;
        var vx = (P1.x - corner.x) / leg2;
        var vy = (P1.y - corner.y) / leg2;
        var cross = Math.abs(ux * vy - uy * vx);
        return cross > 1e-5;
    }

    /** dist(centre, droite₁) = dist(centre, droite₂) = R (droites supports, pas seulement segments). */
    function centerEquidistantFromLines(fillet, P0, corner, P1, tol) {
        if (!fillet || !fillet.center) return false;
        tol = tol != null ? tol : RAYON_TOL_MM;
        var C = fillet.center;
        var R = fillet.R;
        if (!(R > 1e-6)) return false;
        var d1 = distPointToLine(C, P0, corner);
        var d2 = distPointToLine(C, corner, P1);
        return Math.abs(d1 - d2) <= tol && Math.abs(d1 - R) <= tol && Math.abs(d2 - R) <= tol;
    }

    function isValidRayonFillet(fillet, P0, corner, P1) {
        if (!fillet || !fillet.center || !fillet.T1 || !fillet.T2) return false;
        if (!(fillet.R > 1e-6)) return false;
        if (!centerEquidistantFromLines(fillet, P0, corner, P1)) return false;
        if (!pointOnSegment(P0, corner, fillet.T1) || !pointOnSegment(corner, P1, fillet.T2)) return false;
        if (fillet.center.x < MIN_SAFE_X - 1e-6) return false;
        if (!hasArcSweep(fillet)) return false;
        return true;
    }

    function cornerInteriorAngleRad(P0, corner, P1) {
        var ax = P0.x - corner.x;
        var ay = P0.y - corner.y;
        var bx = P1.x - corner.x;
        var by = P1.y - corner.y;
        var la = Math.sqrt(ax * ax + ay * ay);
        var lb = Math.sqrt(bx * bx + by * by);
        if (la < 1e-6 || lb < 1e-6) return null;
        var c = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
        return Math.acos(c);
    }

    function cornerAngleIsAllowed(thetaRad) {
        if (thetaRad == null) return false;
        var deg = thetaRad * 180 / Math.PI;
        return deg >= RAYON_MIN_ANGLE_DEG - 1e-6 && deg <= RAYON_MAX_ANGLE_DEG + 1e-6;
    }

    function filletFromKernel(raw) {
        if (!raw || !raw.center) return null;
        return {
            center: { x: raw.center.x, y: raw.center.y },
            T1: { x: raw.T1.x, y: raw.T1.y },
            T2: { x: raw.T2.x, y: raw.T2.y },
            R: raw.R,
            startAngle: raw.startAngle,
            endAngle: raw.endAngle
        };
    }

    /** T1 sur P0–coin, T2 sur coin–P1 ; recalcule les angles de l'arc. */
    function orientFilletOnSegments(fillet, P0, corner, P1) {
        if (!fillet) return null;
        var t1 = fillet.T1;
        var t2 = fillet.T2;
        if (!pointOnSegment(P0, corner, t1) || !pointOnSegment(corner, P1, t2)) {
            if (pointOnSegment(P0, corner, t2) && pointOnSegment(corner, P1, t1)) {
                t1 = fillet.T2;
                t2 = fillet.T1;
            } else {
                return null;
            }
        }
        var cx = fillet.center.x;
        var cy = fillet.center.y;
        return {
            center: fillet.center,
            T1: t1,
            T2: t2,
            R: fillet.R,
            startAngle: Math.atan2(t1.y - cy, t1.x - cx),
            endAngle: Math.atan2(t2.y - cy, t2.x - cx)
        };
    }

    function maxRadiusOnLSegments(P0, corner, P1) {
        var theta = cornerInteriorAngleRad(P0, corner, P1);
        if (theta == null) return 0;
        var tanHalf = Math.tan(theta / 2);
        if (tanHalf < 1e-6) return 0;
        var tMax = Math.min(dist2d(P0, corner), dist2d(corner, P1));
        return (tMax / tanHalf) * 0.99;
    }

    function radiusForEqualLegs(legLen, thetaRad) {
        var tanHalf = Math.tan(thetaRad / 2);
        if (tanHalf < 1e-6) return 0;
        return (legLen / tanHalf) * 0.99;
    }

    function buildFilletFromKernel(P0, corner, P1, R) {
        if (!K || !K.computeFilletTangentPoints || !K.vec2 || R <= 0) return null;
        var raw = K.computeFilletTangentPoints(
            K.vec2(P0.x, P0.y),
            K.vec2(corner.x, corner.y),
            K.vec2(P1.x, P1.y),
            R
        );
        return filletFromKernel(raw);
    }

    /** Congé tangent aux deux branches S0–coin et coin–S1 (angle variable, pas seulement 90°). */
    function buildFilletAtCorner(P0, corner, P1, legLen) {
        if (!K || legLen < 1e-6) return null;
        var theta = cornerInteriorAngleRad(P0, corner, P1);
        if (!cornerAngleIsAllowed(theta)) return null;

        var R = radiusForEqualLegs(legLen, theta);
        var Rcap = maxRadiusOnLSegments(P0, corner, P1);
        if (Rcap > 1e-6) R = Math.min(R, Rcap);
        if (R < 1e-6) return null;

        var fillet = orientFilletOnSegments(buildFilletFromKernel(P0, corner, P1, R), P0, corner, P1);
        if (fillet && isValidRayonFillet(fillet, P0, corner, P1)) return fillet;

        fillet = orientFilletOnSegments(buildFilletFromKernel(P1, corner, P0, R), P0, corner, P1);
        if (fillet && isValidRayonFillet(fillet, P0, corner, P1)) return fillet;

        return null;
    }

    /** Les deux perpendiculaires (section → intersection) ont la même longueur. */
    function perpendicularLegsAreEqual(layout) {
        if (!layout) return false;
        return Math.abs(layout.lenFromP0 - layout.lenFromP1) <= RAYON_TOL_MM;
    }

    function normalize2d(v) {
        var L = Math.sqrt(v.x * v.x + v.y * v.y);
        if (L < 1e-9) return null;
        return { x: v.x / L, y: v.y / L };
    }

    function perpLeftVec(v) {
        return { x: -v.y, y: v.x };
    }

    function orientPerpToward(perp, from, toward) {
        var tx = toward.x - from.x;
        var ty = toward.y - from.y;
        if (perp.x * tx + perp.y * ty < 0) {
            return { x: -perp.x, y: -perp.y };
        }
        return perp;
    }

    function rayRayIntersection(P, d, Q, e) {
        var det = d.x * e.y - d.y * e.x;
        if (Math.abs(det) < 1e-9) return null;
        var dx = Q.x - P.x;
        var dy = Q.y - P.y;
        var t = (dx * e.y - dy * e.x) / det;
        return { x: P.x + t * d.x, y: P.y + t * d.y };
    }

    /** Coin du L entre deux sections (orientation selon le profil voisin). */
    function pickTransitionCorner(P0, P1, prevPoint, nextPoint) {
        var dx = P1.x - P0.x;
        var dy = P1.y - P0.y;
        if (Math.abs(dx) < 1e-6 || Math.abs(dy) < 1e-6) return null;

        var cornerHR = { x: P1.x, y: P0.y };
        var cornerRH = { x: P0.x, y: P1.y };

        if (prevPoint) {
            var vinX = P0.x - prevPoint.x;
            var vinY = P0.y - prevPoint.y;
            if (Math.abs(vinX) >= Math.abs(vinY)) return cornerHR;
            return cornerRH;
        }
        if (nextPoint) {
            var voutX = nextPoint.x - P1.x;
            var voutY = nextPoint.y - P1.y;
            if (Math.abs(voutX) >= Math.abs(voutY)) return cornerRH;
            return cornerHR;
        }
        if (dy >= 0 && dx >= 0) return cornerHR;
        if (dy >= 0 && dx < 0) return cornerRH;
        if (dy < 0 && dx >= 0) return cornerHR;
        return cornerRH;
    }

    /**
     * Perpendiculaires imaginaires depuis chaque section, ⟂ à la ligne/courbe du profil
     * à cette section (prev→S0 et S1→next, ou jambes du rattachement en secours).
     * Même longueur jusqu'à l'intersection → rayon admissible.
     * Le congé suit le coin du L (S0–coin–S1).
     */
    function getProfileTangentLayout(P0, P1, prevPoint, nextPoint) {
        var cornerM = pickTransitionCorner(P0, P1, prevPoint, nextPoint);
        if (!cornerM) return null;

        var leg1Len = dist2d(P0, cornerM);
        var leg2Len = dist2d(cornerM, P1);
        if (leg1Len < 1e-6 || leg2Len < 1e-6) return null;

        var d1raw = prevPoint
            ? { x: P0.x - prevPoint.x, y: P0.y - prevPoint.y }
            : { x: cornerM.x - P0.x, y: cornerM.y - P0.y };
        var d2raw = nextPoint
            ? { x: nextPoint.x - P1.x, y: nextPoint.y - P1.y }
            : { x: P1.x - cornerM.x, y: P1.y - cornerM.y };

        var d1 = normalize2d(d1raw);
        var d2 = normalize2d(d2raw);
        if (!d1 || !d2) return null;
        if (Math.abs(d1.x * d2.x + d1.y * d2.y) > 0.9999) return null;

        var profileMeet = rayRayIntersection(P0, d1, P1, d2);
        var perpTarget0 = profileMeet || cornerM;
        var perpTarget1 = profileMeet || cornerM;

        var perp0 = orientPerpToward(perpLeftVec(d1), P0, perpTarget0);
        var perp1 = orientPerpToward(perpLeftVec(d2), P1, perpTarget1);
        var perpMeet = rayRayIntersection(P0, perp0, P1, perp1);
        if (!perpMeet) return null;

        return {
            corner: cornerM,
            profileCorner: profileMeet,
            lenFromP0: dist2d(P0, perpMeet),
            lenFromP1: dist2d(P1, perpMeet)
        };
    }

    function resolveRayonLayout(P0, P1, prevPoint, nextPoint) {
        return getProfileTangentLayout(P0, P1, prevPoint, nextPoint);
    }

    function hasArcSweep(fillet) {
        var da = fillet.endAngle - fillet.startAngle;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        return Math.abs(da) > 1e-4;
    }

    /**
     * Congé tangent aux droites du profil (prev→P0 et P1→next).
     * Si l'intersection tombe sur P0 ou P1, utilise le point voisin comme extrémité.
     */
    function buildProfileRayonFillet(P0, P1, prevPoint, nextPoint, layout, legLen) {
        var C = layout.profileCorner;
        if (!C) return null;

        var eps = Math.max(RAYON_TOL_MM, 1e-3 * Math.max(dist2d(P0, P1), 1));
        var tries = [];

        if (dist2d(P0, C) <= eps && prevPoint) {
            tries.push({ a: prevPoint, corner: P0, b: P1, drawCorner: P0 });
        }
        if (dist2d(P1, C) <= eps && nextPoint) {
            tries.push({ a: P0, corner: P1, b: nextPoint, drawCorner: P1 });
        }
        if (dist2d(P0, C) > eps && dist2d(P1, C) > eps) {
            tries.push({ a: P0, corner: C, b: P1, drawCorner: C });
        }

        for (var i = 0; i < tries.length; i++) {
            var t = tries[i];
            var fillet = buildFilletAtCorner(t.a, t.corner, t.b, legLen);
            if (fillet) return { fillet: fillet, corner: t.drawCorner };
        }
        return null;
    }

    function tryRayonAtSections(P0, P1, prevPoint, nextPoint) {
        var layout = resolveRayonLayout(P0, P1, prevPoint, nextPoint);
        if (!layout || !perpendicularLegsAreEqual(layout)) return null;
        if (!layout.profileCorner) return null;

        var legLen = layout.lenFromP0;
        if (legLen < 1e-6) return null;

        var built = buildProfileRayonFillet(P0, P1, prevPoint, nextPoint, layout, legLen);
        if (!built) return null;

        return { fillet: built.fillet, corner: built.corner, legLen: legLen };
    }

    function appendRayonEntities(entities, P0, P1, fillet) {
        var T1 = fillet.T1;
        var T2 = fillet.T2;
        if (dist2d(P0, T1) > 1e-5) {
            entities.push(K.LineSegment(P0.x, P0.y, T1.x, T1.y));
        }
        entities.push(K.ArcSegment(
            fillet.center.x, fillet.center.y, fillet.R,
            fillet.startAngle, fillet.endAngle
        ));
        if (dist2d(T2, P1) > 1e-5) {
            entities.push(K.LineSegment(T2.x, T2.y, P1.x, P1.y));
        }
    }

    function computeRayonValidity(P0, P1, prevPoint, nextPoint) {
        var layout = resolveRayonLayout(P0, P1, prevPoint || null, nextPoint || null);
        if (!layout || !perpendicularLegsAreEqual(layout)) {
            return { valid: false, R: null };
        }
        var pick = tryRayonAtSections(P0, P1, prevPoint || null, nextPoint || null, null);
        if (!pick) return { valid: false, R: null };
        return { valid: true, R: pick.fillet.R };
    }

    function prepareCourbeSFrame(P0, P1, prevPoint, nextPoint) {
        var Dx = P1.x - P0.x;
        var Dy = P1.y - P0.y;
        var dS = Math.sqrt(Dx * Dx + Dy * Dy);
        if (dS < 1e-6) return null;
        var T0x = Dx / dS;
        var T0y = Dy / dS;
        if (prevPoint) {
            var pdx = P0.x - prevPoint.x;
            var pdy = P0.y - prevPoint.y;
            var pd = Math.sqrt(pdx * pdx + pdy * pdy);
            if (pd > 1e-6) { T0x = pdx / pd; T0y = pdy / pd; }
        }
        var T1x = Dx / dS;
        var T1y = Dy / dS;
        if (nextPoint) {
            var ndx = nextPoint.x - P1.x;
            var ndy = nextPoint.y - P1.y;
            var nd = Math.sqrt(ndx * ndx + ndy * ndy);
            if (nd > 1e-6) { T1x = ndx / nd; T1y = ndy / nd; }
        }
        var n0x = -T0y;
        var n0y = T0x;
        var DdotN0 = Dx * n0x + Dy * n0y;
        if (DdotN0 <= 0) { n0x = -n0x; n0y = -n0y; DdotN0 = -DdotN0; }
        var n1x = -T1y;
        var n1y = T1x;
        var DdotN1 = Dx * n1x + Dy * n1y;
        if (DdotN1 >= 0) { n1x = -n1x; n1y = -n1y; DdotN1 = -DdotN1; }
        return {
            Dx: Dx, Dy: Dy, dS: dS,
            T0x: T0x, T0y: T0y, T1x: T1x, T1y: T1y,
            n0x: n0x, n0y: n0y, n1x: n1x, n1y: n1y,
            DdotN0: DdotN0, DdotN1: DdotN1
        };
    }

    function resolveCourbeSPick(P0, P1, frame) {
        if (!frame) return null;
        var dS = frame.dS;
        var minR = 5;
        var candidates = [];

        function tryCandidate(R, useFallback) {
            if (!(R > minR)) return;
            if (!canCourbeSConfigWork(P0, P1, frame, R, useFallback)) return;
            candidates.push({ R: R, useFallback: useFallback });
        }

        var Dx = frame.Dx;
        var Dy = frame.Dy;
        var Vx = frame.n1x - frame.n0x;
        var Vy = frame.n1y - frame.n0y;
        var V2 = Vx * Vx + Vy * Vy;
        var denom = V2 - 4;
        if (Math.abs(denom) > 1e-9) {
            var DdotV = Dx * Vx + Dy * Vy;
            var disc = 4 * DdotV * DdotV + 4 * dS * dS * denom;
            if (disc >= 0) {
                var sqrtDisc = Math.sqrt(disc);
                tryCandidate((-2 * DdotV + sqrtDisc) / (2 * denom), false);
                tryCandidate((-2 * DdotV - sqrtDisc) / (2 * denom), false);
            }
        }
        if (Math.abs(frame.DdotN0) > 1e-9) {
            tryCandidate((dS * dS) / (4 * frame.DdotN0), true);
        }

        if (candidates.length) {
            var nonFb = [];
            for (var ci = 0; ci < candidates.length; ci++) {
                if (!candidates[ci].useFallback) nonFb.push(candidates[ci]);
            }
            var pool = nonFb.length ? nonFb : candidates;
            var targetR = Math.max(minR, dS * 0.6);
            var best = pool[0];
            for (var pi = 0; pi < pool.length; pi++) {
                if (Math.abs(pool[pi].R - targetR) < Math.abs(best.R - targetR)) best = pool[pi];
            }
            return best;
        }

        var targetR2 = Math.abs(frame.DdotN0) > 1e-9 ? (dS * dS) / (4 * frame.DdotN0) : dS * 0.6;
        targetR2 = Math.max(minR, targetR2);
        for (var fb = 0; fb < 2; fb++) {
            if (canCourbeSConfigWork(P0, P1, frame, targetR2, fb === 1)) {
                return { R: targetR2, useFallback: fb === 1 };
            }
        }
        var step = Math.max(0.5, dS * 0.02);
        for (var r0 = minR; r0 <= dS * 4; r0 += step) {
            for (var fb2 = 0; fb2 < 2; fb2++) {
                if (canCourbeSConfigWork(P0, P1, frame, r0, fb2 === 1)) {
                    return { R: r0, useFallback: fb2 === 1 };
                }
            }
        }
        return null;
    }

    /** Rayon du 2e arc pour un rayon R0 fixé au 1er arc (jonction tangente sur la ligne des centres). */
    function computeCourbeSPartnerRadius(R0, frame, useFallback) {
        if (!frame || !(R0 > 0)) return null;
        var dS = frame.dS;
        var R1;
        if (useFallback) {
            if (Math.abs(frame.DdotN0) < 1e-9) return null;
            R1 = (dS * dS) / (2 * frame.DdotN0) - R0;
        } else {
            var n0dotn1 = frame.n0x * frame.n1x + frame.n0y * frame.n1y;
            var denom = 2 * frame.DdotN1 - 2 * R0 * (n0dotn1 + 1);
            if (Math.abs(denom) < 1e-9) return null;
            R1 = (2 * R0 * frame.DdotN0 - dS * dS) / denom;
        }
        if (!(R1 > 0.5)) return null;
        return R1;
    }

    function canCourbeSConfigWork(P0, P1, frame, R0, useFallback) {
        var R1 = computeCourbeSPartnerRadius(R0, frame, useFallback);
        if (R1 == null) return false;
        return appendCourbeSArcs([], P0, P1, frame, R0, R1, useFallback);
    }

    function canCourbeSConfigWorkAnyMode(P0, P1, frame, R0) {
        if (canCourbeSConfigWork(P0, P1, frame, R0, false)) return true;
        return canCourbeSConfigWork(P0, P1, frame, R0, true);
    }

    function computeCourbeSMinR0(P0, P1, prevPoint, nextPoint) {
        var frame = prepareCourbeSFrame(P0, P1, prevPoint, nextPoint);
        var pick = resolveCourbeSPick(P0, P1, frame);
        if (!frame || !pick) return null;
        var absMin = 5;
        var hi = pick.R;
        if (!canCourbeSConfigWorkAnyMode(P0, P1, frame, hi)) return null;

        var lo = absMin;
        if (!canCourbeSConfigWorkAnyMode(P0, P1, frame, lo)) {
            var step = Math.max(0.25, frame.dS * 0.005);
            var found = null;
            for (var r0 = absMin + step; r0 <= hi; r0 += step) {
                if (canCourbeSConfigWorkAnyMode(P0, P1, frame, r0)) {
                    found = r0;
                    break;
                }
            }
            if (found == null) return Math.round(hi * 10) / 10;
            lo = found;
        }

        var good = lo;
        var bad = hi;
        for (var i = 0; i < 48; i++) {
            var mid = (good + bad) / 2;
            if (canCourbeSConfigWorkAnyMode(P0, P1, frame, mid)) bad = mid;
            else good = mid;
        }
        return Math.round(bad * 10) / 10;
    }

    function computeCourbeSMaxR0(P0, P1, prevPoint, nextPoint) {
        var frame = prepareCourbeSFrame(P0, P1, prevPoint, nextPoint);
        var pick = resolveCourbeSPick(P0, P1, frame);
        if (!frame || !pick) return null;
        var lo = computeCourbeSMinR0(P0, P1, prevPoint, nextPoint);
        if (lo == null) lo = 5;
        var hi = pick.R;
        if (!canCourbeSConfigWork(P0, P1, frame, hi, pick.useFallback)) return pick.R;
        while (hi < 2500 && canCourbeSConfigWork(P0, P1, frame, hi * 1.2, pick.useFallback)) {
            hi *= 1.2;
        }
        if (canCourbeSConfigWork(P0, P1, frame, hi, pick.useFallback)) {
            return Math.round(hi * 10) / 10;
        }
        var bad = hi;
        for (var i = 0; i < 48; i++) {
            var mid = (lo + bad) / 2;
            if (canCourbeSConfigWork(P0, P1, frame, mid, pick.useFallback)) lo = mid;
            else bad = mid;
        }
        return Math.round(lo * 10) / 10;
    }

    function appendCourbeSArcs(entities, P0, P1, frame, R0, R1, useFallback) {
        var n0x = frame.n0x;
        var n0y = frame.n0y;
        var n1x = frame.n1x;
        var n1y = frame.n1y;
        var T0x = frame.T0x;
        var T0y = frame.T0y;
        var C1x = P0.x + R0 * n0x;
        var C1y = P0.y + R0 * n0y;
        var C2x = useFallback ? P1.x - R1 * n0x : P1.x + R1 * n1x;
        var C2y = useFallback ? P1.y - R1 * n0y : P1.y + R1 * n1y;
        var dxC = C2x - C1x;
        var dyC = C2y - C1y;
        var dC = Math.sqrt(dxC * dxC + dyC * dyC);
        var sumR = R0 + R1;
        if (dC < 1e-6 || Math.abs(dC - sumR) > Math.max(1, sumR) * 0.08) return false;
        var tJ = R0 / sumR;
        var Mx = C1x + dxC * tJ;
        var My = C1y + dyC * tJ;
        if (Math.min(Mx, Math.min(P0.x, P1.x)) < MIN_SAFE_X) return false;
        var a1s = Math.atan2(P0.y - C1y, P0.x - C1x);
        var a1e = Math.atan2(My - C1y, Mx - C1x);
        var da1 = a1e - a1s;
        if (da1 > Math.PI) da1 -= 2 * Math.PI;
        if (da1 < -Math.PI) da1 += 2 * Math.PI;
        var tangent1AtP0x = da1 > 0 ? -Math.sin(a1s) : Math.sin(a1s);
        var tangent1AtP0y = da1 > 0 ? Math.cos(a1s) : -Math.cos(a1s);
        var dot1 = tangent1AtP0x * T0x + tangent1AtP0y * T0y;
        if (dot1 < 0) {
            n0x = -n0x; n0y = -n0y;
            n1x = -n1x; n1y = -n1y;
            C1x = P0.x + R0 * n0x;
            C1y = P0.y + R0 * n0y;
            C2x = useFallback ? P1.x - R1 * n0x : P1.x + R1 * n1x;
            C2y = useFallback ? P1.y - R1 * n0y : P1.y + R1 * n1y;
            dxC = C2x - C1x;
            dyC = C2y - C1y;
            dC = Math.sqrt(dxC * dxC + dyC * dyC);
            if (dC < 1e-6) return false;
            Mx = C1x + dxC * tJ;
            My = C1y + dyC * tJ;
            a1s = Math.atan2(P0.y - C1y, P0.x - C1x);
            a1e = Math.atan2(My - C1y, Mx - C1x);
        }
        var sweep1 = a1e - a1s;
        if (sweep1 > Math.PI) a1e -= 2 * Math.PI;
        if (sweep1 < -Math.PI) a1e += 2 * Math.PI;
        var a2s = Math.atan2(My - C2y, Mx - C2x);
        var a2e = Math.atan2(P1.y - C2y, P1.x - C2x);
        var sweep2 = a2e - a2s;
        if (sweep2 > Math.PI) a2e -= 2 * Math.PI;
        if (sweep2 < -Math.PI) a2e += 2 * Math.PI;
        entities.push(K.ArcSegment(C1x, C1y, R0, a1s, a1e));
        entities.push(K.ArcSegment(C2x, C2y, R1, a2s, a2e));
        return true;
    }

    function computeCourbeSDefaultRho(P0, P1, prevPoint, nextPoint) {
        var frame = prepareCourbeSFrame(P0, P1, prevPoint, nextPoint);
        var pick = resolveCourbeSPick(P0, P1, frame);
        return pick ? pick.R : null;
    }

    function buildProfileCurves(profilePoints, data) {
        if (!K) return [];
        var points = profilePoints || [];
        if (points.length < 2) return [];
        data = data || {};
        var edgeTypes = data.edgeTypes || [];
        var rhos = data.rhos || [];

        var entities = [];
        var lastPoint = { x: points[0].x, y: points[0].y };

        for (var i = 0; i < points.length - 1; i++) {
            var P0 = lastPoint;
            var P1 = points[i + 1];
            var type = edgeTypes[i] || DEFAULT_EDGE_TYPE;
            var R = rhos[i] || DEFAULT_RHO;

            if (type === 'rayon') {
                var sec0 = { x: points[i].x, y: points[i].y };
                var sec1 = { x: points[i + 1].x, y: points[i + 1].y };
                var prevSec = i > 0 ? { x: points[i - 1].x, y: points[i - 1].y } : null;
                var nextSec = i + 2 < points.length ? { x: points[i + 2].x, y: points[i + 2].y } : null;
                if (dist2d(lastPoint, sec0) > 1e-5) {
                    entities.push(K.LineSegment(lastPoint.x, lastPoint.y, sec0.x, sec0.y));
                }
                var rayonPick = tryRayonAtSections(sec0, sec1, prevSec, nextSec);
                var rayonOk = !!rayonPick;
                if (rayonOk) {
                    appendRayonEntities(entities, sec0, sec1, rayonPick.fillet);
                } else {
                    entities.push(K.LineSegment(sec0.x, sec0.y, sec1.x, sec1.y));
                }
                lastPoint = { x: sec1.x, y: sec1.y };
            } else if (type === 'courbeS') {
                var prevPoint = i > 0 ? { x: points[i - 1].x, y: points[i - 1].y } : null;
                var nextPoint = i + 2 < points.length ? { x: points[i + 2].x, y: points[i + 2].y } : null;
                var frame = prepareCourbeSFrame(P0, P1, prevPoint, nextPoint);
                if (!frame) {
                    entities.push(K.LineSegment(P0.x, P0.y, P1.x, P1.y));
                    lastPoint = { x: P1.x, y: P1.y };
                } else {
                    var pick = resolveCourbeSPick(P0, P1, frame);
                    if (!pick) {
                        entities.push(K.LineSegment(P0.x, P0.y, P1.x, P1.y));
                        lastPoint = { x: P1.x, y: P1.y };
                    } else {
                        var R0 = (R > 0) ? R : pick.R;
                        R0 = Math.max(5, R0);
                        var useFb = pick.useFallback;
                        var R1 = computeCourbeSPartnerRadius(R0, frame, useFb);
                        if (R1 == null) {
                            useFb = !useFb;
                            R1 = computeCourbeSPartnerRadius(R0, frame, useFb);
                        }
                        if (R1 == null) {
                            entities.push(K.LineSegment(P0.x, P0.y, P1.x, P1.y));
                            lastPoint = { x: P1.x, y: P1.y };
                        } else if (!appendCourbeSArcs(entities, P0, P1, frame, R0, R1, useFb)) {
                            entities.push(K.LineSegment(P0.x, P0.y, P1.x, P1.y));
                            lastPoint = { x: P1.x, y: P1.y };
                        } else {
                            lastPoint = { x: P1.x, y: P1.y };
                        }
                    }
                }
            } else if (type === 'spline') {
                var dxSp = P1.x - P0.x;
                var dySp = P1.y - P0.y;
                var dSp = Math.sqrt(dxSp * dxSp + dySp * dySp);
                if (dSp < 1e-6 || Math.abs(R) < 1e-3) {
                    entities.push(K.LineSegment(P0.x, P0.y, P1.x, P1.y));
                    lastPoint = { x: P1.x, y: P1.y };
                } else {
                    var nxSp = -dySp / dSp;
                    var nySp = dxSp / dSp;
                    if (R < 0) { nxSp = -nxSp; nySp = -nySp; }
                    var amp = Math.abs(R) * 0.3;
                    var midSpX = (P0.x + P1.x) * 0.5 + nxSp * amp;
                    var midSpY = (P0.y + P1.y) * 0.5 + nySp * amp;
                    var prevX = P0.x;
                    var prevY = P0.y;
                    for (var k = 1; k <= SPLINE_STEPS; k++) {
                        var t = k / SPLINE_STEPS;
                        var oneMinusT = 1 - t;
                        var bx = oneMinusT * oneMinusT * P0.x + 2 * oneMinusT * t * midSpX + t * t * P1.x;
                        var by = oneMinusT * oneMinusT * P0.y + 2 * oneMinusT * t * midSpY + t * t * P1.y;
                        entities.push(K.LineSegment(prevX, prevY, bx, by));
                        prevX = bx;
                        prevY = by;
                    }
                    lastPoint = { x: P1.x, y: P1.y };
                }
            } else {
                entities.push(K.LineSegment(P0.x, P0.y, P1.x, P1.y));
                lastPoint = { x: P1.x, y: P1.y };
            }
        }
        return entities;
    }

    return {
        buildProfileCurves: buildProfileCurves,
        computeRayonValidity: computeRayonValidity,
        computeCourbeSDefaultRho: computeCourbeSDefaultRho,
        computeCourbeSMaxR0: computeCourbeSMaxR0,
        computeCourbeSMinR0: computeCourbeSMinR0
    };
})();
