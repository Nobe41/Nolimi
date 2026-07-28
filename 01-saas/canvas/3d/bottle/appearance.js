// saas/canvas/3d/bottle/ — opacité vue piqûre, ombres, coque interne.
// Mode verre → RenderMaterials.isGlassMode() (features/render).

var BottleViewAppearance = (function () {
    function isGlassRenderMode() {
        if (typeof RenderMaterials !== 'undefined' && RenderMaterials.isGlassMode) {
            return RenderMaterials.isGlassMode();
        }
        return (typeof BottleMaterials !== 'undefined' && BottleMaterials.getRenderMaterialMode)
            ? BottleMaterials.getRenderMaterialMode() === 'glass'
            : false;
    }

    function enableMeshShadows(obj) {
        if (!obj || typeof THREE === 'undefined' || isGlassRenderMode()) return;
        obj.traverse(function (node) {
            if (node && node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });
    }

    function applyViewOpacity(group) {
        var isPiqureView = (typeof Bottle3DData !== 'undefined' && Bottle3DData.isPiqureViewActive)
            ? Bottle3DData.isPiqureViewActive()
            : false;
        for (var c = 0; c < group.children.length; c++) {
            var obj = group.children[c];
            if (!obj.material) continue;
            obj.material.transparent = true;
            if (!obj.material.userData) obj.material.userData = {};
            if (obj.material.userData.baseOpacity === undefined) {
                obj.material.userData.baseOpacity = (obj.material.opacity !== undefined) ? obj.material.opacity : 1;
            }
            if (obj.material.userData.baseDepthWrite === undefined) {
                obj.material.userData.baseDepthWrite = (obj.material.depthWrite !== undefined) ? obj.material.depthWrite : true;
            }
            var baseOpacity = obj.material.userData.baseOpacity;
            var baseDepthWrite = obj.material.userData.baseDepthWrite;
            if (isPiqureView) {
                var isPiqure = obj.userData.isPiqure === true;
                var isInterior = obj.userData.isInterior === true;
                if (isInterior) {
                    obj.material.opacity = Math.min(baseOpacity, 0.2);
                    obj.material.depthWrite = false;
                } else {
                    obj.material.opacity = isPiqure ? baseOpacity : Math.min(baseOpacity, 0.15);
                    obj.material.depthWrite = isPiqure;
                }
            } else {
                obj.material.opacity = baseOpacity;
                obj.material.depthWrite = baseDepthWrite;
            }
        }
    }

    function enhanceInnerPiqureVisibility(obj) {
        if (!obj || isGlassRenderMode()) return;
        obj.traverse(function (node) {
            if (!node || !node.isMesh || !node.material) return;
            var mat = node.material;
            mat.transparent = true;
            if (!mat.userData) mat.userData = {};
            if (mat.userData.piqureBoostApplied) return;
            mat.userData.piqureBoostApplied = true;
            mat.opacity = Math.max(0.62, (mat.opacity !== undefined ? mat.opacity : 1));
            mat.depthWrite = true;
            mat.polygonOffset = true;
            mat.polygonOffsetFactor = -0.5;
            mat.polygonOffsetUnits = -0.5;
            if (mat.color && mat.color.offsetHSL) mat.color.offsetHSL(0, 0.03, 0.02);
            mat.needsUpdate = true;
            node.renderOrder = 6;
        });
    }

    function getInnerShellMaterial() {
        var glassMode = (typeof BottleMaterials !== 'undefined' && BottleMaterials.getRenderMaterialMode)
            ? BottleMaterials.getRenderMaterialMode()
            : 'base';
        if (glassMode === 'glass' && typeof BottleMaterials !== 'undefined' && BottleMaterials.getInnerGlassMaterial) {
            return BottleMaterials.getInnerGlassMaterial(BottleMaterials.DEFAULT_GLASS_COLOR);
        }
        return new THREE.MeshPhongMaterial({ color: 0x6f8ead, side: THREE.BackSide, shininess: 20 });
    }

    return {
        isGlassRenderMode: isGlassRenderMode,
        enableMeshShadows: enableMeshShadows,
        applyViewOpacity: applyViewOpacity,
        enhanceInnerPiqureVisibility: enhanceInnerPiqureVisibility,
        getInnerShellMaterial: getInnerShellMaterial
    };
})();
