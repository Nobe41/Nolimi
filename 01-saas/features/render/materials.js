// 01-saas/features/render/materials.js
// Matériaux du mode rendu : verre réaliste (transmission, reflets studio).
// Mode « base » : délègue au matériau d’édition (BottleMaterials).
// La carte d’environnement rectangulaire simule des softboxes, sans charger d’EXR.

var RenderMaterials = (function () {
    var MATERIAL_MODE = 'base'; // 'base' | 'glass'
    var studioRectEnvMap = null;

    function resolveColor(color, fallback) {
        return (color !== undefined && color !== null) ? color : fallback;
    }

    function setMaterialMode(mode) {
        MATERIAL_MODE = (mode === 'glass') ? 'glass' : 'base';
    }

    function getMaterialMode() {
        return MATERIAL_MODE;
    }

    function isGlassMode() {
        return MATERIAL_MODE === 'glass';
    }

    // Texture procédurale = reflets studio (pas de fichier HDRI externe)
    function buildStudioRectEnvMap() {
        if (typeof THREE === 'undefined') return null;
        if (studioRectEnvMap) return studioRectEnvMap;

        var w = 1024;
        var h = 512;
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        if (!ctx) return null;

        var bg = ctx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, '#c8d0d8');
        bg.addColorStop(1, '#b4bcc6');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        function drawSoftRect(x, y, rw, rh, alpha) {
            var cx = x + rw * 0.5;
            var cy = y + rh * 0.5;
            var padX = Math.max(10, rw * 0.9);
            var padY = Math.max(10, rh * 0.9);
            var g = ctx.createRadialGradient(cx, cy, 1, cx, cy, Math.max(rw, rh) * 0.85 + Math.max(padX, padY) * 0.25);
            g.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
            g.addColorStop(0.45, 'rgba(255,255,255,' + (alpha * 0.45) + ')');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - padX, y - padY, rw + padX * 2, rh + padY * 2);
            ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, alpha * 1.05) + ')';
            ctx.fillRect(x, y, rw, rh);
            ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, alpha * 1.2) + ')';
            ctx.fillRect(x + rw * 0.35, y, Math.max(2, rw * 0.3), rh);
        }

        drawSoftRect(16, 10, 78, 468, 1.0);
        drawSoftRect(122, 22, 58, 430, 0.98);
        drawSoftRect(252, 18, 52, 445, 0.95);
        drawSoftRect(372, 26, 54, 420, 0.95);
        drawSoftRect(512, 12, 82, 470, 1.0);
        drawSoftRect(648, 26, 54, 420, 0.95);
        drawSoftRect(770, 18, 52, 445, 0.95);
        drawSoftRect(894, 22, 58, 430, 0.98);
        drawSoftRect(1000, 10, 78, 468, 1.0);
        drawSoftRect(190, 8, 620, 52, 0.95);
        drawSoftRect(140, 230, 730, 44, 0.88);
        drawSoftRect(120, 318, 760, 38, 0.82);

        studioRectEnvMap = new THREE.CanvasTexture(canvas);
        studioRectEnvMap.mapping = THREE.EquirectangularReflectionMapping;
        studioRectEnvMap.magFilter = THREE.LinearFilter;
        studioRectEnvMap.minFilter = THREE.LinearFilter;
        studioRectEnvMap.generateMipmaps = false;
        if (studioRectEnvMap.encoding !== undefined && THREE.sRGBEncoding !== undefined) {
            studioRectEnvMap.encoding = THREE.sRGBEncoding;
        }
        studioRectEnvMap.needsUpdate = true;
        return studioRectEnvMap;
    }

    function applyStudioRectReflections(material, intensity) {
        if (!material) return;
        var env = buildStudioRectEnvMap();
        if (!env) return;
        material.envMap = env;
        if (material.envMapIntensity !== undefined) {
            material.envMapIntensity = intensity;
        }
        material.needsUpdate = true;
    }

    function getOuterGlassMaterial(color) {
        var mat = new THREE.MeshPhysicalMaterial({
            color: resolveColor(color, 0xd5edd8),
            metalness: 0,
            roughness: 0.04,
            transmission: 0.84,
            thickness: 2.8,
            ior: 1.52,
            transparent: true,
            opacity: 0.5,
            attenuationDistance: 5.2,
            attenuationColor: new THREE.Color(0xc7e1cb),
            clearcoat: 0.7,
            clearcoatRoughness: 0.022,
            reflectivity: 0.96,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        applyStudioRectReflections(mat, 2.0);
        return mat;
    }

    function getInnerGlassMaterial(color) {
        var mat = new THREE.MeshPhysicalMaterial({
            color: resolveColor(color, 0xcbe3d0),
            metalness: 0,
            roughness: 0.06,
            transmission: 0.82,
            thickness: 1.8,
            ior: 1.52,
            transparent: true,
            opacity: 0.26,
            attenuationDistance: 4.6,
            attenuationColor: new THREE.Color(0xc0dcc6),
            clearcoat: 0.3,
            clearcoatRoughness: 0.07,
            reflectivity: 0.88,
            depthWrite: false,
            side: THREE.BackSide
        });
        applyStudioRectReflections(mat, 1.35);
        return mat;
    }

    // Matériau corps selon le mode rendu (délègue au base canvas si hors verre)
    function getActiveBottleMaterial(color) {
        if (isGlassMode()) return getOuterGlassMaterial(color);
        if (typeof BottleMaterials !== 'undefined' && BottleMaterials.getBaseMaterial) {
            return BottleMaterials.getBaseMaterial(color);
        }
        return null;
    }

    return {
        setMaterialMode: setMaterialMode,
        getMaterialMode: getMaterialMode,
        isGlassMode: isGlassMode,
        getOuterGlassMaterial: getOuterGlassMaterial,
        getInnerGlassMaterial: getInnerGlassMaterial,
        getActiveBottleMaterial: getActiveBottleMaterial
    };
})();
