// Calcul du volume interne de la bouteille (mm3), incluant la piqure et bague fermee.
var CalculeVolumeMath = (function () {
    var THETA_SAMPLES = 360;
    var MERIDIAN_RESOLUTION = 128;
    var EPS = 1e-9;

    function clamp01(v) { return Math.max(0, Math.min(1, v)); }

    function getPanelValue(id, def) {
        if (typeof document === 'undefined') return def;
        var el = document.getElementById(id);
        if (!el) return def;
        var v = parseFloat(el.value);
        return isNaN(v) ? def : v;
    }

    function getPanelSelectValue(id, def) {
        if (typeof document === 'undefined') return def;
        var el = document.getElementById(id);
        if (!el || !el.value) return def;
        return el.value;
    }

    function getShapeArea(section) {
        if (!section) return 0;
        var a = Math.max(0, section.a || 0);
        var b = Math.max(0, section.b || 0);
        if (a <= EPS || b <= EPS) return 0;
        if ((section.shape || 'rond') === 'carre') {
            var carreNiveau = Math.max(0, Math.min(100, section.carreNiveau || 0));
            var r = (1 - carreNiveau / 100) * Math.min(a, b);
            r = Math.max(0, Math.min(r, Math.min(a, b)));
            return (4 * a * b) - ((4 - Math.PI) * r * r);
        }
        return Math.PI * a * b;
    }

    function lerpSection(s0, s1, t) {
        t = clamp01(t);
        return {
            H: (1 - t) * (s0.H || 0) + t * (s1.H || 0),
            a: (1 - t) * (s0.a || 0) + t * (s1.a || 0),
            b: (1 - t) * (s0.b || 0) + t * (s1.b || 0),
            // Blend "carreNiveau" and force square mode if one of the two is square.
            shape: ((s0.shape === 'carre') || (s1.shape === 'carre')) ? 'carre' : 'rond',
            carreNiveau: (1 - t) * (s0.carreNiveau || 0) + t * (s1.carreNiveau || 0)
        };
    }

    function integrateSectionAreaLinear(s0, s1) {
        var y0 = s0.H || 0;
        var y1 = s1.H || 0;
        var dy = y1 - y0;
        if (dy <= EPS) return 0;
        var steps = 160;
        var h = dy / steps;
        var acc = 0;
        for (var i = 0; i <= steps; i++) {
            var t = i / steps;
            var sec = lerpSection(s0, s1, t);
            var A = getShapeArea(sec);
            var w = (i === 0 || i === steps) ? 1 : (i % 2 === 0 ? 2 : 4);
            acc += w * A;
        }
        return (h / 3) * acc;
    }

    function integrateRadiusSquaredOnSegment(x0, y0, x1, y1, yMin, yMax) {
        var dy = y1 - y0;
        if (Math.abs(dy) <= EPS) return 0;

        var ya = Math.max(Math.min(y0, y1), yMin);
        var yb = Math.min(Math.max(y0, y1), yMax);
        if (yb <= ya + EPS) return 0;

        var m = (x1 - x0) / dy;
        var c = x0 - m * y0;
        var intVal = (m * m / 3) * (yb * yb * yb - ya * ya * ya)
            + (m * c) * (yb * yb - ya * ya)
            + (c * c) * (yb - ya);
        return Math.max(0, intVal);
    }

    function integrateMainBodyVolume(sectionsData, yStartOpt, yEndOpt) {
        if (typeof BottleMaths === 'undefined' || typeof GeomKernel === 'undefined') return 0;
        if (!sectionsData || !sectionsData.sections || sectionsData.sections.length < 2) return 0;

        var yMinBase = sectionsData.sections[0].H || 0;
        var yMaxBase = sectionsData.sections[sectionsData.sections.length - 1].H || yMinBase;
        var yMin = (typeof yStartOpt === 'number') ? Math.max(yMinBase, yStartOpt) : yMinBase;
        var yMax = (typeof yEndOpt === 'number') ? Math.min(yMaxBase, yEndOpt) : yMaxBase;
        if (yMax <= yMin + EPS) return 0;

        var sumOverTheta = 0;
        for (var ti = 0; ti < THETA_SAMPLES; ti++) {
            var theta = (ti / THETA_SAMPLES) * 2 * Math.PI;
            var entities = BottleMaths.buildExteriorProfile(theta, sectionsData);
            if (!entities || entities.length === 0) continue;
            var pts = GeomKernel.tessellateProfile(entities, MERIDIAN_RESOLUTION);
            if (!pts || pts.length < 2) continue;

            var intR2dy = 0;
            for (var i = 0; i < pts.length - 1; i++) {
                var p0 = pts[i];
                var p1 = pts[i + 1];
                intR2dy += integrateRadiusSquaredOnSegment(
                    Math.max(0, p0.x), p0.y,
                    Math.max(0, p1.x), p1.y,
                    yMin, yMax
                );
            }
            sumOverTheta += intR2dy;
        }

        var dTheta = (2 * Math.PI) / THETA_SAMPLES;
        return 0.5 * dTheta * sumOverTheta;
    }

    function integrateSectionAreaLinearClipped(s0, s1, yStart, yEnd) {
        var lo = Math.max(Math.min(s0.H, s1.H), yStart);
        var hi = Math.min(Math.max(s0.H, s1.H), yEnd);
        if (hi <= lo + EPS) return 0;
        var dy = (s1.H - s0.H);
        if (Math.abs(dy) <= EPS) return 0;
        var t0 = (lo - s0.H) / dy;
        var t1 = (hi - s0.H) / dy;
        var c0 = lerpSection(s0, s1, t0);
        var c1 = lerpSection(s0, s1, t1);
        c0.H = lo;
        c1.H = hi;
        return integrateSectionAreaLinear(c0, c1);
    }

    function getDynamicPiqureSections() {
        var out = [];
        if (typeof document === 'undefined') return out;
        var inputs = document.querySelectorAll('input[id^="sp"][id$="-h"]');
        var idxs = [];
        for (var i = 0; i < inputs.length; i++) {
            var m = (inputs[i].id || '').match(/^sp(\d+)-h$/);
            if (!m) continue;
            var k = parseInt(m[1], 10);
            if (isFinite(k)) idxs.push(k);
        }
        idxs.sort(function (a, b) { return a - b; });
        var unique = [];
        for (var j = 0; j < idxs.length; j++) {
            if (j === 0 || idxs[j] !== idxs[j - 1]) unique.push(idxs[j]);
        }
        for (var u = 0; u < unique.length; u++) {
            var ksp = unique[u];
            out.push({
                H: Math.max(0, getPanelValue('sp' + ksp + '-h', 0)),
                a: Math.max(0, getPanelValue('sp' + ksp + '-L', 45) / 2),
                b: Math.max(0, getPanelValue('sp' + ksp + '-P', 45) / 2),
                shape: getPanelSelectValue('sp' + ksp + '-forme', 'rond'),
                carreNiveau: Math.max(0, Math.min(100, getPanelValue('sp' + ksp + '-carre-niveau', 0)))
            });
        }
        return out;
    }

    function getDynamicBagueSections() {
        var out = [];
        if (typeof document === 'undefined') return out;
        var inputs = document.querySelectorAll('input[id^="sb"][id$="-h"]');
        var idxs = [];
        for (var i = 0; i < inputs.length; i++) {
            var m = (inputs[i].id || '').match(/^sb(\d+)-h$/);
            if (!m) continue;
            var k = parseInt(m[1], 10);
            if (isFinite(k)) idxs.push(k);
        }
        idxs.sort(function (a, b) { return a - b; });
        var unique = [];
        for (var j = 0; j < idxs.length; j++) {
            if (j === 0 || idxs[j] !== idxs[j - 1]) unique.push(idxs[j]);
        }
        for (var u = 0; u < unique.length; u++) {
            var ksb = unique[u];
            out.push({
                H: Math.max(0, getPanelValue('sb' + ksb + '-h', 0)),
                a: Math.max(0, getPanelValue('sb' + ksb + '-L', 35) / 2),
                b: Math.max(0, getPanelValue('sb' + ksb + '-P', 35) / 2),
                shape: getPanelSelectValue('sb' + ksb + '-forme', 'rond'),
                carreNiveau: Math.max(0, Math.min(100, getPanelValue('sb' + ksb + '-carre-niveau', 0)))
            });
        }
        return out;
    }

    function computePiqureSubtractedVolume(sectionsData) {
        if (!sectionsData || !sectionsData.sections || sectionsData.sections.length < 1) return 0;
        var s1H = sectionsData.sections[0].H || 0;
        var piq = [{
            H: s1H,
            a: Math.max(0, getPanelValue('sp-L', 55) / 2),
            b: Math.max(0, getPanelValue('sp-P', 55) / 2),
            shape: getPanelSelectValue('sp-forme', 'rond'),
            carreNiveau: Math.max(0, Math.min(100, getPanelValue('sp-carre-niveau', 0)))
        }];
        var more = getDynamicPiqureSections();
        for (var i = 0; i < more.length; i++) piq.push(more[i]);
        if (piq.length < 1) return 0;

        for (var k = 1; k < piq.length; k++) {
            if (piq[k].H < piq[k - 1].H) piq[k].H = piq[k - 1].H;
        }

        var v = 0;
        for (var j = 0; j < piq.length - 1; j++) {
            v += integrateSectionAreaLinear(piq[j], piq[j + 1]);
        }

        var last = piq[piq.length - 1];
        var apexH = Math.max(last.H, getPanelValue('rp3-h', 30));
        var dy = apexH - last.H;
        if (dy > EPS) {
            var Alast = getShapeArea(last);
            v += (Alast * dy) / 3;
        }
        return Math.max(0, v);
    }

    function computeBagueAddedVolume(sectionsData) {
        if (!sectionsData || !sectionsData.sections || sectionsData.sections.length < 1) return 0;
        var sTop = sectionsData.sections[sectionsData.sections.length - 1];
        var bague = getDynamicBagueSections();
        if (!bague.length) {
            bague = [
                { H: Math.max(0, getPanelValue('sb1-h', sTop.H || 0)), a: Math.max(0, getPanelValue('sb1-L', 29.5) / 2), b: Math.max(0, getPanelValue('sb1-P', 29.5) / 2), shape: 'rond', carreNiveau: 0 },
                { H: Math.max(0, getPanelValue('sb2-h', sTop.H || 0)), a: Math.max(0, getPanelValue('sb2-L', 29.5) / 2), b: Math.max(0, getPanelValue('sb2-P', 29.5) / 2), shape: 'rond', carreNiveau: 0 },
                { H: Math.max(0, getPanelValue('sb3-h', sTop.H || 0)), a: Math.max(0, getPanelValue('sb3-L', 25.5) / 2), b: Math.max(0, getPanelValue('sb3-P', 25.5) / 2), shape: 'rond', carreNiveau: 0 }
            ];
        }

        for (var i = 0; i < bague.length; i++) {
            if (bague[i].H < sTop.H) bague[i].H = sTop.H;
            if (i > 0 && bague[i].H < bague[i - 1].H) bague[i].H = bague[i - 1].H;
        }

        var v = 0;
        if (bague.length) v += integrateSectionAreaLinear(sTop, bague[0]);
        for (var j = 0; j < bague.length - 1; j++) v += integrateSectionAreaLinear(bague[j], bague[j + 1]);
        return Math.max(0, v);
    }

    function buildInteriorContext(sectionsData) {
        var thicknessMm = (typeof InterieurMath !== 'undefined' && InterieurMath.getThicknessMm)
            ? InterieurMath.getThicknessMm()
            : 3.5;

        var innerSectionsData = (typeof InterieurMath !== 'undefined' && InterieurMath.buildInteriorSectionsDataFromThickness)
            ? InterieurMath.buildInteriorSectionsDataFromThickness(sectionsData, thicknessMm, thicknessMm)
            : sectionsData;

        // Bague interieure: exception metier, sb2 cale sur sb3.
        var sTopInner = innerSectionsData && innerSectionsData.sections && innerSectionsData.sections.length
            ? innerSectionsData.sections[innerSectionsData.sections.length - 1]
            : null;
        var bague = getDynamicBagueSections();
        for (var b = 0; b < bague.length; b++) {
            bague[b] = (typeof InterieurMath !== 'undefined' && InterieurMath.insetSection)
                ? InterieurMath.insetSection(bague[b], thicknessMm)
                : bague[b];
        }
        if (bague.length >= 3) {
            bague[1].a = bague[2].a;
            bague[1].b = bague[2].b;
            bague[1].shape = bague[2].shape;
            bague[1].carreNiveau = bague[2].carreNiveau;
        }
        if (sTopInner && bague.length && bague[0].H < sTopInner.H) bague[0].H = sTopInner.H;
        for (var bm = 0; bm < bague.length - 1; bm++) {
            if (bague[bm + 1].H < bague[bm].H) bague[bm + 1].H = bague[bm].H;
        }

        // Piqure interieure: meme regle que l'affichage interieur (decalage vers exterieur).
        var piq = [];
        if (sectionsData && sectionsData.sections && sectionsData.sections.length) {
            var s1H = (sectionsData.sections[0].H || 0) + thicknessMm;
            var p0 = {
                H: s1H,
                a: Math.max(0, getPanelValue('sp-L', 55) / 2),
                b: Math.max(0, getPanelValue('sp-P', 55) / 2),
                shape: getPanelSelectValue('sp-forme', 'rond'),
                carreNiveau: Math.max(0, Math.min(100, getPanelValue('sp-carre-niveau', 0)))
            };
            p0 = (typeof InterieurMath !== 'undefined' && InterieurMath.outsetSection)
                ? InterieurMath.outsetSection(p0, thicknessMm)
                : p0;
            piq.push(p0);
        }
        var more = getDynamicPiqureSections();
        for (var i = 0; i < more.length; i++) {
            var sec = more[i];
            var outerAtH = (typeof InterieurMath !== 'undefined' && InterieurMath.getOuterSectionAtHeight)
                ? InterieurMath.getOuterSectionAtHeight(innerSectionsData.sections, sec.H || 0)
                : null;
            var maxTa = outerAtH ? Math.max(0, (outerAtH.a || 0) - (sec.a || 0) - 0.2) : thicknessMm;
            var maxTb = outerAtH ? Math.max(0, (outerAtH.b || 0) - (sec.b || 0) - 0.2) : thicknessMm;
            var tPiq = Math.min(thicknessMm, maxTa, maxTb);
            var outSec = (typeof InterieurMath !== 'undefined' && InterieurMath.outsetSection)
                ? InterieurMath.outsetSection(sec, tPiq)
                : sec;
            outSec.H = (sec.H || 0) + thicknessMm;
            piq.push(outSec);
        }
        for (var k = 1; k < piq.length; k++) if (piq[k].H < piq[k - 1].H) piq[k].H = piq[k - 1].H;
        var rp3HInner = null;
        if (piq.length) {
            var last = piq[piq.length - 1];
            rp3HInner = Math.max(last.H, getPanelValue('rp3-h', 30) + thicknessMm);
        }

        return {
            innerSectionsData: innerSectionsData,
            sTopInner: sTopInner,
            bagueInner: bague,
            piqInner: piq,
            rp3HInner: rp3HInner
        };
    }

    function computeVolumeUpToHeightMm3(ctx, yTop) {
        if (!ctx || !ctx.innerSectionsData || !ctx.innerSectionsData.sections || !ctx.innerSectionsData.sections.length) return 0;
        var yBottom = ctx.innerSectionsData.sections[0].H || 0;
        var y = Math.max(yBottom, yTop);
        var mainTop = ctx.sTopInner ? ctx.sTopInner.H : yBottom;
        var v = 0;

        v += integrateMainBodyVolume(ctx.innerSectionsData, yBottom, Math.min(y, mainTop));

        if (ctx.sTopInner && ctx.bagueInner && ctx.bagueInner.length && y > mainTop) {
            v += integrateSectionAreaLinearClipped(ctx.sTopInner, ctx.bagueInner[0], mainTop, y);
            for (var bi = 0; bi < ctx.bagueInner.length - 1; bi++) {
                v += integrateSectionAreaLinearClipped(ctx.bagueInner[bi], ctx.bagueInner[bi + 1], mainTop, y);
            }
        }

        var vPiq = 0;
        if (ctx.piqInner && ctx.piqInner.length) {
            for (var pi = 0; pi < ctx.piqInner.length - 1; pi++) {
                vPiq += integrateSectionAreaLinearClipped(ctx.piqInner[pi], ctx.piqInner[pi + 1], yBottom, y);
            }
            if (ctx.rp3HInner != null) {
                var last = ctx.piqInner[ctx.piqInner.length - 1];
                var apex = { H: ctx.rp3HInner, a: 0, b: 0, shape: last.shape, carreNiveau: last.carreNiveau };
                vPiq += integrateSectionAreaLinearClipped(last, apex, yBottom, y);
            }
        }
        return Math.max(0, v - vPiq);
    }

    function getTopBagueHeight(ctx) {
        if (!ctx) return 0;
        if (ctx.bagueInner && ctx.bagueInner.length) return ctx.bagueInner[ctx.bagueInner.length - 1].H || 0;
        if (ctx.sTopInner) return ctx.sTopInner.H || 0;
        if (ctx.innerSectionsData && ctx.innerSectionsData.sections && ctx.innerSectionsData.sections.length) {
            return ctx.innerSectionsData.sections[ctx.innerSectionsData.sections.length - 1].H || 0;
        }
        return 0;
    }

    function computeTotalInteriorVolumeMm3(sectionsData) {
        var ctx = buildInteriorContext(sectionsData);
        return computeVolumeUpToHeightMm3(ctx, getTopBagueHeight(ctx));
    }

    function computeTotalOuterVolumeMm3(sectionsData) {
        if (!sectionsData) return 0;
        var bodyMain = integrateMainBodyVolume(sectionsData);
        var bagueAdd = computeBagueAddedVolume(sectionsData);
        var piqureSubtract = computePiqureSubtractedVolume(sectionsData);
        return Math.max(0, bodyMain + bagueAdd - piqureSubtract);
    }

    function computeCanuleDiameterMm() {
        var bague = getDynamicBagueSections();
        if (!bague || !bague.length) return 0;
        var top = bague[bague.length - 1];
        var thicknessMm = (typeof InterieurMath !== 'undefined' && InterieurMath.getThicknessMm)
            ? InterieurMath.getThicknessMm()
            : 3.5;
        var topInner = (typeof InterieurMath !== 'undefined' && InterieurMath.insetSection)
            ? InterieurMath.insetSection(top, thicknessMm)
            : top;
        return Math.max(0, 2 * Math.min(topInner.a || 0, topInner.b || 0));
    }

    function computeDegarnieMmFromUsefulCapacityCl(sectionsData, usefulCl) {
        var ctx = buildInteriorContext(sectionsData);
        var yBottom = (ctx.innerSectionsData && ctx.innerSectionsData.sections && ctx.innerSectionsData.sections.length)
            ? (ctx.innerSectionsData.sections[0].H || 0)
            : 0;
        var yTop = getTopBagueHeight(ctx);
        var vTop = computeVolumeUpToHeightMm3(ctx, yTop);
        var targetMm3 = Math.max(0, Math.min(vTop, (usefulCl || 0) * 10000));
        if (targetMm3 <= EPS) return Math.max(0, yTop - yBottom);
        if (targetMm3 >= vTop - EPS) return 0;

        var lo = yBottom;
        var hi = yTop;
        for (var it = 0; it < 36; it++) {
            var mid = (lo + hi) * 0.5;
            var vmid = computeVolumeUpToHeightMm3(ctx, mid);
            if (vmid < targetMm3) lo = mid; else hi = mid;
        }
        var yFill = (lo + hi) * 0.5;
        return Math.max(0, yTop - yFill);
    }

    return {
        computeTotalInteriorVolumeMm3: computeTotalInteriorVolumeMm3,
        computeTotalOuterVolumeMm3: computeTotalOuterVolumeMm3,
        computeDegarnieMmFromUsefulCapacityCl: computeDegarnieMmFromUsefulCapacityCl,
        computeCanuleDiameterMm: computeCanuleDiameterMm
    };
})();
