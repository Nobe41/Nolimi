// Génération des blocs UI (cards + sliders) pour les sections.
var SectionsBloc = (function () {
    function profilOptions() {
        return (typeof SectionsRules !== 'undefined' && SectionsRules.selectProfilOptions)
            ? SectionsRules.selectProfilOptions
            : '';
    }

    function profilOptionsForType(selectedType) {
        selectedType = selectedType || 'ligne';
        var html = profilOptions();
        return html.replace('value="' + selectedType + '"', 'value="' + selectedType + '" selected');
    }

    function formeOptions() {
        return (typeof SectionsRules !== 'undefined' && SectionsRules.selectFormeOptions)
            ? SectionsRules.selectFormeOptions
            : '';
    }

    function buildSectionCardHeader(title, opts) {
        opts = opts || {};
        var removeBtn = opts.removable
            ? '<button type="button" class="btn-remove-section" data-section-index="' + opts.index + '" data-section-mode="' + opts.mode + '" title="Supprimer la section" aria-label="Supprimer la section">&times;</button>'
            : '';
        return '<div class="section-card-header">' +
            '<button type="button" class="accordion main-accordion">' + title + '</button>' +
            removeBtn +
            '</div>';
    }

    function buildSectionCard(s, idx) {
        var i = idx + 1;
        var pre = 's' + i + '-';
        var header = buildSectionCardHeader(i + ' — ' + (s.label || ('Section ' + i)), {
            removable: !!s.userAdded,
            index: idx,
            mode: 'main'
        });
        return '<div class="setting-card">' +
            header +
            '<div class="panel-controls">' +
            '<div class="control-group">' +
            '<div class="label-row"><label>Hauteur (mm)</label><div class="input-wrapper"><input type="number" id="' + pre + 'h" value="' + s.h + '" min="' + s.hMin + '" max="' + s.hMax + '"><span class="unit">mm</span></div></div>' +
            '<input type="range" id="' + pre + 'h-slider" min="' + s.hMin + '" max="' + s.hMax + '" step="' + s.hStep + '" value="' + s.h + '">' +
            '</div>' +
            '<div class="control-group">' +
            '<div class="label-row"><label>Largeur (mm)</label><div class="input-wrapper"><input type="number" id="' + pre + 'L" value="' + s.L + '" min="' + s.LMin + '" max="' + s.LMax + '"><span class="unit">mm</span></div></div>' +
            '<input type="range" id="' + pre + 'L-slider" min="' + s.LMin + '" max="' + s.LMax + '" step="' + s.step + '" value="' + s.L + '">' +
            '</div>' +
            '<div class="control-group">' +
            '<div class="label-row"><label>Profondeur (mm)</label><div class="input-wrapper"><input type="number" id="' + pre + 'P" value="' + s.P + '" min="' + s.LMin + '" max="' + s.LMax + '"><span class="unit">mm</span></div></div>' +
            '<input type="range" id="' + pre + 'P-slider" min="' + s.LMin + '" max="' + s.LMax + '" step="' + s.step + '" value="' + s.P + '">' +
            '</div>' +
            '<div class="control-group">' +
            '<div class="label-row"><label>Forme</label><div class="input-wrapper"><select id="' + pre + 'forme">' + formeOptions() + '</select></div></div>' +
            '</div>' +
            '<div class="control-group js-carre-niveau" data-section="' + i + '" style="display: none;">' +
            '<div class="label-row"><label>Niveau de carré</label><span class="carre-niveau-value">0 %</span></div>' +
            '<input type="range" id="' + pre + 'carre-niveau" min="0" max="100" value="0">' +
            '</div>' +
            '</div></div>';
    }

    function buildLiaisonCard(r, idx) {
        var from = idx + 1;
        var to = idx + 2;
        var id = 'r' + from + to;
        return '<div class="setting-card setting-card--liaison">' +
            '<button class="accordion sub-accordion">Liaison ' + (idx + 1) + '</button>' +
            '<div class="panel-controls">' +
            '<div class="control-group">' +
            '<div class="label-row"><label>Profil</label><div class="input-wrapper"><select id="' + id + '-type">' + profilOptionsForType(r.type) + '</select></div></div>' +
            '</div>' +
            '<div class="control-group js-rho-group">' +
            '<div class="label-row"><label>Rayon</label><div class="input-wrapper"><input type="number" id="' + id + '-rho" value="' + r.rho + '" min="' + r.rhoMin + '" max="' + r.rhoMax + '"><span class="unit">mm</span></div></div>' +
            '<input type="range" id="' + id + '-rho-slider" min="' + r.rhoMin + '" max="' + r.rhoMax + '" step="' + r.rhoStep + '" value="' + r.rho + '">' +
            '</div>' +
            '</div></div>';
    }

    function buildPiqureSectionCard(s, idx) {
        var title = (idx + 1) + ' — ' + s.label;
        var key = s.key;
        var header = buildSectionCardHeader(title, {
            removable: !!s.userAdded,
            index: idx,
            mode: 'piqure'
        });
        var html = '<div class="setting-card">' +
            header +
            '<div class="panel-controls">';
        if (s.hasHeight) {
            html += '<div class="control-group"><div class="label-row"><label>Hauteur (mm)</label><div class="input-wrapper"><input type="number" id="' + key + '-h" value="' + s.h + '" min="' + s.hMin + '" max="' + s.hMax + '"><span class="unit">mm</span></div></div>' +
                '<input type="range" id="' + key + '-h-slider" min="' + s.hMin + '" max="' + s.hMax + '" step="' + s.hStep + '" value="' + s.h + '"></div>';
        }
        html += '<div class="control-group"><div class="label-row"><label>Largeur (mm)</label><div class="input-wrapper"><input type="number" id="' + key + '-L" value="' + s.L + '" min="' + s.LMin + '" max="' + s.LMax + '"><span class="unit">mm</span></div></div>' +
            '<input type="range" id="' + key + '-L-slider" min="' + s.LMin + '" max="' + s.LMax + '" step="' + s.step + '" value="' + s.L + '"></div>' +
            '<div class="control-group"><div class="label-row"><label>Profondeur (mm)</label><div class="input-wrapper"><input type="number" id="' + key + '-P" value="' + s.P + '" min="' + s.LMin + '" max="' + s.LMax + '"><span class="unit">mm</span></div></div>' +
            '<input type="range" id="' + key + '-P-slider" min="' + s.LMin + '" max="' + s.LMax + '" step="' + s.step + '" value="' + s.P + '"></div>' +
            '<div class="control-group"><div class="label-row"><label>Forme</label><div class="input-wrapper"><select id="' + key + '-forme">' + formeOptions() + '</select></div></div></div>' +
            '<div class="control-group js-carre-niveau" data-section="' + key + '" style="display: none;"><div class="label-row"><label>Niveau de carré</label><span class="carre-niveau-value">0 %</span></div><input type="range" id="' + key + '-carre-niveau" min="0" max="100" value="0"></div>' +
            '</div></div>';
        return html;
    }

    function buildSimpleLiaisonCard(id, num, rhoObj) {
        return '<div class="setting-card setting-card--liaison">' +
            '<button class="accordion sub-accordion">Liaison ' + num + '</button>' +
            '<div class="panel-controls">' +
            '<div class="control-group"><div class="label-row"><label>Profil</label><div class="input-wrapper"><select id="' + id + '-type">' + profilOptions() + '</select></div></div></div>' +
            '<div class="control-group js-rho-group"><div class="label-row"><label>Rayon</label><div class="input-wrapper"><input type="number" id="' + id + '-rho" value="' + rhoObj.rho + '" min="' + rhoObj.rhoMin + '" max="' + rhoObj.rhoMax + '"><span class="unit">mm</span></div></div>' +
            '<input type="range" id="' + id + '-rho-slider" min="' + rhoObj.rhoMin + '" max="' + rhoObj.rhoMax + '" step="' + rhoObj.rhoStep + '" value="' + rhoObj.rho + '"></div>' +
            '</div></div>';
    }

    function buildBagueSectionCard(s, idx) {
        var key = s.key;
        var header = buildSectionCardHeader((idx + 1) + ' — ' + s.label, {
            removable: !!s.userAdded,
            index: idx,
            mode: 'bague'
        });
        return '<div class="setting-card">' +
            header +
            '<div class="panel-controls">' +
            '<div class="control-group"><div class="label-row"><label>Hauteur (mm)</label><div class="input-wrapper"><input type="number" id="' + key + '-h" value="' + s.h + '" min="' + s.hMin + '" max="' + s.hMax + '"><span class="unit">mm</span></div></div><input type="range" id="' + key + '-h-slider" min="' + s.hMin + '" max="' + s.hMax + '" step="' + s.hStep + '" value="' + s.h + '"></div>' +
            '<div class="control-group"><div class="label-row"><label>Largeur (mm)</label><div class="input-wrapper"><input type="number" id="' + key + '-L" value="' + s.L + '" min="' + s.LMin + '" max="' + s.LMax + '"><span class="unit">mm</span></div></div><input type="range" id="' + key + '-L-slider" min="' + s.LMin + '" max="' + s.LMax + '" step="' + s.step + '" value="' + s.L + '"></div>' +
            '<div class="control-group"><div class="label-row"><label>Profondeur (mm)</label><div class="input-wrapper"><input type="number" id="' + key + '-P" value="' + s.P + '" min="' + s.LMin + '" max="' + s.LMax + '"><span class="unit">mm</span></div></div><input type="range" id="' + key + '-P-slider" min="' + s.LMin + '" max="' + s.LMax + '" step="' + s.step + '" value="' + s.P + '"></div>' +
            '</div></div>';
    }

    function buildAddSectionFooter(mode, n) {
        if (n < 2) return '';
        var options = '';
        for (var i = 1; i <= n - 1; i++) {
            options += '<option value="' + i + '">Entre section ' + i + ' et ' + (i + 1) + '</option>';
        }
        return [
            '<div class="inspector-add-section-bar" id="inspector-add-section-bar">',
            '  <input type="hidden" id="add-section-mode" value="' + mode + '">',
            '  <button type="button" class="inspector-add-section-fab" id="btn-add-section-fab" aria-label="Ajouter une section" aria-expanded="false" aria-controls="inspector-add-section-panel">+</button>',
            '  <div class="inspector-add-section-panel" id="inspector-add-section-panel">',
            '    <div class="control-group" style="width:100%; margin: 0;">',
            '      <div class="input-wrapper" style="width:100%;">',
            '        <select id="add-section-between" class="input-select" style="width:100%;">' + options + '</select>',
            '      </div>',
            '    </div>',
            '    <button type="button" id="btn-add-section" class="btn-add-section">Ajouter une section</button>',
            '  </div>',
            '</div>'
        ].join('');
    }

    return {
        buildSectionCard: buildSectionCard,
        buildLiaisonCard: buildLiaisonCard,
        buildPiqureSectionCard: buildPiqureSectionCard,
        buildSimpleLiaisonCard: buildSimpleLiaisonCard,
        buildBagueSectionCard: buildBagueSectionCard,
        buildAddSectionFooter: buildAddSectionFooter
    };
})();
