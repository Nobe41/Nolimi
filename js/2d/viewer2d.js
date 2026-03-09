const canvas2d = document.getElementById('canvas-2d');
const ctx2d = canvas2d.getContext('2d');
const view2DContainer = document.getElementById('viewport-2d');

let cam2D = { x: 0, y: 0, zoom: 0 }; 
let isDragging2D = false;
let lastMouse2D = { x: 0, y: 0 };

const paperFormats = {
    'A4_P': { w: 210, h: 297 },
    'A4_L': { w: 297, h: 210 },
    'A3_P': { w: 297, h: 420 },
    'A3_L': { w: 420, h: 297 }
};
window.paperFormats = paperFormats;

function resizeCanvas2D() {
    if (view2DContainer.clientWidth === 0 || view2DContainer.clientHeight === 0) return;
    canvas2d.width = view2DContainer.clientWidth;
    canvas2d.height = view2DContainer.clientHeight;
    if (cam2D.zoom === 0) centerPaper();
    draw2D();
}

window.addEventListener('resize', () => {
    if (!view2DContainer.classList.contains('hidden')) resizeCanvas2D();
});

const observer2D = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (!view2DContainer.classList.contains('hidden')) {
            setTimeout(resizeCanvas2D, 20); 
        }
    });
});
observer2D.observe(view2DContainer, { attributes: true, attributeFilter: ['class'] });

function centerPaper() {
    if (canvas2d.width === 0 || canvas2d.height === 0) return;
    const formatSelect = document.getElementById('paper-format-select');
    const format = formatSelect ? formatSelect.value : 'A4_P';
    const paper = paperFormats[format] || paperFormats['A4_P'];
    const scaleX = (canvas2d.width * 0.85) / paper.w;
    const scaleY = (canvas2d.height * 0.85) / paper.h;
    cam2D.zoom = Math.min(scaleX, scaleY);
    cam2D.x = canvas2d.width / 2;
    cam2D.y = canvas2d.height / 2;
}

canvas2d.addEventListener('mousedown', (e) => {
    isDragging2D = true;
    lastMouse2D = { x: e.clientX, y: e.clientY };
    canvas2d.style.cursor = 'grabbing';
});
canvas2d.addEventListener('mousemove', (e) => {
    if (!isDragging2D) return;
    cam2D.x += e.clientX - lastMouse2D.x;
    cam2D.y += e.clientY - lastMouse2D.y;
    lastMouse2D = { x: e.clientX, y: e.clientY };
    draw2D();
});
window.addEventListener('mouseup', () => {
    isDragging2D = false;
    canvas2d.style.cursor = 'grab';
});
canvas2d.addEventListener('wheel', (e) => {
    e.preventDefault();
    const newZoom = cam2D.zoom * (1 - e.deltaY * 0.001);
    if (newZoom > 0.1 && newZoom < 20) {
        const rect = canvas2d.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        cam2D.x = mouseX - (mouseX - cam2D.x) * (newZoom / cam2D.zoom);
        cam2D.y = mouseY - (mouseY - cam2D.y) * (newZoom / cam2D.zoom);
        cam2D.zoom = newZoom;
        draw2D();
    }
});

const fText = (v) => Number.isInteger(v) ? v : v.toFixed(1);

