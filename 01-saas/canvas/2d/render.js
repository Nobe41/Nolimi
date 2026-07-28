// 01-saas/canvas/2d/render.js
// Dessine la feuille (vues, profils, cotations).
// Données / styles / cartouche → features/2d.

var Canvas2DRender = (function () {
    var plans2DData = null;
    var tools = null;

    // --- Helpers textes / profils ---
    function fText(v) {
        if (typeof Plans2DCotation !== 'undefined' && Plans2DCotation.formatValue) {
            return Plans2DCotation.formatValue(v);
        }
        return Number.isInteger(v) ? v : v.toFixed(1);
    }

    function diameterLabel(L, P, diameter) {
        if (typeof Plans2DCotation !== 'undefined' && Plans2DCotation.getDiameterLabel) {
            return Plans2DCotation.getDiameterLabel(L, P, diameter);
        }
        return 'Ø ' + fText(diameter);
    }

    function halfWidthAt(profile, y) {
        return (plans2DData && plans2DData.getProfileHalfWidthAtY)
            ? plans2DData.getProfileHalfWidthAtY(profile, y)
            : 0;
    }

    function getRattachementLabel(rattId) {
        if (typeof Plans2DCotation !== 'undefined' && Plans2DCotation.getRattachementLabel) {
            return Plans2DCotation.getRattachementLabel(rattId);
        }
        return null;
    }

    function getBottlePoints() {
        var points = (typeof getBottleProfileFromData === 'function') ? getBottleProfileFromData() : null;
        if ((!points || !points.length) && typeof generateBottleProfile === 'function') {
            points = generateBottleProfile();
        }
        return points;
    }

    function draw(ctx, canvas, cam, opts) {
        if (!ctx || !canvas || canvas.width === 0 || !cam) return;

        plans2DData = (typeof Plans2DData !== 'undefined') ? Plans2DData : null;
        tools = (typeof Canvas2DTools !== 'undefined') ? Canvas2DTools : null;

        var viewportDpr = (opts && opts.applyDpr) ? (opts.dpr || 1) : 1;

        // Fond blanc + caméra
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.setTransform(viewportDpr, 0, 0, viewportDpr, 0, 0);
        ctx.save();
        ctx.translate(cam.x, cam.y);
        ctx.scale(cam.zoom, cam.zoom);

        var drawStyle = Plans2DRules.DRAW_STYLE;
        var pageStyle = drawStyle.page;
        var cartoucheStyle = drawStyle.cartouche;

        // --- Feuille + cartouche ---
        var paper = Plans2DFeature.getPaperInfo();
        var paperW = paper.w;
        var paperH = paper.h;
        var startX = -paperW / 2;
        var startY = -paperH / 2;
        var margin = pageStyle.margin;

        ctx.shadowColor = pageStyle.shadow.color;
        ctx.shadowBlur = pageStyle.shadow.blur;
        ctx.shadowOffsetX = pageStyle.shadow.offsetX;
        ctx.shadowOffsetY = pageStyle.shadow.offsetY;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(startX, startY, paperW, paperH);
        ctx.shadowColor = 'transparent';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = pageStyle.frameLineWidth;
        ctx.strokeRect(startX + margin, startY + margin, paperW - margin * 2, paperH - margin * 2);

        var cartLayout = (typeof Plans2DCartouche !== 'undefined' && Plans2DCartouche.getLayout)
            ? Plans2DCartouche.getLayout(paperW, paperH, margin, cartoucheStyle)
            : null;
        if (cartLayout && typeof Plans2DCartouche !== 'undefined' && Plans2DCartouche.draw) {
            Plans2DCartouche.draw(ctx, cartLayout.x, cartLayout.y, Object.assign({}, cartoucheStyle, {
                width: cartLayout.width,
                height: cartLayout.height
            }));
        }

        var showBottomView = Plans2DFeature.getShowBottomView();
        var drawingScale = Plans2DFeature.getDrawingScale();

        var points = getBottlePoints();
        if (!points || points.length === 0) {
            ctx.restore();
            return;
        }

        var bottleHeight = points[points.length - 1].y;
        var max_R = 0;
        for (var i = 0; i < points.length; i++) {
            if (points[i].x > max_R) max_R = points[i].x;
        }
        var R_base = points[0].x;

        var piqureProfile = (plans2DData && plans2DData.getPiqureProfile2D) ? plans2DData.getPiqureProfile2D() : [];
        var bagueProfile = (plans2DData && plans2DData.getBagueProfile2D) ? plans2DData.getBagueProfile2D() : [];
        var profileTopY = bottleHeight;
        [points, piqureProfile, bagueProfile].forEach(function (profile) {
            if (!profile || !profile.length) return;
            for (var pi = 0; pi < profile.length; pi++) {
                if (profile[pi].y > profileTopY) profileTopY = profile[pi].y;
            }
        });

        var mainViewLiftY = (drawStyle && drawStyle.mainView && drawStyle.mainView.liftY != null)
            ? drawStyle.mainView.liftY
            : 20;
        var viewsDropY = showBottomView ? 58 : 0;
        var mainViewOffsetX = 0;
        var mainViewOffsetY = (bottleHeight * drawingScale) / 2 - mainViewLiftY + viewsDropY;

        // --- Vue de face ---
        ctx.save();
        ctx.translate(mainViewOffsetX, mainViewOffsetY);
        ctx.scale(drawingScale, -drawingScale);

        // Axe central
        ctx.beginPath();
        ctx.setLineDash([10, 2, 2, 2]);
        ctx.moveTo(0, -10);
        ctx.lineTo(0, bottleHeight + 20);
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 0.3 / drawingScale;
        ctx.stroke();
        ctx.setLineDash([]);

        // Contour bouteille (droite, gauche, bas)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 0.6 / drawingScale;
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.lineTo(0, points[points.length - 1].y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-points[0].x, points[0].y);
        for (i = 1; i < points.length; i++) ctx.lineTo(-points[i].x, points[i].y);
        ctx.lineTo(0, points[points.length - 1].y);
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(-points[0].x, points[0].y);
        ctx.stroke();

        // Piqûre (pointillés) + bague
        if (tools && tools.drawSymmetricProfile) {
            tools.drawSymmetricProfile(ctx, piqureProfile, drawingScale, { hiddenLine: true, strokeStyle: '#000000' });
            tools.drawSymmetricProfile(ctx, bagueProfile, drawingScale, { strokeStyle: '#000000' });
        }
        if (tools && tools.drawBagueNeckLinks) {
            tools.drawBagueNeckLinks(ctx, points, bagueProfile, drawingScale);
        }
        var bagueSections = (plans2DData && plans2DData.getBagueSections2D) ? plans2DData.getBagueSections2D() : [];
        if (tools && tools.drawSectionLevelLines && bagueSections.length) {
            tools.drawSectionLevelLines(ctx, bagueSections, drawingScale, { strokeStyle: '#000000' });
        }

        // Cotations hauteur (à gauche)
        var mainSections = (plans2DData && plans2DData.getMainSections2D) ? plans2DData.getMainSections2D() : [];
        var sectionDimBaseX = -max_R - 18;
        var sectionDimStep = 9;
        var sectionDimCount = mainSections.length > 1 ? mainSections.length - 1 : 0;
        var piqureDimX = sectionDimBaseX - sectionDimStep;
        var totalDimX = sectionDimBaseX - (sectionDimCount + 2) * sectionDimStep;

        var halfWAtY = function (y) {
            return Math.max(halfWidthAt(points, y), halfWidthAt(piqureProfile, y), halfWidthAt(bagueProfile, y));
        };

        var bottleBase = mainSections.length ? mainSections[0] : null;
        if (bottleBase && tools && tools.drawCotation) {
            for (i = 1; i < mainSections.length; i++) {
                var y1 = bottleBase.y;
                var y2 = mainSections[i].y;
                var sectionHeight = y2 - y1;
                if (!Number.isFinite(sectionHeight) || sectionHeight <= 0) continue;
                var dimPos = sectionDimBaseX - (i <= 1 ? i - 1 : i) * sectionDimStep;
                tools.drawCotation(
                    ctx,
                    -halfWidthAt(points, y1), y1,
                    -halfWidthAt(points, y2), y2,
                    dimPos, fText(sectionHeight), true, drawingScale
                );
            }
        }

        var profileBottomY = points[0].y;
        var totalHeight = profileTopY - profileBottomY;
        if (Number.isFinite(totalHeight) && totalHeight > 0 && tools && tools.drawCotation) {
            tools.drawCotation(
                ctx,
                -halfWAtY(profileBottomY), profileBottomY,
                -halfWAtY(profileTopY), profileTopY,
                totalDimX, fText(totalHeight), true, drawingScale
            );
        }

        if (piqureProfile.length >= 2 && tools && tools.drawCotation && plans2DData && plans2DData.getProfileHalfWidthAtY) {
            var py1 = piqureProfile[0].y;
            var py2 = piqureProfile[piqureProfile.length - 1].y;
            var piqureHeight = py2 - py1;
            if (Number.isFinite(piqureHeight) && piqureHeight > 0) {
                tools.drawCotation(
                    ctx,
                    -plans2DData.getProfileHalfWidthAtY(piqureProfile, py1), py1,
                    -plans2DData.getProfileHalfWidthAtY(piqureProfile, py2), py2,
                    piqureDimX, fText(piqureHeight), true, drawingScale
                );
            }
        }

        // Cotations diamètre (bas + droite)
        var piqureBase = (plans2DData && plans2DData.getPiqureBase2D) ? plans2DData.getPiqureBase2D() : null;
        if (piqureBase && Number.isFinite(piqureBase.halfWidth) && piqureBase.halfWidth > 0
            && tools && tools.drawDiameterCotationDown) {
            tools.drawDiameterCotationDown(
                ctx, -piqureBase.halfWidth, piqureBase.halfWidth, piqureBase.y,
                diameterLabel(piqureBase.L, piqureBase.P, piqureBase.halfWidth * 2),
                drawingScale, 14
            );
        }

        if (bottleBase && Number.isFinite(bottleBase.x) && bottleBase.x > 0
            && tools && tools.drawDiameterCotationDown) {
            tools.drawDiameterCotationDown(
                ctx, -bottleBase.x, bottleBase.x, bottleBase.y,
                diameterLabel(bottleBase.L, bottleBase.P, bottleBase.x * 2),
                drawingScale, 24
            );
        }

        for (i = 1; i < mainSections.length; i++) {
            var y = mainSections[i].y;
            var radius = halfWidthAt(points, y);
            if (!Number.isFinite(radius) || radius <= 0) continue;
            var sec = mainSections[i];
            if (tools && tools.drawDiameterCotationRight) {
                tools.drawDiameterCotationRight(
                    ctx, -radius, radius, y,
                    diameterLabel(sec.L, sec.P, radius * 2),
                    drawingScale
                );
            }
        }

        for (i = 0; i < mainSections.length - 1; i++) {
            var label = getRattachementLabel('r' + (i + 1) + (i + 2));
            if (!label) continue;
            var yMid = (mainSections[i].y + mainSections[i + 1].y) * 0.5;
            radius = halfWidthAt(points, yMid);
            if (!Number.isFinite(radius) || radius <= 0) continue;
            if (tools && tools.drawRattachementCalloutRight) {
                tools.drawRattachementCalloutRight(ctx, radius, yMid, label, drawingScale, 22);
            }
        }

        ctx.restore();

        var frontViewTopY = mainViewOffsetY - profileTopY * drawingScale;

        // --- Vue du dessous ---
        if (showBottomView) {
            ctx.save();
            var maxRadiusScaled = max_R * drawingScale;
            var bottomViewGap = 50;
            var bottomViewY = frontViewTopY - bottomViewGap - maxRadiusScaled;
            var crossLen = maxRadiusScaled + 10;

            ctx.translate(mainViewOffsetX, bottomViewY);

            ctx.beginPath();
            ctx.setLineDash([10, 2, 2, 2]);
            ctx.strokeStyle = '#888888';
            ctx.lineWidth = 0.3;
            ctx.moveTo(-crossLen, 0); ctx.lineTo(crossLen, 0);
            ctx.moveTo(0, -crossLen); ctx.lineTo(0, crossLen);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.strokeStyle = '#000000';
            if (tools && tools.applyPixelStroke) tools.applyPixelStroke(ctx, true);
            else { ctx.lineWidth = 0.6; ctx.setLineDash([]); }

            ctx.beginPath();
            ctx.arc(0, 0, R_base * drawingScale, 0, Math.PI * 2);
            ctx.stroke();

            if (piqureBase && Number.isFinite(piqureBase.halfWidth) && piqureBase.halfWidth > 0) {
                ctx.beginPath();
                ctx.arc(0, 0, piqureBase.halfWidth * drawingScale, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.beginPath();
            ctx.arc(0, 0, max_R * drawingScale, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#000000';
            ctx.font = '4px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('VUE DU DESSOUS', 0, -crossLen - 8);
            ctx.restore();
        }

        ctx.fillStyle = '#000000';
        ctx.font = '4px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('VUE DE FACE', mainViewOffsetX, frontViewTopY - 12);

        ctx.restore();
    }

    return { draw: draw };
})();
