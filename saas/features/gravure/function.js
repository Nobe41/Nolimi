// Orchestration Gravure + rendu 3D.
(function () {
    if (typeof GravureEvents !== 'undefined' && GravureEvents.init) GravureEvents.init();
})();

var Gravure3D = (function () {
    var engravingGroup = null;

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

    function getPanelValue(id, def) {
        if (typeof document === 'undefined') return def;
        var el = document.getElementById(id);
        if (!el) return def;
        var v = parseFloat(el.value);
        return isNaN(v) ? def : v;
    }

    function getPanelValueSigned(id, def) {
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

    function getBagueSectionsFromDOM() {
        if (typeof document === 'undefined') return [];
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
        var out = [];
        for (var u = 0; u < unique.length; u++) {
            var ksb = unique[u];
            var shape = getPanelSelectValue('sb' + ksb + '-forme', 'cylindrique');
            var L = getPanelValue('sb' + ksb + '-L', 35);
            var P = getPanelValue('sb' + ksb + '-P', 35);
            if (typeof SectionsRules !== 'undefined' && SectionsRules.resolveSectionDimensions) {
                var resolved = SectionsRules.resolveSectionDimensions(shape, L, P);
                shape = resolved.shape;
                L = resolved.L;
                P = resolved.P;
            }
            out.push({
                H: Math.max(0, getPanelValue('sb' + ksb + '-h', 0)),
                a: Math.max(0, L / 2),
                b: Math.max(0, P / 2),
                shape: shape,
                carreNiveau: Math.max(0, Math.min(100, getPanelValue('sb' + ksb + '-carre-niveau', 0)))
            });
        }
        return out;
    }

    /** Étend sectionsData avec la bague pour que la gravure suive la surface extérieure du col. */
    function extendSurfaceWithBague(surfaceInput) {
        if (!surfaceInput || !surfaceInput.sections || surfaceInput.sections.length < 2) return surfaceInput;
        var bague = getBagueSectionsFromDOM();
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
            edgeTypes.push(getPanelSelectValue(rbId + '-type', 'ligne'));
            rhos.push(getPanelValueSigned(rbId + '-rho', 5));
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

    function createRadiusSampler(surfaceInput) {
        var sectionsData = Array.isArray(surfaceInput) ? { sections: surfaceInput, edgeTypes: [], rhos: [] } : (surfaceInput && surfaceInput.sections ? surfaceInput : { sections: [] });
        var sections = sectionsData.sections || [];
        var canUseProfile = typeof BottleMaths !== 'undefined' && typeof GeomKernel !== 'undefined' && BottleMaths.buildExteriorProfile && GeomKernel.tessellateProfile && sectionsData.edgeTypes && sectionsData.rhos;
        var cache = {};
        function radiusFromProfile(y, theta) {
            var key = String(Math.round(theta * 10000) / 10000);
            var profile = cache[key];
            if (!profile) {
                var entities = BottleMaths.buildExteriorProfile(theta, sectionsData);
                profile = GeomKernel.tessellateProfile(entities, 48) || [];
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

    function buildEngravingMask(img, g) {
        if (!img || !img.width || !img.height) return null;
        var widthMM = Math.max(1, parseFloat(g.width) || 50);
        var depthMM = Math.max(0.05, parseFloat(g.depth) || 1.5);
        var centerY = isFinite(parseFloat(g.y)) ? parseFloat(g.y) : 150;
        var baseAngle = isFinite(parseFloat(g.angle)) ? parseFloat(g.angle) : 0;
        var heightMM = widthMM * (img.height / img.width);
        var gridW = Math.max(64, Math.min(320, Math.ceil(img.width / 2)));
        var gridH = Math.max(64, Math.min(320, Math.ceil(img.height / 2)));
        var srcScale = Math.min(1, 1024 / Math.max(img.width, img.height));
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
                mask[my * gridW + mx] = (((c1 + c2 + c3 + c4) * 0.25) >= 0.35) ? 1 : 0;
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

    function collectEngravingMetas(surfaceInput) {
        if (typeof window === 'undefined' || typeof window.getEngravingsData !== 'function') return [];
        var engravings = window.getEngravingsData();
        if (!engravings || !engravings.length) return [];
        var images = window.engravingImages || {};
        var radiusAt = createRadiusSampler(extendSurfaceWithBague(surfaceInput));
        var metas = [];
        for (var i = 0; i < engravings.length; i++) {
            var meta = buildEngravingMask(images[engravings[i].id], engravings[i]);
            if (meta) {
                meta.radiusAt = radiusAt;
                metas.push(meta);
            }
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
        return { nTheta: 384, meridianRes: 192 };
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
                if (triangleShouldCutAtEngravingBorder(meta, meta.radiusAt, pos, i0, i1, i2)) remove = true;
            }
            if (!remove) newIndices.push(i0, i1, i2);
        }
        geo.setIndex(newIndices);
        geo.computeVertexNormals();
    }

    function applyInvertedEngravingsToBottleMesh(mesh, surfaceInput) {
        punchHolesForInvertedEngravings(mesh, surfaceInput);
    }

    function buildEngravingMeshGeometry(meta, radiusAt) {
        return buildReliefEngravingGeometry(meta, radiusAt);
    }

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
            var nx = Math.cos(theta), nz = Math.sin(theta);
            vertices.push(surf.x + nx * outwardDepth, yMM, surf.z + nz * outwardDepth);
            return (vertices.length / 3) - 1;
        }
        function addQuad(a, b, c, d) { indices.push(a, b, c); indices.push(a, c, d); }

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
        var radiusAt = createRadiusSampler(surfaceInput);

        for (var gi = 0; gi < engravings.length; gi++) {
            var g = engravings[gi], img = images[g.id];
            if (!img || !img.width || !img.height) continue;
            var meta = buildEngravingMask(img, g);
            if (!meta) continue;
            var built = buildEngravingMeshGeometry(meta, radiusAt);
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

    function updateScene(scene, surfaceInput) {
        if (!scene || !surfaceInput) return;
        if (engravingGroup) {
            scene.remove(engravingGroup);
            disposeGroup(engravingGroup);
            engravingGroup = null;
        }
        engravingGroup = buildEngravingsGroup(extendSurfaceWithBague(surfaceInput));
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
        applyInvertedEngravingsToBottleMesh: applyInvertedEngravingsToBottleMesh,
        applyInvertedDisplacementsToMesh: applyInvertedEngravingsToBottleMesh,
        punchHolesForInvertedEngravings: punchHolesForInvertedEngravings,
        getBottleTessellationOverrides: getBottleTessellationOverrides,
        hasInvertedEngravings: hasInvertedEngravings
    };
})();
