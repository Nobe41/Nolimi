// ==========================================
// VUE 3D — DÉFINITION CAO (mathématique, exacte)
// Repère : origine (0,0,0) à la base, axe Y = hauteur, X et Z = plan horizontal. 1 unité = 1 mm.
// Chaque section = ellipse dans un plan horizontal : x = a·cos(θ), z = b·sin(θ), y = H (a = L/2, b = P/2).
// Section 1 → "1 — Pied", 2 → "2 — Corps", 3 → "3 — Épaule", 4 → "4 — Col", 5 → "5 — Bas col" (s5-h, s5-L, s5-P).
// ==========================================

var sectionRingGroup;
var N_SEGMENTS = 64;

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

// Points d'une ellipse (n+1 points), premier point (a, 0), sens trigo. Retourne [[x,z], ...].
function getEllipsePoints(a, b, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
        var theta = (i / n) * 2 * Math.PI;
        pts.push([a * Math.cos(theta), b * Math.sin(theta)]);
    }
    return pts;
}

// Distance du centre au bord du rectangle arrondi (demi-largeur a, demi-profondeur b, rayon coins r) dans la direction theta.
// Même paramétrage par angle que l'ellipse → pas de torsion sur la feuille entre section ronde et carrée.
function getRoundedRectRadius(a, b, r, theta) {
    r = Math.max(0, Math.min(r, Math.min(a, b)));
    var c = Math.cos(theta), s = Math.sin(theta);
    var x = Math.abs(c), z = Math.abs(s);
    if (x < 1e-10) return b;
    if (z < 1e-10) return a;
    var tRight = a / x;
    var tTop = b / z;
    var hitRight = (a * z / x <= b - r);
    var hitTop = (b * x / z <= a - r);
    if (r < 1e-10) {
        return hitRight && (!hitTop || tRight <= tTop) ? tRight : tTop;
    }
    var Cx = a - r, Cz = b - r;
    var CdotD = Cx * x + Cz * z;
    var C2 = Cx * Cx + Cz * Cz;
    var disc = CdotD * CdotD - (C2 - r * r);
    var tArc = Infinity;
    if (disc >= 0) {
        tArc = CdotD + Math.sqrt(disc);
        var px = tArc * x, pz = tArc * z;
        if (px >= Cx - 1e-6 && pz >= Cz - 1e-6) { /* sur l'arc */ } else tArc = Infinity;
    }
    var out = Infinity;
    if (hitRight && tRight < out) out = tRight;
    if (hitTop && tTop < out) out = tTop;
    if (tArc !== Infinity && tArc < out) out = tArc;
    return out === Infinity ? Math.min(tRight, tTop) : out;
}

// Rectangle arrondi : n+1 points aux mêmes angles que l'ellipse (theta = 2*pi*i/n) pour éviter la torsion.
function getRoundedRectPoints(a, b, r, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
        var theta = (i / n) * 2 * Math.PI;
        var R = getRoundedRectRadius(a, b, r, theta);
        pts.push([R * Math.cos(theta), R * Math.sin(theta)]);
    }
    return pts;
}

// Interpolation Hermite cubique : p(0)=p0, p(1)=p1, p'(0)=m0, p'(1)=m1
function hermite1(p0, p1, m0, m1, t) {
    var t2 = t * t, t3 = t2 * t;
    var h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t;
    var h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
}

// Terme S à dérivées nulles en 0 et 1 : (t-0.5)*t²*(1-t)² — préserve la tangence
function sShapeTerm(t) {
    if (t <= 0 || t >= 1) return 0;
    return (t - 0.5) * t * t * (1 - t) * (1 - t);
}

