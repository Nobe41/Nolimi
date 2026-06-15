const canvas2d = document.getElementById('canvas-2d');
const ctx2d = canvas2d.getContext('2d', { alpha: true });
const view2DContainer = document.getElementById('viewport-2d');
let canvas2dDpr = 1;

function getCanvas2DLogicalSize() {
    return {
        w: view2DContainer.clientWidth,
        h: view2DContainer.clientHeight
    };
}

function shouldApplyCanvasDpr() {
    const size = getCanvas2DLogicalSize();
    if (size.w <= 0 || size.h <= 0) return false;
    return (
        canvas2d.width === Math.round(size.w * canvas2dDpr) &&
        canvas2d.height === Math.round(size.h * canvas2dDpr)
    );
}

let cam2D = (typeof Plans2DState !== 'undefined' && Plans2DState.getCamera)
    ? Plans2DState.getCamera()
    : { x: 0, y: 0, zoom: 0 };

const paperFormats = (typeof Plans2DPaper !== 'undefined' && Plans2DPaper.getFormats)
    ? Plans2DPaper.getFormats()
    : (typeof Plans2DFeature !== 'undefined' && Plans2DFeature.getPaperFormats)
        ? Plans2DFeature.getPaperFormats()
    : {
        'A4_P': { w: 210, h: 297 },
        'A4_L': { w: 297, h: 210 },
        'A3_P': { w: 297, h: 420 },
        'A3_L': { w: 420, h: 297 },
        'A2_P': { w: 420, h: 594 },
        'A2_L': { w: 594, h: 420 }
    };
window.paperFormats = paperFormats;

const VIEWPORT_FIT_RATIO = 0.98;
let lastViewport2DSize = { w: 0, h: 0 };

function getPaperForFit() {
    return (typeof Plans2DPaper !== 'undefined' && Plans2DPaper.getPaperInfo)
        ? Plans2DPaper.getPaperInfo()
        : (typeof Plans2DFeature !== 'undefined' && Plans2DFeature.getPaperInfo)
            ? Plans2DFeature.getPaperInfo()
            : (paperFormats['A4_P'] || { w: 210, h: 297 });
}

function getDefaultFitZoom(size) {
    const paper = getPaperForFit();
    return Math.min((size.w * VIEWPORT_FIT_RATIO) / paper.w, (size.h * VIEWPORT_FIT_RATIO) / paper.h);
}

function sync2DCameraState() {
    if (typeof Plans2DState !== 'undefined' && Plans2DState.setCamera) Plans2DState.setCamera(cam2D);
}

function resizeCanvas2D() {
    const size = getCanvas2DLogicalSize();
    if (size.w === 0 || size.h === 0) return;
    const prev = lastViewport2DSize;

    canvas2dDpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas2d.width = Math.round(size.w * canvas2dDpr);
    canvas2d.height = Math.round(size.h * canvas2dDpr);
    canvas2d.style.width = size.w + 'px';
    canvas2d.style.height = size.h + 'px';

    if (prev.w > 0 && prev.h > 0 && cam2D.zoom > 0) {
        cam2D.x += (size.w - prev.w) / 2;
        cam2D.y += (size.h - prev.h) / 2;
        const oldFit = getDefaultFitZoom(prev);
        const newFit = getDefaultFitZoom(size);
        if (oldFit > 0) cam2D.zoom *= newFit / oldFit;
    } else {
        centerPaper();
        draw2D();
        return;
    }

    lastViewport2DSize = { w: size.w, h: size.h };
    sync2DCameraState();
    draw2D();
}

function centerPaper() {
    const size = getCanvas2DLogicalSize();
    if (size.w === 0 || size.h === 0) return;
    cam2D.zoom = getDefaultFitZoom(size);
    cam2D.x = size.w / 2;
    cam2D.y = size.h / 2;
    lastViewport2DSize = { w: size.w, h: size.h };
    sync2DCameraState();
}


