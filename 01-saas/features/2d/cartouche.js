// saas/features/2d/cartouche.js
// Dessin du cartouche (grille + textes menus + résultats Calcul).
// Styles / logo / formats → Plans2DRules. Appelé par canvas/2d/render.js.

var Plans2DCartouche = (function () {
    var brandLogo = null;
    var brandLogoLoading = false;

    function cols() {
        return Plans2DRules.CARTOUCHE_COLS;
    }

    function fullRows() {
        return Plans2DRules.CARTOUCHE_FULL_ROWS;
    }

    function requestRedraw() {
        if (typeof draw2D === 'function') draw2D();
    }

    // Charge le logo une fois ; redraw quand prêt
    function loadBrandLogo() {
        if (brandLogo && brandLogo.complete && brandLogo.naturalWidth) return;
        if (brandLogoLoading) return;
        brandLogoLoading = true;
        brandLogo = new Image();
        brandLogo.onload = function () {
            brandLogoLoading = false;
            requestRedraw();
        };
        brandLogo.onerror = function () {
            brandLogoLoading = false;
        };
        brandLogo.src = Plans2DRules.CARTOUCHE_LOGO_SRC;
    }

    loadBrandLogo();

    function getStyle(override) {
        var base = Plans2DRules.DRAW_STYLE.cartouche;
        var s = override || {};
        return {
            referenceFormat: s.referenceFormat || base.referenceFormat,
            rowHeight: s.rowHeight != null ? s.rowHeight : base.rowHeight,
            unitRowFactor: s.unitRowFactor != null ? s.unitRowFactor : base.unitRowFactor,
            labelPadding: s.labelPadding != null ? s.labelPadding : base.labelPadding,
            labelPaddingY: s.labelPaddingY != null ? s.labelPaddingY : base.labelPaddingY,
            valueOffsetY: s.valueOffsetY != null ? s.valueOffsetY : base.valueOffsetY,
            fontLabel: s.fontLabel || base.fontLabel,
            fontValue: s.fontValue || base.fontValue,
            fontBrand: s.fontBrand || base.fontBrand,
            fontUnit: s.fontUnit || base.fontUnit
        };
    }

    function readField(id, fallback) {
        var el = document.getElementById(id);
        if (!el) return fallback || '';
        if (el.tagName === 'SELECT' && el.options && el.selectedIndex >= 0) {
            return el.options[el.selectedIndex].text || el.value || fallback || '';
        }
        return el.value || fallback || '';
    }

    function showText(val) {
        if (val === null || val === undefined) return '-';
        var s = String(val).trim();
        return s === '' ? '-' : s;
    }

    function toUpper(str) {
        return String(str == null ? '' : str).toLocaleUpperCase('fr-FR');
    }

    function readPaperFormatShort() {
        var el = document.getElementById(Plans2DRules.IDS.paperFormat);
        if (!el || !el.value) return 'A4';
        var match = String(el.value).match(/^(A\d+)/i);
        return match ? match[1].toUpperCase() : 'A4';
    }

    // Champs saisis dans le panneau Plan (Plans2DRules.IDS)
    function readMenuData() {
        var i = Plans2DRules.IDS;
        return {
            scale: Plans2DFeature.getScaleLabel(),
            planNumber: readField(i.planNumber, ''),
            date: readField(i.date, ''),
            drafter: readField(i.drafter, ''),
            format: readPaperFormatShort(),
            checker: readField(i.checker, ''),
            title: readField(i.projectTitle, ''),
            index: readField(i.index, '')
        };
    }

    // Résultats volume/poids depuis CalculeVolumeFeature (features/calcule)
    function readCalculeData() {
        var dash = { capaciteNominal: '-', capaciteRasBord: '-', poids: '-', brochage: '-' };
        if (typeof CalculeVolumeFeature === 'undefined' || !CalculeVolumeFeature.getResults) return dash;
        var r = CalculeVolumeFeature.getResults();
        if (!r || !r.available) return dash;
        var brochage = '-';
        if (r.canuleMm > 0) {
            brochage = String.fromCharCode(216) + ' ' + r.canuleMm.toLocaleString('fr-FR', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            }) + ' mm';
        }
        return {
            capaciteNominal: r.capaciteUtileCl.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' cl',
            capaciteRasBord: r.rasBordCl.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' cl',
            poids: r.poidsVerreG.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' g',
            brochage: brochage
        };
    }

    function getWidth(margin, referenceFormat) {
        var m = margin != null ? margin : Plans2DRules.DRAW_STYLE.page.margin;
        var formats = Plans2DRules.PAPER_FORMATS;
        var ref = formats[referenceFormat] || formats[Plans2DRules.DRAW_STYLE.cartouche.referenceFormat];
        return ref.w - m * 2;
    }

    // Position du cartouche en bas à droite de la feuille (coords canvas)
    function getLayout(paperW, paperH, margin, style) {
        var s = getStyle(style);
        var w = getWidth(margin, s.referenceFormat);
        var rowH = s.rowHeight;
        var h = rowH * fullRows() + rowH * s.unitRowFactor;
        var left = -paperW / 2 + margin;
        var right = paperW / 2 - margin;
        var bottom = paperH / 2 - margin;
        var innerW = paperW - margin * 2;
        var x = Math.abs(innerW - w) < 0.5 ? left : right - w;
        return {
            x: x,
            y: bottom - h,
            width: w,
            height: h,
            rowHeight: rowH,
            unitHeight: rowH * s.unitRowFactor
        };
    }

    function line(ctx, x1, y1, x2, y2) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
    }

    // Grille 4×5 + ligne unité (référence sections métier du cartouche)
    function drawGrid(ctx, box) {
        var x = box.x;
        var y = box.y;
        var w = box.width;
        var h = box.height;
        var rowH = box.rowHeight;
        var colW = w / cols();
        var nRows = fullRows();
        var yBottle = y + rowH * 2;
        var yUnit = y + rowH * nRows;

        ctx.beginPath();
        ctx.strokeRect(x, y, w, h);
        for (var r = 1; r <= nRows; r++) {
            line(ctx, x, y + rowH * r, x + w, y + rowH * r);
        }
        line(ctx, x + w / 2, y, x + w / 2, yBottle);
        line(ctx, x + colW, y + rowH * 2, x + colW, yUnit);
        line(ctx, x + colW * 3, y + rowH * 2, x + colW * 3, yUnit);
        line(ctx, x + colW * 2, y + rowH * 2, x + colW * 2, y + rowH * 3);
        ctx.stroke();
    }

    function cellRect(box, row, col, colSpan) {
        var colW = box.width / cols();
        colSpan = colSpan || 1;
        return {
            x: box.x + col * colW,
            y: box.y + row * box.rowHeight,
            w: colW * colSpan,
            h: box.rowHeight
        };
    }

    function drawCell(ctx, rect, label, value, style) {
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = style.fontLabel;
        ctx.fillText(toUpper(label), rect.x + style.labelPadding, rect.y + style.labelPaddingY);
        ctx.font = style.fontValue;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(toUpper(showText(value)), rect.x + rect.w / 2, rect.y + rect.h / 2 + style.valueOffsetY);
    }

    // Logo NOLIMI ou image brand (cellule fusionnée ligne 3)
    function drawBrandName(ctx, box, style) {
        var rect = cellRect(box, 3, 1, 2);
        if (!brandLogo || !brandLogo.complete || !brandLogo.naturalWidth) {
            loadBrandLogo();
            ctx.fillStyle = '#000000';
            ctx.font = style.fontBrand;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(toUpper('NOLIMI'), rect.x + rect.w / 2, rect.y + rect.h / 2);
            return;
        }

        var pad = 1.2;
        var brandScale = 0.52;
        var maxW = (rect.w - pad * 2) * brandScale;
        var maxH = (rect.h - pad * 2) * brandScale;
        var aspect = brandLogo.naturalWidth / brandLogo.naturalHeight;
        var drawW = maxW;
        var drawH = drawW / aspect;
        if (drawH > maxH) {
            drawH = maxH;
            drawW = drawH * aspect;
        }

        ctx.save();
        ctx.filter = 'invert(1)';
        ctx.drawImage(
            brandLogo,
            rect.x + (rect.w - drawW) / 2,
            rect.y + (rect.h - drawH) / 2,
            drawW,
            drawH
        );
        ctx.restore();
    }

    // Point d’entrée rendu : grille + cellules calcul + menu + unité mm
    function draw(ctx, cartX, cartY, style) {
        if (!ctx) return;
        var s = getStyle(style);
        var menu = readMenuData();
        var calc = readCalculeData();
        var nRows = fullRows();

        var box = {
            x: cartX,
            y: cartY,
            width: style && style.width ? style.width : getWidth(Plans2DRules.DRAW_STYLE.page.margin, s.referenceFormat),
            height: style && style.height ? style.height : (s.rowHeight * nRows + s.rowHeight * s.unitRowFactor),
            rowHeight: s.rowHeight
        };

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 0.5;
        drawGrid(ctx, box);

        drawCell(ctx, cellRect(box, 0, 0, 2), 'Capacité nominale :', calc.capaciteNominal, s);
        drawCell(ctx, cellRect(box, 0, 2, 2), 'Poids :', calc.poids, s);
        drawCell(ctx, cellRect(box, 1, 0, 2), 'Capacité ras bord :', calc.capaciteRasBord, s);
        drawCell(ctx, cellRect(box, 1, 2, 2), 'Brochage :', calc.brochage, s);

        drawCell(ctx, cellRect(box, 2, 0), 'ECH.', menu.scale, s);
        drawCell(ctx, cellRect(box, 2, 1), 'NUMERO PLAN', 'n' + String.fromCharCode(176) + ' ' + showText(menu.planNumber), s);
        drawCell(ctx, cellRect(box, 2, 2), 'DATE', menu.date, s);
        drawCell(ctx, cellRect(box, 2, 3), 'DESSI.', menu.drafter, s);

        drawCell(ctx, cellRect(box, 3, 0), 'FORMAT', menu.format, s);
        drawBrandName(ctx, box, s);
        drawCell(ctx, cellRect(box, 3, 3), 'VERIF.', menu.checker, s);

        drawCell(ctx, cellRect(box, 4, 0), 'PROJ.', 'EUROPEENNE', s);
        drawCell(ctx, cellRect(box, 4, 1, 2), 'TITRE', menu.title, s);
        drawCell(ctx, cellRect(box, 4, 3), 'INDICE', menu.index, s);

        ctx.font = s.fontUnit;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var unitTop = box.y + box.rowHeight * nRows;
        var unitH = box.height - box.rowHeight * nRows;
        ctx.fillText(toUpper('UNITE : mm'), box.x + box.width / 2, unitTop + unitH / 2);
    }

    return {
        getLayout: getLayout,
        draw: draw
    };
})();
