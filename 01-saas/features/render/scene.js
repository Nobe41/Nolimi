// 01-saas/features/render/scene.js
// Réglages visuels du viewport quand le mode rendu est activé.
// Active tonemapping ACES et masque axes/grille ; pas de décor 3D (table, EXR…).
// Fond et lumières restent ceux du canvas 3D de base (Scene3DBackground).

var RenderScene = (function () {
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

    function applyBaseViewport() {
        if (baseBg() && baseBg().applyBaseBackground) baseBg().applyBaseBackground();
        if (baseBg() && baseBg().setDefaultLightsVisible) baseBg().setDefaultLightsVisible(true);
    }

    // ACES + sRGB en mode rendu ; retour linéaire hors mode rendu
    function syncRendererPipeline() {
        if (!renderer || typeof THREE === 'undefined') return;
        if (isRenderModeEnabled()) {
            if (renderer.physicallyCorrectLights !== undefined) renderer.physicallyCorrectLights = true;
            if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
            if (renderer.toneMapping !== undefined) renderer.toneMapping = THREE.ACESFilmicToneMapping;
            if (renderer.toneMappingExposure !== undefined) renderer.toneMappingExposure = 1.05;
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

    /** Compat SceneSetup3D.setBackgroundScene — ignore le nom, pas de décor. */
    function setActive() {
        applyBaseViewport();
        syncRendererPipeline();
    }

    return {
        isRenderModeEnabled: isRenderModeEnabled,
        syncRendererPipeline: syncRendererPipeline,
        applyHelperVisibility: applyHelperVisibility,
        setActive: setActive,
        // Compat anciens appels world.js
        applySceneDecor: applyBaseViewport,
        applyBackgroundScene: applyBaseViewport,
        getActive: function () { return 'none'; }
    };
})();