function drawCotation(ctx, x1, y1, x2, y2, dimPos, text, isVertical, drawingScale) {
    ctx.save();
    ctx.strokeStyle = '#000000'; 
    ctx.fillStyle = '#000000';
    ctx.lineWidth = 0.15 / drawingScale; 
    
    let dimX1, dimY1, dimX2, dimY2, sign;

    ctx.beginPath();
    if (isVertical) {
        sign = dimPos > Math.max(x1, x2) ? 1 : -1;
        dimX1 = dimPos; dimY1 = y1;
        dimX2 = dimPos; dimY2 = y2;
        ctx.moveTo(x1 + sign*1/drawingScale, y1); ctx.lineTo(dimPos + sign*2/drawingScale, y1);
        ctx.moveTo(x2 + sign*1/drawingScale, y2); ctx.lineTo(dimPos + sign*2/drawingScale, y2);
    } else {
        sign = dimPos > Math.max(y1, y2) ? 1 : -1;
        dimX1 = x1; dimY1 = dimPos;
        dimX2 = x2; dimY2 = dimPos;
        if (Math.abs(dimPos - y1) > 0.1) {
            ctx.moveTo(x1, y1 + sign*1/drawingScale); ctx.lineTo(x1, dimPos + sign*2/drawingScale);
            ctx.moveTo(x2, y2 + sign*1/drawingScale); ctx.lineTo(x2, dimPos + sign*2/drawingScale);
        }
    }
    ctx.moveTo(dimX1, dimY1);
    ctx.lineTo(dimX2, dimY2);
    ctx.stroke();

    const aSize = 2.0 / drawingScale;
    const drawArrow = (ax, ay, angle) => {
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - aSize * Math.cos(angle - Math.PI/10), ay - aSize * Math.sin(angle - Math.PI/10));
        ctx.lineTo(ax - aSize * Math.cos(angle + Math.PI/10), ay - aSize * Math.sin(angle + Math.PI/10));
        ctx.fill();
    };
    let angle = Math.atan2(dimY2 - dimY1, dimX2 - dimX1);
    drawArrow(dimX2, dimY2, angle);
    drawArrow(dimX1, dimY1, angle + Math.PI);

    ctx.save();
    ctx.translate((dimX1 + dimX2) / 2, (dimY1 + dimY2) / 2);
    ctx.scale(1, -1); 
    ctx.font = (3 / drawingScale) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isVertical) ctx.rotate(-Math.PI / 2);
    let textWidth = ctx.measureText(text).width;
    let textHeight = 4 / drawingScale;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-textWidth/2 - 0.5/drawingScale, -textHeight/2, textWidth + 1/drawingScale, textHeight);
    ctx.fillStyle = '#000000';
    ctx.fillText(text, 0, 0);
    ctx.restore();
    ctx.restore();
}

function drawLeaderLine(ctx, x, y, text, drawingScale) {
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.lineWidth = 0.15 / drawingScale;
    ctx.beginPath();
    ctx.arc(x, y, 0.4/drawingScale, 0, Math.PI*2);
    ctx.fill();
    let endX = x - 15/drawingScale;
    let endY = y + 15/drawingScale;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.lineTo(endX - 5/drawingScale, endY);
    ctx.stroke();
    ctx.save();
    ctx.translate(endX - 6/drawingScale, endY);
    ctx.scale(1, -1); 
    ctx.font = (3 / drawingScale) + 'px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText("R" + text, 0, -0.5/drawingScale);
    ctx.restore();
    ctx.restore();
}

