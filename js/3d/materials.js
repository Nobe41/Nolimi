// js/3d/materials.js
// Matériaux 3D (verre bouteille). Une seule « recette », couleur optionnelle.

var BottleMaterials = (function () {
    var DEFAULT_GLASS_COLOR = 0x99bbdd;

    function getGlassMaterial(color) {
        var c = (color !== undefined && color !== null) ? color : DEFAULT_GLASS_COLOR;
        return new THREE.MeshPhongMaterial({
            color: c,
            side: THREE.DoubleSide
        });
    }

    return {
        getGlassMaterial: getGlassMaterial,
        DEFAULT_GLASS_COLOR: DEFAULT_GLASS_COLOR
    };
})();
