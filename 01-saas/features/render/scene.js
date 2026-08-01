// 01-saas/features/render/scene.js
// Viewport mode rendu : fond studio clair, IBL, ombre de contact douce ;
// masque axes/grille.

var RenderScene = (function () {
    var studioEnvRT = null;
    var contactShadow = null;
    var pmremGenerator = null;
    var studioLights = null;

    function modeToggleId() {
        var ids = (typeof RenderRules !== 'undefined' && RenderRules.IDS) ? RenderRules.IDS : {};
        return ids.modeToggle || 'render-mode-toggle';
    }

    function isRenderModeEnabled() {
        if (typeof document === 'undefined') return false;
        var modeToggle = document.getElementById(modeToggleId());
        return !!(modeToggle && modeToggle.checked);
    }

    function baseBg() {
        return (typeof Scene3DBackground !== 'undefined') ? Scene3DBackground : null;
    }

    function clearSceneEnvironment() {
        if (scene) scene.environment = null;
    }

    function ensurePmrem() {
        if (!renderer || typeof THREE === 'undefined' || !THREE.PMREMGenerator) return null;
        if (!pmremGenerator) {
            pmremGenerator = new THREE.PMREMGenerator(renderer);
            if (pmremGenerator.compileEquirectangularShader) {
                pmremGenerator.compileEquirectangularShader();
            }
        }
        return pmremGenerator;
    }

    function applyStudioEnvironment() {
        if (!scene || typeof THREE === 'undefined') return;
        // Fond type photo produit (blanc cassé)
        scene.background = new THREE.Color(0xf5f5f6);

        if (studioEnvRT && studioEnvRT.texture) {
            scene.environment = studioEnvRT.texture;
            return;
        }

        var envMap = (typeof RenderMaterials !== 'undefined' && RenderMaterials.getStudioEnvMap)
            ? RenderMaterials.getStudioEnvMap()
            : null;
        if (!envMap) {
            scene.environment = null;
            return;
        }

        var pmrem = ensurePmrem();
        if (pmrem && pmrem.fromEquirectangular) {
            studioEnvRT = pmrem.fromEquirectangular(envMap);
            scene.environment = studioEnvRT.texture;
        } else {
            scene.environment = envMap;
        }
    }

    function buildContactShadow() {
        if (typeof THREE === 'undefined') return null;
        var size = 256;
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        if (!ctx) return null;

        var g = ctx.createRadialGradient(size * 0.5, size * 0.5, 1, size * 0.5, size * 0.5, size * 0.48);
        g.addColorStop(0, 'rgba(30,34,40,0.38)');
        g.addColorStop(0.25, 'rgba(30,34,40,0.14)');
        g.addColorStop(0.55, 'rgba(30,34,40,0.04)');
        g.addColorStop(1, 'rgba(30,34,40,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);

        var tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        var mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        var mesh = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.12;
        mesh.renderOrder = -2;
        mesh.name = 'render-contact-shadow';
        return mesh;
    }

    function syncContactShadow(enabled) {
        if (!scene || typeof THREE === 'undefined') return;
        if (enabled) {
            if (!contactShadow) contactShadow = buildContactShadow();
            if (contactShadow && !contactShadow.parent) scene.add(contactShadow);
            if (contactShadow) contactShadow.visible = true;
        } else if (contactShadow) {
            contactShadow.visible = false;
            if (contactShadow.parent) contactShadow.parent.remove(contactShadow);
        }
    }

    function syncStudioLights(enabled) {
        if (!scene || typeof THREE === 'undefined') return;

        if (enabled) {
            // Peu de lumières : le look verre vient surtout de l’envMap / Fresnel
            if (!studioLights) {
                studioLights = new THREE.Group();
                studioLights.name = 'render-studio-lights';

                var hemi = new THREE.HemisphereLight(0xffffff, 0xb8bcc4, 0.45);
                studioLights.add(hemi);

                var key = new THREE.DirectionalLight(0xffffff, 0.25);
                key.position.set(-2.5, 4.0, 2.0);
                studioLights.add(key);

                var fill = new THREE.DirectionalLight(0xffffff, 0.15);
                fill.position.set(2.8, 2.5, 1.2);
                studioLights.add(fill);
            }
            if (!studioLights.parent) scene.add(studioLights);
            studioLights.visible = true;
            if (baseBg() && baseBg().setDefaultLightsVisible) {
                baseBg().setDefaultLightsVisible(false);
            }
        } else {
            if (studioLights) studioLights.visible = false;
            if (baseBg() && baseBg().setDefaultLightsVisible) {
                baseBg().setDefaultLightsVisible(true);
            }
        }
    }

    function applyBaseViewport() {
        clearSceneEnvironment();
        syncContactShadow(false);
        syncStudioLights(false);
        if (baseBg() && baseBg().applyBaseBackground) baseBg().applyBaseBackground();
        if (baseBg() && baseBg().setDefaultLightsVisible) baseBg().setDefaultLightsVisible(true);
    }

    function applyStudioViewport() {
        applyStudioEnvironment();
        syncContactShadow(true);
        syncStudioLights(true);
    }

    function syncRendererPipeline() {
        if (!renderer || typeof THREE === 'undefined') return;
        if (isRenderModeEnabled()) {
            if (renderer.physicallyCorrectLights !== undefined) renderer.physicallyCorrectLights = true;
            if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
            if (renderer.toneMapping !== undefined) renderer.toneMapping = THREE.ACESFilmicToneMapping;
            if (renderer.toneMappingExposure !== undefined) renderer.toneMappingExposure = 1.18;
        } else {
            if (renderer.physicallyCorrectLights !== undefined) renderer.physicallyCorrectLights = false;
            if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.LinearEncoding;
            if (renderer.toneMapping !== undefined) renderer.toneMapping = THREE.LinearToneMapping;
            if (renderer.toneMappingExposure !== undefined) renderer.toneMappingExposure = 1.0;
        }
    }

    function applyHelperVisibility(axesHelper, gridHelper) {
        var opts = (typeof window !== 'undefined' && window.displayOptions) ? window.displayOptions : {};
        var renderOn = isRenderModeEnabled();
        if (axesHelper) axesHelper.visible = !renderOn && opts.showAxes !== false;
        if (gridHelper) gridHelper.visible = !renderOn && opts.showGrid !== false;
    }

    function setActive() {
        if (isRenderModeEnabled()) applyStudioViewport();
        else applyBaseViewport();
        syncRendererPipeline();
    }

    return {
        isRenderModeEnabled: isRenderModeEnabled,
        syncRendererPipeline: syncRendererPipeline,
        applyHelperVisibility: applyHelperVisibility,
        setActive: setActive,
        applySceneDecor: setActive,
        applyBackgroundScene: setActive,
        getActive: function () { return isRenderModeEnabled() ? 'studio' : 'none'; }
    };
})();