// Feuille 3D (surface) reliant deux sections. shape1/shape2 = 'rond'|'carre', carreNiveau 0-100.
function makeSheetBetweenSections(H1, a1, b1, H2, a2, b2, type, tangentStart, tangentEnd, shape1, carreNiveau1, shape2, carreNiveau2) {
    type = type || 'ligne';
    shape1 = shape1 || 'rond';
    shape2 = shape2 || 'rond';
    carreNiveau1 = carreNiveau1 || 0;
    carreNiveau2 = carreNiveau2 || 0;
    var n = N_SEGMENTS;
    var vertices = [];
    var indices = [];

    var numLayers = (type === 'ligne') ? 2 : 17;
    var useHermite = (type === 'courbe' || type === 'courbeS') && tangentStart && tangentEnd;
    // 0 % = rond (r max), 100 % = carré vif (r = 0)
    var r1 = (1 - carreNiveau1 / 100) * Math.min(a1, b1);
    var r2 = (1 - carreNiveau2 / 100) * Math.min(a2, b2);

    for (var layer = 0; layer < numLayers; layer++) {
        var t = numLayers === 2 ? layer : layer / (numLayers - 1);
        var H, a, b;
        if (type === 'ligne') {
            H = H1 + t * (H2 - H1);
            a = a1 + t * (a2 - a1);
            b = b1 + t * (b2 - b1);
        } else if (useHermite) {
            var dH0 = tangentStart[0], da0 = tangentStart[1], db0 = tangentStart[2];
            var dH1 = tangentEnd[0], da1 = tangentEnd[1], db1 = tangentEnd[2];
            H = hermite1(H1, H2, dH0, dH1, t);
            a = hermite1(a1, a2, da0, da1, t);
            b = hermite1(b1, b2, db0, db1, t);
            if (type === 'courbeS') {
                var sAmp = 0.2 * Math.max(a1, a2, b1, b2);
                var sTerm = sShapeTerm(t);
                a = Math.max(0.1, a + sAmp * sTerm);
                b = Math.max(0.1, b + sAmp * sTerm);
            } else {
                a = Math.max(0.1, a);
                b = Math.max(0.1, b);
            }
        } else {
            H = H1 + t * (H2 - H1);
            a = Math.max(0.1, a1 + t * (a2 - a1));
            b = Math.max(0.1, b1 + t * (b2 - b1));
        }
        var contour;
        if (shape1 === 'rond' && shape2 === 'rond') {
            contour = getEllipsePoints(a, b, n);
        } else if (shape1 === 'carre' && shape2 === 'carre') {
            var r_t = (1 - t) * r1 + t * r2;
            contour = getRoundedRectPoints(a, b, r_t, n);
        } else {
            var cRond = getEllipsePoints(a, b, n);
            var r_t = (1 - t) * r1 + t * r2;
            var cCarre = getRoundedRectPoints(a, b, r_t, n);
            contour = [];
            var tr = (shape1 === 'carre') ? (1 - t) : t;
            for (var i = 0; i <= n; i++) {
                contour.push([
                    (1 - tr) * cRond[i][0] + tr * cCarre[i][0],
                    (1 - tr) * cRond[i][1] + tr * cCarre[i][1]
                ]);
            }
        }
        for (var i = 0; i <= n; i++) {
            vertices.push(contour[i][0], H, contour[i][1]);
        }
    }

    var vertsPerRing = n + 1;
    for (var layer = 0; layer < numLayers - 1; layer++) {
        var base = layer * vertsPerRing;
        var baseNext = (layer + 1) * vertsPerRing;
        for (var i = 0; i < n; i++) {
            var cur = base + i;
            var next = base + i + 1;
            var curT = baseNext + i;
            var nextT = baseNext + i + 1;
            indices.push(cur, next, curT);
            indices.push(next, nextT, curT);
        }
        indices.push(base + n, base, baseNext + n);
        indices.push(base, baseNext, baseNext + n);
    }

    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    var mat = new THREE.MeshPhongMaterial({
        color: 0x99bbdd,
        side: THREE.DoubleSide
    });
    return new THREE.Mesh(geom, mat);
}

// Trait de section (ellipse ou rectangle arrondi). shape = 'rond' | 'carre', carreNiveau 0-100 (0 = rond, 100 = carré vif).
function makeSectionRing(H, a, b, shape, carreNiveau, isHighlight) {
    var pts = (shape === 'carre')
        ? getRoundedRectPoints(a, b, (1 - carreNiveau / 100) * Math.min(a, b), N_SEGMENTS)
        : getEllipsePoints(a, b, N_SEGMENTS);
    var points = pts.map(function (p) { return new THREE.Vector3(p[0], H, p[1]); });
    var geom = new THREE.BufferGeometry().setFromPoints(points);
    var color = isHighlight ? 0x0066cc : 0x000000;
    return new THREE.LineLoop(geom, new THREE.LineBasicMaterial({ color: color }));
}

