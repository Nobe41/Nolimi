// js/3d/bottleView.js
// Vue 3D bouteille : panel → sections → maillages (corps, piqûre, bague). Pipeline CAO.

var BottleView3D = (function () {
    /* Tessellation fine : courbes et surfaces lisses en viewport et à l'export (STL = maillage uniquement). */
    var tess = (typeof Canvas3DRules !== 'undefined' && Canvas3DRules.TESSELLATION) ? Canvas3DRules.TESSELLATION : {};
    var ringRules = (typeof Canvas3DRules !== 'undefined' && Canvas3DRules.SECTION_RING) ? Canvas3DRules.SECTION_RING : {};
    var N_SEGMENTS = tess.N_SEGMENTS || 128;
    var N_FEUILLE_V = tess.N_FEUILLE_V || 32;
    var MERIDIAN_RESOLUTION = tess.MERIDIAN_RESOLUTION || 64;
    /** Méridien du profil 2D (vue de face) = joint de moule en 3D (axe X rouge, 0°). */
    var MOLD_JOINT_PROFILE_THETA = 0;
    var RING_COLOR_NORMAL = ringRules.COLOR_NORMAL || 0x000000;
    var RING_COLOR_HIGHLIGHT = ringRules.COLOR_HIGHLIGHT || 0x0066cc;

    var sectionRingGroup = null;
    var bottleInnerGlassMesh = null;
    var bottleLabelMeshes = {};
    var bottleLabelCacheKeys = {};

    function disposeLabelMeshById(labelId) {
        var mesh = bottleLabelMeshes[labelId];
        if (!mesh) return;
        if (mesh.parent) mesh.parent.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material && mesh.material.dispose) mesh.material.dispose();
        delete bottleLabelMeshes[labelId];
        delete bottleLabelCacheKeys[labelId];
    }

    function disposeAllLabelMeshes() {
        var ids = Object.keys(bottleLabelMeshes);
        for (var i = 0; i < ids.length; i++) disposeLabelMeshById(ids[i]);
    }

    /** Libère géométries / matériaux Three.js pour éviter la saturation GPU (context lost). */
    function disposeThreeHierarchy(root) {
        if (!root) return;
        root.traverse(function (node) {
            if (node.geometry) node.geometry.dispose();
            if (!node.material) return;
            var mats = Array.isArray(node.material) ? node.material : [node.material];
            for (var mi = 0; mi < mats.length; mi++) {
                var mat = mats[mi];
                if (!mat) continue;
                if (mat.map && mat.map.dispose) mat.map.dispose();
                if (mat.dispose) mat.dispose();
            }
        });
    }

    function detachPersistedFromSectionRing() {
        if (!sectionRingGroup) return;
        if (bottleGroup && bottleGroup.parent === sectionRingGroup) sectionRingGroup.remove(bottleGroup);
        var labelIds = Object.keys(bottleLabelMeshes);
        for (var li = 0; li < labelIds.length; li++) {
            var lm = bottleLabelMeshes[labelIds[li]];
            if (lm && lm.parent === sectionRingGroup) sectionRingGroup.remove(lm);
        }
    }

    function replaceSectionRingGroup() {
        if (sectionRingGroup) {
            if (scene) scene.remove(sectionRingGroup);
            detachPersistedFromSectionRing();
            disposeThreeHierarchy(sectionRingGroup);
            sectionRingGroup = null;
        }
        sectionRingGroup = new THREE.Group();
        sectionRingGroup.userData.isBottleExportRoot = true;
    }

    function buildBottleBodySignature(sectionsData) {
        if (!sectionsData || !sectionsData.sections) return '';
        var parts = [];
        for (var i = 0; i < sectionsData.sections.length; i++) {
            var s = sectionsData.sections[i];
            parts.push([
                Math.round((s.H || 0) * 100) / 100,
                Math.round((s.a || 0) * 100) / 100,
                Math.round((s.b || 0) * 100) / 100,
                s.shape || '',
                Math.round((s.carreNiveau || 0) * 100) / 100
            ].join(','));
        }
        if (sectionsData.edgeTypes && sectionsData.edgeTypes.length) parts.push('e:' + sectionsData.edgeTypes.join(','));
        if (sectionsData.rhos && sectionsData.rhos.length) {
            var rr = [];
            for (var r = 0; r < sectionsData.rhos.length; r++) rr.push(Math.round((sectionsData.rhos[r] || 0) * 100) / 100);
            parts.push('r:' + rr.join(','));
        }
        return parts.join('|');
    }

    function isGlassRenderMode() {
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

    var PIQURE_CONFIG = [
        { h: 's1-h', L: 'sp-L', P: 'sp-P', formKey: 'sp-forme', carreKey: 'sp-carre-niveau', defaultL: 55, defaultP: 55 },
        { h: 'sp2-h', L: 'sp2-L', P: 'sp2-P', formKey: 'sp2-forme', carreKey: 'sp2-carre-niveau', defaultL: 45, defaultP: 45 },
        { h: 'sp3-h', L: 'sp3-L', P: 'sp3-P', formKey: 'sp3-forme', carreKey: 'sp3-carre-niveau', defaultL: 28, defaultP: 28 }
    ];
    var BAGUE_CONFIG = [
        { h: 'sb1-h', L: 'sb1-L', P: 'sb1-P', formKey: 'sb1-forme', carreKey: 'sb1-carre-niveau', defaultL: 29.5, defaultP: 29.5 },
        { h: 'sb2-h', L: 'sb2-L', P: 'sb2-P', formKey: 'sb2-forme', carreKey: 'sb2-carre-niveau', defaultL: 29.5, defaultP: 29.5 },
        { h: 'sb3-h', L: 'sb3-L', P: 'sb3-P', formKey: 'sb3-forme', carreKey: 'sb3-carre-niveau', defaultL: 25.5, defaultP: 25.5 },
        { h: 'sb4-h', L: 'sb4-L', P: 'sb4-P', formKey: 'sb4-forme', carreKey: 'sb4-carre-niveau', defaultL: 31, defaultP: 31 },
        { h: 'sb5-h', L: 'sb5-L', P: 'sb5-P', formKey: 'sb5-forme', carreKey: 'sb5-carre-niveau', defaultL: 29, defaultP: 29 }
    ];

    function getPanelValue(id, def) {
        var el = document.getElementById(id);
        if (!el) return def;
        var v = parseFloat(el.value);
        return isNaN(v) ? def : Math.max(0, v);
    }
    /** Pour les champs qui acceptent des négatifs (ex. spline rho). */
    function getPanelValueSigned(id, def) {
        var el = document.getElementById(id);
        if (!el) return def;
        var v = parseFloat(el.value);
        return isNaN(v) ? def : v;
    }

    function getPanelSelectValue(id, def) {
        var el = document.getElementById(id);
        if (!el || !el.value) return def;
        return el.value;
    }

    function getSectionForme(k) {
        return getPanelSelectValue('s' + k + '-forme', 'cylindrique');
    }
    function getSectionCarreNiveau(k) {
        var v = getPanelValue('s' + k + '-carre-niveau', 0);
        return Math.max(0, Math.min(100, v));
    }

    function getMainSectionIndicesFromDOM() {
        var inputs = document.querySelectorAll('input[id^="s"][id$="-h"]');
        var idxs = [];
        for (var i = 0; i < inputs.length; i++) {
            var id = inputs[i].id || '';
            var m = id.match(/^s(\d+)-h$/);
            if (!m) continue;
            var k = parseInt(m[1], 10);
            if (isFinite(k)) idxs.push(k);
        }
        idxs.sort(function (a, b) { return a - b; });
        // Dédupliquer
        var out = [];
        for (var j = 0; j < idxs.length; j++) {
            if (j === 0 || idxs[j] !== idxs[j - 1]) out.push(idxs[j]);
        }
        return out;
    }

    function getSectionFromPanel(cfg) {
        var H = getPanelValue(cfg.h, 0);
        var shape = cfg.shape !== undefined ? cfg.shape : getPanelSelectValue(cfg.formKey, 'cylindrique');
        var L = getPanelValue(cfg.L, cfg.defaultL);
        var P = getPanelValue(cfg.P, cfg.defaultP);
        if (typeof SectionsRules !== 'undefined' && SectionsRules.resolveSectionDimensions) {
            var resolved = SectionsRules.resolveSectionDimensions(shape, L, P);
            shape = resolved.shape;
            L = resolved.L;
            P = resolved.P;
        }
        var carreNiveau = cfg.carreNiveau !== undefined ? cfg.carreNiveau : Math.max(0, Math.min(100, getPanelValue(cfg.carreKey, 0)));
        return { H: H, a: Math.max(0, L / 2), b: Math.max(0, P / 2), shape: shape, carreNiveau: carreNiveau };
    }

    function getPiqureSectionFromPanel() { return getSectionFromPanel(PIQURE_CONFIG[0]); }
    function getHautPiqureSectionFromPanel() { return getSectionFromPanel(PIQURE_CONFIG[1]); }
    function getHautPiqure3SectionFromPanel() { return getSectionFromPanel(PIQURE_CONFIG[2]); }
    function getBague1SectionFromPanel() { return getSectionFromPanel(BAGUE_CONFIG[0]); }
    function getBague2SectionFromPanel() { return getSectionFromPanel(BAGUE_CONFIG[1]); }
    function getBague3SectionFromPanel() { return getSectionFromPanel(BAGUE_CONFIG[2]); }
    function getBague4SectionFromPanel() { return getSectionFromPanel(BAGUE_CONFIG[3]); }
    function getBague5SectionFromPanel() { return getSectionFromPanel(BAGUE_CONFIG[4]); }

    function getSectionsDataFromPanel() {
        if (typeof Bottle3DData !== 'undefined' && Bottle3DData.getSectionsData) {
            return Bottle3DData.getSectionsData();
        }
        var idxs = getMainSectionIndicesFromDOM();
        if (!idxs || idxs.length < 2) {
            // fallback historique (au cas où l’inspecteur n’est pas rendu)
            idxs = [1, 2, 3, 4, 5];
        }

        var sections = [];
        for (var ii = 0; ii < idxs.length; ii++) {
            var k = idxs[ii];
            var defaultL = (k === 1) ? 71 : (k <= 3 ? 85 : 32);
            var defaultP = defaultL;
            var Hraw = getPanelValue('s' + k + '-h', 0);
            var a = Math.max(0, getPanelValue('s' + k + '-L', defaultL) / 2);
            var b = Math.max(0, getPanelValue('s' + k + '-P', defaultP) / 2);
            sections.push({ H: Hraw, a: a, b: b, shape: getSectionForme(k), carreNiveau: getSectionCarreNiveau(k) });
        }

        // Assurer des hauteurs monotones (Y(k+1) >= Y(k))
        for (var j = 1; j < sections.length; j++) {
            if (sections[j].H < sections[j - 1].H) sections[j].H = sections[j - 1].H;
        }

        var edgeTypes = [];
        var rhos = [];
        for (var e = 0; e < sections.length - 1; e++) {
            var from = e + 1;
            var to = e + 2;
            var rid = 'r' + from + to;
            edgeTypes.push(getPanelSelectValue(rid + '-type', 'ligne'));
            rhos.push(getPanelValueSigned(rid + '-rho', 10));
        }

        return { sections: sections, edgeTypes: edgeTypes, rhos: rhos };
    }

    function collectLiaisonsFromDom(prefix, expectedCount) {
        var edgeTypes = [];
        var rhos = [];
        if (expectedCount > 0) {
            for (var i = 1; i <= expectedCount; i++) {
                var id = prefix + i;
                edgeTypes.push(getPanelSelectValue(id + '-type', 'ligne'));
                rhos.push(getPanelValueSigned(id + '-rho', 5));
            }
            return { edgeTypes: edgeTypes, rhos: rhos };
        }
        var selects = document.querySelectorAll('select[id^="' + prefix + '"][id$="-type"]');
        for (var j = 0; j < selects.length; j++) {
            var sid = (selects[j].id || '').replace(/-type$/, '');
            edgeTypes.push(getPanelSelectValue(sid + '-type', 'ligne'));
            rhos.push(getPanelValueSigned(sid + '-rho', 5));
        }
        return { edgeTypes: edgeTypes, rhos: rhos };
    }

    function buildSectionsDataBundle(sections, liaisonPrefix) {
        if (!sections || sections.length < 2) return null;
        for (var j = 1; j < sections.length; j++) {
            if (sections[j].H < sections[j - 1].H) sections[j].H = sections[j - 1].H;
        }
        var n = sections.length - 1;
        var liaisons = collectLiaisonsFromDom(liaisonPrefix, n);
        while (liaisons.edgeTypes.length < n) {
            liaisons.edgeTypes.push('ligne');
            liaisons.rhos.push(5);
        }
        liaisons.edgeTypes = liaisons.edgeTypes.slice(0, n);
        liaisons.rhos = liaisons.rhos.slice(0, n);
        return { sections: sections, edgeTypes: liaisons.edgeTypes, rhos: liaisons.rhos };
    }

    function collectIndexedSectionKeys(prefix) {
        var inputs = document.querySelectorAll('input[id^="' + prefix + '"][id$="-h"]');
        var idxs = [];
        for (var i = 0; i < inputs.length; i++) {
            var m = (inputs[i].id || '').match(new RegExp('^' + prefix + '(\\d+)-h$'));
            if (!m) continue;
            var k = parseInt(m[1], 10);
            if (isFinite(k)) idxs.push(k);
        }
        idxs.sort(function (a, b) { return a - b; });
        var clean = [];
        for (var j = 0; j < idxs.length; j++) if (j === 0 || idxs[j] !== idxs[j - 1]) clean.push(idxs[j]);
        return clean;
    }

    function collectPiqureSectionsFromPanel() {
        var piqSections = [getPiqureSectionFromPanel()];
        var panel = document.getElementById('panel-content-piqure');
        var heightInputs = panel
            ? panel.querySelectorAll('input[id^="sp"][id$="-h"]')
            : document.querySelectorAll('input[id^="sp"][id$="-h"]');
        for (var ssi = 0; ssi < heightInputs.length; ssi++) {
            var m = (heightInputs[ssi].id || '').match(/^sp(\d+)-h$/);
            if (!m) continue;
            var ksp = parseInt(m[1], 10);
            piqSections.push(getSectionFromPanel({
                h: 'sp' + ksp + '-h',
                L: 'sp' + ksp + '-L',
                P: 'sp' + ksp + '-P',
                formKey: 'sp' + ksp + '-forme',
                carreKey: 'sp' + ksp + '-carre-niveau',
                defaultL: 45,
                defaultP: 45
            }));
        }
        return piqSections;
    }

    function collectBagueSectionsFromPanel() {
        var panel = document.getElementById('panel-content-bague');
        var heightInputs = panel
            ? panel.querySelectorAll('input[id^="sb"][id$="-h"]')
            : document.querySelectorAll('input[id^="sb"][id$="-h"]');
        var bagueSections = [];
        for (var bsi = 0; bsi < heightInputs.length; bsi++) {
            var m = (heightInputs[bsi].id || '').match(/^sb(\d+)-h$/);
            if (!m) continue;
            var ksb2 = parseInt(m[1], 10);
            bagueSections.push(getSectionFromPanel({
                h: 'sb' + ksb2 + '-h',
                L: 'sb' + ksb2 + '-L',
                P: 'sb' + ksb2 + '-P',
                formKey: 'sb' + ksb2 + '-forme',
                carreKey: 'sb' + ksb2 + '-carre-niveau',
                defaultL: 35,
                defaultP: 35
            }));
        }
        if (!bagueSections.length) {
            bagueSections = [
                getBague1SectionFromPanel(),
                getBague2SectionFromPanel(),
                getBague3SectionFromPanel()
            ];
        }
        return bagueSections;
    }

    function profilePointsFromSectionsData(sectionsData) {
        if (!sectionsData || !sectionsData.sections || sectionsData.sections.length < 2) return [];
        if (typeof BottleMaths === 'undefined' || typeof GeomKernel === 'undefined') return [];
        if (!sectionsData.edgeTypes || !sectionsData.rhos) return [];
        var entities = BottleMaths.buildExteriorProfile(MOLD_JOINT_PROFILE_THETA, sectionsData);
        if (!entities || !entities.length) return [];
        return GeomKernel.tessellateProfile(entities, Math.max(48, MERIDIAN_RESOLUTION)) || [];
    }

    function buildLiaisonRevolvedMesh(sectionsData, color, options) {
        options = options || {};
        if (!sectionsData || !sectionsData.sections || sectionsData.sections.length < 2) return null;
        if (typeof BottleMesh3D === 'undefined' || !BottleMesh3D.createBottleMesh) {
            return buildRuledSurfaceStrip(sectionsData.sections, color);
        }
        var mat;
        if (options.inner) {
            mat = new THREE.MeshPhongMaterial({
                color: color || 0x6f8ead,
                side: THREE.BackSide,
                shininess: 20
            });
        } else if (typeof BottleMaterials !== 'undefined' && BottleMaterials.getGlassMaterial) {
            mat = BottleMaterials.getGlassMaterial(color || BottleMaterials.DEFAULT_GLASS_COLOR);
        }
        return BottleMesh3D.createBottleMesh(sectionsData, mat);
    }

    function buildSectionRingLine(H, points, isHighlight) {
        var RING_SURFACE_OFFSET = 0.015; // micro-offset pour eviter le z-fighting
        var pts = points.map(function (p) {
            var x = p[0], z = p[1];
            var r = Math.sqrt(x * x + z * z);
            if (r > 1e-9) {
                var k = (r + RING_SURFACE_OFFSET) / r;
                x *= k;
                z *= k;
            }
            return new THREE.Vector3(x, H, z);
        });
        var geom = new THREE.BufferGeometry().setFromPoints(pts);
        var color = isHighlight ? RING_COLOR_HIGHLIGHT : RING_COLOR_NORMAL;
        var mat = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.95,
            depthTest: true
        });
        var ring = new THREE.LineLoop(geom, mat);
        ring.renderOrder = 20;
        return ring;
    }

    function buildMoldJointLine(theta, sectionsData) {
        if (typeof THREE === 'undefined' || typeof BottleMaths === 'undefined' || typeof GeomKernel === 'undefined') return null;
        var entities = BottleMaths.buildExteriorProfile(theta, sectionsData);
        if (!entities || !entities.length) return null;
        var pts2d = GeomKernel.tessellateProfile(entities, Math.max(64, MERIDIAN_RESOLUTION));
        if (!pts2d || !pts2d.length) return null;
        var c = Math.cos(theta), s = Math.sin(theta);
        var pts3d = [];
        for (var i = 0; i < pts2d.length; i++) {
            var p = pts2d[i];
            pts3d.push(new THREE.Vector3(p.x * c, p.y, p.x * s));
        }
        var geom = new THREE.BufferGeometry().setFromPoints(pts3d);
        var mat = new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.95 });
        var line = new THREE.Line(geom, mat);
        line.renderOrder = 20;
        line.userData.isPiqure = false;
        line.userData.isInterior = false;
        return line;
    }

    function addSectionRing(group, section, isHighlight, isPiqure) {
        if (typeof window !== 'undefined' && window.displayOptions && window.displayOptions.showSectionRings === false) return;
        var pts = BottleMaths.getSectionRingPoints(section.a, section.b, section.shape, section.carreNiveau, N_SEGMENTS);
        var ring = buildSectionRingLine(section.H, pts, isHighlight);
        ring.userData.isPiqure = isPiqure;
        group.add(ring);
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
            // Aide à distinguer la piqûre interne derrière la peau externe.
            mat.opacity = Math.max(0.62, (mat.opacity !== undefined ? mat.opacity : 1));
            mat.depthWrite = false;
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

    function addRuledSurfaceIndicesClosedU(indices, nu, nv, rowStride) {
        for (var i = 0; i < nu; i++) {
            var iNext = (i + 1) % nu;
            for (var j = 0; j < nv; j++) {
                var a = i * rowStride + j;
                var b = iNext * rowStride + j;
                var c = iNext * rowStride + j + 1;
                var d = i * rowStride + j + 1;
                indices.push(a, d, c);
                indices.push(a, c, b);
            }
        }
    }

    function buildPiqurePiedFeuille(s1, piqure, H) {
        var nu = N_SEGMENTS;
        var nv = N_FEUILLE_V;
        var vertices = [];
        var indices = [];
        for (var i = 0; i < nu; i++) {
            var u = (i / nu) * 2 * Math.PI;
            for (var j = 0; j <= nv; j++) {
                var v = j / nv;
                var p = BottleMaths.getRadialBandPoint(s1, piqure, H, u, v);
                vertices.push(p.x, p.y, p.z);
            }
        }
        addRuledSurfaceIndicesClosedU(indices, nu, nv, nv + 1);
        var geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();
        var mat = BottleMaterials.getGlassMaterial();
        return new THREE.Mesh(geom, mat);
    }

    function buildPiqureBasHautFeuille(piqure, hautPiqure) {
        var nu = N_SEGMENTS;
        var nv = N_FEUILLE_V;
        var vertices = [];
        var indices = [];
        for (var i = 0; i < nu; i++) {
            var u = (i / nu) * 2 * Math.PI;
            for (var j = 0; j <= nv; j++) {
                var v = j / nv;
                var p = BottleMaths.getRuledSurfacePoint(piqure, hautPiqure, u, v);
                vertices.push(p.x, p.y, p.z);
            }
        }
        addRuledSurfaceIndicesClosedU(indices, nu, nv, nv + 1);
        var geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();
        var mat = BottleMaterials.getGlassMaterial();
        return new THREE.Mesh(geom, mat);
    }

    var NECK_FEUILLE_SURFACE_OFFSET = 0.02;

    function getNeckToBaguePoint(sPrev, sTop, bague1, sectionsData, radiusAt, u, v) {
        var yStart = (sPrev && isFinite(sPrev.H)) ? sPrev.H : sTop.H;
        var yEnd = bague1.H;
        if (yEnd < yStart) yStart = yEnd;
        var y = yStart + v * (yEnd - yStart);
        var c = Math.cos(u);
        var s = Math.sin(u);

        if (y <= sTop.H + 1e-6) {
            var r = radiusAt(y, u) + NECK_FEUILLE_SURFACE_OFFSET;
            return { x: r * c, y: y, z: r * s };
        }

        var rRim = radiusAt(sTop.H, u) + NECK_FEUILLE_SURFACE_OFFSET;
        var pRim = { x: rRim * c, y: sTop.H, z: rRim * s };
        var pBague = BottleMaths.getRuledSurfacePoint(sTop, bague1, u, 1);
        var span = yEnd - sTop.H;
        var t = span > 1e-6 ? (y - sTop.H) / span : 1;
        return {
            x: (1 - t) * pRim.x + t * pBague.x,
            y: y,
            z: (1 - t) * pRim.z + t * pBague.z
        };
    }

    /**
     * Feuille col → bague conforme au profil extérieur (courbe S, rayon, ovale L≠P).
     * Évite que le corps dépasse et « coupe » la feuille au-dessus de l'épaule/col.
     */
    function buildNeckToBagueFeuille(sPrev, sTop, bague1, sectionsData, color) {
        if (!sTop || !bague1 || typeof BottleMaths === 'undefined' || typeof THREE === 'undefined') return null;
        var radiusAt = (BottleMaths.createExteriorRadiusSampler)
            ? BottleMaths.createExteriorRadiusSampler(sectionsData)
            : null;
        if (!radiusAt) return buildPiqureBasHautFeuille(sTop, bague1);

        var nu = N_SEGMENTS;
        var nv = N_FEUILLE_V;
        var vertices = [];
        var indices = [];
        for (var i = 0; i < nu; i++) {
            var u = (i / nu) * 2 * Math.PI;
            for (var j = 0; j <= nv; j++) {
                var v = j / nv;
                var p = getNeckToBaguePoint(sPrev, sTop, bague1, sectionsData, radiusAt, u, v);
                vertices.push(p.x, p.y, p.z);
            }
        }
        addRuledSurfaceIndicesClosedU(indices, nu, nv, nv + 1);
        var geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();
        var mat = BottleMaterials.getGlassMaterial(color);
        return new THREE.Mesh(geom, mat);
    }

    function buildPiqureFeuilleVersAxe(section, topH) {
        var nu = N_SEGMENTS;
        var nv = N_FEUILLE_V;
        var vertices = [];
        var indices = [];
        for (var i = 0; i < nu; i++) {
            var u = (i / nu) * 2 * Math.PI;
            for (var j = 0; j <= nv; j++) {
                var v = j / nv;
                var p = BottleMaths.getConeToApexPoint(section, topH, u, v);
                vertices.push(p.x, p.y, p.z);
            }
        }
        addRuledSurfaceIndicesClosedU(indices, nu, nv, nv + 1);
        var geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();
        var mat = BottleMaterials.getGlassMaterial();
        return new THREE.Mesh(geom, mat);
    }

    function buildRuledSurfaceStrip(sections, color) {
        if (!sections || sections.length < 2) return null;
        var nu = N_SEGMENTS;
        var nv = N_FEUILLE_V;
        var K = sections.length;
        var totalRows = (K - 1) * nv + 1;
        var vertices = [];
        var indices = [];
        for (var i = 0; i < nu; i++) {
            var u = (i / nu) * 2 * Math.PI;
            for (var r = 0; r < totalRows; r++) {
                var k = Math.floor(r / nv);
                var v = (r === (K - 1) * nv) ? 1 : (r - k * nv) / nv;
                if (k >= K - 1) k = K - 2;
                var p = BottleMaths.getRuledSurfacePoint(sections[k], sections[k + 1], u, v);
                vertices.push(p.x, p.y, p.z);
            }
        }
        for (var band = 0; band < K - 1; band++) {
            for (var i = 0; i < nu; i++) {
                var iNext = (i + 1) % nu;
                for (var j = 0; j < nv; j++) {
                    var r0 = band * nv + j;
                    var r1 = band * nv + j + 1;
                    var a = i * totalRows + r0;
                    var b = iNext * totalRows + r0;
                    var c = iNext * totalRows + r1;
                    var d = i * totalRows + r1;
                    indices.push(a, d, c);
                    indices.push(a, c, b);
                }
            }
        }
        var geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();
        var mat = BottleMaterials.getGlassMaterial(color);
        return new THREE.Mesh(geom, mat);
    }

    function getLabelRaycastTargets() {
        var targets = [];
        if (sectionRingGroup) {
            sectionRingGroup.traverse(function (obj) {
                if (!obj.isMesh || !obj.geometry) return;
                if (obj.userData.isInterior || obj.userData.isLabel) return;
                targets.push(obj);
            });
        }
        if (!targets.length && bottleGroup) targets.push(bottleGroup);
        return targets;
    }

    function buildConformalLabelMesh(labelState) {
        var targets = getLabelRaycastTargets();
        if (!targets.length || typeof THREE === 'undefined' || !labelState || !labelState.texture) return null;

        var combinedBox = new THREE.Box3();
        var maxR = 0;
        var centerY = (parseFloat(labelState.height) || 0);
        var bandHalf = 12;
        var hasBandSample = false;
        var bandMaxR = 0;
        for (var ti = 0; ti < targets.length; ti++) {
            var mesh = targets[ti];
            mesh.geometry.computeBoundingBox();
            if (mesh.geometry.boundingBox) {
                var meshBox = mesh.geometry.boundingBox.clone();
                meshBox.applyMatrix4(mesh.matrixWorld);
                combinedBox.union(meshBox);
            }
            var pos = mesh.geometry.attributes.position;
            if (!pos || !pos.count) continue;
            for (var pi = 0; pi < pos.count; pi++) {
                var px = pos.getX(pi);
                var py = pos.getY(pi);
                var pz = pos.getZ(pi);
                var pr = Math.sqrt(px * px + pz * pz);
                if (pr > maxR) maxR = pr;
                if (Math.abs(py - centerY) <= bandHalf) {
                    hasBandSample = true;
                    if (pr > bandMaxR) bandMaxR = pr;
                }
            }
        }
        if (combinedBox.isEmpty()) return null;

        var radius = (hasBandSample ? bandMaxR : maxR);
        if (radius <= 0) return null;
        radius *= 1.01;

        var bboxHeight = combinedBox.max.y - combinedBox.min.y;
        var baseHeight = Math.max(6, bboxHeight * 0.14);
        var scale = Math.max(0.2, (parseFloat(labelState.size) || 100) / 100);
        var labelH = baseHeight * scale;

        var texImage = labelState.texture.image || null;
        var texW = (texImage && texImage.width) ? texImage.width : 1;
        var texH = (texImage && texImage.height) ? texImage.height : 1;
        var texAspect = Math.max(0.01, texW / texH);
        var labelW = labelH * texAspect;
        var maxW = (2 * Math.PI * radius) * 0.95;
        if (labelW > maxW) {
            labelW = maxW;
            labelH = labelW / texAspect;
        }

        var thetaLength = Math.max(0.05, Math.min((labelW / radius), Math.PI * 2 * 0.95));
        var thetaOffset = (parseFloat(labelState.rotation) || 0) * Math.PI / 180;
        var segU = 32;
        var segV = 10;
        var vertices = [];
        var uvs = [];
        var indices = [];
        var labelBottom = centerY;
        var labelTop = centerY + labelH;
        var raycaster = new THREE.Raycaster();
        var normalMatrix = new THREE.Matrix3();
        for (var tw = 0; tw < targets.length; tw++) targets[tw].updateMatrixWorld(true);
        var fallbackRadius = radius * 1.015;
        var outOffset = 0.12;

        for (var iv = 0; iv <= segV; iv++) {
            var v = iv / segV;
            var y = labelBottom + v * (labelTop - labelBottom);
            for (var iu = 0; iu <= segU; iu++) {
                var u = iu / segU;
                var theta = thetaOffset + (u - 0.5) * thetaLength;
                var dx = Math.cos(theta);
                var dz = Math.sin(theta);
                var origin = new THREE.Vector3(dx * maxR * 3.0, y, dz * maxR * 3.0);
                var direction = new THREE.Vector3(-dx, 0, -dz);
                raycaster.set(origin, direction);
                var hits = raycaster.intersectObjects(targets, false);

                var vx = dx * fallbackRadius;
                var vy = y;
                var vz = dz * fallbackRadius;
                if (hits && hits.length) {
                    var hp = hits[0].point;
                    vx = hp.x;
                    vy = hp.y;
                    vz = hp.z;
                    if (hits[0].face && hits[0].face.normal) {
                        normalMatrix.getNormalMatrix(hits[0].object.matrixWorld);
                        var n = hits[0].face.normal.clone().applyMatrix3(normalMatrix).normalize();
                        vx += n.x * outOffset;
                        vy += n.y * outOffset;
                        vz += n.z * outOffset;
                    } else {
                        vx += dx * outOffset;
                        vz += dz * outOffset;
                    }
                }
                vertices.push(vx, vy, vz);
                var uMap = (labelState.flipX ? (1 - u) : u);
                var vMap = (labelState.flipY ? v : (1 - v));
                uvs.push(uMap, vMap);
            }
        }

        for (var j = 0; j < segV; j++) {
            for (var k = 0; k < segU; k++) {
                var a = j * (segU + 1) + k;
                var b = a + 1;
                var c = (j + 1) * (segU + 1) + k;
                var d = c + 1;
                indices.push(a, c, b);
                indices.push(b, c, d);
            }
        }

        var geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geom.setIndex(indices);
        geom.computeVertexNormals();

        labelState.texture.wrapS = THREE.ClampToEdgeWrapping;
        labelState.texture.wrapT = THREE.ClampToEdgeWrapping;
        labelState.texture.needsUpdate = true;

        var mat = new THREE.MeshBasicMaterial({
            map: labelState.texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        var mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, 0, 0);
        mesh.userData.isPiqure = false;
        mesh.userData.isLabel = true;
        mesh.renderOrder = 10;
        return mesh;
    }

    function updateLabelMeshes(sectionsData) {
        if (!bottleGroup || !bottleGroup.geometry || typeof THREE === 'undefined' || typeof window === 'undefined' || !window.renderLabelState) {
            disposeAllLabelMeshes();
            return;
        }
        var labelState = window.renderLabelState;
        var labels = Array.isArray(labelState.labels) ? labelState.labels : [];
        var labelEnabled = !!labelState.enabled && labels.length > 0;
        if (!labelEnabled) {
            disposeAllLabelMeshes();
            return;
        }
        var bodySig = buildBottleBodySignature(sectionsData);
        var keep = {};
        for (var li = 0; li < labels.length; li++) {
            var one = labels[li];
            if (!one || !one.id || !one.texture) continue;
            var labelId = one.id;
            keep[labelId] = true;
            var labelKey = [
                bodySig,
                labelId,
                (one.texture && one.texture.id) ? one.texture.id : 'tx',
                Math.round((parseFloat(one.height) || 0) * 100) / 100,
                Math.round((parseFloat(one.size) || 100) * 100) / 100,
                Math.round((parseFloat(one.rotation) || 0) * 100) / 100,
                one.flipX ? 1 : 0,
                one.flipY ? 1 : 0
            ].join('|');
            if (!bottleLabelMeshes[labelId] || bottleLabelCacheKeys[labelId] !== labelKey) {
                disposeLabelMeshById(labelId);
                bottleLabelMeshes[labelId] = buildConformalLabelMesh(one);
                bottleLabelCacheKeys[labelId] = bottleLabelMeshes[labelId] ? labelKey : '';
            }
            if (bottleLabelMeshes[labelId]) sectionRingGroup.add(bottleLabelMeshes[labelId]);
        }
        var existing = Object.keys(bottleLabelMeshes);
        for (var ei = 0; ei < existing.length; ei++) {
            if (!keep[existing[ei]]) disposeLabelMeshById(existing[ei]);
        }
    }

    function refreshLabelsOnly() {
        if (!scene || !sectionRingGroup || typeof THREE === 'undefined') return false;
        updateLabelMeshes(getSectionsDataFromPanel());
        return true;
    }


    function updateView() {
        if (!scene || typeof BottleMesh3D === 'undefined') return;
        if (typeof Validator !== 'undefined' && Validator.applyAllUserConstraints) Validator.applyAllUserConstraints();
        var sectionsData = getSectionsDataFromPanel();
        var sections = sectionsData.sections;
        var activeSection = typeof window.activeSectionIndex !== 'undefined' ? window.activeSectionIndex : 0;

        replaceSectionRingGroup();

        var bottleTessOverride = (typeof Gravure3D !== 'undefined' && Gravure3D.getBottleTessellationOverrides)
            ? Gravure3D.getBottleTessellationOverrides(sectionsData)
            : null;

        if (!bottleGroup) {
            var baseMat = (typeof BottleMaterials !== 'undefined' && BottleMaterials.getBottleBodyMaterial)
                ? BottleMaterials.getBottleBodyMaterial()
                : null;
            bottleGroup = BottleMesh3D.createBottleMesh(sectionsData, baseMat, bottleTessOverride);
            if (bottleGroup) {
                bottleGroup.userData = bottleGroup.userData || {};
                bottleGroup.userData.materialMode = (typeof BottleMaterials !== 'undefined' && BottleMaterials.getRenderMaterialMode)
                    ? BottleMaterials.getRenderMaterialMode()
                    : 'base';
            }
        } else {
            if (typeof BottleMaterials !== 'undefined' && BottleMaterials.getRenderMaterialMode && BottleMaterials.getBottleBodyMaterial) {
                var targetMode = BottleMaterials.getRenderMaterialMode();
                if (!bottleGroup.userData || bottleGroup.userData.materialMode !== targetMode) {
                    if (bottleGroup.material && bottleGroup.material.dispose) bottleGroup.material.dispose();
                    bottleGroup.material = BottleMaterials.getBottleBodyMaterial();
                    bottleGroup.userData = bottleGroup.userData || {};
                    bottleGroup.userData.materialMode = targetMode;
                }
            }
            BottleMesh3D.updateBottleMesh(bottleGroup, sectionsData, bottleTessOverride);
        }
        if (bottleGroup && typeof Gravure3D !== 'undefined' && Gravure3D.applyInvertedEngravingsToBottleMesh) {
            Gravure3D.applyInvertedEngravingsToBottleMesh(bottleGroup, sectionsData);
        }
        if (bottleGroup) {
            bottleGroup.userData.isPiqure = false;
            enableMeshShadows(bottleGroup);
            sectionRingGroup.add(bottleGroup);
        }

        // Verre réaliste : ajouter une peau intérieure pour donner une épaisseur lisible.
        if (bottleInnerGlassMesh) {
            if (bottleInnerGlassMesh.geometry) bottleInnerGlassMesh.geometry.dispose();
            if (bottleInnerGlassMesh.material && bottleInnerGlassMesh.material.dispose) bottleInnerGlassMesh.material.dispose();
            bottleInnerGlassMesh = null;
        }
        if (bottleGroup && bottleGroup.geometry && typeof THREE !== 'undefined') {
            var thicknessMm = (typeof InterieurMath !== 'undefined' && InterieurMath.getThicknessMm)
                ? InterieurMath.getThicknessMm()
                : 3.5;
            var innerSectionsData = (typeof InterieurMath !== 'undefined' && InterieurMath.buildInteriorSectionsDataFromThickness)
                ? InterieurMath.buildInteriorSectionsDataFromThickness(sectionsData, thicknessMm, thicknessMm)
                : sectionsData;
            var renderModeNow = (typeof BottleMaterials !== 'undefined' && BottleMaterials.getRenderMaterialMode)
                ? BottleMaterials.getRenderMaterialMode()
                : 'base';
            var innerMat;
            if (renderModeNow === 'glass') {
                innerMat = (typeof BottleMaterials !== 'undefined' && BottleMaterials.getInnerGlassMaterial)
                    ? BottleMaterials.getInnerGlassMaterial(BottleMaterials.DEFAULT_GLASS_COLOR)
                    : BottleMaterials.getGlassMaterial(BottleMaterials.DEFAULT_GLASS_COLOR);
            } else {
                innerMat = new THREE.MeshPhongMaterial({
                    color: 0x6f8ead,
                    side: THREE.BackSide,
                    shininess: 20
                });
            }
            bottleInnerGlassMesh = (typeof BottleMesh3D !== 'undefined' && BottleMesh3D.createBottleMesh)
                ? BottleMesh3D.createBottleMesh(innerSectionsData, innerMat)
                : null;
            if (!bottleInnerGlassMesh) {
                var fallbackGeom = bottleGroup.geometry.clone();
                bottleInnerGlassMesh = new THREE.Mesh(fallbackGeom, innerMat);
            }
            bottleInnerGlassMesh.position.copy(bottleGroup.position);
            bottleInnerGlassMesh.rotation.copy(bottleGroup.rotation);
            bottleInnerGlassMesh.userData.isPiqure = false;
            bottleInnerGlassMesh.userData.isInterior = true;
            bottleInnerGlassMesh.castShadow = false;
            bottleInnerGlassMesh.receiveShadow = true;
            bottleInnerGlassMesh.renderOrder = 3;
            if (typeof Gravure3D !== 'undefined' && Gravure3D.punchHolesForInvertedEngravings) {
                Gravure3D.punchHolesForInvertedEngravings(bottleInnerGlassMesh, sectionsData);
            }
            sectionRingGroup.add(bottleInnerGlassMesh);
        }

        for (var i = 0; i < sections.length; i++) {
            addSectionRing(sectionRingGroup, sections[i], activeSection === i + 1, false);
        }

        // Joint de moule visuel sur l'axe rouge X (deux demi-joints opposes, 0° et 180°).
        var showMoldJoint = !(typeof window !== 'undefined' && window.displayOptions && window.displayOptions.showMoldJoint === false);
        if (showMoldJoint) {
            var moldLineA = buildMoldJointLine(MOLD_JOINT_PROFILE_THETA, sectionsData);
            var moldLineB = buildMoldJointLine(MOLD_JOINT_PROFILE_THETA + Math.PI, sectionsData);
            if (moldLineA) sectionRingGroup.add(moldLineA);
            if (moldLineB) sectionRingGroup.add(moldLineB);
        }

        // ---------- PIQÛRE (dynamique : sp + sp2..spN) ----------
        var piqSections = collectPiqureSectionsFromPanel();
        var s1 = sections[0];
        addSectionRing(sectionRingGroup, piqSections[0], false, true);
        for (var pri = 1; pri < piqSections.length; pri++) {
            addSectionRing(sectionRingGroup, piqSections[pri], false, true);
        }
        var feuille = buildPiqurePiedFeuille(s1, piqSections[0], piqSections[0].H);
        feuille.userData.isPiqure = true;
        enhanceInnerPiqureVisibility(feuille);
        enableMeshShadows(feuille);
        sectionRingGroup.add(feuille);
        var thicknessNow = (typeof InterieurMath !== 'undefined' && InterieurMath.getThicknessMm)
            ? InterieurMath.getThicknessMm()
            : 3.5;
        var piqureInnerMat = getInnerShellMaterial();
        var s1Inner = InterieurMath.insetSection(s1, thicknessNow);
        s1Inner.H = s1.H + thicknessNow;
        var piqSectionsInner = [];
        for (var psi = 0; psi < piqSections.length; psi++) {
            // Exception demandee: la piqure se decale vers l'exterieur.
            var outerAtH = InterieurMath.getOuterSectionAtHeight(sections, piqSections[psi].H || 0);
            var maxTa = outerAtH ? Math.max(0, (outerAtH.a || 0) - (piqSections[psi].a || 0) - 0.2) : thicknessNow;
            var maxTb = outerAtH ? Math.max(0, (outerAtH.b || 0) - (piqSections[psi].b || 0) - 0.2) : thicknessNow;
            var tPiq = Math.min(thicknessNow, maxTa, maxTb);
            var innerP = InterieurMath.outsetSection(piqSections[psi], tPiq);
            innerP.H = (piqSections[psi].H || 0) + thicknessNow;
            piqSectionsInner.push(innerP);
        }
        var feuilleInner = buildPiqurePiedFeuille(s1Inner, piqSectionsInner[0], piqSectionsInner[0].H);
        if (feuilleInner && !isGlassRenderMode()) {
            feuilleInner.userData.isPiqure = true;
            feuilleInner.userData.isInterior = true;
            sectionRingGroup.add(feuilleInner);
        }
        var piqSectionsData = buildSectionsDataBundle(piqSections.slice(), 'rp');
        var feuillePiqureStrip = buildLiaisonRevolvedMesh(piqSectionsData, BottleMaterials.DEFAULT_GLASS_COLOR);
        if (feuillePiqureStrip) {
            feuillePiqureStrip.userData.isPiqure = true;
            enhanceInnerPiqureVisibility(feuillePiqureStrip);
            enableMeshShadows(feuillePiqureStrip);
            sectionRingGroup.add(feuillePiqureStrip);
            var piqInnerSectionsData = buildSectionsDataBundle(piqSectionsInner.slice(), 'rp');
            var piqStripInner = buildLiaisonRevolvedMesh(piqInnerSectionsData, 0x6f8ead, { inner: true });
            if (piqStripInner && !isGlassRenderMode()) {
                piqStripInner.userData.isPiqure = true;
                piqStripInner.userData.isInterior = true;
                if (piqStripInner.material) {
                    piqStripInner.material.side = THREE.BackSide;
                    if (piqStripInner.material.shininess !== undefined) piqStripInner.material.shininess = 20;
                }
                sectionRingGroup.add(piqStripInner);
            }
        }
        var lastP = piqSections[piqSections.length - 1];
        var rp3H = getPanelValue('rp3-h', 30);
        if (lastP && rp3H > lastP.H) {
            var feuilleVersAxe = buildPiqureFeuilleVersAxe(lastP, rp3H);
            feuilleVersAxe.userData.isPiqure = true;
            enhanceInnerPiqureVisibility(feuilleVersAxe);
            enableMeshShadows(feuilleVersAxe);
            sectionRingGroup.add(feuilleVersAxe);
            var lastPInner = piqSectionsInner[piqSectionsInner.length - 1];
            var rp3HInner = Math.max(lastPInner.H, rp3H + thicknessNow);
            var piqApexInner = buildPiqureFeuilleVersAxe(lastPInner, rp3HInner);
            if (piqApexInner && !isGlassRenderMode()) {
                piqApexInner.userData.isPiqure = true;
                piqApexInner.userData.isInterior = true;
                if (piqApexInner.material) {
                    piqApexInner.material = piqureInnerMat;
                }
                sectionRingGroup.add(piqApexInner);
            }
        }

        var bagueSections = collectBagueSectionsFromPanel();
        for (var bri = 0; bri < bagueSections.length; bri++) {
            addSectionRing(sectionRingGroup, bagueSections[bri], false, false);
        }
        var bague1 = bagueSections[0];
        var sTop = sections && sections.length ? sections[sections.length - 1] : null;
        var sPrev = sections && sections.length >= 2 ? sections[sections.length - 2] : null;
        // bague1 ring déjà ajouté dans la boucle si présent
        if (sTop) {
            var feuilleColBague = buildNeckToBagueFeuille(sPrev, sTop, bague1, sectionsData, BottleMaterials.DEFAULT_GLASS_COLOR);
            feuilleColBague.userData.isPiqure = false;
            enableMeshShadows(feuilleColBague);
            sectionRingGroup.add(feuilleColBague);
            var bagueInnerMat = getInnerShellMaterial();
            var feuilleColBagueInner = InterieurMath.createInsetMeshFromMesh(feuilleColBague, thicknessNow, bagueInnerMat);
            if (feuilleColBagueInner && !isGlassRenderMode()) {
                feuilleColBagueInner.userData.isPiqure = false;
                feuilleColBagueInner.userData.isInterior = true;
                sectionRingGroup.add(feuilleColBagueInner);
            }
        }
        var bagueSectionsData = buildSectionsDataBundle(bagueSections.slice(), 'rb');
        var feuilleBagueStrip = buildLiaisonRevolvedMesh(bagueSectionsData, BottleMaterials.DEFAULT_GLASS_COLOR);
        if (feuilleBagueStrip) {
            feuilleBagueStrip.userData.isPiqure = false;
            enableMeshShadows(feuilleBagueStrip);
            sectionRingGroup.add(feuilleBagueStrip);
            var bagueInnerSections = [];
            for (var bis = 0; bis < bagueSections.length; bis++) bagueInnerSections.push(InterieurMath.insetSection(bagueSections[bis], thicknessNow));
            // Exception demandee: la section "2 - Haut bague" ne pilote pas l'epaisseur,
            // on la cale sur la section "3 - Haut bague".
            if (bagueInnerSections.length >= 3) {
                bagueInnerSections[1].a = bagueInnerSections[2].a;
                bagueInnerSections[1].b = bagueInnerSections[2].b;
                bagueInnerSections[1].shape = bagueInnerSections[2].shape;
                bagueInnerSections[1].carreNiveau = bagueInnerSections[2].carreNiveau;
            }
            var bagueInnerSectionsData = buildSectionsDataBundle(bagueInnerSections.slice(), 'rb');
            var bagueStripInner = buildLiaisonRevolvedMesh(bagueInnerSectionsData, 0x6f8ead, { inner: true });
            if (bagueStripInner && !isGlassRenderMode()) {
                bagueStripInner.userData.isPiqure = false;
                bagueStripInner.userData.isInterior = true;
                if (bagueStripInner.material) {
                    bagueStripInner.material.side = THREE.BackSide;
                    if (bagueStripInner.material.shininess !== undefined) bagueStripInner.material.shininess = 20;
                }
                sectionRingGroup.add(bagueStripInner);
            }
        }

        // Fermer le haut de bague : feuille qui relie la section "3 - Haut bague"
        // a la peau interieure pour rendre l'epaisseur lisible au col.
        if (bagueSections.length) {
            var bagueTop = bagueSections[bagueSections.length - 1];
            var bagueTopInner = InterieurMath.insetSection(bagueTop, thicknessNow);
            // Fermeture coplanaire au meme niveau pour garder un rond propre en haut.
            bagueTopInner.H = bagueTop.H;
            var lipSheet = buildPiqureBasHautFeuille(bagueTop, bagueTopInner);
            if (lipSheet && !isGlassRenderMode()) {
                lipSheet.userData.isPiqure = false;
                lipSheet.userData.isInterior = true;
                enableMeshShadows(lipSheet);
                sectionRingGroup.add(lipSheet);
            }
        }

        updateLabelMeshes(sectionsData);

        if (typeof RenderFeature !== 'undefined' && RenderFeature.updateLabelHeightLimits) {
            RenderFeature.updateLabelHeightLimits({
                clampValues: false,
                skipSliderResync: typeof window !== 'undefined' && !!window._renderLabelSliderDragging
            });
        }

        applyViewOpacity(sectionRingGroup);
        scene.add(sectionRingGroup);

        if (typeof CalculeVolumeFeature !== 'undefined' && CalculeVolumeFeature && CalculeVolumeFeature.updateFromSectionsData) {
            CalculeVolumeFeature.updateFromSectionsData(sectionsData);
        }

        if (typeof Gravure3D !== 'undefined' && Gravure3D && Gravure3D.updateScene) {
            Gravure3D.updateScene(scene, sectionsData);
        }
    }

    /**
     * Retourne les points du profil 2D (méridien au joint de moule) pour la vue plan.
     * Utilisé par viewer2d.js pour dessiner le profil avec cotations.
     */
    function getProfilePointsFor2D() {
        var sectionsData = getSectionsDataFromPanel();
        if (!sectionsData || !sectionsData.sections || sectionsData.sections.length < 2) return [];
        var entities = (typeof BottleMaths !== 'undefined' && BottleMaths.buildExteriorProfile)
            ? BottleMaths.buildExteriorProfile(MOLD_JOINT_PROFILE_THETA, sectionsData)
            : [];
        if (!entities || entities.length === 0) return [];
        return (typeof GeomKernel !== 'undefined' && GeomKernel.tessellateProfile)
            ? GeomKernel.tessellateProfile(entities, 32)
            : [];
    }

    function getPiqureProfilePointsFor2D() {
        var profile = profilePointsFromSectionsData(buildSectionsDataBundle(collectPiqureSectionsFromPanel(), 'rp'));
        var rp3h = getPanelValue('rp3-h', NaN);
        if (isFinite(rp3h)) {
            var lastP = collectPiqureSectionsFromPanel();
            var lastH = lastP.length ? lastP[lastP.length - 1].H : 0;
            if (rp3h > lastH) profile.push({ x: 0, y: rp3h });
        }
        profile.sort(function (a, b) { return a.y - b.y; });
        return profile;
    }

    function getBagueProfilePointsFor2D() {
        return profilePointsFromSectionsData(buildSectionsDataBundle(collectBagueSectionsFromPanel(), 'rb'));
    }

    function dispose() {
        if (sectionRingGroup && scene) scene.remove(sectionRingGroup);
        detachPersistedFromSectionRing();
        disposeThreeHierarchy(sectionRingGroup);
        if (bottleGroup) {
            disposeThreeHierarchy(bottleGroup);
            bottleGroup = null;
        }
        if (bottleInnerGlassMesh) {
            disposeThreeHierarchy(bottleInnerGlassMesh);
            bottleInnerGlassMesh = null;
        }
        disposeAllLabelMeshes();
        sectionRingGroup = null;
    }

    return {
        updateView: updateView,
        getProfilePointsFor2D: getProfilePointsFor2D,
        getPiqureProfilePointsFor2D: getPiqureProfilePointsFor2D,
        getBagueProfilePointsFor2D: getBagueProfilePointsFor2D,
        MOLD_JOINT_PROFILE_THETA: MOLD_JOINT_PROFILE_THETA,
        applyViewOpacity: applyViewOpacity,
        refreshLabelsOnly: refreshLabelsOnly,
        dispose: dispose
    };
})();

window.getBottleProfileFromData = function () {
    return (typeof BottleView3D !== 'undefined' && BottleView3D.getProfilePointsFor2D)
        ? BottleView3D.getProfilePointsFor2D()
        : [];
};

