// calcule/math.js — calculs de volume et dérivés (mm³, mm, cl).
// Rôle : volume intérieur (cavité liquide), volume extérieur (verre), dégarnie, Ø brochage.
// Sections piqûre/bague → Bottle3DData. Épaisseur verre → InterieurMath.
// Résultats affichés par function.js (overlay 3D + panneau).

var CalculeVolumeMath = (function () {
    function rules() {
        return typeof CalculeRules !== 'undefined' ? CalculeRules : {};
    }

    function eps() {
        return rules().EPS != null ? rules().EPS : 1e-9;
    }

    function clamp01(v) {
        return Math.max(0, Math.min(1, v));
    }

    function getPiqureSections() {
        if (typeof Bottle3DData !== 'undefined' && Bottle3DData.collectPiqureSectionsFromPanel) {
            return Bottle3DData.collectPiqureSectionsFromPanel();
        }
        return [];
    }

    function getBagueSections() {
        if (typeof Bottle3DData !== 'undefined' && Bottle3DData.collectBagueSectionsFromPanel) {
            return Bottle3DData.collectBagueSectionsFromPanel();
        }
        return [];
    }

    function panelValue(id, def) {
        if (typeof Bottle3DData !== 'undefined' && Bottle3DData.getPanelValue) {
            return Bottle3DData.getPanelValue(id, def);
        }
        if (typeof document === 'undefined') return def;
        var el = document.getElementById(id);
        if (!el) return def;
        var v = parseFloat(el.value);
        return isNaN(v) ? def : v;
    }

    function tipHeightId() {
        return (typeof Bottle3DRules !== 'undefined' && Bottle3DRules.PIQURE_TIP_HEIGHT_ID)
            ? Bottle3DRules.PIQURE_TIP_HEIGHT_ID
            : 'rp3-h';
    }

    function tipHeightDefault() {
        return (typeof Bottle3DRules !== 'undefined' && Bottle3DRules.PIQURE_TIP_HEIGHT_DEFAULT != null)
            ? Bottle3DRules.PIQURE_TIP_HEIGHT_DEFAULT
            : 30;
    }

    function thicknessMm() {
        return (typeof InterieurMath !== 'undefined' && InterieurMath.getThicknessMm)
            ? InterieurMath.getThicknessMm()
            : 3.5;
    }

    // --- Aires de section et intégration le long de l'axe Y ---

    function normalizeShape(shape) {
        if (!shape || shape === 'rond') return 'cylindrique';
        return shape;
    }

    // Aire au plan d'une section : ellipse (cylindrique/ovale) ou rectangle arrondi (carré).
    function getShapeArea(section) {
        if (!section) return 0;
        var a = Math.max(0, section.a || 0);
        var b = Math.max(0, section.b || 0);
        var e = eps();
        if (a <= e || b <= e) return 0;
        if (normalizeShape(section.shape) === 'carre') {
            var carreNiveau = Math.max(0, Math.min(100, section.carreNiveau || 0));
            var r = (1 - carreNiveau / 100) * Math.min(a, b);
            r = Math.max(0, Math.min(r, Math.min(a, b)));
            return (4 * a * b) - ((4 - Math.PI) * r * r);
        }
        return Math.PI * a * b;
    }

    function lerpSection(s0, s1, t) {
        t = clamp01(t);
        var sh0 = normalizeShape(s0.shape);
        var sh1 = normalizeShape(s1.shape);
        return {
            H: (1 - t) * (s0.H || 0) + t * (s1.H || 0),
            a: (1 - t) * (s0.a || 0) + t * (s1.a || 0),
            b: (1 - t) * (s0.b || 0) + t * (s1.b || 0),
            shape: (sh0 === 'carre' || sh1 === 'carre')
                ? 'carre'
                : ((sh0 === 'ovale' || sh1 === 'ovale') ? 'ovale' : 'cylindrique'),
            carreNiveau: (1 - t) * (s0.carreNiveau || 0) + t * (s1.carreNiveau || 0)
        };
    }

    function integrateSectionAreaLinear(s0, s1) {
        var y0 = s0.H || 0;
        var y1 = s1.H || 0;
        var dy = y1 - y0;
        var e = eps();
        if (dy <= e) return 0;
        var steps = rules().AREA_INTEGRATION_STEPS || 160;
        var h = dy / steps;
        var acc = 0;
        for (var i = 0; i <= steps; i++) {
            var A = getShapeArea(lerpSection(s0, s1, i / steps));
            var w = (i === 0 || i === steps) ? 1 : (i % 2 === 0 ? 2 : 4);
            acc += w * A;
        }
        return (h / 3) * acc;
    }

    function integrateRadiusSquaredOnSegment(x0, y0, x1, y1, yMin, yMax) {
        var e = eps();
        var dy = y1 - y0;
        if (Math.abs(dy) <= e) return 0;
        var ya = Math.max(Math.min(y0, y1), yMin);
        var yb = Math.min(Math.max(y0, y1), yMax);
        if (yb <= ya + e) return 0;
        var m = (x1 - x0) / dy;
        var c = x0 - m * y0;
        return Math.max(0,
            (m * m / 3) * (yb * yb * yb - ya * ya * ya)
            + (m * c) * (yb * yb - ya * ya)
            + (c * c) * (yb - ya)
        );
    }

    // Volume corps principal : intégration ∫ r² dy sur 360 méridien (révolution).
    function integrateMainBodyVolume(sectionsData, yStartOpt, yEndOpt) {
        if (typeof BottleMaths === 'undefined' || typeof GeomKernel === 'undefined') return 0;
        if (!sectionsData || !sectionsData.sections || sectionsData.sections.length < 2) return 0;

        var e = eps();
        var yMinBase = sectionsData.sections[0].H || 0;
        var yMaxBase = sectionsData.sections[sectionsData.sections.length - 1].H || yMinBase;
        var yMin = (typeof yStartOpt === 'number') ? Math.max(yMinBase, yStartOpt) : yMinBase;
        var yMax = (typeof yEndOpt === 'number') ? Math.min(yMaxBase, yEndOpt) : yMaxBase;
        if (yMax <= yMin + e) return 0;

        var thetaN = rules().THETA_SAMPLES || 360;
        var merRes = rules().MERIDIAN_RESOLUTION || 128;
        var sumOverTheta = 0;
        for (var ti = 0; ti < thetaN; ti++) {
            var theta = (ti / thetaN) * 2 * Math.PI;
            var entities = BottleMaths.buildExteriorProfile(theta, sectionsData);
            if (!entities || !entities.length) continue;
            var pts = GeomKernel.tessellateProfile(entities, merRes);
            if (!pts || pts.length < 2) continue;
            var intR2dy = 0;
            for (var i = 0; i < pts.length - 1; i++) {
                intR2dy += integrateRadiusSquaredOnSegment(
                    Math.max(0, pts[i].x), pts[i].y,
                    Math.max(0, pts[i + 1].x), pts[i + 1].y,
                    yMin, yMax
                );
            }
            sumOverTheta += intR2dy;
        }
        return 0.5 * ((2 * Math.PI) / thetaN) * sumOverTheta;
    }

    function integrateSectionAreaLinearClipped(s0, s1, yStart, yEnd) {
        var e = eps();
        var lo = Math.max(Math.min(s0.H, s1.H), yStart);
        var hi = Math.min(Math.max(s0.H, s1.H), yEnd);
        if (hi <= lo + e) return 0;
        var dy = (s1.H - s0.H);
        if (Math.abs(dy) <= e) return 0;
        var c0 = lerpSection(s0, s1, (lo - s0.H) / dy);
        var c1 = lerpSection(s0, s1, (hi - s0.H) / dy);
        c0.H = lo;
        c1.H = hi;
        return integrateSectionAreaLinear(c0, c1);
    }

    function enforceAscending(sections) {
        for (var k = 1; k < sections.length; k++) {
            if (sections[k].H < sections[k - 1].H) sections[k].H = sections[k - 1].H;
        }
    }

    // --- Volumes annexes côté extérieur (piqûre soustraite, bague ajoutée) ---

    // Cône/piqûre du bas : volume à retirer du corps extérieur.
    function computePiqureSubtractedVolume(sectionsData) {
        if (!sectionsData || !sectionsData.sections || !sectionsData.sections.length) return 0;
        var piq = getPiqureSections();
        if (!piq.length) return 0;
        enforceAscending(piq);

        var v = 0;
        for (var j = 0; j < piq.length - 1; j++) {
            v += integrateSectionAreaLinear(piq[j], piq[j + 1]);
        }
        var last = piq[piq.length - 1];
        var apexH = Math.max(last.H, panelValue(tipHeightId(), tipHeightDefault()));
        var dy = apexH - last.H;
        if (dy > eps()) v += getShapeArea(last) * dy / 3;
        return Math.max(0, v);
    }

    // Bague du col : volume ajouté au-dessus de la dernière section corps.
    function computeBagueAddedVolume(sectionsData) {
        if (!sectionsData || !sectionsData.sections || !sectionsData.sections.length) return 0;
        var sTop = sectionsData.sections[sectionsData.sections.length - 1];
        var bague = getBagueSections();
        if (!bague.length) return 0;

        for (var i = 0; i < bague.length; i++) {
            if (bague[i].H < sTop.H) bague[i].H = sTop.H;
            if (i > 0 && bague[i].H < bague[i - 1].H) bague[i].H = bague[i - 1].H;
        }

        var v = integrateSectionAreaLinear(sTop, bague[0]);
        for (var j = 0; j < bague.length - 1; j++) {
            v += integrateSectionAreaLinear(bague[j], bague[j + 1]);
        }
        return Math.max(0, v);
    }

    // --- Cavité intérieure : sections inset + piqûre/bague adaptées à l'épaisseur ---

    // Prépare toutes les sections « liquide » (corps, bague, piqûre) pour l'intégration.
    function buildInteriorContext(sectionsData) {
        var t = thicknessMm();
        var innerSectionsData = (typeof InterieurMath !== 'undefined' && InterieurMath.buildInteriorSectionsDataFromThickness)
            ? InterieurMath.buildInteriorSectionsDataFromThickness(sectionsData, t, t)
            : sectionsData;

        var sTopInner = innerSectionsData && innerSectionsData.sections && innerSectionsData.sections.length
            ? innerSectionsData.sections[innerSectionsData.sections.length - 1]
            : null;

        // Bague intérieure : sb2 calé sur sb3 (règle métier)
        var bague = getBagueSections().map(function (sec) {
            return (typeof InterieurMath !== 'undefined' && InterieurMath.insetSection)
                ? InterieurMath.insetSection(sec, t)
                : sec;
        });
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

        // Piqûre intérieure : outset + décalage H
        var piqOuter = getPiqureSections();
        var piq = [];
        for (var i = 0; i < piqOuter.length; i++) {
            var sec = piqOuter[i];
            if (i === 0) {
                var p0 = {
                    H: (sec.H || 0) + t,
                    a: sec.a,
                    b: sec.b,
                    shape: sec.shape,
                    carreNiveau: sec.carreNiveau
                };
                p0 = (typeof InterieurMath !== 'undefined' && InterieurMath.outsetSection)
                    ? InterieurMath.outsetSection(p0, t)
                    : p0;
                // Pied : H = s1 + épaisseur (comme avant)
                if (sectionsData && sectionsData.sections && sectionsData.sections.length) {
                    p0.H = (sectionsData.sections[0].H || 0) + t;
                }
                piq.push(p0);
                continue;
            }
            var outerAtH = (typeof InterieurMath !== 'undefined' && InterieurMath.getOuterSectionAtHeight)
                ? InterieurMath.getOuterSectionAtHeight(innerSectionsData.sections, sec.H || 0)
                : null;
            var maxTa = outerAtH ? Math.max(0, (outerAtH.a || 0) - (sec.a || 0) - 0.2) : t;
            var maxTb = outerAtH ? Math.max(0, (outerAtH.b || 0) - (sec.b || 0) - 0.2) : t;
            var tPiq = Math.min(t, maxTa, maxTb);
            var outSec = (typeof InterieurMath !== 'undefined' && InterieurMath.outsetSection)
                ? InterieurMath.outsetSection(sec, tPiq)
                : sec;
            outSec.H = (sec.H || 0) + t;
            piq.push(outSec);
        }
        enforceAscending(piq);

        var rp3HInner = null;
        if (piq.length) {
            var last = piq[piq.length - 1];
            rp3HInner = Math.max(last.H, panelValue(tipHeightId(), tipHeightDefault()) + t);
        }

        return {
            innerSectionsData: innerSectionsData,
            sTopInner: sTopInner,
            bagueInner: bague,
            piqInner: piq,
            rp3HInner: rp3HInner
        };
    }

    // Volume intérieur cumulé du pied jusqu'à yTop (corps + bague − piqûre intérieure).
    function computeVolumeUpToHeightMm3(ctx, yTop) {
        if (!ctx || !ctx.innerSectionsData || !ctx.innerSectionsData.sections || !ctx.innerSectionsData.sections.length) {
            return 0;
        }
        var yBottom = ctx.innerSectionsData.sections[0].H || 0;
        var y = Math.max(yBottom, yTop);
        var mainTop = ctx.sTopInner ? ctx.sTopInner.H : yBottom;
        var v = integrateMainBodyVolume(ctx.innerSectionsData, yBottom, Math.min(y, mainTop));

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

    // Capacité ras bord : volume intérieur total jusqu'au sommet de la bague.
    function computeTotalInteriorVolumeMm3(sectionsData) {
        var ctx = buildInteriorContext(sectionsData);
        return computeVolumeUpToHeightMm3(ctx, getTopBagueHeight(ctx));
    }

    // Enveloppe extérieure verre : corps + bague − piqûre (mm³).
    function computeTotalOuterVolumeMm3(sectionsData) {
        if (!sectionsData) return 0;
        return Math.max(0,
            integrateMainBodyVolume(sectionsData)
            + computeBagueAddedVolume(sectionsData)
            - computePiqureSubtractedVolume(sectionsData)
        );
    }

    // Diamètre intérieur du col (brochage) = 2 × min(a, b) de la bague inset.
    function computeCanuleDiameterMm() {
        var bague = getBagueSections();
        if (!bague.length) return 0;
        var top = bague[bague.length - 1];
        var t = thicknessMm();
        var topInner = (typeof InterieurMath !== 'undefined' && InterieurMath.insetSection)
            ? InterieurMath.insetSection(top, t)
            : top;
        return Math.max(0, 2 * Math.min(topInner.a || 0, topInner.b || 0));
    }

    // Dégarnie (mm) : hauteur vide sous le col pour une capacité utile cible (cl), par bisection.
    function computeDegarnieMmFromUsefulCapacityCl(sectionsData, usefulCl) {
        var ctx = buildInteriorContext(sectionsData);
        var e = eps();
        var yBottom = (ctx.innerSectionsData && ctx.innerSectionsData.sections && ctx.innerSectionsData.sections.length)
            ? (ctx.innerSectionsData.sections[0].H || 0)
            : 0;
        var yTop = getTopBagueHeight(ctx);
        var vTop = computeVolumeUpToHeightMm3(ctx, yTop);
        var mm3PerCl = rules().MM3_PER_CL || 10000;
        var targetMm3 = Math.max(0, Math.min(vTop, (usefulCl || 0) * mm3PerCl));
        if (targetMm3 <= e) return Math.max(0, yTop - yBottom);
        if (targetMm3 >= vTop - e) return 0;

        var lo = yBottom;
        var hi = yTop;
        var iters = rules().DEGARNIE_BISECT_ITERS || 36;
        for (var it = 0; it < iters; it++) {
            var mid = (lo + hi) * 0.5;
            if (computeVolumeUpToHeightMm3(ctx, mid) < targetMm3) lo = mid;
            else hi = mid;
        }
        return Math.max(0, yTop - ((lo + hi) * 0.5));
    }

    // Chambre d'expansion (%) : volume d'air entre le niveau utile et le bas du bouchon,
    // rapporté à la capacité ras bord. Plus fiable qu'une proportion linéaire en hauteur.
    function computeExpansionChamberPct(sectionsData, usefulCl, bouchonMm) {
        var ctx = buildInteriorContext(sectionsData);
        var e = eps();
        var mm3PerCl = rules().MM3_PER_CL || 10000;
        var yBottom = (ctx.innerSectionsData && ctx.innerSectionsData.sections && ctx.innerSectionsData.sections.length)
            ? (ctx.innerSectionsData.sections[0].H || 0)
            : 0;
        var yTop = getTopBagueHeight(ctx);
        var vTop = computeVolumeUpToHeightMm3(ctx, yTop);
        if (vTop <= e) return 0;

        var usefulMm3 = Math.max(0, Math.min(vTop, (usefulCl || 0) * mm3PerCl));
        var corkMm = Math.max(0, bouchonMm || 0);
        var yBelowCork = Math.max(yBottom, yTop - corkMm);
        var vBelowCork = computeVolumeUpToHeightMm3(ctx, yBelowCork);
        var chamberMm3 = Math.max(0, vBelowCork - usefulMm3);
        return (chamberMm3 / vTop) * 100;
    }

    return {
        computeTotalInteriorVolumeMm3: computeTotalInteriorVolumeMm3,
        computeTotalOuterVolumeMm3: computeTotalOuterVolumeMm3,
        computeDegarnieMmFromUsefulCapacityCl: computeDegarnieMmFromUsefulCapacityCl,
        computeExpansionChamberPct: computeExpansionChamberPct,
        computeCanuleDiameterMm: computeCanuleDiameterMm
    };
})();
