// saas/canvas/3d/ — matériau de base de la bouteille (édition, hors mode rendu).
// Mode verre / Physical → features/render/materials.js (RenderMaterials).

var BottleMaterials = (function () {
    var DEFAULT_GLASS_COLOR = 0x99bbdd;

    function resolveColor(color, fallback) {
        return (color !== undefined && color !== null) ? color : fallback;
    }

    function getBaseMaterial(color) {
        return new THREE.MeshPhongMaterial({
            color: resolveColor(color, DEFAULT_GLASS_COLOR),
            side: THREE.DoubleSide
        });
    }

    // Compat : suit le mode rendu s’il est chargé
    function isGlassMode() {
        return (typeof RenderMaterials !== 'undefined' && RenderMaterials.isGlassMode)
            ? RenderMaterials.isGlassMode()
            : false;
    }

    function getGlassMaterial(color) {
        if (isGlassMode() && typeof RenderMaterials !== 'undefined' && RenderMaterials.getOuterGlassMaterial) {
            return RenderMaterials.getOuterGlassMaterial(color);
        }
        return getBaseMaterial(color);
    }

    function getInnerGlassMaterial(color) {
        if (isGlassMode() && typeof RenderMaterials !== 'undefined' && RenderMaterials.getInnerGlassMaterial) {
            return RenderMaterials.getInnerGlassMaterial(color);
        }
        return new THREE.MeshPhongMaterial({
            color: resolveColor(color, 0x6f8ead),
            side: THREE.BackSide,
            shininess: 20
        });
    }

    function getBottleBodyMaterial() {
        if (typeof RenderMaterials !== 'undefined' && RenderMaterials.getActiveBottleMaterial) {
            var mat = RenderMaterials.getActiveBottleMaterial(DEFAULT_GLASS_COLOR);
            if (mat) return mat;
        }
        return getBaseMaterial(DEFAULT_GLASS_COLOR);
    }

    // Façades compat (préférer RenderMaterials.setMaterialMode côté rendu)
    function setRenderMaterialMode(mode) {
        if (typeof RenderMaterials !== 'undefined' && RenderMaterials.setMaterialMode) {
            RenderMaterials.setMaterialMode(mode);
        }
    }

    function getRenderMaterialMode() {
        if (typeof RenderMaterials !== 'undefined' && RenderMaterials.getMaterialMode) {
            return RenderMaterials.getMaterialMode();
        }
        return 'base';
    }

    return {
        getBaseMaterial: getBaseMaterial,
        getGlassMaterial: getGlassMaterial,
        getRealisticGlassMaterial: getGlassMaterial,
        getInnerGlassMaterial: getInnerGlassMaterial,
        getBottleBodyMaterial: getBottleBodyMaterial,
        setRenderMaterialMode: setRenderMaterialMode,
        getRenderMaterialMode: getRenderMaterialMode,
        DEFAULT_GLASS_COLOR: DEFAULT_GLASS_COLOR
    };
})();
