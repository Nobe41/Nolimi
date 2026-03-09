// js/3d/bottleView.js
// Vue 3D bouteille : panel → sections → maillages (corps, piqûre, bague). Pipeline CAO.

var BottleView3D = (function () {
    /* Tessellation fine : courbes et surfaces lisses en viewport et à l’export (STL = maillage uniquement). */
    var N_SEGMENTS = 128;
    var N_FEUILLE_V = 32;
    var MERIDIAN_RESOLUTION = 64;
    var RING_COLOR_NORMAL = 0x000000;
    var RING_COLOR_HIGHLIGHT = 0x0066cc;
    window.N_SEGMENTS = N_SEGMENTS;
    window.N_FEUILLE_V = N_FEUILLE_V;
    window.MERIDIAN_RESOLUTION = MERIDIAN_RESOLUTION;

    var sectionRingGroup = null;

    var PIQURE_CONFIG = [
        { h: 's1-h', L: 'sp-L', P: 'sp-P', formKey: 'sp-forme', carreKey: 'sp-carre-niveau', defaultL: 58, defaultP: 58 },
        { h: 'sp2-h', L: 'sp2-L', P: 'sp2-P', formKey: 'sp2-forme', carreKey: 'sp2-carre-niveau', defaultL: 48, defaultP: 48 },
        { h: 'sp3-h', L: 'sp3-L', P: 'sp3-P', formKey: 'sp3-forme', carreKey: 'sp3-carre-niveau', defaultL: 35, defaultP: 35 }
    ];
    var BAGUE_CONFIG = [
        { h: 'sb1-h', L: 'sb1-L', P: 'sb1-P', defaultL: 35, defaultP: 35 },
        { h: 'sb2-h', L: 'sb2-L', P: 'sb2-P', defaultL: 35, defaultP: 35 },
        { h: 'sb3-h', L: 'sb3-L', P: 'sb3-P', defaultL: 33, defaultP: 33 },
        { h: 'sb3-h', L: 'sb4-L', P: 'sb4-P', defaultL: 31, defaultP: 31 },
        { h: 'sb5-h', L: 'sb5-L', P: 'sb5-P', defaultL: 29, defaultP: 29 }
    ];

    function getPanelValue(id, def) {
        var el = document.getElementById(id);
        if (!el) return def;
        var v = parseFloat(el.value);
        return isNaN(v) ? def : Math.max(0, v);
    }

    function getPanelSelectValue(id, def) {
        var el = document.getElementById(id);
        if (!el || !el.value) return def;
        return el.value;
    }

    function getSectionForme(k) {
        return getPanelSelectValue('s' + k + '-forme', 'rond');
    }
    function getSectionCarreNiveau(k) {
        var v = getPanelValue('s' + k + '-carre-niveau', 0);
        return Math.max(0, Math.min(100, v));
    }

    function getSectionFromPanel(cfg) {
        var H = getPanelValue(cfg.h, 0);
        var a = Math.max(0, getPanelValue(cfg.L, cfg.defaultL) / 2);
        var b = Math.max(0, getPanelValue(cfg.P, cfg.defaultP) / 2);
        var shape = cfg.shape !== undefined ? cfg.shape : getPanelSelectValue(cfg.formKey, 'rond');
        var carreNiveau = cfg.carreNiveau !== undefined ? cfg.carreNiveau : Math.max(0, Math.min(100, getPanelValue(cfg.carreKey, 0)));
        return { H: H, a: a, b: b, shape: shape, carreNiveau: carreNiveau };
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
        var H1 = getPanelValue('s1-h', 0);
        var s2hVal = getPanelValue('s2-h', 10);
        var s3hVal = getPanelValue('s3-h', 120);
        var s4hVal = getPanelValue('s4-h', 200);
        var s5hVal = getPanelValue('s5-h', 280);

        s3hVal = Math.max(s3hVal, s2hVal);
        s4hVal = Math.max(s4hVal, s3hVal);
        s5hVal = Math.max(s5hVal, s4hVal);
        s4hVal = Math.min(s4hVal, s5hVal);
        s3hVal = Math.min(s3hVal, s4hVal);
        s2hVal = Math.max(Math.min(s2hVal, s3hVal), H1);

        var H2 = s2hVal, H3 = s3hVal, H4 = s4hVal, H5 = s5hVal;

        var sections = [
            { H: H1, a: Math.max(0, getPanelValue('s1-L', 71) / 2), b: Math.max(0, getPanelValue('s1-P', 71) / 2), shape: getSectionForme(1), carreNiveau: getSectionCarreNiveau(1) },
            { H: H2, a: Math.max(0, getPanelValue('s2-L', 85) / 2), b: Math.max(0, getPanelValue('s2-P', 85) / 2), shape: getSectionForme(2), carreNiveau: getSectionCarreNiveau(2) },
            { H: H3, a: Math.max(0, getPanelValue('s3-L', 85) / 2), b: Math.max(0, getPanelValue('s3-P', 85) / 2), shape: getSectionForme(3), carreNiveau: getSectionCarreNiveau(3) },
            { H: H4, a: Math.max(0, getPanelValue('s4-L', 32) / 2), b: Math.max(0, getPanelValue('s4-P', 32) / 2), shape: getSectionForme(4), carreNiveau: getSectionCarreNiveau(4) },
            { H: H5, a: Math.max(0, getPanelValue('s5-L', 32) / 2), b: Math.max(0, getPanelValue('s5-P', 32) / 2), shape: getSectionForme(5), carreNiveau: getSectionCarreNiveau(5) }
        ];

        var edgeTypes = [
            getPanelSelectValue('r12-type', 'ligne'),
            getPanelSelectValue('r23-type', 'ligne'),
            getPanelSelectValue('r34-type', 'ligne'),
            getPanelSelectValue('r45-type', 'ligne')
        ];
        var rhos = [
            getPanelValue('r12-rho', 5),
            getPanelValue('r23-rho', 40),
            getPanelValue('r34-rho', 20),
            getPanelValue('r45-rho', 15)
        ];

        return { sections: sections, edgeTypes: edgeTypes, rhos: rhos };
    }

    function buildSectionRingLine(H, points, isHighlight) {
        var pts = points.map(function (p) { return new THREE.Vector3(p[0], H, p[1]); });
        var geom = new THREE.BufferGeometry().setFromPoints(pts);
        var color = isHighlight ? RING_COLOR_HIGHLIGHT : RING_COLOR_NORMAL;
        return new THREE.LineLoop(geom, new THREE.LineBasicMaterial({ color: color }));
    }

    function addSectionRing(group, section, isHighlight, isPiqure) {
        var pts = BottleMaths.getSectionRingPoints(section.a, section.b, section.shape, section.carreNiveau, N_SEGMENTS);
        var ring = buildSectionRingLine(section.H, pts, isHighlight);
        ring.userData.isPiqure = isPiqure;
        group.add(ring);
    }

    function applyViewOpacity(group) {
        var isPiqureView = false;
        var piqurePanel = document.getElementById('panel-content-piqure');
        if (piqurePanel && !piqurePanel.classList.contains('hidden')) isPiqureView = true;
        for (var c = 0; c < group.children.length; c++) {
            var obj = group.children[c];
            if (!obj.material) continue;
            obj.material.transparent = true;
            if (isPiqureView) {
                var isPiqure = obj.userData.isPiqure === true;
                obj.material.opacity = isPiqure ? 1 : 0.15;
                obj.material.depthWrite = isPiqure;
            } else {
                obj.material.opacity = 1;
                obj.material.depthWrite = true;
            }
        }
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

    function updateView() {
        if (!scene || typeof BottleMesh3D === 'undefined') return;
        if (typeof Validator !== 'undefined' && Validator.applyAllUserConstraints) Validator.applyAllUserConstraints();
        var sectionsData = getSectionsDataFromPanel();
        var sections = sectionsData.sections;
        var activeSection = typeof window.activeSectionIndex !== 'undefined' ? window.activeSectionIndex : 0;

        if (sectionRingGroup) scene.remove(sectionRingGroup);
        sectionRingGroup = new THREE.Group();

        if (!bottleGroup) {
            var baseMat = (typeof BottleMaterials !== 'undefined' && BottleMaterials.getGlassMaterial)
                ? BottleMaterials.getGlassMaterial()
                : null;
            bottleGroup = BottleMesh3D.createBottleMesh(sectionsData, baseMat);
        } else {
            BottleMesh3D.updateBottleMesh(bottleGroup, sectionsData);
        }
        if (bottleGroup) {
            bottleGroup.userData.isPiqure = false;
            sectionRingGroup.add(bottleGroup);
        }

        for (var i = 0; i < sections.length; i++) {
            addSectionRing(sectionRingGroup, sections[i], activeSection === i + 1, false);
        }

        var piqure = getPiqureSectionFromPanel();
        var s1 = sections[0];
        addSectionRing(sectionRingGroup, piqure, false, true);
        var hautPiqure = getHautPiqureSectionFromPanel();
        addSectionRing(sectionRingGroup, hautPiqure, false, true);
        var hautPiqure3 = getHautPiqure3SectionFromPanel();
        addSectionRing(sectionRingGroup, hautPiqure3, false, true);
        var feuille = buildPiqurePiedFeuille(s1, piqure, piqure.H);
        feuille.userData.isPiqure = true;
        sectionRingGroup.add(feuille);
        var feuillePiqureStrip = buildRuledSurfaceStrip([piqure, hautPiqure, hautPiqure3], BottleMaterials.DEFAULT_GLASS_COLOR);
        if (feuillePiqureStrip) { feuillePiqureStrip.userData.isPiqure = true; sectionRingGroup.add(feuillePiqureStrip); }
        var rp3H = getPanelValue('rp3-h', 30);
        if (rp3H > hautPiqure3.H) {
            var feuille3VersAxe = buildPiqureFeuilleVersAxe(hautPiqure3, rp3H);
            feuille3VersAxe.userData.isPiqure = true;
            sectionRingGroup.add(feuille3VersAxe);
        }
        var bague1 = getBague1SectionFromPanel();
        var s5 = sections[4];
        addSectionRing(sectionRingGroup, bague1, false, false);
        var feuilleColBague = buildPiqureBasHautFeuille(s5, bague1);
        feuilleColBague.userData.isPiqure = false;
        sectionRingGroup.add(feuilleColBague);
        var bague2 = getBague2SectionFromPanel();
        var bague3 = getBague3SectionFromPanel();
        var bague4 = getBague4SectionFromPanel();
        var bague5 = getBague5SectionFromPanel();
        var feuilleBagueStrip = buildRuledSurfaceStrip([bague1, bague2, bague3, bague4, bague5], BottleMaterials.DEFAULT_GLASS_COLOR);
        if (feuilleBagueStrip) { feuilleBagueStrip.userData.isPiqure = false; sectionRingGroup.add(feuilleBagueStrip); }
        addSectionRing(sectionRingGroup, bague2, false, false);
        addSectionRing(sectionRingGroup, bague3, false, false);
        addSectionRing(sectionRingGroup, bague4, false, false);
        addSectionRing(sectionRingGroup, bague5, false, false);

        applyViewOpacity(sectionRingGroup);
        scene.add(sectionRingGroup);
    }

    /**
     * Retourne les points du profil 2D (méridien face) pour la vue plan.
     * Utilisé par viewer2d.js pour dessiner le profil avec cotations.
     */
    function getProfilePointsFor2D() {
        var sectionsData = getSectionsDataFromPanel();
        if (!sectionsData || !sectionsData.sections || sectionsData.sections.length < 2) return [];
        var entities = (typeof BottleMaths !== 'undefined' && BottleMaths.buildExteriorProfile)
            ? BottleMaths.buildExteriorProfile(0, sectionsData)
            : [];
        if (!entities || entities.length === 0) return [];
        return (typeof GeomKernel !== 'undefined' && GeomKernel.tessellateProfile)
            ? GeomKernel.tessellateProfile(entities, 32)
            : [];
    }

    return {
        updateView: updateView,
        getProfilePointsFor2D: getProfilePointsFor2D
    };
})();

window.getBottleProfileFromData = function () {
    return (typeof BottleView3D !== 'undefined' && BottleView3D.getProfilePointsFor2D)
        ? BottleView3D.getProfilePointsFor2D()
        : [];
};