function draw2D() {
    if (!ctx2d || canvas2d.width === 0) return;

    ctx2d.clearRect(0, 0, canvas2d.width, canvas2d.height);
    
    // NOUVEAU FOND ICI :
    ctx2d.fillStyle = '#ffffff'; 
    ctx2d.fillRect(0, 0, canvas2d.width, canvas2d.height);

    ctx2d.save();
    ctx2d.translate(cam2D.x, cam2D.y);
    ctx2d.scale(cam2D.zoom, cam2D.zoom);

    // ---- FEUILLE BLANCHE ----
    const formatSelect = document.getElementById('paper-format-select');
    const format = formatSelect ? formatSelect.value : 'A4_P';
    const paper = paperFormats[format] || paperFormats['A4_P'];
    const paperW = paper.w;
    const paperH = paper.h;
    const startX = -paperW / 2;
    const startY = -paperH / 2;

    ctx2d.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx2d.shadowBlur = 10;
    ctx2d.shadowOffsetX = 5;
    ctx2d.shadowOffsetY = 5;
    ctx2d.fillStyle = '#ffffff';
    ctx2d.fillRect(startX, startY, paperW, paperH);
    ctx2d.shadowColor = 'transparent';

    // ---- CADRE ----
    const margin = 10; 
    ctx2d.strokeStyle = '#000000';
    ctx2d.lineWidth = 0.5; 
    ctx2d.strokeRect(startX + margin, startY + margin, paperW - margin * 2, paperH - margin * 2);

    // ---- CARTOUCHE ----
    const borderBottomRightX = startX + paperW - margin;
    const borderBottomRightY = startY + paperH - margin;
    const cartW = 110; 
    const cartH = 35;  
    const cartX = borderBottomRightX - cartW;
    const cartY = borderBottomRightY - cartH;

    ctx2d.strokeStyle = '#000000';
    ctx2d.lineWidth = 0.5;
    ctx2d.strokeRect(cartX, cartY, cartW, cartH);
    
    ctx2d.beginPath();
    ctx2d.moveTo(cartX, cartY + 9);  ctx2d.lineTo(cartX + cartW, cartY + 9);
    ctx2d.moveTo(cartX, cartY + 18); ctx2d.lineTo(cartX + cartW, cartY + 18);
    ctx2d.moveTo(cartX, cartY + 27); ctx2d.lineTo(cartX + cartW, cartY + 27);
    ctx2d.stroke();

    ctx2d.fillStyle = '#000000';
    ctx2d.font = '4px Arial';
    
    const valTitle = document.getElementById('cartouche-title') ? document.getElementById('cartouche-title').value : '';
    const valDrafter = document.getElementById('cartouche-drafter') ? document.getElementById('cartouche-drafter').value : '';
    const valChecker = document.getElementById('cartouche-checker') ? document.getElementById('cartouche-checker').value : '';
    const valCap = document.getElementById('cartouche-capacity') ? document.getElementById('cartouche-capacity').value : '';
    
    ctx2d.fillText("Projet: " + valTitle, cartX + 2, cartY + 6);
    ctx2d.fillText("Dessinateur: " + valDrafter, cartX + 2, cartY + 15);
    ctx2d.fillText("Vérificateur: " + valChecker, cartX + 2, cartY + 24);
    ctx2d.fillText("Contenance: " + valCap, cartX + 2, cartY + 32);
    
    const scaleSelect = document.getElementById('drawing-scale-select');
    const scaleText = scaleSelect ? scaleSelect.options[scaleSelect.selectedIndex].text : '1:1';
    ctx2d.fillText("Echelle: " + scaleText, cartX + 65, cartY + 32);

    // ---- GESTION DES VUES (LOGIQUE) ----
    const cbVueDessous = document.getElementById('cb-vue-dessous');
    const showBottomView = cbVueDessous && cbVueDessous.checked;

    let mainViewOffsetX = 0;
    if (showBottomView) {
        mainViewOffsetX = -paperW / 6; 
    }

    const scaleValue = scaleSelect ? scaleSelect.value : '1:1';
    let drawingScale = 1;
    if (scaleValue === "1:2") drawingScale = 0.5;
    if (scaleValue === "1:5") drawingScale = 0.2;
    if (scaleValue === "2:1") drawingScale = 2;

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
        const D_bas = R_base * 2;
        const D_epaule = max_R * 2;
        const D_finish = R_top * 2;
        
        ctx2d.save();
        ctx2d.translate(mainViewOffsetX, (bottleHeight * drawingScale) / 2); 
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

        // 3. Cotations (dérivées du profil)
        drawCotation(ctx2d, D_bas/2, 0, D_epaule/2, bodyY, max_R + 15, fText(bodyY), true, drawingScale);
        drawCotation(ctx2d, D_bas/2, 0, D_finish/2, bottleHeight, max_R + 30, fText(bottleHeight), true, drawingScale);
        drawCotation(ctx2d, -D_bas/2, 0, D_bas/2, 0, -15, "Ø " + fText(D_bas), false, drawingScale);
        drawCotation(ctx2d, -D_epaule/2, bodyY, D_epaule/2, bodyY, bodyY, "Ø " + fText(D_epaule), false, drawingScale);
        drawCotation(ctx2d, -D_finish/2, bottleHeight, D_finish/2, bottleHeight, bottleHeight + 15, "Ø " + fText(D_finish), false, drawingScale);

        ctx2d.restore(); 

        // TITRE DE LA VUE DE FACE (Au-dessus)
        if (showBottomView) {
            ctx2d.fillStyle = '#000000';
            ctx2d.font = '4px Arial'; 
            ctx2d.textAlign = 'center';
            ctx2d.textBaseline = 'bottom';
            const titleY = - (bottleHeight * drawingScale) / 2 - 20;
            ctx2d.fillText("VUE DE FACE", mainViewOffsetX, titleY);
        }

        // ====================================================
        // 4. VUE DU DESSOUS (GÉNÉRÉE MATHÉMATIQUEMENT)
        // ====================================================
        if (showBottomView) {
            ctx2d.save();
            
            const bottomViewX = cartX + (cartW / 2);
            const maxRadiusScaled = max_R * drawingScale;
            const bottomViewY = cartY - maxRadiusScaled - 25; 
            
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
            ctx2d.lineWidth = 0.6; 
            
            ctx2d.beginPath();
            ctx2d.arc(0, 0, R_base * drawingScale, 0, Math.PI * 2);
            ctx2d.stroke();

            if (max_R - R_base > 1) {
                ctx2d.beginPath();
                ctx2d.arc(0, 0, max_R * drawingScale, 0, Math.PI * 2);
                ctx2d.stroke();
            }

            // Titre de la vue
            ctx2d.fillStyle = '#000000';
            ctx2d.font = '4px Arial';
            ctx2d.textAlign = 'center';
            ctx2d.textBaseline = 'bottom';
            ctx2d.fillText("VUE DU DESSOUS", 0, -crossLen - 8);

            // COTATION MANUELLE DU DIAMÈTRE
            const scaledRad = R_base * drawingScale;
            const dimY = scaledRad + 10; 
            
            ctx2d.beginPath();
            ctx2d.strokeStyle = '#000000';
            ctx2d.lineWidth = 0.15;
            
            ctx2d.moveTo(-scaledRad, 1); ctx2d.lineTo(-scaledRad, dimY + 2);
            ctx2d.moveTo(scaledRad, 1); ctx2d.lineTo(scaledRad, dimY + 2);
            
            ctx2d.moveTo(-scaledRad, dimY); ctx2d.lineTo(scaledRad, dimY);
            ctx2d.stroke();

            const aSize = 2.0;
            const drawArrow = (ax, ay, angle) => {
                ctx2d.beginPath();
                ctx2d.moveTo(ax, ay);
                ctx2d.lineTo(ax - aSize * Math.cos(angle - Math.PI/10), ay - aSize * Math.sin(angle - Math.PI/10));
                ctx2d.lineTo(ax - aSize * Math.cos(angle + Math.PI/10), ay - aSize * Math.sin(angle + Math.PI/10));
                ctx2d.fill();
            };
            drawArrow(scaledRad, dimY, 0); 
            drawArrow(-scaledRad, dimY, Math.PI); 

            ctx2d.fillStyle = '#000000';
            ctx2d.font = '3px Arial';
            ctx2d.textAlign = 'center';
            ctx2d.textBaseline = 'middle';
            let txtW = ctx2d.measureText("Ø " + fText(D_bas)).width;
            ctx2d.fillStyle = '#ffffff';
            ctx2d.fillRect(-txtW/2 - 0.5, dimY - 2, txtW + 1, 4);
            ctx2d.fillStyle = '#000000';
            ctx2d.fillText("Ø " + fText(D_bas), 0, dimY);

            ctx2d.restore();
        }
    }
    ctx2d.restore(); 
}

function setup2DControlsListeners() {
    const ids = ['paper-format-select', 'drawing-scale-select', 'cb-vue-dessous', 'cartouche-title', 'cartouche-drafter', 'cartouche-checker', 'cartouche-capacity'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const ev = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
        el.addEventListener(ev, () => { if (typeof draw2D === 'function') draw2D(); });
    });
}

window.addEventListener('load', () => {
    setTimeout(resizeCanvas2D, 100);
    setup2DControlsListeners();
});