// Sections 1, 2, 3, 4, 5 = blocs Pied, Corps, Épaule, Col, Bas col (mêmes fonctions : hauteur, largeur, profondeur)
function updateSectionRings() {
    if (!scene) return;
    if (sectionRingGroup) scene.remove(sectionRingGroup);
    sectionRingGroup = new THREE.Group();

    var activeSection = typeof window.activeSectionIndex !== 'undefined' ? window.activeSectionIndex : 0;
    var H1 = getPanelValue('s1-h', 0);
    var a1 = Math.max(0, getPanelValue('s1-L', 71) / 2);
    var b1 = Math.max(0, getPanelValue('s1-P', 71) / 2);
    var forme1 = getSectionForme(1);
    var carre1 = getSectionCarreNiveau(1);
    sectionRingGroup.add(makeSectionRing(H1, a1, b1, forme1, carre1, activeSection === 1));

    // Section 2 : hauteur min = H1 (section en dessous), max = H3 (section au dessus) — ne peut pas dépasser la section 3
    var s2hInput = document.getElementById('s2-h');
    var s2hSlider = document.getElementById('s2-h-slider');
    var s2hVal = getPanelValue('s2-h', 10);
    if (s2hInput) s2hInput.min = H1;
    if (s2hSlider) s2hSlider.min = H1;

    // Section 3 (Épaule) : hauteur min = section d'en dessous (H2) — on calcule H3 d'abord pour borner s2
    var s3hInput = document.getElementById('s3-h');
    var s3hSlider = document.getElementById('s3-h-slider');
    var s3hVal = getPanelValue('s3-h', 120);
    if (s3hVal < s2hVal) {
        s3hVal = s2hVal;
        if (s3hInput) s3hInput.value = s2hVal;
        if (s3hSlider) s3hSlider.value = s2hVal;
    }
    var H3 = s3hVal;

    // Section 4 (Col) : hauteur min = H3 ; on calcule H4 pour borner s3
    var s4hInput = document.getElementById('s4-h');
    var s4hSlider = document.getElementById('s4-h-slider');
    var s4hVal = getPanelValue('s4-h', 200);
    if (s4hVal < H3) {
        s4hVal = H3;
        if (s4hInput) s4hInput.value = H3;
        if (s4hSlider) s4hSlider.value = H3;
    }
    var H4 = s4hVal;

    // Section 5 (Bas col) : hauteur min = H4 ; on calcule H5 pour borner s4
    var s5hInput = document.getElementById('s5-h');
    var s5hSlider = document.getElementById('s5-h-slider');
    var s5hVal = getPanelValue('s5-h', 280);
    if (s5hVal < H4) {
        s5hVal = H4;
        if (s5hInput) s5hInput.value = H4;
        if (s5hSlider) s5hSlider.value = H4;
    }
    var H5 = s5hVal;

    if (s4hInput) s4hInput.max = H5;
    if (s4hSlider) s4hSlider.max = H5;
    if (s4hVal > H5) {
        s4hVal = H5;
        if (s4hInput) s4hInput.value = H5;
        if (s4hSlider) s4hSlider.value = H5;
    }
    H4 = s4hVal;

    if (s3hInput) s3hInput.max = H4;
    if (s3hSlider) s3hSlider.max = H4;
    if (s3hVal > H4) {
        s3hVal = H4;
        if (s3hInput) s3hInput.value = H4;
        if (s3hSlider) s3hSlider.value = H4;
    }
    H3 = s3hVal;

    if (s2hInput) s2hInput.max = H3;
    if (s2hSlider) s2hSlider.max = H3;
    if (s2hVal > H3) {
        s2hVal = H3;
        if (s2hInput) s2hInput.value = H3;
        if (s2hSlider) s2hSlider.value = H3;
    }
    if (s2hVal < H1) {
        s2hVal = H1;
        if (s2hInput) s2hInput.value = H1;
        if (s2hSlider) s2hSlider.value = H1;
    }
    var H2 = s2hVal;
    if (s3hInput) s3hInput.min = H2;
    if (s3hSlider) s3hSlider.min = H2;
    if (s4hInput) s4hInput.min = H3;
    if (s4hSlider) s4hSlider.min = H3;
    if (s5hInput) s5hInput.min = H4;
    if (s5hSlider) s5hSlider.min = H4;

    var a2 = Math.max(0, getPanelValue('s2-L', 85) / 2);
    var b2 = Math.max(0, getPanelValue('s2-P', 85) / 2);

    var a3 = Math.max(0, getPanelValue('s3-L', 85) / 2);
    var b3 = Math.max(0, getPanelValue('s3-P', 85) / 2);
    var a4 = Math.max(0, getPanelValue('s4-L', 32) / 2);
    var b4 = Math.max(0, getPanelValue('s4-P', 32) / 2);
    var a5 = Math.max(0, getPanelValue('s5-L', 32) / 2);
    var b5 = Math.max(0, getPanelValue('s5-P', 32) / 2);

    // Tangentes aux sections pour que courbe / courbe S soient tangentes aux feuilles d'avant et d'après
    var T1 = [H2 - H1, a2 - a1, b2 - b1];
    var T2 = [0.5 * (H2 - H1 + H3 - H2), 0.5 * (a2 - a1 + a3 - a2), 0.5 * (b2 - b1 + b3 - b2)];
    var T3 = [0.5 * (H3 - H2 + H4 - H3), 0.5 * (a3 - a2 + a4 - a3), 0.5 * (b3 - b2 + b4 - b3)];
    var T4 = [0.5 * (H4 - H3 + H5 - H4), 0.5 * (a4 - a3 + a5 - a4), 0.5 * (b4 - b3 + b5 - b4)];
    var T5 = [H5 - H4, a5 - a4, b5 - b4];

    var forme2 = getSectionForme(2);
    var carre2 = getSectionCarreNiveau(2);
    var forme3 = getSectionForme(3);
    var carre3 = getSectionCarreNiveau(3);
    var forme4 = getSectionForme(4);
    var carre4 = getSectionCarreNiveau(4);
    var forme5 = getSectionForme(5);
    var carre5 = getSectionCarreNiveau(5);

    var type12 = getPanelSelectValue('r12-type', 'ligne');
    sectionRingGroup.add(makeSheetBetweenSections(H1, a1, b1, H2, a2, b2, type12, T1, T2, forme1, carre1, forme2, carre2));
    sectionRingGroup.add(makeSectionRing(H2, a2, b2, forme2, carre2, activeSection === 2));

    var type23 = getPanelSelectValue('r23-type', 'ligne');
    sectionRingGroup.add(makeSheetBetweenSections(H2, a2, b2, H3, a3, b3, type23, T2, T3, forme2, carre2, forme3, carre3));
    sectionRingGroup.add(makeSectionRing(H3, a3, b3, forme3, carre3, activeSection === 3));

    var type34 = getPanelSelectValue('r34-type', 'ligne');
    sectionRingGroup.add(makeSheetBetweenSections(H3, a3, b3, H4, a4, b4, type34, T3, T4, forme3, carre3, forme4, carre4));
    sectionRingGroup.add(makeSectionRing(H4, a4, b4, forme4, carre4, activeSection === 4));

    var type45 = getPanelSelectValue('r45-type', 'ligne');
    sectionRingGroup.add(makeSheetBetweenSections(H4, a4, b4, H5, a5, b5, type45, T4, T5, forme4, carre4, forme5, carre5));
    sectionRingGroup.add(makeSectionRing(H5, a5, b5, forme5, carre5, activeSection === 5));

    scene.add(sectionRingGroup);
}

function initLogiciel() {
    if (renderer) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    var w = viewport3D.clientWidth;
    var h = viewport3D.clientHeight;
    var aspect = w / h;
    var vs = 250;
    camera = new THREE.OrthographicCamera(-vs * aspect, vs * aspect, vs, -vs, 1, 2000);
    camera.position.set(400, 300, 400);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    viewport3D.appendChild(renderer.domElement);

    scene.add(new THREE.AxesHelper(100));
    var grid = new THREE.GridHelper(400, 20, 0xaaaaaa, 0xcccccc);
    grid.material.opacity = 0.6;
    grid.material.transparent = true;
    scene.add(grid);

    scene.add(camera);
    var dL1 = new THREE.DirectionalLight(0xffffff, 0.45);
    dL1.position.set(-3, 0, 1.5);
    camera.add(dL1);
    var dL2 = new THREE.DirectionalLight(0xffffff, 0.45);
    dL2.position.set(3, 0, 1.5);
    camera.add(dL2);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 150, 0);

    updateSectionRings();
    if (typeof setupListeners === 'function') setupListeners();

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

// Appelé à chaque changement dans le panneau (blocs 1-Pied, 2-Corps, etc.)
function updateBouteille() {
    updateSectionRings();
}
