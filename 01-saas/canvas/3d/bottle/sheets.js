// 01-saas/canvas/3d/bottle/ — feuilles (piqûre, col→bague, bandes réglées).
// Surfaces hors corps de révolution principal ; matériaux via BottleMaterials.

var BottleViewSheets = (function () {
    var tess = (typeof Canvas3DRules !== 'undefined' && Canvas3DRules.TESSELLATION) ? Canvas3DRules.TESSELLATION : {};
    var N_SEGMENTS = tess.N_SEGMENTS || 128;
    var N_FEUILLE_V = tess.N_FEUILLE_V || 32;
    var MERIDIAN_RESOLUTION = tess.MERIDIAN_RESOLUTION || 64;
    var NECK_FEUILLE_SURFACE_OFFSET = 0.02;

    function addRuledSurfaceIndicesClosedU(indices, nu, nv, rowStride) {
        for (var i = 0; i < nu; i++) {
            var iNext = (i + 1) % nu;
            for (var j = 0; j < nv; j++) {
                var a = i * rowStride + j;
                var b = iNext * rowStride + j;
                var c = iNext * rowStride + j + 1;
                var d = i * rowStride + j + 1;
                indices.push(a, d, c);
                indices.push(a, c, b);
            }
        }
    }

    function buildRuledSurfaceStrip(sections, color, tessOpts) {
        if (!sections || sections.length < 2) return null;
        var nu = (tessOpts && tessOpts.nSegments) || N_SEGMENTS;
        var nv = (tessOpts && tessOpts.nFeuilleV) || N_FEUILLE_V;
        var K = sections.length;
        var totalRows = (K - 1) * nv + 1;
        var vertices = [];
        var indices = [];
        for (var i = 0; i < nu; i++) {
            var u = (i / nu) * 2 * Math.PI;
            for (var r = 0; r < totalRows; r++) {
                var k = Math.floor(r / nv);
                var v = (r === (K - 1) * nv) ? 1 : (r - k * nv) / nv;
                if (k >= K - 1) k = K - 2;
                var p = BottleMaths.getRuledSurfacePoint(sections[k], sections[k + 1], u, v);
                vertices.push(p.x, p.y, p.z);
            }
        }
        for (var band = 0; band < K - 1; band++) {
            for (var i = 0; i < nu; i++) {
                var iNext = (i + 1) % nu;
                for (var j = 0; j < nv; j++) {
                    var r0 = band * nv + j;
                    var r1 = band * nv + j + 1;
                    var a = i * totalRows + r0;
                    var b = iNext * totalRows + r0;
                    var c = iNext * totalRows + r1;
                    var d = i * totalRows + r1;
                    indices.push(a, d, c);
                    indices.push(a, c, b);
                }
            }
        }
        var geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();
        var mat = BottleMaterials.getGlassMaterial(color);
        return new THREE.Mesh(geom, mat);
    }

    function buildLiaisonRevolvedMesh(sectionsData, color, options) {
        options = options || {};
        if (!sectionsData || !sectionsData.sections || sectionsData.sections.length < 2) return null;
        if (typeof BottleMesh3D === 'undefined' || !BottleMesh3D.createBottleMesh) {
            return buildRuledSurfaceStrip(sectionsData.sections, color, options.tessOverride);
        }
        var mat;
        if (options.inner) {
            mat = new THREE.MeshPhongMaterial({
                color: color || 0x6f8ead,
                side: THREE.BackSide,
                shininess: 20
            });
        } else if (typeof BottleMaterials !== 'undefined' && BottleMaterials.getGlassMaterial) {
            mat = BottleMaterials.getGlassMaterial(color || BottleMaterials.DEFAULT_GLASS_COLOR);
        }
        return BottleMesh3D.createBottleMesh(sectionsData, mat, options.tessOverride || null);
    }

    function buildPiqurePiedFeuille(s1, piqure, H, tessOpts) {
        var nu = (tessOpts && tessOpts.nSegments) || N_SEGMENTS;
        var nv = (tessOpts && tessOpts.nFeuilleV) || N_FEUILLE_V;
        var vertices = [];
        var indices = [];
        for (var i = 0; i < nu; i++) {
            var u = (i / nu) * 2 * Math.PI;
            for (var j = 0; j <= nv; j++) {
                var v = j / nv;
                var p = BottleMaths.getRadialBandPoint(s1, piqure, H, u, v);
                vertices.push(p.x, p.y, p.z);
            }
        }
        addRuledSurfaceIndicesClosedU(indices, nu, nv, nv + 1);
        var geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();
        var mat = BottleMaterials.getGlassMaterial();
        return new THREE.Mesh(geom, mat);
    }

    function buildPiqureBasHautFeuille(piqure, hautPiqure, tessOpts) {
        var nu = (tessOpts && tessOpts.nSegments) || N_SEGMENTS;
        var nv = (tessOpts && tessOpts.nFeuilleV) || N_FEUILLE_V;
        var vertices = [];
        var indices = [];
        for (var i = 0; i < nu; i++) {
            var u = (i / nu) * 2 * Math.PI;
            for (var j = 0; j <= nv; j++) {
                var v = j / nv;
                var p = BottleMaths.getRuledSurfacePoint(piqure, hautPiqure, u, v);
                vertices.push(p.x, p.y, p.z);
            }
        }
        addRuledSurfaceIndicesClosedU(indices, nu, nv, nv + 1);
        var geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();
        var mat = BottleMaterials.getGlassMaterial();
        return new THREE.Mesh(geom, mat);
    }

    function getNeckToBaguePoint(sPrev, sTop, bague1, sectionsData, radiusAt, u, v) {
        var yStart = (sPrev && isFinite(sPrev.H)) ? sPrev.H : sTop.H;
        var yEnd = bague1.H;
        if (yEnd < yStart) yStart = yEnd;
        var y = yStart + v * (yEnd - yStart);
        var c = Math.cos(u);
        var s = Math.sin(u);

        if (y <= sTop.H + 1e-6) {
            var r = radiusAt(y, u) + NECK_FEUILLE_SURFACE_OFFSET;
            return { x: r * c, y: y, z: r * s };
        }

        var rRim = radiusAt(sTop.H, u) + NECK_FEUILLE_SURFACE_OFFSET;
        var pRim = { x: rRim * c, y: sTop.H, z: rRim * s };
        var pBague = BottleMaths.getRuledSurfacePoint(sTop, bague1, u, 1);
        var span = yEnd - sTop.H;
        var t = span > 1e-6 ? (y - sTop.H) / span : 1;
        return {
            x: (1 - t) * pRim.x + t * pBague.x,
            y: y,
            z: (1 - t) * pRim.z + t * pBague.z
        };
    }

    function buildNeckToBagueFeuille(sPrev, sTop, bague1, sectionsData, color, tessOpts) {
        if (!sTop || !bague1 || typeof BottleMaths === 'undefined' || typeof THREE === 'undefined') return null;
        var radiusAt = (BottleMaths.createExteriorRadiusSampler)
            ? BottleMaths.createExteriorRadiusSampler(sectionsData)
            : null;
        if (!radiusAt) return buildPiqureBasHautFeuille(sTop, bague1, tessOpts);

        var nu = (tessOpts && tessOpts.nSegments) || N_SEGMENTS;
        var nv = (tessOpts && tessOpts.nFeuilleV) || N_FEUILLE_V;
        var vertices = [];
        var indices = [];
        for (var i = 0; i < nu; i++) {
            var u = (i / nu) * 2 * Math.PI;
            for (var j = 0; j <= nv; j++) {
                var v = j / nv;
                var p = getNeckToBaguePoint(sPrev, sTop, bague1, sectionsData, radiusAt, u, v);
                vertices.push(p.x, p.y, p.z);
            }
        }
        addRuledSurfaceIndicesClosedU(indices, nu, nv, nv + 1);
        var geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();
        var mat = BottleMaterials.getGlassMaterial(color);
        return new THREE.Mesh(geom, mat);
    }

    function buildPiqureFeuilleVersAxe(section, topH, tessOpts) {
        var nu = (tessOpts && tessOpts.nSegments) || N_SEGMENTS;
        var nv = (tessOpts && tessOpts.nFeuilleV) || N_FEUILLE_V;
        var vertices = [];
        var indices = [];
        for (var i = 0; i < nu; i++) {
            var u = (i / nu) * 2 * Math.PI;
            for (var j = 0; j <= nv; j++) {
                var v = j / nv;
                var p = BottleMaths.getConeToApexPoint(section, topH, u, v);
                vertices.push(p.x, p.y, p.z);
            }
        }
        addRuledSurfaceIndicesClosedU(indices, nu, nv, nv + 1);
        var geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();
        var mat = BottleMaterials.getGlassMaterial();
        return new THREE.Mesh(geom, mat);
    }

    return {
        N_SEGMENTS: N_SEGMENTS,
        MERIDIAN_RESOLUTION: MERIDIAN_RESOLUTION,
        buildLiaisonRevolvedMesh: buildLiaisonRevolvedMesh,
        buildPiqurePiedFeuille: buildPiqurePiedFeuille,
        buildPiqureBasHautFeuille: buildPiqureBasHautFeuille,
        buildNeckToBagueFeuille: buildNeckToBagueFeuille,
        buildPiqureFeuilleVersAxe: buildPiqureFeuilleVersAxe,
        buildRuledSurfaceStrip: buildRuledSurfaceStrip
    };
})();