const fText = (v) => (typeof Plans2DCotation !== 'undefined' && Plans2DCotation.formatValue)
    ? Plans2DCotation.formatValue(v)
    : (typeof Plans2DMath !== 'undefined' && Plans2DMath.formatText)
        ? Plans2DMath.formatText(v)
        : (Number.isInteger(v) ? v : v.toFixed(1));
const plans2DData = (typeof Plans2DData !== 'undefined') ? Plans2DData : null;
const primitives2D = (typeof Canvas2DRenderPrimitives !== 'undefined') ? Canvas2DRenderPrimitives : null;

function getRattachementLabel(rattId) {
    if (typeof Plans2DCotation !== 'undefined' && Plans2DCotation.getRattachementLabel) {
        return Plans2DCotation.getRattachementLabel(rattId);
    }
    return null;
}

function draw2D() {
    if (!ctx2d || canvas2d.width === 0) return;

    const viewportDpr = shouldApplyCanvasDpr() ? canvas2dDpr : 1;

    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d.clearRect(0, 0, canvas2d.width, canvas2d.height);
    ctx2d.fillStyle = '#ffffff';
    ctx2d.fillRect(0, 0, canvas2d.width, canvas2d.height);

    ctx2d.setTransform(viewportDpr, 0, 0, viewportDpr, 0, 0);
    ctx2d.save();
    ctx2d.translate(cam2D.x, cam2D.y);
    ctx2d.scale(cam2D.zoom, cam2D.zoom);
    const drawStyle = (typeof Plans2DRules !== 'undefined' && Plans2DRules.DRAW_STYLE) ? Plans2DRules.DRAW_STYLE : null;
    const pageStyle = drawStyle && drawStyle.page ? drawStyle.page : { margin: 10, frameLineWidth: 0.5, shadow: { color: 'rgba(0, 0, 0, 0.2)', blur: 12, offsetX: 0, offsetY: 0 } };
    const cartoucheStyle = drawStyle && drawStyle.cartouche ? drawStyle.cartouche : { rowHeight: 13, unitRowFactor: 0.5 };

    // ---- FEUILLE BLANCHE ----
    const paper = (typeof Plans2DPaper !== 'undefined' && Plans2DPaper.getPaperInfo)
        ? Plans2DPaper.getPaperInfo()
        : (typeof Plans2DFeature !== 'undefined' && Plans2DFeature.getPaperInfo)
            ? Plans2DFeature.getPaperInfo()
            : (paperFormats['A4_P'] || { w: 210, h: 297 });
    const paperW = paper.w;
    const paperH = paper.h;
    const startX = -paperW / 2;
    const startY = -paperH / 2;

    // Ombre centree autour de la feuille (pas de decalage droite/bas).
    ctx2d.shadowColor = pageStyle.shadow.color;
    ctx2d.shadowBlur = pageStyle.shadow.blur;
    ctx2d.shadowOffsetX = pageStyle.shadow.offsetX;
    ctx2d.shadowOffsetY = pageStyle.shadow.offsetY;
    ctx2d.fillStyle = '#ffffff';
    ctx2d.fillRect(startX, startY, paperW, paperH);
    ctx2d.shadowColor = 'transparent';

    // ---- CADRE ----
    const margin = pageStyle.margin;
    ctx2d.strokeStyle = '#000000';
    ctx2d.lineWidth = pageStyle.frameLineWidth;
    ctx2d.strokeRect(startX + margin, startY + margin, paperW - margin * 2, paperH - margin * 2);

    // ---- CARTOUCHE (largeur zone utile A4, taille fixe quel que soit le format) ----
    const cartLayout = (typeof Plans2DCartouche !== 'undefined' && Plans2DCartouche.getLayout)
        ? Plans2DCartouche.getLayout(paperW, paperH, margin, cartoucheStyle)
        : null;
    if (cartLayout && typeof Plans2DCartouche !== 'undefined' && Plans2DCartouche.draw) {
        Plans2DCartouche.draw(ctx2d, cartLayout.x, cartLayout.y, Object.assign({}, cartoucheStyle, {
            width: cartLayout.width,
            height: cartLayout.height
        }));
    }

    // ---- GESTION DES VUES (LOGIQUE) ----
    const showBottomView = (typeof Plans2DViews !== 'undefined' && Plans2DViews.getShowBottomView)
        ? Plans2DViews.getShowBottomView()
        : false;

    const mainViewOffsetX = 0;

    let drawingScale = (typeof Plans2DViews !== 'undefined' && Plans2DViews.getDrawingScale)
        ? Plans2DViews.getDrawingScale()
        : 1;

    let points = null;
    if (typeof getBottleProfileFromData === 'function') {
        points = getBottleProfileFromData();
    }
    if ((!points || points.length === 0) && typeof generateBottleProfile === 'function') {
        points = generateBottleProfile();
    }
    if (!points || points.length === 0) {
        ctx2d.restore();
        return;
    }
    {
        // Dimensions dérivées du profil (modèle 6 sections)
        const bottleHeight = points[points.length - 1].y;
        let max_R = 0;
        let bodyY = 0;
        for (let i = 0; i < points.length; i++) {
            if (points[i].x > max_R) {
                max_R = points[i].x;
                bodyY = points[i].y;
            }
        }
        const R_base = points[0].x;
        const R_top = points[points.length - 1].x;
        const D_finish = R_top * 2;

        const piqureProfile = (plans2DData && plans2DData.getPiqureProfile2D) ? plans2DData.getPiqureProfile2D() : [];
        const bagueProfile = (plans2DData && plans2DData.getBagueProfile2D) ? plans2DData.getBagueProfile2D() : [];
        let profileTopY = bottleHeight;
        [points, piqureProfile, bagueProfile].forEach(function (profile) {
            if (!profile || !profile.length) return;
            for (let i = 0; i < profile.length; i++) {
                if (profile[i].y > profileTopY) profileTopY = profile[i].y;
            }
        });

        const mainViewLiftY = (drawStyle && drawStyle.mainView && drawStyle.mainView.liftY != null)
            ? drawStyle.mainView.liftY
            : 20;
        const viewsDropY = showBottomView ? 58 : 0;
        const mainViewOffsetY = (bottleHeight * drawingScale) / 2 - mainViewLiftY + viewsDropY;

        ctx2d.save();
        ctx2d.translate(mainViewOffsetX, mainViewOffsetY);
        ctx2d.scale(drawingScale, -drawingScale); 

        // 1. Axe de symétrie
        ctx2d.beginPath();
        ctx2d.setLineDash([10, 2, 2, 2]);
        ctx2d.moveTo(0, -10);
        ctx2d.lineTo(0, bottleHeight + 20);
        ctx2d.strokeStyle = '#888888';
        ctx2d.lineWidth = 0.3 / drawingScale; 
        ctx2d.stroke();
        ctx2d.setLineDash([]);

        // 2. Bouteille Principale
        ctx2d.strokeStyle = '#000000';
        ctx2d.lineWidth = 0.6 / drawingScale; 
        ctx2d.lineJoin = 'round';

        ctx2d.beginPath();
        ctx2d.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx2d.lineTo(points[i].x, points[i].y);
        ctx2d.lineTo(0, points[points.length-1].y);
        ctx2d.stroke();

        ctx2d.beginPath();
        ctx2d.moveTo(-points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx2d.lineTo(-points[i].x, points[i].y);
        ctx2d.lineTo(0, points[points.length-1].y);
        ctx2d.moveTo(points[0].x, points[0].y);
        ctx2d.lineTo(-points[0].x, points[0].y);
        ctx2d.stroke();

        // 2bis. Piqûre (pointillés) + bague (trait plein)
        if (primitives2D && primitives2D.drawSymmetricProfile) {
            primitives2D.drawSymmetricProfile(ctx2d, piqureProfile, drawingScale, { hiddenLine: true, strokeStyle: '#000000' });
            primitives2D.drawSymmetricProfile(ctx2d, bagueProfile, drawingScale, { strokeStyle: '#000000' });
        }
        if (primitives2D && primitives2D.drawBagueNeckLinks) primitives2D.drawBagueNeckLinks(ctx2d, points, bagueProfile, drawingScale);
        // Montrer explicitement toutes les sections de bague (traits horizontaux)
        if (primitives2D && primitives2D.drawSectionLevelLines) primitives2D.drawSectionLevelLines(ctx2d, bagueProfile, drawingScale, { strokeStyle: '#000000' });
        // 3. Cotations verticales par section (corps principal uniquement).
        // Chaque cote represente la hauteur entre 2 sections consecutives.
        const mainSections = (plans2DData && plans2DData.getMainSections2D) ? plans2DData.getMainSections2D() : [];
        const sectionDimBaseX = -max_R - 18;
        const sectionDimStep = 9;
        const sectionDimCount = mainSections.length > 1 ? mainSections.length - 1 : 0;
        const piqureDimX = sectionDimBaseX - sectionDimStep;
        const totalDimX = sectionDimBaseX - (sectionDimCount + 2) * sectionDimStep;
        const halfWAtY = function (y) {
            const w = [
                plans2DData && plans2DData.getProfileHalfWidthAtY ? plans2DData.getProfileHalfWidthAtY(points, y) : 0,
                plans2DData && plans2DData.getProfileHalfWidthAtY ? plans2DData.getProfileHalfWidthAtY(piqureProfile, y) : 0,
                plans2DData && plans2DData.getProfileHalfWidthAtY ? plans2DData.getProfileHalfWidthAtY(bagueProfile, y) : 0
            ];
            return Math.max(w[0], w[1], w[2]);
        };
        const bottleBase = mainSections.length ? mainSections[0] : null;
        if (bottleBase) {
            for (let i = 1; i < mainSections.length; i++) {
                const y1 = bottleBase.y;
                const y2 = mainSections[i].y;
                const sectionHeight = y2 - y1;
                if (!Number.isFinite(sectionHeight) || sectionHeight <= 0) continue;
                const dimPos = sectionDimBaseX - (i <= 1 ? i - 1 : i) * sectionDimStep;
                const xRefBase = -(plans2DData && plans2DData.getProfileHalfWidthAtY ? plans2DData.getProfileHalfWidthAtY(points, y1) : 0);
                const xRefTop = -(plans2DData && plans2DData.getProfileHalfWidthAtY ? plans2DData.getProfileHalfWidthAtY(points, y2) : 0);
                if (primitives2D && primitives2D.drawCotation) primitives2D.drawCotation(ctx2d, xRefBase, y1, xRefTop, y2, dimPos, fText(sectionHeight), true, drawingScale);
            }
        }

        // 3bis. Hauteur totale (corps + bague)
        const profileBottomY = points[0].y;
        const totalHeight = profileTopY - profileBottomY;
        if (Number.isFinite(totalHeight) && totalHeight > 0 && primitives2D && primitives2D.drawCotation) {
            const xRefBottom = -halfWAtY(profileBottomY);
            const xRefTop = -halfWAtY(profileTopY);
            primitives2D.drawCotation(ctx2d, xRefBottom, profileBottomY, xRefTop, profileTopY, totalDimX, fText(totalHeight), true, drawingScale);
        }

        // 3ter. Hauteur piqûre (base s1-h → sommet rp3-h)
        if (piqureProfile.length >= 2 && primitives2D && primitives2D.drawCotation && plans2DData && plans2DData.getProfileHalfWidthAtY) {
            const py1 = piqureProfile[0].y;
            const py2 = piqureProfile[piqureProfile.length - 1].y;
            const piqureHeight = py2 - py1;
            if (Number.isFinite(piqureHeight) && piqureHeight > 0) {
                const xRefPiq1 = -plans2DData.getProfileHalfWidthAtY(piqureProfile, py1);
                const xRefPiq2 = -plans2DData.getProfileHalfWidthAtY(piqureProfile, py2);
                primitives2D.drawCotation(ctx2d, xRefPiq1, py1, xRefPiq2, py2, piqureDimX, fText(piqureHeight), true, drawingScale);
            }
        }

        // 3quater. Diametre trou 1-piqure (sp @ s1-h), cote vers le bas
        const piqureBase = (plans2DData && plans2DData.getPiqureBase2D) ? plans2DData.getPiqureBase2D() : null;
        if (piqureBase && Number.isFinite(piqureBase.halfWidth) && piqureBase.halfWidth > 0
            && primitives2D && primitives2D.drawDiameterCotationDown) {
            const holeDiameter = piqureBase.halfWidth * 2;
            const holeDimLabel = (typeof Plans2DCotation !== 'undefined' && Plans2DCotation.getDiameterLabel)
                ? Plans2DCotation.getDiameterLabel(piqureBase.L, piqureBase.P, holeDiameter)
                : ('Ø ' + fText(holeDiameter));
            primitives2D.drawDiameterCotationDown(
                ctx2d, -piqureBase.halfWidth, piqureBase.halfWidth, piqureBase.y, holeDimLabel, drawingScale, 14
            );
        }

        const piedSection = mainSections.length ? mainSections[0] : null;
        const dimStackStep = 10;
        if (piedSection && Number.isFinite(piedSection.x) && piedSection.x > 0
            && primitives2D && primitives2D.drawDiameterCotationDown) {
            const piedDiameter = piedSection.x * 2;
            const piedDimLabel = (typeof Plans2DCotation !== 'undefined' && Plans2DCotation.getDiameterLabel)
                ? Plans2DCotation.getDiameterLabel(piedSection.L, piedSection.P, piedDiameter)
                : ('Ø ' + fText(piedDiameter));
            primitives2D.drawDiameterCotationDown(
                ctx2d, -piedSection.x, piedSection.x, piedSection.y, piedDimLabel, drawingScale, 14 + dimStackStep
            );
        }

        // 4. Cotations de diametre a droite pour chaque section principale.
        for (let i = 0; i < mainSections.length; i++) {
            if (i === 0) continue;
            const y = mainSections[i].y;
            const radius = (plans2DData && plans2DData.getProfileHalfWidthAtY) ? plans2DData.getProfileHalfWidthAtY(points, y) : 0;
            if (!Number.isFinite(radius) || radius <= 0) continue;
            const diameter = radius * 2;
            const sec = mainSections[i];
            const dimLabel = (typeof Plans2DCotation !== 'undefined' && Plans2DCotation.getDiameterLabel)
                ? Plans2DCotation.getDiameterLabel(sec.L, sec.P, diameter)
                : ('Ø ' + fText(diameter));
            if (primitives2D && primitives2D.drawDiameterCotationRight) primitives2D.drawDiameterCotationRight(ctx2d, -radius, radius, y, dimLabel, drawingScale);
        }

        // 5. Cotations de raccordements (rayon/courbe/spline/autre) a droite.
        for (let i = 0; i < mainSections.length - 1; i++) {
            const from = i + 1;
            const to = i + 2;
            const rattId = 'r' + from + to;
            const label = getRattachementLabel(rattId);
            if (!label) continue;
            const yMid = (mainSections[i].y + mainSections[i + 1].y) * 0.5;
            const radius = (plans2DData && plans2DData.getProfileHalfWidthAtY) ? plans2DData.getProfileHalfWidthAtY(points, yMid) : 0;
            if (!Number.isFinite(radius) || radius <= 0) continue;
            if (primitives2D && primitives2D.drawRattachementCalloutRight) primitives2D.drawRattachementCalloutRight(ctx2d, radius, yMid, label, drawingScale, 22);
        }

        ctx2d.restore(); 

        const frontViewTopY = mainViewOffsetY - profileTopY * drawingScale;

        // ====================================================
        // 4. VUE DU DESSOUS (au-dessus de la vue de face)
        // ====================================================
        if (showBottomView) {
            ctx2d.save();

            const maxRadiusScaled = max_R * drawingScale;
            const bottomViewGap = 50;
            const bottomViewX = mainViewOffsetX;
            const bottomViewY = frontViewTopY - bottomViewGap - maxRadiusScaled;

            ctx2d.translate(bottomViewX, bottomViewY);

            // Axes de symétrie (Croix)
            ctx2d.beginPath();
            ctx2d.setLineDash([10, 2, 2, 2]);
            ctx2d.strokeStyle = '#888888';
            ctx2d.lineWidth = 0.3; 
            const crossLen = maxRadiusScaled + 10; 
            ctx2d.moveTo(-crossLen, 0); ctx2d.lineTo(crossLen, 0);
            ctx2d.moveTo(0, -crossLen); ctx2d.lineTo(0, crossLen);
            ctx2d.stroke();
            ctx2d.setLineDash([]);

            // Tracés des diamètres
            ctx2d.strokeStyle = '#000000';
            if (primitives2D && primitives2D.applyPixelStroke) primitives2D.applyPixelStroke(ctx2d, true);
            else { ctx2d.lineWidth = 0.6; ctx2d.setLineDash([]); }

            ctx2d.beginPath();
            ctx2d.arc(0, 0, R_base * drawingScale, 0, Math.PI * 2);
            ctx2d.stroke();

            if (piqureBase && Number.isFinite(piqureBase.halfWidth) && piqureBase.halfWidth > 0) {
                ctx2d.beginPath();
                ctx2d.arc(0, 0, piqureBase.halfWidth * drawingScale, 0, Math.PI * 2);
                ctx2d.stroke();
            }

            ctx2d.beginPath();
            ctx2d.arc(0, 0, max_R * drawingScale, 0, Math.PI * 2);
            ctx2d.stroke();

            ctx2d.fillStyle = '#000000';
            ctx2d.font = '4px Arial';
            ctx2d.textAlign = 'center';
            ctx2d.textBaseline = 'bottom';
            ctx2d.fillText('VUE DU DESSOUS', 0, -crossLen - 8);

            ctx2d.restore();
        }

        ctx2d.fillStyle = '#000000';
        ctx2d.font = '4px Arial';
        ctx2d.textAlign = 'center';
        ctx2d.textBaseline = 'bottom';
        ctx2d.fillText('VUE DE FACE', mainViewOffsetX, frontViewTopY - 12);
    }
    ctx2d.restore(); 
}

function setup2DControlsListeners() {
    if (typeof Plans2DEvents !== 'undefined' && Plans2DEvents.bindControlRedraw) {
        Plans2DEvents.bindControlRedraw(draw2D);
        return;
    }
    const ids = [
        'paper-format-select', 'drawing-scale-select', 'cb-vue-dessous',
        'cartouche-title', 'cartouche-plan-number', 'cartouche-date',
        'cartouche-drafter', 'cartouche-checker', 'cartouche-index'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const ev = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
        el.addEventListener(ev, () => { if (typeof draw2D === 'function') draw2D(); });
    });
}

window.addEventListener('load', () => {
    if (typeof Canvas2DInteractions !== 'undefined' && Canvas2DInteractions.bind) {
        Canvas2DInteractions.bind({
            canvas: canvas2d,
            container: view2DContainer,
            getCamera: function () { return cam2D; },
            setCamera: function (next) {
                cam2D = next;
                if (typeof Plans2DState !== 'undefined' && Plans2DState.setCamera) Plans2DState.setCamera(cam2D);
            },
            draw: draw2D,
            resize: resizeCanvas2D,
            onCameraChange: function () {
                if (typeof RealtimeViewSync !== 'undefined' && RealtimeViewSync.scheduleBroadcast) {
                    RealtimeViewSync.scheduleBroadcast();
                }
            }
        });
    }
    setTimeout(resizeCanvas2D, 100);
    setup2DControlsListeners();
});
