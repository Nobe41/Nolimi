// js/3d/bottleMesh.js
// Maillage de révolution du corps de bouteille (sectionsData → profil → rotation → Mesh).
// Dépend : BottleMaths, GeomKernel, Three.js. Optionnel : BottleMaterials, N_SEGMENTS, MERIDIAN_RESOLUTION.

var BottleMesh3D = (function () {
    var DEFAULT_N_SEGMENTS = 128;
    var DEFAULT_MERIDIAN_RES = 64;

    function getDefaultMaterial() {
        if (typeof BottleMaterials !== 'undefined' && BottleMaterials.getGlassMaterial) {
            return BottleMaterials.getGlassMaterial();
        }
        var color = (typeof BottleMaterials !== 'undefined' && BottleMaterials.DEFAULT_GLASS_COLOR !== undefined)
            ? BottleMaterials.DEFAULT_GLASS_COLOR : 0x99bbdd;
        return new THREE.MeshPhongMaterial({ color: color, side: THREE.DoubleSide });
    }

    function buildRevolvedMeshInternal(sectionsData, material) {
        if (typeof THREE === 'undefined' || typeof GeomKernel === 'undefined' || typeof BottleMaths === 'undefined') return null;

        var nTheta = typeof N_SEGMENTS !== 'undefined' ? N_SEGMENTS : DEFAULT_N_SEGMENTS;
        var meridianRes = typeof MERIDIAN_RESOLUTION !== 'undefined' ? MERIDIAN_RESOLUTION : DEFAULT_MERIDIAN_RES;

        var meridians = [];
        for (var t = 0; t < nTheta; t++) {
            var theta = (t / nTheta) * 2 * Math.PI;
            var entities = BottleMaths.buildExteriorProfile(theta, sectionsData);
            meridians.push(GeomKernel.tessellateProfile(entities, meridianRes));
        }

        var nMeridian = meridians[0].length;
        for (var ti = 1; ti < nTheta; ti++) {
            if (meridians[ti].length < nMeridian) nMeridian = meridians[ti].length;
        }

        var cosTheta = [];
        var sinTheta = [];
        for (var t = 0; t < nTheta; t++) {
            var angle = (t / nTheta) * 2 * Math.PI;
            cosTheta.push(Math.cos(angle));
            sinTheta.push(Math.sin(angle));
        }

        var vertices = [];
        var indices = [];
        var t, m, p, x, y, z;
        for (t = 0; t < nTheta; t++) {
            for (m = 0; m < nMeridian; m++) {
                p = meridians[t][m];
                x = p.x * cosTheta[t];
                z = p.x * sinTheta[t];
                y = p.y;
                vertices.push(x, y, z);
            }
        }

        for (t = 0; t < nTheta; t++) {
            var tNext = (t + 1) % nTheta;
            for (m = 0; m < nMeridian - 1; m++) {
                var i0 = t * nMeridian + m;
                var i1 = t * nMeridian + m + 1;
                var i2 = tNext * nMeridian + m;
                var i3 = tNext * nMeridian + m + 1;
                indices.push(i0, i1, i2);
                indices.push(i1, i3, i2);
            }
        }

        var geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();

        var mat = material != null ? material : getDefaultMaterial();
        return new THREE.Mesh(geom, mat);
    }

    function createBottleMesh(sectionsData, material) {
        return buildRevolvedMeshInternal(sectionsData, material);
    }

    function updateBottleMesh(mesh, sectionsData) {
        if (!mesh) return createBottleMesh(sectionsData);
        var newMesh = buildRevolvedMeshInternal(sectionsData, mesh.material);
        if (mesh.geometry) mesh.geometry.dispose();
        mesh.geometry = newMesh.geometry;
        return mesh;
    }

    return {
        createBottleMesh: createBottleMesh,
        updateBottleMesh: updateBottleMesh
    };
})();
