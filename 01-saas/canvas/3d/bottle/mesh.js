// 01-saas/canvas/3d/bottle/ — maillage corps (profil tourné autour de l’axe).
// Utilisé par build / export / highlight ; pas d’UI ici.

var BottleMesh3D = (function () {
    var DEFAULT_N_SEGMENTS = 128;
    var DEFAULT_MERIDIAN_RES = 64;

    // Matériau verre par défaut
    function getDefaultMaterial() {
        if (typeof BottleMaterials !== 'undefined' && BottleMaterials.getGlassMaterial) {
            return BottleMaterials.getGlassMaterial();
        }
        var color = (typeof BottleMaterials !== 'undefined' && BottleMaterials.DEFAULT_GLASS_COLOR !== undefined)
            ? BottleMaterials.DEFAULT_GLASS_COLOR
            : 0x99bbdd;
        return new THREE.MeshPhongMaterial({ color: color, side: THREE.DoubleSide });
    }

    // Crée le mesh : sections → profils → rotation → triangles
    function createBottleMesh(sectionsData, material, tessOverride) {
        if (typeof THREE === 'undefined' || typeof GeomKernel === 'undefined' || typeof BottleMaths === 'undefined') {
            return null;
        }

        var tess = (typeof Canvas3DRules !== 'undefined' && Canvas3DRules.TESSELLATION)
            ? Canvas3DRules.TESSELLATION
            : {};
        var nTheta = (tessOverride && tessOverride.nTheta) || tess.N_SEGMENTS || DEFAULT_N_SEGMENTS;
        var meridianRes = (tessOverride && tessOverride.meridianRes) || tess.MERIDIAN_RESOLUTION || DEFAULT_MERIDIAN_RES;

        // Un profil par angle autour de la bouteille
        var meridians = [];
        var cosTheta = [];
        var sinTheta = [];
        for (var t = 0; t < nTheta; t++) {
            var theta = (t / nTheta) * 2 * Math.PI;
            cosTheta.push(Math.cos(theta));
            sinTheta.push(Math.sin(theta));
            var entities = BottleMaths.buildExteriorProfile(theta, sectionsData);
            meridians.push(GeomKernel.tessellateProfile(entities, meridianRes));
        }

        // Même nombre de points sur chaque profil
        var nMeridian = meridians[0].length;
        for (var ti = 1; ti < nTheta; ti++) {
            if (meridians[ti].length < nMeridian) nMeridian = meridians[ti].length;
        }

        // Vertices (x, y, z)
        var vertices = [];
        for (t = 0; t < nTheta; t++) {
            for (var m = 0; m < nMeridian; m++) {
                var p = meridians[t][m];
                vertices.push(p.x * cosTheta[t], p.y, p.x * sinTheta[t]);
            }
        }

        // Triangles entre deux profils voisins
        var indices = [];
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

    // Met à jour un mesh existant (réutilise le matériau)
    function updateBottleMesh(mesh, sectionsData, tessOverride) {
        if (!mesh) return createBottleMesh(sectionsData, null, tessOverride);
        var newMesh = createBottleMesh(sectionsData, mesh.material, tessOverride);
        if (mesh.geometry) mesh.geometry.dispose();
        mesh.geometry = newMesh.geometry;
        return mesh;
    }

    return {
        createBottleMesh: createBottleMesh,
        updateBottleMesh: updateBottleMesh
    };
})();
