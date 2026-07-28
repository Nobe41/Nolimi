// 01-saas/canvas/2d/tools.js
// Outils de trait (lignes, flèches, textes, mesures).
// Épaisseurs / tirets → Plans2DRules.DRAW_STYLE.mainView.

var Canvas2DTools = (function () {

    // --- Style de trait ---
    function getStrokeStyle(drawingScale) {
        var mv = Plans2DRules.DRAW_STYLE.mainView;
        var dash = mv.hiddenDashMm;
        return {
            visibleWidth: mv.strokeVisibleMm / drawingScale,
            hiddenWidth: mv.strokeHiddenMm / drawingScale,
            hiddenDash: [dash[0] / drawingScale, dash[1] / drawingScale]
        };
    }

    function applyModelStroke(ctx, drawingScale, visible) {
        var s = getStrokeStyle(drawingScale);
        ctx.lineWidth = visible ? s.visibleWidth : s.hiddenWidth;
        ctx.setLineDash(visible ? [] : s.hiddenDash);
        ctx.lineCap = 'round';
    }

    // Trait en pixels écran (vue du dessous)
    function applyPixelStroke(ctx, visible) {
        ctx.lineWidth = visible ? 0.6 : 0.25;
        ctx.setLineDash(visible ? [] : [4, 2.5]);
        ctx.lineCap = 'round';
    }

    // --- Petits helpers ---
    function drawArrowHead(ctx, ax, ay, angle, aSize) {
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - aSize * Math.cos(angle - Math.PI / 10), ay - aSize * Math.sin(angle - Math.PI / 10));
        ctx.lineTo(ax - aSize * Math.cos(angle + Math.PI / 10), ay - aSize * Math.sin(angle + Math.PI / 10));
        ctx.fill();
    }

    // Texte à l’endroit (le dessin est retourné) + fond blanc
    function drawFlippedLabel(ctx, text, drawingScale, textAlign, rotateRad) {
        ctx.save();
        ctx.scale(1, -1);
        if (rotateRad) ctx.rotate(rotateRad);
        ctx.font = (3 / drawingScale) + 'px Arial';
        ctx.textAlign = textAlign;
        ctx.textBaseline = 'middle';
        var txt = String(text);
        var w = ctx.measureText(txt).width;
        var h = 4 / drawingScale;
        var pad = 0.5 / drawingScale;
        ctx.fillStyle = '#ffffff';
        if (textAlign === 'left') {
            ctx.fillRect(-pad, -h / 2, w + pad * 2, h);
        } else {
            ctx.fillRect(-w / 2 - pad, -h / 2, w + pad * 2, h);
        }
        ctx.fillStyle = '#000000';
        ctx.fillText(txt, 0, 0);
        ctx.restore();
    }

    function beginDimStyle(ctx, drawingScale) {
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = '#000000';
        ctx.lineWidth = 0.15 / drawingScale;
        return 2.0 / drawingScale; // taille de flèche
    }

    function strokePolyline(ctx, points, mirrorX) {
        ctx.beginPath();
        ctx.moveTo(mirrorX ? -points[0].x : points[0].x, points[0].y);
        for (var i = 1; i < points.length; i++) {
            ctx.lineTo(mirrorX ? -points[i].x : points[i].x, points[i].y);
        }
        ctx.stroke();
    }

    // --- Profils / liaisons ---
    function drawSymmetricProfile(ctx, profilePoints, drawingScale, options) {
        if (!profilePoints || profilePoints.length < 2) return;
        ctx.save();
        ctx.strokeStyle = options && options.strokeStyle ? options.strokeStyle : '#000000';
        ctx.lineJoin = 'round';
        var hidden = options && (options.hiddenLine || options.dashed);
        applyModelStroke(ctx, drawingScale, !hidden);
        strokePolyline(ctx, profilePoints, false);
        strokePolyline(ctx, profilePoints, true);
        ctx.restore();
    }

    function drawSectionLevelLines(ctx, profilePoints, drawingScale, options) {
        if (!profilePoints || profilePoints.length === 0) return;
        ctx.save();
        ctx.strokeStyle = options && options.strokeStyle ? options.strokeStyle : '#000000';
        var hidden = options && (options.hiddenLine || options.dashed);
        applyModelStroke(ctx, drawingScale, !hidden);
        profilePoints.forEach(function (p) {
            ctx.beginPath();
            ctx.moveTo(-p.x, p.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        });
        ctx.restore();
    }

    function drawBagueNeckLinks(ctx, mainProfilePoints, bagueProfilePoints, drawingScale) {
        if (!mainProfilePoints || mainProfilePoints.length === 0) return;
        if (!bagueProfilePoints || bagueProfilePoints.length === 0) return;
        var neck = mainProfilePoints[mainProfilePoints.length - 1];
        var bagueBase = bagueProfilePoints[0];
        if (!neck || !bagueBase) return;

        ctx.save();
        ctx.strokeStyle = '#000000';
        applyModelStroke(ctx, drawingScale, true);
        ctx.beginPath();
        ctx.moveTo(neck.x, neck.y);
        ctx.lineTo(bagueBase.x, bagueBase.y);
        ctx.moveTo(-neck.x, neck.y);
        ctx.lineTo(-bagueBase.x, bagueBase.y);
        ctx.stroke();
        ctx.restore();
    }

    // Note / flèche de rattachement (à droite)
    function drawRattachementCalloutRight(ctx, xAnchor, yAnchor, text, drawingScale, offsetX) {
        var aSize = beginDimStyle(ctx, drawingScale);
        var arrowGapX = 2.5 / drawingScale;
        var labelX = xAnchor + offsetX / drawingScale;
        var labelY = yAnchor + (offsetX / drawingScale) * 0.35;
        var textGapX = 1.5 / drawingScale;
        var leadEndX = labelX - textGapX;
        var dx = leadEndX - xAnchor;
        var dy = labelY - yAnchor;
        var ex = xAnchor + arrowGapX;
        var ey = Math.abs(dx) > 1e-6 ? yAnchor + arrowGapX * dy / dx : yAnchor;

        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(xAnchor, yAnchor);
        ctx.stroke();
        drawArrowHead(ctx, xAnchor, yAnchor, Math.atan2(yAnchor - ey, xAnchor - ex), aSize);

        ctx.beginPath();
        ctx.moveTo(xAnchor, yAnchor);
        ctx.lineTo(leadEndX, labelY);
        ctx.stroke();

        ctx.save();
        ctx.translate(labelX, labelY);
        drawFlippedLabel(ctx, text, drawingScale, 'left', 0);
        ctx.restore();
        ctx.restore();
    }

    // --- Cotations ---
    function drawCotation(ctx, x1, y1, x2, y2, dimPos, text, isVertical, drawingScale) {
        var aSize = beginDimStyle(ctx, drawingScale);
        var dimX1, dimY1, dimX2, dimY2, sign;

        ctx.beginPath();
        if (isVertical) {
            sign = dimPos > Math.max(x1, x2) ? 1 : -1;
            dimX1 = dimPos; dimY1 = y1; dimX2 = dimPos; dimY2 = y2;
            ctx.moveTo(x1, y1); ctx.lineTo(dimPos + sign * 2 / drawingScale, y1);
            ctx.moveTo(x2, y2); ctx.lineTo(dimPos + sign * 2 / drawingScale, y2);
        } else {
            sign = dimPos > Math.max(y1, y2) ? 1 : -1;
            dimX1 = x1; dimY1 = dimPos; dimX2 = x2; dimY2 = dimPos;
            if (Math.abs(dimPos - y1) > 0.1) {
                ctx.moveTo(x1, y1 + sign * 1 / drawingScale); ctx.lineTo(x1, dimPos + sign * 2 / drawingScale);
                ctx.moveTo(x2, y2 + sign * 1 / drawingScale); ctx.lineTo(x2, dimPos + sign * 2 / drawingScale);
            }
        }

        var dxDim = dimX2 - dimX1;
        var dyDim = dimY2 - dimY1;
        var lenDim = Math.sqrt(dxDim * dxDim + dyDim * dyDim);
        var uxDim = lenDim > 1e-9 ? (dxDim / lenDim) : 0;
        var uyDim = lenDim > 1e-9 ? (dyDim / lenDim) : 0;
        ctx.moveTo(dimX1 + uxDim * aSize, dimY1 + uyDim * aSize);
        ctx.lineTo(dimX2 - uxDim * aSize, dimY2 - uyDim * aSize);
        ctx.stroke();

        var angle = Math.atan2(dimY2 - dimY1, dimX2 - dimX1);
        drawArrowHead(ctx, dimX2, dimY2, angle, aSize);
        drawArrowHead(ctx, dimX1, dimY1, angle + Math.PI, aSize);

        ctx.save();
        ctx.translate((dimX1 + dimX2) / 2, (dimY1 + dimY2) / 2);
        drawFlippedLabel(ctx, text, drawingScale, 'center', isVertical ? -Math.PI / 2 : 0);
        ctx.restore();
        ctx.restore();
    }

    function drawDiameterCotationDown(ctx, xLeft, xRight, y, text, drawingScale, gapMm) {
        var aSize = beginDimStyle(ctx, drawingScale);
        var arrowGapY = 2.5 / drawingScale;
        var gap = ((gapMm != null && isFinite(gapMm)) ? gapMm : 14) / drawingScale;
        var yDim = y - gap;
        var labelGap = 2 / drawingScale;

        ctx.beginPath();
        ctx.moveTo(xLeft, y - arrowGapY);
        ctx.lineTo(xLeft, yDim);
        ctx.moveTo(xRight, y - arrowGapY);
        ctx.lineTo(xRight, yDim);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(xLeft + aSize, yDim);
        ctx.lineTo(xRight - aSize, yDim);
        ctx.stroke();
        drawArrowHead(ctx, xLeft, yDim, Math.PI, aSize);
        drawArrowHead(ctx, xRight, yDim, 0, aSize);

        ctx.save();
        ctx.translate((xLeft + xRight) / 2, yDim + labelGap);
        drawFlippedLabel(ctx, text, drawingScale, 'center', 0);
        ctx.restore();
        ctx.restore();
    }

    function drawDiameterCotationRight(ctx, xLeft, xRight, y, text, drawingScale) {
        var aSize = beginDimStyle(ctx, drawingScale);
        var arrowGapX = 2.5 / drawingScale;
        var offsetX = 10 / drawingScale;
        var tick = 3 / drawingScale;
        var labelX = xRight + offsetX;

        ctx.beginPath();
        ctx.moveTo(xLeft - arrowGapX, y);
        ctx.lineTo(xLeft, y);
        ctx.moveTo(xRight + arrowGapX, y);
        ctx.lineTo(xRight, y);
        ctx.stroke();
        drawArrowHead(ctx, xLeft, y, 0, aSize);
        drawArrowHead(ctx, xRight, y, Math.PI, aSize);

        ctx.beginPath();
        ctx.moveTo(xRight, y);
        ctx.lineTo(labelX - tick, y);
        ctx.stroke();

        ctx.save();
        ctx.translate(labelX, y);
        drawFlippedLabel(ctx, text, drawingScale, 'left', 0);
        ctx.restore();
        ctx.restore();
    }

    return {
        applyModelStroke: applyModelStroke,
        applyPixelStroke: applyPixelStroke,
        drawRattachementCalloutRight: drawRattachementCalloutRight,
        drawSymmetricProfile: drawSymmetricProfile,
        drawSectionLevelLines: drawSectionLevelLines,
        drawBagueNeckLinks: drawBagueNeckLinks,
        drawCotation: drawCotation,
        drawDiameterCotationRight: drawDiameterCotationRight,
        drawDiameterCotationDown: drawDiameterCotationDown
    };
})();
