// saas/features/sections/bloc.js
// Génération HTML des cartes inspecteur (sections, liaisons, footer « + »).
// Constantes / options → SectionsRules. Pas d’événements ici.
//
// Conventions d’IDs générés :
//   Corps   : s{n}-h, s{n}-L, s{n}-P, s{n}-forme, s{n}-carre-niveau
//             liaison entre n et n+1 → r{n}{n+1}-type, r{n}{n+1}-rho
//   Piqûre  : {key}-h/L/P/forme  (key = sp, sp2…) ; liaisons rp1, rp2…
//   Bague   : sb{n}-… ; liaisons rb1, rb2…
//   Pointe  : rp3-h (hauteur pointe piqûre, ID fixe — ne pas renommer)

var SectionsBloc = (function () {
    var R = typeof SectionsRules !== 'undefined' ? SectionsRules : {};
    var IDS = R.IDS || {};

    function profilOptions() {
        return R.selectProfilOptions || '';
    }

    // Marque l’option du type de profil actuellement sélectionné
    function profilOptionsForType(selectedType) {
        selectedType = selectedType || 'ligne';
        var html = profilOptions();
        return html.replace('value="' + selectedType + '"', 'value="' + selectedType + '" selected');
    }

    function formeOptions() {
        return R.selectFormeOptions || '';
    }

    // Forme + L (diamètre) + P (profondeur, masqué si cylindrique) + niveau carré
    function buildDimensionAndFormeControls(pre, s, dataSectionAttr) {
        var dsAttr = dataSectionAttr ? ' data-section="' + dataSectionAttr + '"' : '';
        return '<div class="control-group">' +
            '<div class="label-row"><label>Forme</label><div class="input-wrapper"><select id="' + pre + 'forme">' + formeOptions() + '</select></div></div>' +
            '</div>' +
            '<div class="control-group js-section-L">' +
            '<div class="label-row"><label>Diamètre (mm)</label><div class="input-wrapper"><input type="number" id="' + pre + 'L" value="' + s.L + '" min="' + s.LMin + '" max="' + s.LMax + '"><span class="unit">mm</span></div></div>' +
            '<input type="range" id="' + pre + 'L-slider" min="' + s.LMin + '" max="' + s.LMax + '" step="' + s.step + '" value="' + s.L + '">' +
            '</div>' +
            '<div class="control-group js-section-P" style="display: none;">' +
            '<div class="label-row"><label>Profondeur (mm)</label><div class="input-wrapper"><input type="number" id="' + pre + 'P" value="' + s.P + '" min="' + s.LMin + '" max="' + s.LMax + '"><span class="unit">mm</span></div></div>' +
            '<input type="range" id="' + pre + 'P-slider" min="' + s.LMin + '" max="' + s.LMax + '" step="' + s.step + '" value="' + s.P + '">' +
            '</div>' +
            '<div class="control-group js-carre-niveau"' + dsAttr + ' style="display: none;">' +
            '<div class="label-row"><label>Niveau de carré</label><span class="carre-niveau-value">0 %</span></div>' +
            '<input type="range" id="' + pre + 'carre-niveau" min="0" max="100" value="0">' +
            '</div>';
    }

    // Titre accordéon + bouton × si section ajoutée par l’utilisateur
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

    // Carte section corps (s1, s2…)
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
            buildDimensionAndFormeControls(pre, s, i) +
            '</div></div>';
    }

    // Carte liaison corps (r12, r23…)
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

    // Carte section piqûre (sp, sp2…)
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
        html += buildDimensionAndFormeControls(key + '-', s, key) +
            '</div></div>';
        return html;
    }

    // Liaison simple piqûre / bague (rp*, rb*) — même UI que le corps, préfixe fixe
    function buildSimpleLiaisonCard(id, num, rhoObj) {
        return '<div class="setting-card setting-card--liaison">' +
            '<button class="accordion sub-accordion">Liaison ' + num + '</button>' +
            '<div class="panel-controls">' +
            '<div class="control-group"><div class="label-row"><label>Profil</label><div class="input-wrapper"><select id="' + id + '-type">' + profilOptionsForType(rhoObj && rhoObj.type) + '</select></div></div></div>' +
            '<div class="control-group js-rho-group"><div class="label-row"><label>Rayon</label><div class="input-wrapper"><input type="number" id="' + id + '-rho" value="' + rhoObj.rho + '" min="' + rhoObj.rhoMin + '" max="' + rhoObj.rhoMax + '"><span class="unit">mm</span></div></div>' +
            '<input type="range" id="' + id + '-rho-slider" min="' + rhoObj.rhoMin + '" max="' + rhoObj.rhoMax + '" step="' + rhoObj.rhoStep + '" value="' + rhoObj.rho + '"></div>' +
            '</div></div>';
    }

    // Carte section bague (sb1…)
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
            buildDimensionAndFormeControls(key + '-', s, key) +
            '</div></div>';
    }

    // Barre « + » en bas de l’inspecteur (entre quelles sections insérer)
    function buildAddSectionFooter(mode, n) {
        if (n < 2) return '';
        var options = '';
        for (var i = 1; i <= n - 1; i++) {
            options += '<option value="' + i + '">Entre section ' + i + ' et ' + (i + 1) + '</option>';
        }
        var barId = IDS.addSectionBar || 'inspector-add-section-bar';
        var fabId = IDS.addSectionFab || 'btn-add-section-fab';
        var panelId = IDS.addSectionPanel || 'inspector-add-section-panel';
        var modeId = IDS.addSectionMode || 'add-section-mode';
        var betweenId = IDS.addSectionBetween || 'add-section-between';
        var btnId = IDS.addSectionBtn || 'btn-add-section';
        return [
            '<div class="inspector-add-section-bar" id="' + barId + '">',
            '  <input type="hidden" id="' + modeId + '" value="' + mode + '">',
            '  <button type="button" class="inspector-add-section-fab" id="' + fabId + '" aria-label="Ajouter une section" aria-expanded="false" aria-controls="' + panelId + '">+</button>',
            '  <div class="inspector-add-section-panel" id="' + panelId + '">',
            '    <div class="control-group" style="width:100%; margin: 0;">',
            '      <div class="input-wrapper" style="width:100%;">',
            '        <select id="' + betweenId + '" class="input-select" style="width:100%;">' + options + '</select>',
            '      </div>',
            '    </div>',
            '    <button type="button" id="' + btnId + '" class="btn-add-section">Ajouter une section</button>',
            '  </div>',
            '</div>'
        ].join('');
    }

    // Pointe piqûre : ID fixe rp3-h (3D, calcule, validator y font référence)
    function buildPiqureTipCard(sectionCount) {
        var tip = R.PIQURE_TIP || { height: 30, hMin: 0, hMax: 100, hStep: 0.5 };
        var hId = IDS.piqureTipHeight || 'rp3-h';
        var sliderId = IDS.piqureTipHeightSlider || 'rp3-h-slider';
        var num = sectionCount || 0;
        return '<div class="setting-card setting-card--liaison">'
            + '<button class="accordion sub-accordion">Liaison ' + num + '</button>'
            + '<div class="panel-controls">'
            + '<div class="control-group"><div class="label-row"><label>Hauteur (mm)</label>'
            + '<div class="input-wrapper"><input type="number" id="' + hId + '" value="' + tip.height + '" min="' + tip.hMin + '" max="' + tip.hMax + '"><span class="unit">mm</span></div></div>'
            + '<input type="range" id="' + sliderId + '" min="' + tip.hMin + '" max="' + tip.hMax + '" step="' + tip.hStep + '" value="' + tip.height + '">'
            + '</div></div></div>';
    }

    return {
        buildSectionCard: buildSectionCard,
        buildLiaisonCard: buildLiaisonCard,
        buildPiqureSectionCard: buildPiqureSectionCard,
        buildSimpleLiaisonCard: buildSimpleLiaisonCard,
        buildBagueSectionCard: buildBagueSectionCard,
        buildAddSectionFooter: buildAddSectionFooter,
        buildPiqureTipCard: buildPiqureTipCard
    };
})();
