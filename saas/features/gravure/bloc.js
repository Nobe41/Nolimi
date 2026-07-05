var GravureBloc = (function () {
    function updateTitles() {
        var items = document.querySelectorAll('.gravure-item');
        items.forEach(function (item, index) {
            var btn = item.querySelector('.accordion');
            if (btn) btn.textContent = 'Gravure ' + (index + 1);
        });
    }

    function buildCardHtml(id, index, opts) {
        var d = (typeof GravureRules !== 'undefined') ? GravureRules : { DEFAULTS: {}, LIMITS: {} };
        var def = d.DEFAULTS || {};
        var lim = d.LIMITS || {};
        opts = opts || {};
        var y = opts.y != null ? opts.y : def.y;
        var angleDeg = opts.angleDeg != null ? opts.angleDeg : def.angleDeg;
        var width = opts.width != null ? opts.width : def.width;
        var depth = opts.depth != null ? opts.depth : def.depth;
        var flipChecked = opts.flip ? ' checked' : '';
        var invertChecked = opts.invert ? ' checked' : '';
        var enabledChecked = opts.enabled === false ? '' : ' checked';
        var fileName = opts.fileName ? String(opts.fileName) : '';
        return ''
            + '<button class="accordion sub-accordion">Gravure ' + index + '</button>'
            + '<div class="panel-controls">'
            + '<div class="control-group"><div class="label-row"><label for="gravure-enabled-' + id + '">Activer</label><div class="input-wrapper"><input type="checkbox" class="gravure-enabled" id="gravure-enabled-' + id + '"' + enabledChecked + '></div></div></div>'
            + '<div class="control-group"><div class="label-row"><label>Fichier image (PNG)</label></div><div class="gravure-file-row"><button type="button" class="gravure-file-btn">Parcourir…</button><input type="file" id="gravure-file-' + id + '" class="gravure-file" accept=".png,image/png,image/*" data-id="' + id + '"><span id="gravure-filename-' + id + '" class="gravure-filename">' + fileName + '</span></div></div>'
            + '<div class="control-group"><div class="label-row"><label for="gravure-flip-' + id + '">Miroir</label><div class="input-wrapper"><input type="checkbox" class="gravure-flip" id="gravure-flip-' + id + '"' + flipChecked + '></div></div></div>'
            + '<div class="control-group"><div class="label-row"><label for="gravure-invert-' + id + '">Inverser</label><div class="input-wrapper"><input type="checkbox" class="gravure-invert" id="gravure-invert-' + id + '"' + invertChecked + '></div></div></div>'
            + '<div class="control-group"><div class="label-row"><label>Hauteur (Y)</label><div class="input-wrapper"><input type="number" id="gravure-y-num-' + id + '" value="' + y + '" min="' + lim.y.min + '" max="' + lim.y.max + '"><span class="unit">mm</span></div></div><input type="range" class="gravure-y" id="gravure-y-slider-' + id + '" min="' + lim.y.min + '" max="' + lim.y.max + '" step="' + lim.y.step + '" value="' + y + '"></div>'
            + '<div class="control-group"><div class="label-row"><label>Angle (rotation)</label><div class="input-wrapper"><input type="number" id="gravure-angle-num-' + id + '" value="' + angleDeg + '" min="' + lim.angleDeg.min + '" max="' + lim.angleDeg.max + '"><span class="unit">°</span></div></div><input type="range" class="gravure-angle" id="gravure-angle-slider-' + id + '" min="' + lim.angleDeg.min + '" max="' + lim.angleDeg.max + '" step="' + lim.angleDeg.step + '" value="' + angleDeg + '"></div>'
            + '<div class="control-group"><div class="label-row"><label>Taille</label><div class="input-wrapper"><input type="number" id="gravure-largeur-num-' + id + '" value="' + width + '" min="' + lim.width.min + '" max="' + lim.width.max + '"><span class="unit">mm</span></div></div><input type="range" class="gravure-largeur" id="gravure-largeur-slider-' + id + '" min="' + lim.width.min + '" max="' + lim.width.max + '" step="' + lim.width.step + '" value="' + width + '"></div>'
            + '<div class="control-group"><div class="label-row"><label>Relief</label><div class="input-wrapper"><input type="number" id="gravure-profondeur-num-' + id + '" value="' + depth + '" min="' + lim.depth.min + '" max="' + lim.depth.max + '" step="' + lim.depth.step + '"><span class="unit">mm</span></div></div><input type="range" class="gravure-profondeur" id="gravure-profondeur-slider-' + id + '" min="' + lim.depth.min + '" max="' + lim.depth.max + '" step="' + lim.depth.step + '" value="' + depth + '"></div>'
            + '<div class="control-group"><button type="button" class="btn-remove-gravure">Supprimer la gravure</button></div>'
            + '</div>';
    }

    return {
        updateTitles: updateTitles,
        buildCardHtml: buildCardHtml
    };
})();
