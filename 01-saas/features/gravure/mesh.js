// saas/features/gravure/mesh.js
// Couche 3D : transforme les cartes UI en géométrie sur la bouteille.
// Entrées : getEngravingsData() + images PNG (window.engravingImages).
// Relief normal → mesh extrudé collé à la surface. Inversé → perce le corps.
// UI (cartes, sliders) → events.js + bloc.js. Qualité → GravureRules.MESH.

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
                ? (MESH.GRID_CAP_COMPLEX != null ? MESH.GRID_CAP_COMPLEX : 256)
                : (MESH.GRID_CAP_DEFAULT != null ? MESH.GRID_CAP_DEFAULT : 512),
            profileRes: complex
                ? (MESH.PROFILE_RES_COMPLEX != null ? MESH.PROFILE_RES_COMPLEX : 32)
                : (MESH.PROFILE_RES_DEFAULT != null ? MESH.PROFILE_RES_DEFAULT : 72),
            thetaBuckets: complex
                ? (MESH.THETA_BUCKETS_COMPLEX != null ? MESH.THETA_BUCKETS_COMPLEX : 96)
                : (MESH.THETA_BUCKETS_DEFAULT != null ? MESH.THETA_BUCKETS_DEFAULT : 160)
        };
    }

    function hasInvertedEngravingOnComplexLiaison(surfaceInput) {
        if (typeof window === 'undefined' || typeof window.getEngravingsData !== 'function') return false;
        var engravings = window.getEngravingsData();
        if (!engravings || !engravings.length) return false;
        for (var i = 0; i < engravings.length; i++) {
            if (!engravings[i].invert) continue;
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
        edgeTypes.push('ligne');
        rhos.push(0);
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

    // PNG → grille binaire (masque) projetée sur la surface cylindrique/elliptique
    function buildEngravingMask(img, g, gridCap) {
        if (!img || !img.width || !img.height) return null;
        var widthMM = Math.max(1, parseFloat(g.width) || 50);
        var depthMM = Math.max(0.05, parseFloat(g.depth) || 1.5);
        var centerY = isFinite(parseFloat(g.y)) ? parseFloat(g.y) : 150;
        var baseAngle = isFinite(parseFloat(g.angle)) ? parseFloat(g.angle) : 0;
        var heightMM = widthMM * (img.height / img.width);
        var maxGrid = Math.max(48, gridCap || (MESH.GRID_CAP_DEFAULT != null ? MESH.GRID_CAP_DEFAULT : 512));
        var imgDiv = Math.max(1, MESH.MASK_IMG_DIVISOR != null ? MESH.MASK_IMG_DIVISOR : 1);
        var gridW = Math.max(48, Math.min(maxGrid, Math.ceil(img.width / imgDiv)));
        var gridH = Math.max(48, Math.min(maxGrid, Math.ceil(img.height / imgDiv)));
        var srcMax = MESH.MASK_SRC_MAX != null ? MESH.MASK_SRC_MAX : 2048;
        var alphaThr = MESH.MASK_ALPHA_THRESHOLD != null ? MESH.MASK_ALPHA_THRESHOLD : 0.3;
        var srcScale = Math.min(1, srcMax / Math.max(img.width, img.height));
        var srcW = Math.max(1, Math.round(img.width * srcScale));
        var srcH = Math.max(1, Math.round(img.height * srcScale));
        var off = document.createElement('canvas');
        off.width = srcW; off.height = srcH;
        var ctx = off.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0, srcW, srcH);
        var pixels = ctx.getImageData(0, 0, srcW, srcH).data;

        function alphaAtUV(u, v) {
            var px = Math.max(0, Math.min(srcW - 1, Math.round(u * (srcW - 1))));
            var py = Math.max(0, Math.min(srcH - 1, Math.round(v * (srcH - 1))));
            return pixels[(py * srcW + px) * 4 + 3] / 255;
        }

        var mask = new Uint8Array(gridW * gridH);
        for (var my = 0; my < gridH; my++) {
            for (var mx = 0; mx < gridW; mx++) {
                var u0 = mx / gridW, v0 = my / gridH, du = 1 / gridW, dv = 1 / gridH;
                var c1 = alphaAtUV(u0 + du * 0.25, v0 + dv * 0.25);
                var c2 = alphaAtUV(u0 + du * 0.75, v0 + dv * 0.25);
                var c3 = alphaAtUV(u0 + du * 0.25, v0 + dv * 0.75);
                var c4 = alphaAtUV(u0 + du * 0.75, v0 + dv * 0.75);
                mask[my * gridW + mx] = (((c1 + c2 + c3 + c4) * 0.25) >= alphaThr) ? 1 : 0;
            }
        }

        return {
            mask: mask,
            gridW: gridW,
            gridH: gridH,
            widthMM: widthMM,
            heightMM: heightMM,
            depthMM: depthMM,
            centerY: centerY,
            baseAngle: baseAngle,
            flip: !!g.flip,
            invert: !!g.invert
        };
    }

    function sampleMaskSolid(meta, radiusAt, y, theta) {
        if (!meta || !meta.mask) return false;
        var baseRadius = Math.max(1, radiusAt(meta.centerY, meta.baseAngle));
        var dTheta = theta - meta.baseAngle;
        while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
        while (dTheta < -Math.PI) dTheta += 2 * Math.PI;
        var xCentered = dTheta * baseRadius;
        var uMap = (xCentered / meta.widthMM) + 0.5;
        if (meta.flip) uMap = 1 - uMap;
        var vMap = 0.5 - ((y - meta.centerY) / meta.heightMM);
        if (uMap < 0 || uMap > 1 || vMap < 0 || vMap > 1) return false;
        var ix = Math.max(0, Math.min(meta.gridW - 1, Math.floor(uMap * meta.gridW)));
        var iy = Math.max(0, Math.min(meta.gridH - 1, Math.floor(vMap * meta.gridH)));
        return meta.mask[iy * meta.gridW + ix] === 1;
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
            var limits = getEngravingAdaptiveLimits(surfaceInput, {
                centerY: centerY,
                heightMM: heightMM,
                widthMM: widthMM
            });
            var meta = buildEngravingMask(img, g, limits.gridCap);
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
        if (insideCount >= 2) return true;
        if (insideCount === 0) return false;
        var cx = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3;
        var cy = (pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3;
        var cz = (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3;
        var cr = Math.sqrt(cx * cx + cz * cz);
        if (cr < 1e-6) return false;
        return sampleMaskSolid(meta, radiusAt, cy, Math.atan2(cz, cx));
    }

    // Mode inversé : retire les triangles du corps bouteille sous le masque
    function punchHolesForInvertedEngravings(mesh, surfaceInput) {
        if (!mesh || !mesh.geometry || typeof THREE === 'undefined') return;
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
                if (triangleOutsideMetaBounds(meta, pos, i0, i1, i2)) continue;
                if (triangleShouldCutAtEngravingBorder(meta, meta.radiusAt, pos, i0, i1, i2)) remove = true;
            }
            if (!remove) newIndices.push(i0, i1, i2);
        }
        geo.setIndex(newIndices);
        geo.computeVertexNormals();
    }

    // Relief sortant (ou entrant si invert) : voxels du masque → triangles 3D
    function buildReliefEngravingGeometry(meta, radiusAt) {
        var widthMM = meta.widthMM;
        var depthMM = meta.depthMM;
        var centerY = meta.centerY;
        var baseAngle = meta.baseAngle;
        var heightMM = meta.heightMM;
        var flip = meta.flip;
        var invert = meta.invert;
        var gridW = meta.gridW;
        var gridH = meta.gridH;
        var mask = meta.mask;
        var baseRadius = Math.max(1, radiusAt(centerY, baseAngle));
        var dirDepth = invert ? -depthMM : depthMM;

        function isSolid(ix, iy) { return !(ix < 0 || iy < 0 || ix >= gridW || iy >= gridH) && mask[iy * gridW + ix] === 1; }
        var vertices = [], indices = [];
        function pushPoint(uRaw, vRaw, outwardDepth) {
            var uMap = flip ? (1 - uRaw) : uRaw;
            var xCentered = (uMap - 0.5) * widthMM;
            var yMM = centerY + (0.5 - vRaw) * heightMM;
            var theta = baseAngle + (xCentered / baseRadius);
            var surf = getSurfacePoint(radiusAt, yMM, theta);
            if (!isFinite(surf.x) || !isFinite(surf.y) || !isFinite(surf.z)) return -1;
            var nx = Math.cos(theta), nz = Math.sin(theta);
            vertices.push(surf.x + nx * outwardDepth, yMM, surf.z + nz * outwardDepth);
            return (vertices.length / 3) - 1;
        }
        function addQuad(a, b, c, d) {
            if (a < 0 || b < 0 || c < 0 || d < 0) return;
            indices.push(a, b, c);
            indices.push(a, c, d);
        }

        for (var gy = 0; gy < gridH; gy++) {
            for (var gx = 0; gx < gridW; gx++) {
                if (!isSolid(gx, gy)) continue;
                var u0 = gx / gridW, u1 = (gx + 1) / gridW, v0 = gy / gridH, v1 = (gy + 1) / gridH;
                var t00 = pushPoint(u0, v0, dirDepth), t10 = pushPoint(u1, v0, dirDepth), t11 = pushPoint(u1, v1, dirDepth), t01 = pushPoint(u0, v1, dirDepth);
                addQuad(t00, t10, t11, t01);
                var b00 = pushPoint(u0, v0, 0), b10 = pushPoint(u1, v0, 0), b11 = pushPoint(u1, v1, 0), b01 = pushPoint(u0, v1, 0);
                if (!invert) addQuad(b01, b11, b10, b00);
                if (!isSolid(gx - 1, gy)) addQuad(b00, t00, t01, b01);
                if (!isSolid(gx + 1, gy)) addQuad(b11, t11, t10, b10);
                if (!isSolid(gx, gy - 1)) addQuad(b10, t10, t00, b00);
                if (!isSolid(gx, gy + 1)) addQuad(b01, t01, t11, b11);
            }
        }
        if (!indices.length) return null;
        return { vertices: vertices, indices: indices };
    }

    function createEngravingMaterial() {
        var mat = (typeof BottleMaterials !== 'undefined' && BottleMaterials.getGlassMaterial)
            ? BottleMaterials.getGlassMaterial(BottleMaterials.DEFAULT_GLASS_COLOR)
            : new THREE.MeshPhongMaterial({ color: 0x99bbdd, side: THREE.DoubleSide });
        mat.side = THREE.DoubleSide;
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
            if (!img || !img.width || !img.height) continue;
            var widthMM = Math.max(1, parseFloat(g.width) || 50);
            var centerY = isFinite(parseFloat(g.y)) ? parseFloat(g.y) : 150;
            var heightMM = widthMM * (img.height / img.width);
            var limits = getEngravingAdaptiveLimits(surfaceInput, {
                centerY: centerY,
                heightMM: heightMM,
                widthMM: widthMM
            });
            var meta = buildEngravingMask(img, g, limits.gridCap);
            if (!meta) continue;
            var radiusAt = createRadiusSampler(extended, {
                profileRes: limits.profileRes,
                thetaBuckets: limits.thetaBuckets
            });
            var built = buildReliefEngravingGeometry(meta, radiusAt);
            if (!built) continue;
            var geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.Float32BufferAttribute(built.vertices, 3));
            geom.setIndex(built.indices);
            geom.computeVertexNormals();
            var mat = createEngravingMaterial();
            var mesh = new THREE.Mesh(geom, mat);
            mesh.userData.isPiqure = false;
            mesh.userData.isInterior = false;
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
                img ? (img.width + 'x' + img.height) : '0',
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
                img ? (img.width + 'x' + img.height) : '0',
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

    // Reconstruit le groupe de meshes gravure si la signature a changé
    function updateScene(scene, surfaceInput) {
        if (!scene || !surfaceInput) return;
        var sig = buildEngravingSceneSignature(surfaceInput);
        if (sig === lastEngravingSignature && engravingGroup) {
            if (engravingGroup.parent !== scene) scene.add(engravingGroup);
            return;
        }
        lastEngravingSignature = sig;
        if (engravingGroup) {
            scene.remove(engravingGroup);
            disposeGroup(engravingGroup);
            engravingGroup = null;
        }
        engravingGroup = buildEngravingsGroup(surfaceInput);
        if (engravingGroup) {
            engravingGroup.userData.isBottleExportRoot = true;
            scene.add(engravingGroup);
            if (typeof BottleView3D !== 'undefined' && BottleView3D.applyViewOpacity) {
                BottleView3D.applyViewOpacity(engravingGroup);
            }
        }
    }

    return {
        updateScene: updateScene,
        refreshEngravingOpacity: refreshEngravingOpacity,
        applyInvertedEngravingsToBottleMesh: punchHolesForInvertedEngravings,
        punchHolesForInvertedEngravings: punchHolesForInvertedEngravings,
        getBottleTessellationOverrides: getBottleTessellationOverrides,
        hasInvertedEngravings: hasInvertedEngravings,
        buildInvertedEngravingPunchSignature: buildInvertedEngravingPunchSignature
    };
})();
