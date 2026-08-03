// 01-saas/features/gravure/mesh.js
// Couche 3D : SVG noir → polygones courbes → extrusion simple sur la bouteille.
// Entrées : getEngravingsData() + window.engravingImages[_id]._svgSource.
// UI → events.js + bloc.js. Qualité → GravureRules.MESH.

var Gravure3D = (function () {
    var engravingGroup = null;
    var lastEngravingSignature = '';
    var MESH = (typeof GravureRules !== 'undefined' && GravureRules.MESH) ? GravureRules.MESH : {};

    function disposeGroup(group) {
        if (!group) return;
        group.traverse(function (obj) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) for (var i = 0; i < obj.material.length; i++) obj.material[i].dispose();
                else obj.material.dispose();
            }
        });
    }

    function panelSelect(id, def) {
        if (typeof Bottle3DData !== 'undefined' && Bottle3DData.getPanelSelectValue) {
            return Bottle3DData.getPanelSelectValue(id, def);
        }
        return def;
    }

    function panelSigned(id, def) {
        if (typeof Bottle3DData !== 'undefined' && Bottle3DData.getPanelValueSigned) {
            return Bottle3DData.getPanelValueSigned(id, def);
        }
        return def;
    }

    function collectBagueSections() {
        if (typeof Bottle3DData !== 'undefined' && Bottle3DData.collectBagueSectionsFromPanel) {
            return Bottle3DData.collectBagueSectionsFromPanel();
        }
        return [];
    }

    function normalizeSectionsData(surfaceInput) {
        return Array.isArray(surfaceInput)
            ? { sections: surfaceInput, edgeTypes: [], rhos: [] }
            : (surfaceInput && surfaceInput.sections ? surfaceInput : { sections: [] });
    }

    function engravingOverlapsComplexLiaison(surfaceInput, yMin, yMax) {
        var data = extendSurfaceWithBague(surfaceInput);
        var sections = data.sections || [];
        var edgeTypes = data.edgeTypes || [];
        var rhos = data.rhos || [];
        if (sections.length < 2 || !edgeTypes.length) return false;
        var complexTypes = MESH.COMPLEX_LIAISON_TYPES || ['spline', 'courbeS', 'rayon'];
        var marginMin = MESH.COMPLEX_LIAISON_MARGIN_MIN != null ? MESH.COMPLEX_LIAISON_MARGIN_MIN : 4;
        var marginRho = MESH.COMPLEX_LIAISON_MARGIN_RHO_FACTOR != null ? MESH.COMPLEX_LIAISON_MARGIN_RHO_FACTOR : 0.35;
        for (var i = 0; i < sections.length - 1; i++) {
            var type = edgeTypes[i] || 'ligne';
            if (complexTypes.indexOf(type) < 0) continue;
            var y0 = sections[i].H;
            var y1 = sections[i + 1].H;
            var edgeYMin = Math.min(y0, y1);
            var edgeYMax = Math.max(y0, y1);
            var margin = Math.max(marginMin, Math.abs(rhos[i] || 0) * marginRho);
            if (yMax >= edgeYMin - margin && yMin <= edgeYMax + margin) return true;
        }
        return false;
    }

    function isComplexEngravingRegion(surfaceInput, meta) {
        if (!meta) return false;
        var yMin = meta.centerY - meta.heightMM * 0.5;
        var yMax = meta.centerY + meta.heightMM * 0.5;
        return engravingOverlapsComplexLiaison(surfaceInput, yMin, yMax);
    }

    function getEngravingAdaptiveLimits(surfaceInput, meta) {
        var complex = isComplexEngravingRegion(surfaceInput, meta);
        return {
            complex: complex,
            gridCap: complex
                ? (MESH.GRID_CAP_COMPLEX != null ? MESH.GRID_CAP_COMPLEX : 96)
                : (MESH.GRID_CAP_DEFAULT != null ? MESH.GRID_CAP_DEFAULT : 144),
            profileRes: complex
                ? (MESH.PROFILE_RES_COMPLEX != null ? MESH.PROFILE_RES_COMPLEX : 28)
                : (MESH.PROFILE_RES_DEFAULT != null ? MESH.PROFILE_RES_DEFAULT : 56),
            thetaBuckets: complex
                ? (MESH.THETA_BUCKETS_COMPLEX != null ? MESH.THETA_BUCKETS_COMPLEX : 72)
                : (MESH.THETA_BUCKETS_DEFAULT != null ? MESH.THETA_BUCKETS_DEFAULT : 120)
        };
    }

    function hasInvertedEngravingOnComplexLiaison(surfaceInput) {
        if (typeof window === 'undefined' || typeof window.getEngravingsData !== 'function') return false;
        var engravings = window.getEngravingsData();
        if (!engravings || !engravings.length) return false;
        for (var i = 0; i < engravings.length; i++) {
            if (!engravings[i].invert) continue;
            if (engravings[i].enabled === false) continue;
            var widthMM = Math.max(1, parseFloat(engravings[i].width) || 50);
            var centerY = isFinite(parseFloat(engravings[i].y)) ? parseFloat(engravings[i].y) : 150;
            var heightMM = widthMM;
            var images = window.engravingImages || {};
            var img = images[engravings[i].id];
            if (img && img.width && img.height) heightMM = widthMM * (img.height / img.width);
            if (engravingOverlapsComplexLiaison(surfaceInput, centerY - heightMM * 0.5, centerY + heightMM * 0.5)) return true;
        }
        return false;
    }

    /** Étend sectionsData avec la bague pour que la gravure suive la surface extérieure du col. */
    function extendSurfaceWithBague(surfaceInput) {
        if (!surfaceInput || !surfaceInput.sections || surfaceInput.sections.length < 2) return surfaceInput;
        var bague = collectBagueSections();
        if (!bague.length) return surfaceInput;

        var main = surfaceInput.sections;
        var sTop = main[main.length - 1];
        for (var i = 0; i < bague.length; i++) {
            if (bague[i].H < sTop.H) bague[i].H = sTop.H;
            if (i > 0 && bague[i].H < bague[i - 1].H) bague[i].H = bague[i - 1].H;
        }

        var sections = main.slice();
        for (var bi = 0; bi < bague.length; bi++) sections.push(bague[bi]);

        var edgeTypes = (surfaceInput.edgeTypes || []).slice();
        var rhos = (surfaceInput.rhos || []).slice();
        edgeTypes.push(panelSelect('rb0-type', 'courbeS'));
        rhos.push(panelSigned('rb0-rho', 1));
        for (var e = 0; e < bague.length - 1; e++) {
            var rbId = 'rb' + (e + 1);
            edgeTypes.push(panelSelect(rbId + '-type', 'ligne'));
            rhos.push(panelSigned(rbId + '-rho', 5));
        }

        return { sections: sections, edgeTypes: edgeTypes, rhos: rhos };
    }

    function getInterpolatedSectionAtY(sections, y) {
        if (!sections || !sections.length) return { a: 1, b: 1 };
        if (sections.length === 1) return { a: Math.max(1, sections[0].a), b: Math.max(1, sections[0].b) };
        if (y <= sections[0].H) return { a: Math.max(1, sections[0].a), b: Math.max(1, sections[0].b) };
        var last = sections[sections.length - 1];
        if (y >= last.H) return { a: Math.max(1, last.a), b: Math.max(1, last.b) };
        for (var i = 0; i < sections.length - 1; i++) {
            var s0 = sections[i], s1 = sections[i + 1];
            if (y < s0.H || y > s1.H) continue;
            var dy = s1.H - s0.H;
            var t = dy > 1e-6 ? ((y - s0.H) / dy) : 0;
            return { a: Math.max(1, s0.a + (s1.a - s0.a) * t), b: Math.max(1, s0.b + (s1.b - s0.b) * t) };
        }
        return { a: Math.max(1, last.a), b: Math.max(1, last.b) };
    }

    function getRadiusAtYTheta(sections, y, theta) {
        var sec = getInterpolatedSectionAtY(sections, y);
        var c = Math.cos(theta), s = Math.sin(theta);
        var denom = Math.sqrt((c * c) / (sec.a * sec.a) + (s * s) / (sec.b * sec.b));
        if (!isFinite(denom) || denom < 1e-9) return Math.max(sec.a, sec.b);
        return 1 / denom;
    }

    function createRadiusSampler(surfaceInput, options) {
        options = options || {};
        var profileRes = options.profileRes || (MESH.PROFILE_RES_DEFAULT != null ? MESH.PROFILE_RES_DEFAULT : 72);
        var thetaBuckets = options.thetaBuckets || (MESH.THETA_BUCKETS_DEFAULT != null ? MESH.THETA_BUCKETS_DEFAULT : 160);
        var sectionsData = normalizeSectionsData(surfaceInput);
        var sections = sectionsData.sections || [];
        var canUseProfile = typeof BottleMaths !== 'undefined' && typeof GeomKernel !== 'undefined' && BottleMaths.buildExteriorProfile && GeomKernel.tessellateProfile && sectionsData.edgeTypes && sectionsData.rhos;
        var cache = {};

        function thetaCacheKey(theta) {
            var t = (theta % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
            return Math.min(thetaBuckets - 1, Math.floor(t / (2 * Math.PI) * thetaBuckets));
        }

        function radiusFromProfile(y, theta) {
            var key = String(thetaCacheKey(theta));
            var profile = cache[key];
            if (!profile) {
                var bucketTheta = ((parseInt(key, 10) + 0.5) / thetaBuckets) * 2 * Math.PI;
                var entities = BottleMaths.buildExteriorProfile(bucketTheta, sectionsData);
                profile = GeomKernel.tessellateProfile(entities, profileRes) || [];
                cache[key] = profile;
            }
            if (!profile.length) return getRadiusAtYTheta(sections, y, theta);
            var nearest = profile[0], nearestDy = Math.abs(nearest.y - y);
            for (var i = 0; i < profile.length - 1; i++) {
                var p0 = profile[i], p1 = profile[i + 1];
                var minY = Math.min(p0.y, p1.y), maxY = Math.max(p0.y, p1.y);
                var d0 = Math.abs(p0.y - y);
                if (d0 < nearestDy) { nearestDy = d0; nearest = p0; }
                if (y < minY || y > maxY) continue;
                var dy = p1.y - p0.y;
                if (Math.abs(dy) < 1e-9) return Math.max(0, p0.x);
                var t = (y - p0.y) / dy;
                return Math.max(0, p0.x + (p1.x - p0.x) * t);
            }
            return Math.max(0, nearest.x);
        }
        return function (y, theta) {
            if (!sections.length) return 1;
            return canUseProfile ? radiusFromProfile(y, theta) : getRadiusAtYTheta(sections, y, theta);
        };
    }

    function getSurfacePoint(radiusAt, y, theta) {
        var r = radiusAt(y, theta);
        return { x: r * Math.cos(theta), y: y, z: r * Math.sin(theta), r: r };
    }

    // Parse SVG noir → courbes mathématiques (cache)
    function parseSvgPolygonsCached(img) {
        if (!img || !img._svgSource || typeof GravureSvg === 'undefined' || !GravureSvg.parse) return null;
        var flatFrac = MESH.SVG_FLATNESS_FRAC != null ? MESH.SVG_FLATNESS_FRAC : 0.00055;
        var minFlat = MESH.SVG_MIN_FLATNESS != null ? MESH.SVG_MIN_FLATNESS : 0.025;
        var key = ['ink3', img._svgSource.length, flatFrac, minFlat].join('|');
        if (img._svgParsed && img._svgParsedKey === key) return img._svgParsed;
        var parsed = GravureSvg.parse(img._svgSource, {
            flatnessFrac: flatFrac,
            minFlatness: minFlat
        });
        img._svgParsedKey = key;
        img._svgParsed = parsed;
        return parsed;
    }

    // Contours noirs : courbes C/Q/A conservées + polygones pour punch
    function buildEngravingMeta(img, g) {
        if (!img || !img._svgSource) return null;
        var parsed = parseSvgPolygonsCached(img);
        if (!parsed) return null;
        var hasCurves = parsed.curves && parsed.curves.length;
        var hasPolys = parsed.polygons && parsed.polygons.length;
        if (!hasCurves && !hasPolys) return null;

        var widthMM = Math.max(1, parseFloat(g.width) || 50);
        var depthMM = Math.max(0.05, parseFloat(g.depth) || 1.5);
        var centerY = isFinite(parseFloat(g.y)) ? parseFloat(g.y) : 150;
        var baseAngle = isFinite(parseFloat(g.angle)) ? parseFloat(g.angle) : 0;
        var flip = !!g.flip;
        var invert = !!g.invert;
        var aspect = parsed.height / Math.max(1e-6, parsed.width);
        var heightMM = widthMM * aspect;
        var uvPolys = [];
        if (hasPolys) {
            for (var pi = 0; pi < parsed.polygons.length; pi++) {
                var src = parsed.polygons[pi];
                var uv = [];
                for (var pj = 0; pj < src.length; pj++) {
                    uv.push({
                        x: (src[pj].x - parsed.minX) / parsed.width,
                        y: (src[pj].y - parsed.minY) / parsed.height
                    });
                }
                if (uv.length >= 3) uvPolys.push(uv);
            }
        }
        // Punch / invert : toujours des polygones UV (même si on part des courbes)
        if (!uvPolys.length && hasCurves && typeof GravureSvg !== 'undefined' && GravureSvg.sampleCurveSubpath) {
            var flatSvg = Math.max(
                0.01,
                (MESH.SVG_CURVE_FLATNESS_MM != null ? MESH.SVG_CURVE_FLATNESS_MM : 0.06)
                    / Math.max(widthMM, 1e-6) * parsed.width
            );
            for (var ci = 0; ci < parsed.curves.length; ci++) {
                var cpts = GravureSvg.sampleCurveSubpath(parsed.curves[ci], flatSvg);
                if (!cpts || cpts.length < 3) continue;
                var cuv = [];
                for (var ck = 0; ck < cpts.length; ck++) {
                    cuv.push({
                        x: (cpts[ck].x - parsed.minX) / parsed.width,
                        y: (cpts[ck].y - parsed.minY) / parsed.height
                    });
                }
                if (cuv.length >= 3) uvPolys.push(cuv);
            }
        }
        if (!uvPolys.length && !hasCurves) return null;
        return {
            curves: hasCurves ? parsed.curves : null,
            svgMinX: parsed.minX,
            svgMinY: parsed.minY,
            svgWidth: parsed.width,
            svgHeight: parsed.height,
            polygons: uvPolys,
            widthMM: widthMM,
            heightMM: heightMM,
            depthMM: depthMM,
            centerY: centerY,
            baseAngle: baseAngle,
            flip: flip,
            invert: invert,
            enabled: g.enabled !== false,
            vector: true
        };
    }

    function buildEngravingMask(img, g) {
        return buildEngravingMeta(img, g);
    }

    function sampleMaskSolid(meta, radiusAt, y, theta) {
        if (!meta || !meta.polygons || !meta.polygons.length) return false;
        if (typeof GravureSvg === 'undefined' || !GravureSvg.pointInPolygons) return false;
        var baseRadius = Math.max(1, radiusAt(meta.centerY, meta.baseAngle));
        var dTheta = theta - meta.baseAngle;
        while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
        while (dTheta < -Math.PI) dTheta += 2 * Math.PI;
        var xCentered = dTheta * baseRadius;
        var uMap = (xCentered / meta.widthMM) + 0.5;
        if (meta.flip) uMap = 1 - uMap;
        var vMap = 0.5 - ((y - meta.centerY) / meta.heightMM);
        if (uMap < 0 || uMap > 1 || vMap < 0 || vMap > 1) return false;
        return GravureSvg.pointInPolygons(uMap, vMap, meta.polygons);
    }

    function prepareMetaPunchBounds(meta, radiusAt) {
        var baseRadius = Math.max(1, radiusAt(meta.centerY, meta.baseAngle));
        meta._baseRadius = baseRadius;
        meta._yMin = meta.centerY - meta.heightMM * 0.5 - 1;
        meta._yMax = meta.centerY + meta.heightMM * 0.5 + 1;
        meta._thetaHalf = (meta.widthMM * 0.5) / baseRadius + 0.08;
    }

    function normalizeAngleDelta(theta, baseAngle) {
        var dTheta = theta - baseAngle;
        while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
        while (dTheta < -Math.PI) dTheta += 2 * Math.PI;
        return dTheta;
    }

    function triangleOutsideMetaBounds(meta, pos, i0, i1, i2) {
        if (meta._yMin == null) return false;
        var yLo = Infinity;
        var yHi = -Infinity;
        var verts = [i0, i1, i2];
        for (var vi = 0; vi < 3; vi++) {
            var vy = pos.getY(verts[vi]);
            if (vy < yLo) yLo = vy;
            if (vy > yHi) yHi = vy;
        }
        if (yHi < meta._yMin || yLo > meta._yMax) return true;

        var thetaInside = 0;
        for (vi = 0; vi < 3; vi++) {
            var vx = pos.getX(verts[vi]);
            var vz = pos.getZ(verts[vi]);
            if ((vx * vx + vz * vz) < 1e-8) continue;
            if (Math.abs(normalizeAngleDelta(Math.atan2(vz, vx), meta.baseAngle)) <= meta._thetaHalf) thetaInside++;
        }
        if (thetaInside > 0) return false;

        var cx = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3;
        var cz = (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3;
        if ((cx * cx + cz * cz) < 1e-8) return true;
        return Math.abs(normalizeAngleDelta(Math.atan2(cz, cx), meta.baseAngle)) > meta._thetaHalf;
    }

    function collectEngravingMetas(surfaceInput) {
        if (typeof window === 'undefined' || typeof window.getEngravingsData !== 'function') return [];
        var engravings = window.getEngravingsData();
        if (!engravings || !engravings.length) return [];
        var images = window.engravingImages || {};
        var extended = extendSurfaceWithBague(surfaceInput);
        var metas = [];
        for (var i = 0; i < engravings.length; i++) {
            var g = engravings[i];
            var img = images[g.id];
            var widthMM = Math.max(1, parseFloat(g.width) || 50);
            var centerY = isFinite(parseFloat(g.y)) ? parseFloat(g.y) : 150;
            var heightMM = widthMM;
            if (img && img.width && img.height) heightMM = widthMM * (img.height / img.width);
            if (!img || !img._svgSource) continue;
            if (g.enabled === false) continue;
            var limits = getEngravingAdaptiveLimits(surfaceInput, {
                centerY: centerY,
                heightMM: heightMM,
                widthMM: widthMM
            });
            var meta = buildEngravingMeta(img, g);
            if (!meta) continue;
            meta.radiusAt = createRadiusSampler(extended, {
                profileRes: limits.profileRes,
                thetaBuckets: limits.thetaBuckets
            });
            prepareMetaPunchBounds(meta, meta.radiusAt);
            metas.push(meta);
        }
        return metas;
    }

    function getInvertedEngravingMetas(surfaceInput) {
        var metas = collectEngravingMetas(surfaceInput);
        var inverted = [];
        for (var i = 0; i < metas.length; i++) {
            if (metas[i].invert) inverted.push(metas[i]);
        }
        return inverted;
    }

    function hasInvertedEngravings(surfaceInput) {
        return getInvertedEngravingMetas(surfaceInput).length > 0;
    }

    function getBottleTessellationOverrides(surfaceInput) {
        if (!hasInvertedEngravings(surfaceInput)) return null;
        var complex = MESH.BOTTLE_TESS_COMPLEX || { nTheta: 384, meridianRes: 192 };
        var simple = MESH.BOTTLE_TESS_SIMPLE || { nTheta: 512, meridianRes: 256 };
        if (hasInvertedEngravingOnComplexLiaison(surfaceInput)) {
            return { nTheta: complex.nTheta, meridianRes: complex.meridianRes };
        }
        return { nTheta: simple.nTheta, meridianRes: simple.meridianRes };
    }

    function triangleShouldCutAtEngravingBorder(meta, radiusAt, pos, i0, i1, i2) {
        var insideCount = 0;
        var verts = [i0, i1, i2];
        for (var vi = 0; vi < 3; vi++) {
            var vx = pos.getX(verts[vi]), vy = pos.getY(verts[vi]), vz = pos.getZ(verts[vi]);
            var vr = Math.sqrt(vx * vx + vz * vz);
            if (vr < 1e-6) continue;
            if (sampleMaskSolid(meta, radiusAt, vy, Math.atan2(vz, vx))) insideCount++;
        }
        var cx = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3;
        var cy = (pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3;
        var cz = (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3;
        var cr = Math.sqrt(cx * cx + cz * cz);
        var centerInside = false;
        if (cr >= 1e-6) {
            centerInside = sampleMaskSolid(meta, radiusAt, cy, Math.atan2(cz, cx));
        }
        // Trou réel : centre dans la forme, ou majorité des sommets
        return centerInside || insideCount >= 2;
    }

    // Mode inversé : ouvre la peau extérieure sous le masque (pas l’intérieur → la poche reste visible)
    function punchHolesForInvertedEngravings(mesh, surfaceInput) {
        if (!mesh || !mesh.geometry || typeof THREE === 'undefined') return;
        if (mesh.userData && mesh.userData.isInterior) return;
        var geo = mesh.geometry;
        var pos = geo.attributes.position;
        var index = geo.index;
        if (!pos || !index || !index.count) return;

        var inverted = getInvertedEngravingMetas(surfaceInput);
        if (!inverted.length) return;

        var newIndices = [];
        for (var fi = 0; fi < index.count; fi += 3) {
            var i0 = index.getX(fi), i1 = index.getX(fi + 1), i2 = index.getX(fi + 2);
            var remove = false;
            for (var ii = 0; ii < inverted.length && !remove; ii++) {
                var meta = inverted[ii];
                if (!meta.polygons || !meta.polygons.length) continue;
                if (triangleOutsideMetaBounds(meta, pos, i0, i1, i2)) continue;
                if (triangleShouldCutAtEngravingBorder(meta, meta.radiusAt, pos, i0, i1, i2)) remove = true;
            }
            if (!remove) newIndices.push(i0, i1, i2);
        }
        geo.setIndex(newIndices);
        geo.computeVertexNormals();
    }

    function contourRingsUV(meta) {
        var rings = [];
        var flatSvg = Math.max(
            0.01,
            (MESH.SVG_CURVE_FLATNESS_MM != null ? MESH.SVG_CURVE_FLATNESS_MM : 0.06)
                / Math.max(meta.widthMM, 1e-6) * (meta.svgWidth || 1)
        );
        if (meta.curves && meta.curves.length && typeof GravureSvg !== 'undefined' && GravureSvg.sampleCurveSubpath) {
            for (var ci = 0; ci < meta.curves.length; ci++) {
                var pts = GravureSvg.sampleCurveSubpath(meta.curves[ci], flatSvg);
                if (!pts || pts.length < 3) continue;
                var uv = [];
                for (var i = 0; i < pts.length; i++) {
                    uv.push({
                        x: (pts[i].x - meta.svgMinX) / Math.max(1e-9, meta.svgWidth),
                        y: (pts[i].y - meta.svgMinY) / Math.max(1e-9, meta.svgHeight)
                    });
                }
                if (uv.length >= 3) rings.push(uv);
            }
        }
        if (!rings.length && meta.polygons && meta.polygons.length) {
            for (var pi = 0; pi < meta.polygons.length; pi++) {
                if (meta.polygons[pi] && meta.polygons[pi].length >= 3) rings.push(meta.polygons[pi]);
            }
        }
        return rings;
    }

    function cleanUvRing(ring) {
        var pts = [];
        for (var i = 0; i < ring.length; i++) {
            var p = ring[i];
            if (!pts.length || Math.abs(pts[pts.length - 1].x - p.x) > 1e-10 || Math.abs(pts[pts.length - 1].y - p.y) > 1e-10) {
                pts.push({ x: p.x, y: p.y });
            }
        }
        if (pts.length >= 2 && Math.abs(pts[0].x - pts[pts.length - 1].x) < 1e-10 && Math.abs(pts[0].y - pts[pts.length - 1].y) < 1e-10) {
            pts.pop();
        }
        return pts;
    }

    function ringArea2(pts) {
        var a = 0;
        for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            a += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
        }
        return a;
    }

    function pointInTri2(p, a, b, c) {
        function cross(p0, p1, p2) {
            return (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
        }
        var s = cross(a, b, c) >= 0 ? 1 : -1;
        return s * cross(a, b, p) >= -1e-12 && s * cross(b, c, p) >= -1e-12 && s * cross(c, a, p) >= -1e-12;
    }

    function triangulateUvRing(ring) {
        var pts = cleanUvRing(ring);
        if (pts.length < 3) return null;
        if (ringArea2(pts) < 0) pts = pts.slice().reverse();

        if (typeof THREE !== 'undefined' && THREE.ShapeUtils && THREE.ShapeUtils.triangulateShape) {
            try {
                var contour = [];
                for (var ci = 0; ci < pts.length; ci++) contour.push(new THREE.Vector2(pts[ci].x, pts[ci].y));
                var faces = THREE.ShapeUtils.triangulateShape(contour, []);
                if (faces && faces.length) return { pts: pts, faces: faces };
            } catch (e) { /* earclip */ }
        }

        var idx = [];
        for (var i = 0; i < pts.length; i++) idx.push(i);
        var facesEc = [];
        var guard = 0;
        var maxGuard = pts.length * pts.length + 16;
        while (idx.length > 3 && guard++ < maxGuard) {
            var earFound = false;
            for (var k = 0; k < idx.length; k++) {
                var i0 = idx[(k - 1 + idx.length) % idx.length];
                var i1 = idx[k];
                var i2 = idx[(k + 1) % idx.length];
                var a = pts[i0], b = pts[i1], c = pts[i2];
                var cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
                if (cross <= 1e-12) continue;
                var hasPoint = false;
                for (var t = 0; t < idx.length; t++) {
                    var ii = idx[t];
                    if (ii === i0 || ii === i1 || ii === i2) continue;
                    if (pointInTri2(pts[ii], a, b, c)) { hasPoint = true; break; }
                }
                if (hasPoint) continue;
                facesEc.push([i0, i1, i2]);
                idx.splice(k, 1);
                earFound = true;
                break;
            }
            if (!earFound) break;
        }
        if (idx.length === 3) facesEc.push([idx[0], idx[1], idx[2]]);
        return facesEc.length ? { pts: pts, faces: facesEc } : null;
    }

    // Subdiv 2D agressive : plus de longues diagonales → plus de traits au milieu
    function subdivideUvFaces(pts, faces, maxEdgeUV) {
        var max2 = maxEdgeUV * maxEdgeUV;
        var verts = pts.map(function (p) { return { x: p.x, y: p.y }; });
        var tris = faces.map(function (f) { return [f[0], f[1], f[2]]; });
        var edgeMid = Object.create(null);

        function mid(i0, i1) {
            var a = i0 < i1 ? i0 : i1;
            var b = i0 < i1 ? i1 : i0;
            var key = a + ':' + b;
            if (edgeMid[key] != null) return edgeMid[key];
            var m = verts.length;
            verts.push({
                x: (verts[i0].x + verts[i1].x) * 0.5,
                y: (verts[i0].y + verts[i1].y) * 0.5
            });
            edgeMid[key] = m;
            return m;
        }
        function len2(i0, i1) {
            var dx = verts[i0].x - verts[i1].x;
            var dy = verts[i0].y - verts[i1].y;
            return dx * dx + dy * dy;
        }

        var guard = 0;
        while (guard++ < 14) {
            edgeMid = Object.create(null);
            // rebuild mids each pass from current verts — keep stable mids across tris in one pass
            var next = [];
            var splitAny = false;
            for (var t = 0; t < tris.length; t++) {
                var a = tris[t][0], b = tris[t][1], c = tris[t][2];
                var d01 = len2(a, b), d12 = len2(b, c), d20 = len2(c, a);
                var longest = d01, e = 0;
                if (d12 > longest) { longest = d12; e = 1; }
                if (d20 > longest) { longest = d20; e = 2; }
                if (longest <= max2) {
                    next.push([a, b, c]);
                    continue;
                }
                splitAny = true;
                if (e === 0) {
                    var m01 = mid(a, b);
                    next.push([a, m01, c], [m01, b, c]);
                } else if (e === 1) {
                    var m12 = mid(b, c);
                    next.push([a, b, m12], [a, m12, c]);
                } else {
                    var m20 = mid(c, a);
                    next.push([a, b, m20], [m20, b, c]);
                }
            }
            tris = next;
            if (!splitAny) break;
        }
        return { pts: verts, faces: tris };
    }

    // Relief sortant = dessus+parois+fond (courbes SVG).
    // Inverser = comme l’ancien PNG : punch d’ouverture + poche (fond + parois), courbes SVG.
    function buildReliefEngravingGeometry(meta, radiusAt) {
        if (!meta || typeof THREE === 'undefined') return null;
        var rings = contourRingsUV(meta);
        if (!rings.length) return null;

        var widthMM = meta.widthMM;
        var heightMM = meta.heightMM;
        var depthMM = Math.max(0.05, meta.depthMM);
        var flip = meta.flip;
        var invert = meta.invert;
        var baseRadius = Math.max(1, radiusAt(meta.centerY, meta.baseAngle));
        var centerY = meta.centerY;
        var baseAngle = meta.baseAngle;
        // Poche assez profonde pour rester lisible ; légèrement rentrée pour éviter le z-fight du punch
        var dirDepth = invert ? -Math.max(depthMM, 1.2) : depthMM;
        var openDepth = invert ? -0.2 : 0;
        var maxEdgeUV = 0.55 / Math.max(widthMM, heightMM, 1e-6);

        var vertices = [];
        var indices = [];
        var capCache = Object.create(null);

        function project(uRaw, vRaw, outwardDepth) {
            var uMap = flip ? (1 - uRaw) : uRaw;
            var xCentered = (uMap - 0.5) * widthMM;
            var yMM = centerY + (0.5 - vRaw) * heightMM;
            var theta = baseAngle + (xCentered / baseRadius);
            var surf = getSurfacePoint(radiusAt, yMM, theta);
            if (!isFinite(surf.x) || !isFinite(surf.y) || !isFinite(surf.z)) return null;
            var nx = Math.cos(theta), nz = Math.sin(theta);
            return {
                x: surf.x + nx * outwardDepth,
                y: yMM,
                z: surf.z + nz * outwardDepth
            };
        }

        function pushVert(u, v, outwardDepth) {
            var key = (u * 1e5 | 0) + ',' + (v * 1e5 | 0) + ',' + (outwardDepth * 1e3 | 0);
            if (capCache[key] != null) return capCache[key];
            var p = project(u, v, outwardDepth);
            if (!p) return -1;
            vertices.push(p.x, p.y, p.z);
            var idx = (vertices.length / 3) - 1;
            capCache[key] = idx;
            return idx;
        }

        function pushWall(u, v, outwardDepth) {
            var p = project(u, v, outwardDepth);
            if (!p) return -1;
            vertices.push(p.x, p.y, p.z);
            return (vertices.length / 3) - 1;
        }

        function addTri(a, b, c) {
            if (a < 0 || b < 0 || c < 0) return;
            indices.push(a, b, c);
        }
        function addQuad(a, b, c, d) {
            addTri(a, b, c);
            addTri(a, c, d);
        }

        for (var ri = 0; ri < rings.length; ri++) {
            var ring = cleanUvRing(rings[ri]);
            if (ring.length < 3) continue;

            var tri = triangulateUvRing(ring);
            if (tri) {
                var dense = subdivideUvFaces(tri.pts, tri.faces, maxEdgeUV);
                for (var fi = 0; fi < dense.faces.length; fi++) {
                    var f = dense.faces[fi];
                    var p0 = dense.pts[f[0]], p1 = dense.pts[f[1]], p2 = dense.pts[f[2]];

                    // Fond (invert) ou dessus (relief) — même winding que l’ancien PNG
                    var t0 = pushVert(p0.x, p0.y, dirDepth);
                    var t1 = pushVert(p1.x, p1.y, dirDepth);
                    var t2 = pushVert(p2.x, p2.y, dirDepth);
                    addTri(t0, t1, t2);

                    // Face contre la surface : seulement en relief sortant
                    if (!invert) {
                        var b0 = pushVert(p0.x, p0.y, 0);
                        var b1 = pushVert(p1.x, p1.y, 0);
                        var b2 = pushVert(p2.x, p2.y, 0);
                        addTri(b0, b2, b1);
                    }
                }
            }

            // Parois contour : ouverture ↔ fond/dessus (courbe SVG)
            for (var e = 0; e < ring.length; e++) {
                var a = ring[e];
                var b = ring[(e + 1) % ring.length];
                var ta = pushWall(a.x, a.y, dirDepth);
                var tb = pushWall(b.x, b.y, dirDepth);
                var ba = pushWall(a.x, a.y, openDepth);
                var bb = pushWall(b.x, b.y, openDepth);
                // Invert : winding vers l’intérieur de la poche (visible depuis l’extérieur)
                if (invert) addQuad(ba, bb, tb, ta);
                else addQuad(ba, ta, tb, bb);
            }
        }

        if (!indices.length) return null;
        var geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();
        return geom;
    }

    function createEngravingMaterial() {
        // Même couleur que la bouteille (invert / miroir / relief) — opaque pour rester visible
        var mat;
        if (typeof BottleMaterials !== 'undefined' && BottleMaterials.getBaseMaterial) {
            mat = BottleMaterials.getBaseMaterial(BottleMaterials.DEFAULT_GLASS_COLOR);
        } else {
            mat = new THREE.MeshPhongMaterial({ color: 0x99bbdd });
        }
        mat.side = THREE.DoubleSide;
        mat.transparent = false;
        mat.opacity = 1;
        mat.depthWrite = true;
        mat.depthTest = true;
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = -1;
        mat.polygonOffsetUnits = -1;
        if (!mat.userData) mat.userData = {};
        mat.userData.keepOpaque = true;
        mat.userData.baseOpacity = 1;
        mat.userData.baseDepthWrite = true;
        return mat;
    }

    function buildEngravingsGroup(surfaceInput) {
        if (typeof window === 'undefined' || typeof THREE === 'undefined') return null;
        if (typeof window.getEngravingsData !== 'function') return null;
        var engravings = window.getEngravingsData();
        if (!engravings || !engravings.length) return null;
        var images = window.engravingImages || {};
        var group = new THREE.Group();
        var extended = extendSurfaceWithBague(surfaceInput);

        for (var gi = 0; gi < engravings.length; gi++) {
            var g = engravings[gi], img = images[g.id];
            if (!img || !img._svgSource) continue;
            if (g.enabled === false) continue;
            var widthMM = Math.max(1, parseFloat(g.width) || 50);
            var centerY = isFinite(parseFloat(g.y)) ? parseFloat(g.y) : 150;
            var heightMM = widthMM;
            if (img.width && img.height) heightMM = widthMM * (img.height / img.width);
            var limits = getEngravingAdaptiveLimits(surfaceInput, {
                centerY: centerY,
                heightMM: heightMM,
                widthMM: widthMM
            });
            var meta = buildEngravingMeta(img, g);
            if (!meta) continue;
            var radiusAt = createRadiusSampler(extended, {
                profileRes: limits.profileRes,
                thetaBuckets: limits.thetaBuckets
            });
            var geom = buildReliefEngravingGeometry(meta, radiusAt);
            if (!geom) continue;
            var mat = createEngravingMaterial();
            var mesh = new THREE.Mesh(geom, mat);
            mesh.userData.isPiqure = false;
            mesh.userData.isInterior = false;
            mesh.renderOrder = 3;
            group.add(mesh);
        }
        return group.children.length ? group : null;
    }

    function buildEngravingSceneSignature(surfaceInput) {
        var extended = extendSurfaceWithBague(surfaceInput);
        var secParts = [];
        if (extended && extended.sections) {
            for (var si = 0; si < extended.sections.length; si++) {
                var s = extended.sections[si];
                secParts.push([
                    Math.round((s.H || 0) * 100) / 100,
                    Math.round((s.a || 0) * 100) / 100,
                    Math.round((s.b || 0) * 100) / 100,
                    s.shape || '',
                    Math.round((s.carreNiveau || 0) * 100) / 100
                ].join(','));
            }
        }
        if (extended && extended.edgeTypes) secParts.push('e:' + extended.edgeTypes.join(','));
        if (extended && extended.rhos) {
            var rr = [];
            for (var ri = 0; ri < extended.rhos.length; ri++) rr.push(Math.round((extended.rhos[ri] || 0) * 100) / 100);
            secParts.push('r:' + rr.join(','));
        }
        var engravings = (typeof window !== 'undefined' && window.getEngravingsData) ? window.getEngravingsData() : [];
        var images = (typeof window !== 'undefined' && window.engravingImages) ? window.engravingImages : {};
        var gParts = [];
        for (var gi = 0; gi < engravings.length; gi++) {
            var g = engravings[gi];
            var img = images[g.id];
            gParts.push([
                g.id || '',
                img ? (img._svgSource ? ('svg' + img._svgSource.length) : (img.width + 'x' + img.height)) : '0',
                Math.round((g.y || 0) * 100) / 100,
                Math.round((g.angle || 0) * 10000) / 10000,
                Math.round((g.width || 0) * 100) / 100,
                Math.round((g.depth || 0) * 100) / 100,
                g.flip ? 1 : 0,
                g.invert ? 1 : 0,
                g.enabled !== false ? 1 : 0
            ].join(':'));
        }
        var renderMode = (typeof BottleMaterials !== 'undefined' && BottleMaterials.getRenderMaterialMode)
            ? BottleMaterials.getRenderMaterialMode()
            : 'base';
        return secParts.join('|') + '##' + gParts.join('|') + '##rm:' + renderMode;
    }

    function buildInvertedEngravingPunchSignature(surfaceInput) {
        if (typeof window === 'undefined' || typeof window.getEngravingsData !== 'function') return '';
        var engravings = window.getEngravingsData();
        if (!engravings || !engravings.length) return '';
        var images = window.engravingImages || {};
        var parts = [];
        for (var gi = 0; gi < engravings.length; gi++) {
            var g = engravings[gi];
            if (!g.invert) continue;
            var img = images[g.id];
            parts.push([
                g.id || '',
                img ? (img._svgSource ? ('svg' + img._svgSource.length) : (img.width + 'x' + img.height)) : '0',
                Math.round((g.y || 0) * 100) / 100,
                Math.round((g.angle || 0) * 10000) / 10000,
                Math.round((g.width || 0) * 100) / 100,
                Math.round((g.depth || 0) * 100) / 100,
                g.flip ? 1 : 0,
                g.enabled !== false ? 1 : 0
            ].join(':'));
        }
        return parts.join('|');
    }

    function refreshEngravingOpacity() {
        if (!engravingGroup || typeof BottleView3D === 'undefined' || !BottleView3D.applyViewOpacity) return;
        BottleView3D.applyViewOpacity(engravingGroup);
    }

    // Appelé avant dispose du sectionRingGroup : force une vraie reconstruction (évite matériaux déjà disposés)
    function invalidateScene() {
        engravingGroup = null;
        lastEngravingSignature = '';
    }

    // Reconstruit le groupe de meshes gravure si la signature a changé
    function updateScene(scene, surfaceInput, parentGroup) {
        if (!scene || !surfaceInput) return;
        var parent = parentGroup || scene;
        var sig = buildEngravingSceneSignature(surfaceInput);
        if (sig === lastEngravingSignature && engravingGroup) {
            if (engravingGroup.parent !== parent) {
                if (engravingGroup.parent) engravingGroup.parent.remove(engravingGroup);
                parent.add(engravingGroup);
            }
            return;
        }
        lastEngravingSignature = sig;
        if (engravingGroup) {
            if (engravingGroup.parent) engravingGroup.parent.remove(engravingGroup);
            disposeGroup(engravingGroup);
            engravingGroup = null;
        }
        engravingGroup = buildEngravingsGroup(surfaceInput);
        if (engravingGroup) {
            engravingGroup.userData.isBottleExportRoot = true;
            parent.add(engravingGroup);
            if (typeof BottleView3D !== 'undefined' && BottleView3D.applyViewOpacity) {
                BottleView3D.applyViewOpacity(engravingGroup);
            }
        }
    }

    return {
        updateScene: updateScene,
        invalidateScene: invalidateScene,
        refreshEngravingOpacity: refreshEngravingOpacity,
        applyInvertedEngravingsToBottleMesh: punchHolesForInvertedEngravings,
        punchHolesForInvertedEngravings: punchHolesForInvertedEngravings,
        getBottleTessellationOverrides: getBottleTessellationOverrides,
        hasInvertedEngravings: hasInvertedEngravings,
        buildInvertedEngravingPunchSignature: buildInvertedEngravingPunchSignature
    };
})();
