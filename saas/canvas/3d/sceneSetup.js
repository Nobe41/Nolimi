// js/3d/sceneSetup.js
// Initialisation de la scène Three.js (caméra ortho, éclairage, grille).
// Assigne scene, camera, renderer, controls aux variables globales (state.js).

var SceneSetup3D = (function () {
    var sceneRules = (typeof Canvas3DRules !== 'undefined' && Canvas3DRules.SCENE) ? Canvas3DRules.SCENE : {};
    var VIEW_SIZE_BASE = sceneRules.VIEW_SIZE_BASE || 250;
    var VIEWPORT_FIT_RATIO = sceneRules.VIEWPORT_FIT_RATIO != null ? sceneRules.VIEWPORT_FIT_RATIO : 0.98;
    var VIEW_SIZE = sceneRules.VIEW_SIZE != null
        ? sceneRules.VIEW_SIZE
        : (VIEW_SIZE_BASE * VIEWPORT_FIT_RATIO);
    var NEAR = sceneRules.NEAR || 1;
    var FAR = sceneRules.FAR || 2000;
    var CAMERA_POSITION = sceneRules.CAMERA_POSITION || { x: 400, y: 300, z: 400 };
    var CONTROLS_TARGET_Y = sceneRules.CONTROLS_TARGET_Y || 150;
    var DIRECTIONAL_INTENSITY = sceneRules.DIRECTIONAL_INTENSITY || 0.45;
    var AMBIENT_INTENSITY = sceneRules.AMBIENT_INTENSITY || 0.5;
    var AXES_SIZE = sceneRules.AXES_SIZE || 100;
    var GRID_SIZE = sceneRules.GRID_SIZE || 400;
    var GRID_DIVISIONS = sceneRules.GRID_DIVISIONS || 20;
    var GRID_OPACITY = sceneRules.GRID_OPACITY || 0.6;
    var ACTIVE_BG_SCENE = 'none';
    var backgroundTextures = { scene1: null, scene2: null };
    var scene0EnvTexture = null;
    var scene0EnvBackgroundTexture = null;
    var scene0EnvImageLoading = false;
    var scene0EnvImageLoaded = false;
    var SCENE0_ENV_IMAGE_PATH = 'assets/env/empty_play_room_1k.exr';
    var axesHelper = null;
    var gridHelper = null;
    var sceneDecor = {
        table: null, tableLegs: [], contactShadow: null, sunLight: null,
        frontLightLeft: null, frontLightRight: null, fillLight: null, baseKeyLight: null, baseRimLight: null,
        defaultLightLeft: null, defaultLightRight: null, defaultAmbient: null,
        scene0Dome: null
    };

    function makeBackgroundTexture(kind) {
        if (typeof THREE === 'undefined') return null;
        var size = 1024;
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        if (!ctx) return null;

        var grad = ctx.createLinearGradient(0, 0, 0, size);
        if (kind === 'scene2') {
            grad.addColorStop(0, '#e7f1ff');
            grad.addColorStop(1, '#cfdff4');
        } else {
            grad.addColorStop(0, '#fff4e7');
            grad.addColorStop(1, '#f1e3cf');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        // Lignes légères pour donner un vrai "fond image"
        ctx.strokeStyle = kind === 'scene2' ? 'rgba(80,110,150,0.18)' : 'rgba(120,90,60,0.18)';
        ctx.lineWidth = 2;
        for (var i = 0; i < 14; i++) {
            var y = Math.round((i + 1) * size / 15);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y);
            ctx.stroke();
        }
        for (var j = 0; j < 10; j++) {
            var x = Math.round((j + 1) * size / 11);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, size);
            ctx.stroke();
        }

        var tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    }

    function makeWoodTextureSet() {
        if (typeof THREE === 'undefined') return null;
        var size = 1024;
        function makeCanvas() {
            var c = document.createElement('canvas');
            c.width = size; c.height = size;
            return c;
        }
        var albedoCanvas = makeCanvas();
        var roughCanvas = makeCanvas();
        var bumpCanvas = makeCanvas();
        var aCtx = albedoCanvas.getContext('2d');
        var rCtx = roughCanvas.getContext('2d');
        var bCtx = bumpCanvas.getContext('2d');
        if (!aCtx || !rCtx || !bCtx) return null;

        var grad = aCtx.createLinearGradient(0, 0, 0, size);
        grad.addColorStop(0, '#a87e53');
        grad.addColorStop(1, '#6e4a2b');
        aCtx.fillStyle = grad;
        aCtx.fillRect(0, 0, size, size);
        rCtx.fillStyle = '#8f8f8f';
        rCtx.fillRect(0, 0, size, size);
        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, size, size);

        // Veines + joints de planches
        for (var i = 0; i < 80; i++) {
            var y = (i / 80) * size + (Math.random() * 8 - 4);
            var tone = i % 2 ? '#5b3f27' : '#c69a6a';
            aCtx.globalAlpha = 0.16 + Math.random() * 0.12;
            aCtx.strokeStyle = tone;
            aCtx.lineWidth = 1.5 + Math.random() * 2.5;
            aCtx.beginPath();
            aCtx.moveTo(0, y);
            for (var x = 0; x <= size; x += 32) {
                var ny = y + Math.sin((x / size) * Math.PI * 7 + i * 0.25) * (3 + Math.random() * 3);
                aCtx.lineTo(x, ny);
            }
            aCtx.stroke();

            rCtx.globalAlpha = 0.08;
            rCtx.strokeStyle = '#222222';
            rCtx.lineWidth = 2;
            rCtx.beginPath();
            rCtx.moveTo(0, y);
            rCtx.lineTo(size, y);
            rCtx.stroke();

            bCtx.globalAlpha = 0.12;
            bCtx.strokeStyle = '#b0b0b0';
            bCtx.lineWidth = 1.5;
            bCtx.beginPath();
            bCtx.moveTo(0, y);
            bCtx.lineTo(size, y);
            bCtx.stroke();
        }
        aCtx.globalAlpha = 1;
        rCtx.globalAlpha = 1;
        bCtx.globalAlpha = 1;

        // Joints de planches verticaux
        for (var j = 1; j < 5; j++) {
            var bx = Math.round((j / 5) * size);
            aCtx.strokeStyle = 'rgba(45,30,18,0.45)';
            aCtx.lineWidth = 3;
            aCtx.beginPath();
            aCtx.moveTo(bx, 0);
            aCtx.lineTo(bx, size);
            aCtx.stroke();

            rCtx.strokeStyle = 'rgba(20,20,20,0.35)';
            rCtx.lineWidth = 4;
            rCtx.beginPath();
            rCtx.moveTo(bx, 0);
            rCtx.lineTo(bx, size);
            rCtx.stroke();
        }

        function toTex(canvas) {
            var tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(3, 3);
            tex.needsUpdate = true;
            return tex;
        }
        return {
            albedo: toTex(albedoCanvas),
            roughness: toTex(roughCanvas),
            bump: toTex(bumpCanvas)
        };
    }

    function ensureBackgroundTexture(kind) {
        if (!backgroundTextures[kind]) backgroundTextures[kind] = makeBackgroundTexture(kind);
        return backgroundTextures[kind];
    }

    function isRenderModeEnabled() {
        if (typeof document === 'undefined') return false;
        var modeToggle = document.getElementById('render-mode-toggle');
        return !!(modeToggle && modeToggle.checked);
    }

    function buildScene0PanoramaTexture() {
        if (typeof THREE === 'undefined') return null;
        var w = 2048;
        var h = 1024;
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Environnement studio visible (pas juste un blanc uniforme).
        var grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#eef3f8');
        grad.addColorStop(0.38, '#e2e9f1');
        grad.addColorStop(0.56, '#d0d8e4');
        grad.addColorStop(0.70, '#c6ad89');
        grad.addColorStop(1, '#9e7d58');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Horizon lisible.
        var horizonY = Math.round(h * 0.58);
        ctx.fillStyle = 'rgba(255, 236, 210, 0.40)';
        ctx.fillRect(0, horizonY - 16, w, 32);

        // Sol "planches" simplifié pour casser l'effet fond blanc.
        var floorTop = horizonY + 8;
        var floorH = h - floorTop;
        var floorGrad = ctx.createLinearGradient(0, floorTop, 0, h);
        floorGrad.addColorStop(0, 'rgba(193, 154, 111, 0.55)');
        floorGrad.addColorStop(1, 'rgba(115, 84, 52, 0.72)');
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, floorTop, w, floorH);
        ctx.strokeStyle = 'rgba(88, 60, 34, 0.24)';
        ctx.lineWidth = 2;
        for (var lx = 0; lx < w; lx += 120) {
            ctx.beginPath();
            ctx.moveTo(lx, floorTop);
            ctx.lineTo(lx, h);
            ctx.stroke();
        }

        // Panneaux lumineux verticaux type studio.
        function addLightPanel(cx, panelW, alpha) {
            var x0 = Math.max(0, Math.round(cx - panelW / 2));
            var x1 = Math.min(w, Math.round(cx + panelW / 2));
            var lg = ctx.createLinearGradient(x0, 0, x1, 0);
            lg.addColorStop(0, 'rgba(255,255,255,0)');
            lg.addColorStop(0.5, 'rgba(255,255,255,' + alpha + ')');
            lg.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = lg;
            ctx.fillRect(x0, Math.round(h * 0.08), x1 - x0, Math.round(h * 0.7));
        }
        addLightPanel(w * 0.18, w * 0.10, 0.70);
        addLightPanel(w * 0.50, w * 0.13, 0.60);
        addLightPanel(w * 0.82, w * 0.10, 0.70);

        // Montants sombres pour que les reflets aient des contours nets.
        ctx.fillStyle = 'rgba(38, 46, 58, 0.24)';
        ctx.fillRect(Math.round(w * 0.10), Math.round(h * 0.08), Math.round(w * 0.02), Math.round(h * 0.68));
        ctx.fillRect(Math.round(w * 0.48), Math.round(h * 0.08), Math.round(w * 0.02), Math.round(h * 0.68));
        ctx.fillRect(Math.round(w * 0.88), Math.round(h * 0.08), Math.round(w * 0.02), Math.round(h * 0.68));

        // Vignette légère pour éviter un fond trop plat.
        var vGrad = ctx.createRadialGradient(w / 2, h * 0.48, h * 0.18, w / 2, h * 0.5, h * 0.86);
        vGrad.addColorStop(0, 'rgba(255,255,255,0)');
        vGrad.addColorStop(1, 'rgba(45,33,20,0.34)');
        ctx.fillStyle = vGrad;
        ctx.fillRect(0, 0, w, h);

        var tex = new THREE.CanvasTexture(canvas);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        if (tex.encoding !== undefined && THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
        tex.needsUpdate = true;
        return tex;
    }

    function buildEquirectTextureFromImage(image) {
        if (typeof THREE === 'undefined' || !image) return null;
        var w = 2048;
        var h = 1024; // ratio 2:1 attendu pour equirect
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Fond doux pour éviter des bandes noires dures.
        var bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, '#f0f0f0');
        bgGrad.addColorStop(1, '#d8d8d8');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // "Contain" : on affiche toute l'image sans crop (évite l'effet zoom).
        var iw = image.width || w;
        var ih = image.height || h;
        var imgAspect = iw / Math.max(1, ih);
        var targetW = w;
        var targetH = Math.round(targetW / Math.max(0.01, imgAspect));
        if (targetH > h) {
            targetH = h;
            targetW = Math.round(targetH * imgAspect);
        }
        var dx = Math.round((w - targetW) / 2);
        var dy = Math.round((h - targetH) / 2);

        // Couche de remplissage agrandie, faible alpha (adoucit les marges).
        ctx.globalAlpha = 0.22;
        ctx.drawImage(image, 0, 0, iw, ih, 0, 0, w, h);
        ctx.globalAlpha = 1.0;
        ctx.drawImage(image, 0, 0, iw, ih, dx, dy, targetW, targetH);

        var tex = new THREE.CanvasTexture(canvas);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        if (tex.encoding !== undefined && THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
        tex.needsUpdate = true;
        return tex;
    }

    function ensureScene0Environment() {
        if (typeof THREE === 'undefined') return null;
        if (!scene0EnvBackgroundTexture) {
            scene0EnvBackgroundTexture = buildScene0PanoramaTexture();
        }
        if (!scene0EnvTexture && scene0EnvBackgroundTexture) {
            if (renderer && typeof THREE.PMREMGenerator !== 'undefined') {
                var pmrem = new THREE.PMREMGenerator(renderer);
                if (pmrem.compileEquirectangularShader) pmrem.compileEquirectangularShader();
                var envRT = pmrem.fromEquirectangular(scene0EnvBackgroundTexture);
                scene0EnvTexture = envRT ? envRT.texture : scene0EnvBackgroundTexture;
                pmrem.dispose();
            } else {
                scene0EnvTexture = scene0EnvBackgroundTexture;
            }
        }

        // Remplace le panorama procédural par l'EXR utilisateur dès qu'il est chargé.
        if (!scene0EnvImageLoaded && !scene0EnvImageLoading) {
            scene0EnvImageLoading = true;
            var loader = (typeof THREE.EXRLoader !== 'undefined')
                ? new THREE.EXRLoader()
                : new THREE.TextureLoader();
            loader.load(
                SCENE0_ENV_IMAGE_PATH,
                function (imgTex) {
                    scene0EnvImageLoading = false;
                    scene0EnvImageLoaded = true;
                    if (!imgTex) return;
                    // EXR: déjà HDR/equirect -> on l'applique tel quel.
                    if (typeof THREE.EXRLoader !== 'undefined') {
                        imgTex.mapping = THREE.EquirectangularReflectionMapping;
                        imgTex.magFilter = THREE.LinearFilter;
                        imgTex.minFilter = THREE.LinearFilter;
                        imgTex.generateMipmaps = false;
                        scene0EnvBackgroundTexture = imgTex;
                    } else {
                        var converted = buildEquirectTextureFromImage(imgTex.image) || imgTex;
                        scene0EnvBackgroundTexture = converted;
                    }
                    if (renderer && typeof THREE.PMREMGenerator !== 'undefined') {
                        var pmrem2 = new THREE.PMREMGenerator(renderer);
                        if (pmrem2.compileEquirectangularShader) pmrem2.compileEquirectangularShader();
                        var envRT2 = pmrem2.fromEquirectangular(scene0EnvBackgroundTexture);
                        scene0EnvTexture = envRT2 ? envRT2.texture : scene0EnvBackgroundTexture;
                        pmrem2.dispose();
                    } else {
                        scene0EnvTexture = scene0EnvBackgroundTexture;
                    }
                    if (sceneDecor.scene0Dome && sceneDecor.scene0Dome.material) {
                        sceneDecor.scene0Dome.material.map = scene0EnvBackgroundTexture;
                        sceneDecor.scene0Dome.material.needsUpdate = true;
                    }
                    if (scene && ACTIVE_BG_SCENE === 'scene0' && isRenderModeEnabled()) {
                        ensureScene0Dome();
                        applyBackgroundScene();
                        applySceneDecor();
                    }
                },
                undefined,
                function () {
                    scene0EnvImageLoading = false;
                }
            );
        }
        return scene0EnvTexture;
    }

    function ensureScene0Dome() {
        if (!scene || typeof THREE === 'undefined') return null;
        if (sceneDecor.scene0Dome) return sceneDecor.scene0Dome;
        if (!scene0EnvBackgroundTexture) ensureScene0Environment();
        if (!scene0EnvBackgroundTexture) return null;
        var domeGeo = new THREE.SphereGeometry(1400, 64, 40);
        var domeMat = new THREE.MeshBasicMaterial({
            map: scene0EnvBackgroundTexture,
            side: THREE.BackSide,
            depthWrite: false
        });
        var dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.set(0, 120, 0);
        dome.renderOrder = -10;
        scene.add(dome);
        sceneDecor.scene0Dome = dome;
        return dome;
    }

    function applyBackgroundScene() {
        if (!scene || typeof THREE === 'undefined') return;
        var useScene0Env = ACTIVE_BG_SCENE === 'scene0' && isRenderModeEnabled();
        if (useScene0Env) {
            var envTex = ensureScene0Environment();
            scene.environment = envTex;
            // Si l'EXR est chargé, on l'affiche directement en fond (cadrage correct).
            if (scene0EnvImageLoaded && scene0EnvBackgroundTexture) {
                scene.background = scene0EnvBackgroundTexture;
            } else {
                // Fallback sobre pendant le chargement/échec EXR.
                scene.background = scene0EnvBackgroundTexture || new THREE.Color(0xffffff);
            }
            if (sceneDecor.scene0Dome) sceneDecor.scene0Dome.visible = false;
            return;
        }
        if (ACTIVE_BG_SCENE === 'scene1' || ACTIVE_BG_SCENE === 'scene2') {
            scene.background = ensureBackgroundTexture(ACTIVE_BG_SCENE);
            scene.environment = null;
        } else {
            scene.background = new THREE.Color(0xffffff);
            scene.environment = null;
        }
    }

    function ensureSceneDecor() {
        if (!scene || typeof THREE === 'undefined') return;
        if (sceneDecor.table && sceneDecor.baseKeyLight) return;

        var woodSet = makeWoodTextureSet();
        var tableMat = new THREE.MeshPhysicalMaterial({
            color: 0x8a6640,
            roughness: 0.65,
            metalness: 0.02,
            map: woodSet ? woodSet.albedo : null,
            roughnessMap: woodSet ? woodSet.roughness : null,
            bumpMap: woodSet ? woodSet.bump : null,
            bumpScale: 0.25,
            clearcoat: 0.1,
            clearcoatRoughness: 0.35
        });

        sceneDecor.table = new THREE.Mesh(new THREE.BoxGeometry(520, 8, 380), tableMat);
        sceneDecor.table.position.set(0, -4, 0);
        sceneDecor.table.receiveShadow = true;
        scene.add(sceneDecor.table);

        var legMat = new THREE.MeshPhysicalMaterial({ color: 0x6b4a2e, roughness: 0.82, metalness: 0.03 });
        var legOffsets = [
            { x: -220, z: -150 }, { x: 220, z: -150 },
            { x: -220, z: 150 }, { x: 220, z: 150 }
        ];
        for (var i = 0; i < legOffsets.length; i++) {
            var leg = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 130, 16), legMat);
            leg.position.set(legOffsets[i].x, -69, legOffsets[i].z);
            leg.castShadow = true;
            leg.receiveShadow = true;
            sceneDecor.tableLegs.push(leg);
            scene.add(leg);
        }

        // Ombre de contact simple sous la bouteille
        var shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 });
        sceneDecor.contactShadow = new THREE.Mesh(new THREE.CircleGeometry(65, 48), shadowMat);
        sceneDecor.contactShadow.rotation.x = -Math.PI / 2;
        sceneDecor.contactShadow.position.set(0, 0.05, 0);
        scene.add(sceneDecor.contactShadow);

        // Lumière "soleil"
        sceneDecor.sunLight = new THREE.DirectionalLight(0xfff4dc, 1.0);
        sceneDecor.sunLight.position.set(320, 460, 180);
        sceneDecor.sunLight.target.position.set(0, 120, 0);
        sceneDecor.sunLight.castShadow = true;
        sceneDecor.sunLight.shadow.mapSize.width = 2048;
        sceneDecor.sunLight.shadow.mapSize.height = 2048;
        sceneDecor.sunLight.shadow.camera.near = 10;
        sceneDecor.sunLight.shadow.camera.far = 1200;
        sceneDecor.sunLight.shadow.camera.left = -350;
        sceneDecor.sunLight.shadow.camera.right = 350;
        sceneDecor.sunLight.shadow.camera.top = 350;
        sceneDecor.sunLight.shadow.camera.bottom = -350;
        sceneDecor.sunLight.shadow.bias = -0.00015;
        scene.add(sceneDecor.sunLight);
        scene.add(sceneDecor.sunLight.target);

        // Eclairage studio activé uniquement en Scène 1.
        sceneDecor.frontLightLeft = new THREE.DirectionalLight(0xffffff, 0.92);
        sceneDecor.frontLightLeft.position.set(-260, 300, 420);
        sceneDecor.frontLightLeft.target.position.set(0, 140, 0);
        scene.add(sceneDecor.frontLightLeft);
        scene.add(sceneDecor.frontLightLeft.target);

        sceneDecor.frontLightRight = new THREE.DirectionalLight(0xffffff, 0.92);
        sceneDecor.frontLightRight.position.set(260, 300, 420);
        sceneDecor.frontLightRight.target.position.set(0, 140, 0);
        scene.add(sceneDecor.frontLightRight);
        scene.add(sceneDecor.frontLightRight.target);

        sceneDecor.fillLight = new THREE.HemisphereLight(0xffffff, 0xeaf2ff, 0.55);
        scene.add(sceneDecor.fillLight);

        // Scène 0: projecteur doux — reflet visible sur le verre sans écraser les ombres.
        sceneDecor.baseKeyLight = new THREE.SpotLight(0xfff8f4, 1.35, 2200, Math.PI / 5, 0.55, 2);
        sceneDecor.baseKeyLight.position.set(240, 300, 480);
        sceneDecor.baseKeyLight.target.position.set(0, 125, 0);
        sceneDecor.baseKeyLight.castShadow = true;
        sceneDecor.baseKeyLight.shadow.mapSize.width = 2048;
        sceneDecor.baseKeyLight.shadow.mapSize.height = 2048;
        sceneDecor.baseKeyLight.shadow.camera.near = 10;
        sceneDecor.baseKeyLight.shadow.camera.far = 1200;
        sceneDecor.baseKeyLight.shadow.camera.left = -300;
        sceneDecor.baseKeyLight.shadow.camera.right = 300;
        sceneDecor.baseKeyLight.shadow.camera.top = 300;
        sceneDecor.baseKeyLight.shadow.camera.bottom = -300;
        sceneDecor.baseKeyLight.shadow.bias = -0.0001;
        scene.add(sceneDecor.baseKeyLight);
        scene.add(sceneDecor.baseKeyLight.target);

        // Très léger contre-jour pour garder du relief sans gommer les ombres de la clé.
        sceneDecor.baseRimLight = new THREE.DirectionalLight(0xe8eef8, 0.12);
        sceneDecor.baseRimLight.position.set(-180, 220, -260);
        sceneDecor.baseRimLight.target.position.set(0, 120, 0);
        scene.add(sceneDecor.baseRimLight);
        scene.add(sceneDecor.baseRimLight.target);
    }

    function applySceneDecor() {
        if (!scene) return;
        ensureSceneDecor();
        var isScene1 = ACTIVE_BG_SCENE === 'scene1';
        var isScene0 = ACTIVE_BG_SCENE === 'scene0';
        var isScene0Render = isScene0 && isRenderModeEnabled();
        var isBaseDefault = ACTIVE_BG_SCENE === 'none';
        if (sceneDecor.table) sceneDecor.table.visible = isScene1;
        if (sceneDecor.contactShadow) sceneDecor.contactShadow.visible = isScene1;
        if (sceneDecor.sunLight) sceneDecor.sunLight.visible = isScene1;
        if (sceneDecor.frontLightLeft) sceneDecor.frontLightLeft.visible = isScene1;
        if (sceneDecor.frontLightRight) sceneDecor.frontLightRight.visible = isScene1;
        if (sceneDecor.fillLight) sceneDecor.fillLight.visible = isScene1;
        if (sceneDecor.baseKeyLight) sceneDecor.baseKeyLight.visible = isScene0;
        if (sceneDecor.baseRimLight) sceneDecor.baseRimLight.visible = isScene0;
        if (sceneDecor.defaultLightLeft) sceneDecor.defaultLightLeft.visible = isBaseDefault;
        if (sceneDecor.defaultLightRight) sceneDecor.defaultLightRight.visible = isBaseDefault;
        if (sceneDecor.defaultAmbient) sceneDecor.defaultAmbient.visible = isBaseDefault;
        if (sceneDecor.scene0Dome) sceneDecor.scene0Dome.visible = false;
        for (var i = 0; i < sceneDecor.tableLegs.length; i++) {
            sceneDecor.tableLegs[i].visible = isScene1;
        }
    }

    function applyDisplayOptions() {
        if (!scene) return;
        var opts = (typeof window !== 'undefined' && window.displayOptions) ? window.displayOptions : {};
        var isScene0Render = ACTIVE_BG_SCENE === 'scene0' && isRenderModeEnabled();
        if (axesHelper) axesHelper.visible = !isScene0Render && opts.showAxes !== false;
        if (gridHelper) gridHelper.visible = !isScene0Render && opts.showGrid !== false;
    }

    /**
     * Tonemapping / couleurs : actif dès que le mode rendu est activé
     * (même sans scene0) pour mieux lire le verre et ses reflets.
     */
    function syncRendererPipeline() {
        if (!renderer || typeof THREE === 'undefined') return;
        var modeToggle = (typeof document !== 'undefined') ? document.getElementById('render-mode-toggle') : null;
        var renderOn = modeToggle && modeToggle.checked;
        if (renderOn) {
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

    function initScene(canvasElement) {
        if (!canvasElement || typeof THREE === 'undefined') return null;

        var w = canvasElement.clientWidth;
        var h = canvasElement.clientHeight;
        if (h < 1) h = 1;
        var aspect = w / h;

        scene = new THREE.Scene();
        applyBackgroundScene();

        camera = new THREE.OrthographicCamera(
            -VIEW_SIZE * aspect, VIEW_SIZE * aspect,
            VIEW_SIZE, -VIEW_SIZE,
            NEAR, FAR
        );
        camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        canvasElement.appendChild(renderer.domElement);

        axesHelper = new THREE.AxesHelper(AXES_SIZE);
        scene.add(axesHelper);
        gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, 0xaaaaaa, 0xcccccc);
        gridHelper.material.opacity = GRID_OPACITY;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);
        applyDisplayOptions();
        applySceneDecor();
        syncRendererPipeline();

        scene.add(camera);
        // Eclairage historique de base (actif hors mode rendu).
        sceneDecor.defaultLightLeft = new THREE.DirectionalLight(0xffffff, DIRECTIONAL_INTENSITY);
        sceneDecor.defaultLightLeft.position.set(-3, 0, 1.5);
        camera.add(sceneDecor.defaultLightLeft);
        sceneDecor.defaultLightRight = new THREE.DirectionalLight(0xffffff, DIRECTIONAL_INTENSITY);
        sceneDecor.defaultLightRight.position.set(3, 0, 1.5);
        camera.add(sceneDecor.defaultLightRight);
        sceneDecor.defaultAmbient = new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY);
        scene.add(sceneDecor.defaultAmbient);

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.set(0, CONTROLS_TARGET_Y, 0);
        controls.enableDamping = false;
        controls.zoomSpeed = 1.0;

        return { scene: scene, camera: camera, renderer: renderer, controls: controls };
    }

    function resize(width, height) {
        if (!camera || !renderer) return;
        var w = width || (viewport3D ? viewport3D.clientWidth : 0);
        var h = height || (viewport3D ? viewport3D.clientHeight : 0);
        if (!w || !h) return;
        var aspect = w / h;
        camera.left = -VIEW_SIZE * aspect;
        camera.right = VIEW_SIZE * aspect;
        camera.top = VIEW_SIZE;
        camera.bottom = -VIEW_SIZE;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    function disposeScene() {
        if (controls && controls.dispose) controls.dispose();
        if (renderer && renderer.dispose) renderer.dispose();
        if (renderer && renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        scene = null;
        camera = null;
        controls = null;
        renderer = null;
        axesHelper = null;
        gridHelper = null;
    }

    return {
        initScene: initScene,
        resize: resize,
        disposeScene: disposeScene,
        applyDisplayOptions: applyDisplayOptions,
        setBackgroundScene: function (sceneName) {
            if (sceneName === 'scene0' || sceneName === 'scene1' || sceneName === 'scene2') ACTIVE_BG_SCENE = sceneName;
            else ACTIVE_BG_SCENE = 'none';
            applyBackgroundScene();
            applySceneDecor();
            applyDisplayOptions();
            syncRendererPipeline();
        },
        syncRendererPipeline: syncRendererPipeline
    };
})();
