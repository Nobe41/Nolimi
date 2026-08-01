// 01-saas/canvas/3d/bottle/ — opacité vue piqûre, ombres, coque interne.
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
        if (!obj || typeof THREE === 'undefined') return;
        // En mode verre, pas d’ombres mesh (transmission) : ombre de contact gérée par RenderScene
        if (isGlassRenderMode()) {
            obj.traverse(function (node) {
                if (node && node.isMesh) {
                    node.castShadow = false;
                    node.receiveShadow = false;
                }
            });
            return;
        }
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
            var mat = obj.material;
            var isRenderGlass = !!(mat.userData && mat.userData.isRenderGlass);
            mat.transparent = true;
            if (!mat.userData) mat.userData = {};
            if (mat.userData.baseOpacity === undefined) {
                mat.userData.baseOpacity = (mat.opacity !== undefined) ? mat.opacity : 1;
            }
            if (mat.userData.baseDepthWrite === undefined) {
                mat.userData.baseDepthWrite = (mat.depthWrite !== undefined) ? mat.depthWrite : true;
            }
            var baseOpacity = mat.userData.baseOpacity;
            var baseDepthWrite = mat.userData.baseDepthWrite;
            if (isPiqureView) {
                var isPiqure = obj.userData.isPiqure === true;
                var isInterior = obj.userData.isInterior === true;
                if (isInterior) {
                    mat.opacity = Math.min(baseOpacity, isRenderGlass ? 0.35 : 0.2);
                    mat.depthWrite = false;
                } else {
                    mat.opacity = isPiqure ? baseOpacity : Math.min(baseOpacity, isRenderGlass ? 0.2 : 0.15);
                    mat.depthWrite = isPiqure ? baseDepthWrite : false;
                }
            } else {
                mat.opacity = baseOpacity;
                mat.depthWrite = baseDepthWrite;
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
