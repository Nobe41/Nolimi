// 01-saas/features/render/materials.js
// Verre photoréaliste mode rendu : shader Fresnel + réfraction/réflexion studio.
// EnvMap procédurale à fort contraste (murs sombres + softboxes verticales).

var RenderMaterials = (function () {
    var MATERIAL_MODE = 'base'; // 'base' | 'glass'
    var studioRectEnvMap = null;

    function setMaterialMode(mode) {
        MATERIAL_MODE = (mode === 'glass') ? 'glass' : 'base';
    }

    function getMaterialMode() {
        return MATERIAL_MODE;
    }

    function isGlassMode() {
        return MATERIAL_MODE === 'glass';
    }

    // Studio produit : murs gris moyen/foncé + softboxes blanches verticales.
    // Le contraste crée le liseré Fresnel sombre et les bandes de highlight.
    function buildStudioRectEnvMap() {
        if (typeof THREE === 'undefined') return null;
        if (studioRectEnvMap) return studioRectEnvMap;

        var w = 2048;
        var h = 1024;
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Ambiance studio (pas blanc) — indispensable pour les bords sombres du verre
        var bg = ctx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, '#6a7078');
        bg.addColorStop(0.35, '#4e545c');
        bg.addColorStop(0.65, '#3a4048');
        bg.addColorStop(1, '#2a3038');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Panneau arrière un peu plus clair (vu à travers / en réfraction)
        var back = ctx.createRadialGradient(w * 0.5, h * 0.42, 20, w * 0.5, h * 0.42, w * 0.42);
        back.addColorStop(0, 'rgba(210,214,220,0.55)');
        back.addColorStop(0.55, 'rgba(140,146,154,0.25)');
        back.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = back;
        ctx.fillRect(0, 0, w, h);

        // Sol plus sombre
        var floor = ctx.createLinearGradient(0, h * 0.68, 0, h);
        floor.addColorStop(0, 'rgba(0,0,0,0)');
        floor.addColorStop(1, 'rgba(18,20,24,0.85)');
        ctx.fillStyle = floor;
        ctx.fillRect(0, h * 0.68, w, h * 0.32);

        function drawSoftbox(xCenter, stripW, top, bottom, peak) {
            var x0 = xCenter - stripW * 0.5;
            var g = ctx.createLinearGradient(x0, 0, x0 + stripW, 0);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(0.18, 'rgba(255,255,255,' + (peak * 0.35) + ')');
            g.addColorStop(0.38, 'rgba(255,255,255,' + (peak * 0.85) + ')');
            g.addColorStop(0.5, 'rgba(255,255,255,' + peak + ')');
            g.addColorStop(0.62, 'rgba(255,255,255,' + (peak * 0.85) + ')');
            g.addColorStop(0.82, 'rgba(255,255,255,' + (peak * 0.35) + ')');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x0, top, stripW, bottom - top);

            // Cœur très lumineux (highlight net sur le cylindre)
            var coreW = Math.max(8, stripW * 0.18);
            var cg = ctx.createLinearGradient(xCenter - coreW, 0, xCenter + coreW, 0);
            cg.addColorStop(0, 'rgba(255,255,255,0)');
            cg.addColorStop(0.5, 'rgba(255,255,255,1)');
            cg.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = cg;
            ctx.fillRect(xCenter - coreW, top + 12, coreW * 2, bottom - top - 24);
        }

        // Softboxes principales gauche / droite (signature photo produit)
        drawSoftbox(w * 0.12, 140, 40, h - 60, 1.0);
        drawSoftbox(w * 0.88, 140, 40, h - 60, 1.0);
        // Softboxes secondaires (épaules / volume)
        drawSoftbox(w * 0.28, 70, 80, h - 100, 0.55);
        drawSoftbox(w * 0.72, 70, 80, h - 100, 0.55);
        // Softbox plafond
        var topG = ctx.createLinearGradient(0, 0, 0, h * 0.18);
        topG.addColorStop(0, 'rgba(255,255,255,0.9)');
        topG.addColorStop(0.6, 'rgba(220,224,230,0.35)');
        topG.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = topG;
        ctx.fillRect(w * 0.2, 0, w * 0.6, h * 0.18);

        studioRectEnvMap = new THREE.CanvasTexture(canvas);
        studioRectEnvMap.mapping = THREE.EquirectangularReflectionMapping;
        studioRectEnvMap.magFilter = THREE.LinearFilter;
        studioRectEnvMap.minFilter = THREE.LinearMipmapLinearFilter;
        studioRectEnvMap.generateMipmaps = true;
        if (studioRectEnvMap.encoding !== undefined && THREE.sRGBEncoding !== undefined) {
            studioRectEnvMap.encoding = THREE.sRGBEncoding;
        }
        studioRectEnvMap.needsUpdate = true;
        return studioRectEnvMap;
    }

    function buildGlassUniforms(opts) {
        opts = opts || {};
        return {
            envMap: { value: buildStudioRectEnvMap() },
            envIntensity: { value: opts.envIntensity != null ? opts.envIntensity : 1.35 },
            ior: { value: opts.ior != null ? opts.ior : 1.5 },
            fresnelPower: { value: opts.fresnelPower != null ? opts.fresnelPower : 5.0 },
            reflectBoost: { value: opts.reflectBoost != null ? opts.reflectBoost : 1.15 },
            refractMix: { value: opts.refractMix != null ? opts.refractMix : 0.22 },
            backdropColor: { value: new THREE.Color(opts.backdrop != null ? opts.backdrop : 0xf7f7f8) },
            edgeDarken: { value: opts.edgeDarken != null ? opts.edgeDarken : 0.22 },
            thicknessBoost: { value: opts.thicknessBoost != null ? opts.thicknessBoost : 0.35 },
            opacity: { value: opts.opacity != null ? opts.opacity : 1.0 }
        };
    }

    var glassVertexShader = [
        'varying vec3 vWorldPos;',
        'varying vec3 vWorldNormal;',
        'varying vec3 vViewPos;',
        'void main() {',
        '  vec4 worldPos = modelMatrix * vec4(position, 1.0);',
        '  vWorldPos = worldPos.xyz;',
        '  vWorldNormal = normalize(mat3(modelMatrix) * normal);',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  vViewPos = mv.xyz;',
        '  gl_Position = projectionMatrix * mv;',
        '}'
    ].join('\n');

    var glassFragmentShader = [
        'uniform sampler2D envMap;',
        'uniform float envIntensity;',
        'uniform float ior;',
        'uniform float fresnelPower;',
        'uniform float reflectBoost;',
        'uniform float refractMix;',
        'uniform vec3 backdropColor;',
        'uniform float edgeDarken;',
        'uniform float thicknessBoost;',
        'uniform float opacity;',
        'varying vec3 vWorldPos;',
        'varying vec3 vWorldNormal;',
        'varying vec3 vViewPos;',
        'const float PI = 3.141592653589793;',
        'vec2 dirToEquirect(vec3 dir) {',
        '  vec3 d = normalize(dir);',
        '  float u = atan(d.z, d.x) * (0.5 / PI) + 0.5;',
        '  float v = asin(clamp(d.y, -1.0, 1.0)) * (1.0 / PI) + 0.5;',
        '  return vec2(u, v);',
        '}',
        'vec3 sampleEnv(vec3 dir) {',
        '  return texture2D(envMap, dirToEquirect(dir)).rgb * envIntensity;',
        '}',
        'void main() {',
        '  vec3 N = normalize(vWorldNormal);',
        '  vec3 V = normalize(cameraPosition - vWorldPos);',
        '  float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);',
        '  // Fresnel Schlick (verre IOR ~1.5 → F0 ≈ 0.04)',
        '  float F0 = 0.04;',
        '  float fresnel = F0 + (1.0 - F0) * pow(1.0 - ndv, fresnelPower);',
        '  fresnel = clamp(fresnel * reflectBoost, 0.0, 1.0);',
        '  vec3 R = reflect(-V, N);',
        '  vec3 reflected = sampleEnv(R);',
        '  // Réfraction vers le fond studio clair + léger env',
        '  float eta = 1.0 / max(ior, 1.01);',
        '  vec3 refrDir = refract(-V, N, eta);',
        '  vec3 refractedEnv = length(refrDir) > 0.001 ? sampleEnv(refrDir) : sampleEnv(-V);',
        '  vec3 refracted = mix(backdropColor, refractedEnv, refractMix);',
        '  // Épaississement optique aux angles rasants (silhouette + base)',
        '  float thick = pow(1.0 - ndv, 2.2) * thicknessBoost;',
        '  refracted *= (1.0 - thick * 0.45);',
        '  refracted -= vec3(thick * edgeDarken);',
        '  vec3 color = mix(refracted, reflected, fresnel);',
        '  // Micro-specular : renforce les softboxes déjà dans l’env',
        '  float highlight = pow(max(reflected.r, max(reflected.g, reflected.b)), 6.0);',
        '  color += vec3(highlight * fresnel * 0.45);',
        '  // Centre quasi invisible (fond blanc), bords + highlights opaques',
        '  float visibility = clamp(fresnel * 1.05 + thick * 0.75 + highlight * 0.3, 0.06, 1.0);',
        '  gl_FragColor = vec4(color, visibility * opacity);',
        '}'
    ].join('\n');

    function createGlassShaderMaterial(opts) {
        var uniforms = buildGlassUniforms(opts);
        var mat = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: glassVertexShader,
            fragmentShader: glassFragmentShader,
            transparent: true,
            depthWrite: opts && opts.depthWrite === false ? false : true,
            side: (opts && opts.side != null) ? opts.side : THREE.FrontSide,
            lights: false,
            polygonOffset: !!(opts && opts.polygonOffset),
            polygonOffsetFactor: (opts && opts.polygonOffsetFactor != null) ? opts.polygonOffsetFactor : 1,
            polygonOffsetUnits: (opts && opts.polygonOffsetUnits != null) ? opts.polygonOffsetUnits : 1
        });
        mat.userData = mat.userData || {};
        mat.userData.isRenderGlass = true;
        mat.userData.baseOpacity = uniforms.opacity.value;
        mat.userData.baseDepthWrite = mat.depthWrite;
        mat.userData.glassOpacityUniform = uniforms.opacity;
        // Synchronise opacity Three.js ↔ uniforme shader (applyViewOpacity, blending)
        try { delete mat.opacity; } catch (err) { /* ignore */ }
        Object.defineProperty(mat, 'opacity', {
            get: function () { return uniforms.opacity.value; },
            set: function (v) { uniforms.opacity.value = v; },
            configurable: true,
            enumerable: true
        });
        return mat;
    }

    function getOuterGlassMaterial() {
        return createGlassShaderMaterial({
            envIntensity: 1.4,
            fresnelPower: 4.8,
            reflectBoost: 1.2,
            refractMix: 0.2,
            edgeDarken: 0.28,
            thicknessBoost: 0.42,
            opacity: 1,
            depthWrite: true,
            side: THREE.DoubleSide
        });
    }

    function getInnerGlassMaterial() {
        return createGlassShaderMaterial({
            envIntensity: 1.05,
            fresnelPower: 5.2,
            reflectBoost: 0.95,
            refractMix: 0.12,
            edgeDarken: 0.18,
            thicknessBoost: 0.55,
            opacity: 0.7,
            depthWrite: false,
            side: THREE.BackSide,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });
    }

    function getActiveBottleMaterial(color) {
        if (isGlassMode()) return getOuterGlassMaterial();
        if (typeof BottleMaterials !== 'undefined' && BottleMaterials.getBaseMaterial) {
            return BottleMaterials.getBaseMaterial(color);
        }
        return null;
    }

    // Invalide le cache si on retouche l’envMap (hot reload)
    function invalidateEnvMap() {
        if (studioRectEnvMap && studioRectEnvMap.dispose) studioRectEnvMap.dispose();
        studioRectEnvMap = null;
    }

    return {
        setMaterialMode: setMaterialMode,
        getMaterialMode: getMaterialMode,
        isGlassMode: isGlassMode,
        getOuterGlassMaterial: getOuterGlassMaterial,
        getInnerGlassMaterial: getInnerGlassMaterial,
        getActiveBottleMaterial: getActiveBottleMaterial,
        getStudioEnvMap: buildStudioRectEnvMap,
        invalidateEnvMap: invalidateEnvMap
    };
})();
