// 01-saas/features/gravure/bloc.js
// Couche UI pure : génère le HTML d’une carte gravure (accordion + sliders).
// Chaque carte = une gravure dans le panneau latéral (SVG, Y, angle, relief…).
// Les valeurs saisies ici sont relues par events.js puis mesh.js pour le 3D.

var GravureBloc = (function () {
    function updateTitles() {
        var items = document.querySelectorAll('.gravure-item');
        items.forEach(function (item, index) {
            var btn = item.querySelector('.accordion');
            if (btn) btn.textContent = 'Gravure ' + (index + 1);
        });
    }

    function lim(key, prop, fallback) {
        var L = (typeof GravureRules !== 'undefined' && GravureRules.LIMITS && GravureRules.LIMITS[key])
            ? GravureRules.LIMITS[key]
            : null;
        return L && L[prop] != null ? L[prop] : fallback;
    }

    function buildCardHtml(id, index, opts) {
        var def = (typeof GravureRules !== 'undefined' && GravureRules.DEFAULTS) ? GravureRules.DEFAULTS : {};
        opts = opts || {};
        var y = opts.y != null ? opts.y : (def.y != null ? def.y : 150);
        var angleDeg = opts.angleDeg != null ? opts.angleDeg : (def.angleDeg != null ? def.angleDeg : 0);
        var width = opts.width != null ? opts.width : (def.width != null ? def.width : 50);
        var depth = opts.depth != null ? opts.depth : (def.depth != null ? def.depth : 1.5);
        var flipChecked = opts.flip ? ' checked' : '';
        var invertChecked = opts.invert ? ' checked' : '';
        var enabledChecked = opts.enabled === false ? '' : ' checked';
        var fileName = opts.fileName ? String(opts.fileName) : '';

        return ''
            + '<button class="accordion sub-accordion">Gravure ' + index + '</button>'
            + '<div class="panel-controls">'
            + '<div class="control-group"><div class="label-row"><label for="gravure-enabled-' + id + '">Activer</label><div class="input-wrapper"><input type="checkbox" class="gravure-enabled" id="gravure-enabled-' + id + '"' + enabledChecked + '></div></div></div>'
            + '<div class="control-group"><div class="label-row"><label>Fichier SVG</label></div><div class="gravure-file-row"><button type="button" class="gravure-file-btn">Parcourir…</button><input type="file" id="gravure-file-' + id + '" class="gravure-file" accept=".svg,image/svg+xml" data-id="' + id + '"><span id="gravure-filename-' + id + '" class="gravure-filename">' + fileName + '</span></div></div>'
            + '<div class="control-group"><div class="label-row"><label for="gravure-flip-' + id + '">Miroir</label><div class="input-wrapper"><input type="checkbox" class="gravure-flip" id="gravure-flip-' + id + '"' + flipChecked + '></div></div></div>'
            + '<div class="control-group"><div class="label-row"><label for="gravure-invert-' + id + '">Inverser</label><div class="input-wrapper"><input type="checkbox" class="gravure-invert" id="gravure-invert-' + id + '"' + invertChecked + '></div></div></div>'
            + '<div class="control-group"><div class="label-row"><label>Hauteur (Y)</label><div class="input-wrapper"><input type="number" id="gravure-y-num-' + id + '" value="' + y + '" min="' + lim('y', 'min', 10) + '" max="' + lim('y', 'max', 350) + '"><span class="unit">mm</span></div></div><input type="range" class="gravure-y" id="gravure-y-slider-' + id + '" min="' + lim('y', 'min', 10) + '" max="' + lim('y', 'max', 350) + '" step="' + lim('y', 'step', 1) + '" value="' + y + '"></div>'
            + '<div class="control-group"><div class="label-row"><label>Angle (rotation)</label><div class="input-wrapper"><input type="number" id="gravure-angle-num-' + id + '" value="' + angleDeg + '" min="' + lim('angleDeg', 'min', 0) + '" max="' + lim('angleDeg', 'max', 360) + '"><span class="unit">°</span></div></div><input type="range" class="gravure-angle" id="gravure-angle-slider-' + id + '" min="' + lim('angleDeg', 'min', 0) + '" max="' + lim('angleDeg', 'max', 360) + '" step="' + lim('angleDeg', 'step', 1) + '" value="' + angleDeg + '"></div>'
            + '<div class="control-group"><div class="label-row"><label>Taille</label><div class="input-wrapper"><input type="number" id="gravure-largeur-num-' + id + '" value="' + width + '" min="' + lim('width', 'min', 10) + '" max="' + lim('width', 'max', 150) + '"><span class="unit">mm</span></div></div><input type="range" class="gravure-largeur" id="gravure-largeur-slider-' + id + '" min="' + lim('width', 'min', 10) + '" max="' + lim('width', 'max', 150) + '" step="' + lim('width', 'step', 1) + '" value="' + width + '"></div>'
            + '<div class="control-group"><div class="label-row"><label>Relief</label><div class="input-wrapper"><input type="number" id="gravure-profondeur-num-' + id + '" value="' + depth + '" min="' + lim('depth', 'min', 0.1) + '" max="' + lim('depth', 'max', 5) + '" step="' + lim('depth', 'step', 0.1) + '"><span class="unit">mm</span></div></div><input type="range" class="gravure-profondeur" id="gravure-profondeur-slider-' + id + '" min="' + lim('depth', 'min', 0.1) + '" max="' + lim('depth', 'max', 5) + '" step="' + lim('depth', 'step', 0.1) + '" value="' + depth + '"></div>'
            + '<div class="control-group"><button type="button" class="btn-remove-gravure">Supprimer la gravure</button></div>'
            + '</div>';
    }

    return {
        updateTitles: updateTitles,
        buildCardHtml: buildCardHtml
    };
})();
