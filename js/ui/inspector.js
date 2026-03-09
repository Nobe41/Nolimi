// js/ui/inspector.js
// Génération du panneau gauche : sections (Pied → Bas col), piqûre, bague. Données → HTML.

var UIInspector = (function () {
    var CONTAINER_SECTIONS = 'panel-content-sections';
    var CONTAINER_PIQURE = 'panel-content-piqure';
    var CONTAINER_BAGUE = 'panel-content-bague';

    var SELECT_PROFIL_OPTIONS = '<option value="ligne">Ligne</option><option value="courbe">Courbe</option><option value="courbeS">Courbe S</option>';
    var SELECT_FORME_OPTIONS = '<option value="rond">Rond (actuel)</option><option value="carre">Carré</option>';

    // Sections corps : index, label, hauteur (val, min, max, step), L/P (val, min, max), step dimension
    var SECTIONS_MAIN = [
        { i: 1, label: 'Pied', h: 0, hMin: 0, hMax: 80, L: 71, P: 71, LMin: 40, LMax: 120, step: 0.5, hStep: 0.5 },
        { i: 2, label: 'Corps', h: 10, hMin: 0, hMax: 350, L: 85, P: 85, LMin: 40, LMax: 120, step: 0.5, hStep: 1 },
        { i: 3, label: 'Épaule', h: 120, hMin: 0, hMax: 350, L: 85, P: 85, LMin: 20, LMax: 120, step: 0.5, hStep: 0.5 },
        { i: 4, label: 'Col', h: 200, hMin: 20, hMax: 250, L: 32, P: 32, LMin: 20, LMax: 70, step: 0.5, hStep: 1 },
        { i: 5, label: 'Bas col', h: 280, hMin: 0, hMax: 350, L: 32, P: 32, LMin: 20, LMax: 50, step: 0.1, hStep: 0.5 }
    ];

    // Rattachements entre sections : id (r12, r23, r34, r45), rho (val, min, max, step)
    var RATTACHEMENTS_MAIN = [
        { id: 'r12', rho: 5, rhoMin: 0, rhoMax: 50, rhoStep: 0.5 },
        { id: 'r23', rho: 40, rhoMin: 5, rhoMax: 120, rhoStep: 1 },
        { id: 'r34', rho: 0, rhoMin: 0, rhoMax: 40, rhoStep: 0.5 },
        { id: 'r45', rho: 20, rhoMin: 5, rhoMax: 60, rhoStep: 1 }
    ];

    function buildSectionCard(s) {
        var pre = 's' + s.i + '-';
        return '<div class="setting-card">' +
            '<button class="accordion main-accordion">' + s.i + ' — ' + s.label + '</button>' +
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
            '<div class="label-row"><label>Forme</label><div class="input-wrapper"><select id="' + pre + 'forme">' + SELECT_FORME_OPTIONS + '</select></div></div>' +
            '</div>' +
            '<div class="control-group js-carre-niveau" data-section="' + s.i + '" style="display: none;">' +
            '<div class="label-row"><label>Niveau de carré</label><span class="carre-niveau-value">0 %</span></div>' +
            '<input type="range" id="' + pre + 'carre-niveau" min="0" max="100" value="0">' +
            '</div>' +
            '</div></div>';
    }

    function buildRattachementCard(r, num) {
        return '<div class="setting-card setting-card--rattachement">' +
            '<button class="accordion sub-accordion">Rattachement ' + num + '</button>' +
            '<div class="panel-controls">' +
            '<div class="control-group">' +
            '<div class="label-row"><label>Profil</label><div class="input-wrapper"><select id="' + r.id + '-type">' + SELECT_PROFIL_OPTIONS + '</select></div></div>' +
            '</div>' +
            '<div class="control-group">' +
            '<div class="label-row"><label>Rayon courbure ρ (mm)</label><div class="input-wrapper"><input type="number" id="' + r.id + '-rho" value="' + r.rho + '" min="' + r.rhoMin + '" max="' + r.rhoMax + '"><span class="unit">mm</span></div></div>' +
            '<input type="range" id="' + r.id + '-rho-slider" min="' + r.rhoMin + '" max="' + r.rhoMax + '" step="' + r.rhoStep + '" value="' + r.rho + '">' +
            '</div>' +
            '</div></div>';
    }

    function renderMainSections(container) {
        if (!container) return;
        var html = '';
        for (var i = 0; i < SECTIONS_MAIN.length; i++) {
            html += buildSectionCard(SECTIONS_MAIN[i]);
            if (i < RATTACHEMENTS_MAIN.length) {
                html += buildRattachementCard(RATTACHEMENTS_MAIN[i], i + 1);
            }
        }
        container.innerHTML = html;
    }

    function renderPiqure(container) {
        if (!container) return;
        container.innerHTML = [
            '<div class="setting-card">',
            '<button class="accordion main-accordion">1 — Piqûre</button>',
            '<div class="panel-controls">',
            '<div class="control-group"><div class="label-row"><label>Largeur (mm)</label><div class="input-wrapper"><input type="number" id="sp-L" value="58" min="10" max="71"><span class="unit">mm</span></div></div><input type="range" id="sp-L-slider" min="10" max="71" step="0.5" value="58"></div>',
            '<div class="control-group"><div class="label-row"><label>Profondeur (mm)</label><div class="input-wrapper"><input type="number" id="sp-P" value="58" min="10" max="71"><span class="unit">mm</span></div></div><input type="range" id="sp-P-slider" min="10" max="71" step="0.5" value="58"></div>',
            '<div class="control-group"><div class="label-row"><label>Forme</label><div class="input-wrapper"><select id="sp-forme">' + SELECT_FORME_OPTIONS + '</select></div></div></div>',
            '<div class="control-group js-carre-niveau" data-section="piqure" style="display: none;"><div class="label-row"><label>Niveau de carré</label><span class="carre-niveau-value">0 %</span></div><input type="range" id="sp-carre-niveau" min="0" max="100" value="0"></div>',
            '</div></div>',
            '<div class="setting-card setting-card--rattachement"><button class="accordion sub-accordion">Rattachement 1</button><div class="panel-controls">',
            '<div class="control-group"><div class="label-row"><label>Profil</label><div class="input-wrapper"><select id="rp1-type">' + SELECT_PROFIL_OPTIONS + '</select></div></div></div>',
            '<div class="control-group"><div class="label-row"><label>Rayon courbure ρ (mm)</label><div class="input-wrapper"><input type="number" id="rp1-rho" value="5" min="0" max="50"><span class="unit">mm</span></div></div><input type="range" id="rp1-rho-slider" min="0" max="50" step="0.5" value="5"></div></div></div>',
            '<div class="setting-card"><button class="accordion main-accordion">2 — Bas piqûre</button><div class="panel-controls">',
            '<div class="control-group"><div class="label-row"><label>Hauteur (mm)</label><div class="input-wrapper"><input type="number" id="sp2-h" value="4" min="0" max="80"><span class="unit">mm</span></div></div><input type="range" id="sp2-h-slider" min="0" max="80" step="0.5" value="4"></div>',
            '<div class="control-group"><div class="label-row"><label>Largeur (mm)</label><div class="input-wrapper"><input type="number" id="sp2-L" value="48" min="10" max="120"><span class="unit">mm</span></div></div><input type="range" id="sp2-L-slider" min="10" max="120" step="0.5" value="48"></div>',
            '<div class="control-group"><div class="label-row"><label>Profondeur (mm)</label><div class="input-wrapper"><input type="number" id="sp2-P" value="48" min="10" max="120"><span class="unit">mm</span></div></div><input type="range" id="sp2-P-slider" min="10" max="120" step="0.5" value="48"></div>',
            '<div class="control-group"><div class="label-row"><label>Forme</label><div class="input-wrapper"><select id="sp2-forme">' + SELECT_FORME_OPTIONS + '</select></div></div></div>',
            '<div class="control-group js-carre-niveau" data-section="sp2" style="display: none;"><div class="label-row"><label>Niveau de carré</label><span class="carre-niveau-value">0 %</span></div><input type="range" id="sp2-carre-niveau" min="0" max="100" value="0"></div>',
            '</div></div>',
            '<div class="setting-card setting-card--rattachement"><button class="accordion sub-accordion">Rattachement 2</button><div class="panel-controls">',
            '<div class="control-group"><div class="label-row"><label>Profil</label><div class="input-wrapper"><select id="rp2-type">' + SELECT_PROFIL_OPTIONS + '</select></div></div></div>',
            '<div class="control-group"><div class="label-row"><label>Rayon courbure ρ (mm)</label><div class="input-wrapper"><input type="number" id="rp2-rho" value="5" min="0" max="50"><span class="unit">mm</span></div></div><input type="range" id="rp2-rho-slider" min="0" max="50" step="0.5" value="5"></div></div></div>',
            '<div class="setting-card"><button class="accordion main-accordion">3 — Haut piqûre</button><div class="panel-controls">',
            '<div class="control-group"><div class="label-row"><label>Hauteur (mm)</label><div class="input-wrapper"><input type="number" id="sp3-h" value="20" min="0" max="80"><span class="unit">mm</span></div></div><input type="range" id="sp3-h-slider" min="0" max="80" step="0.5" value="20"></div>',
            '<div class="control-group"><div class="label-row"><label>Largeur (mm)</label><div class="input-wrapper"><input type="number" id="sp3-L" value="35" min="10" max="120"><span class="unit">mm</span></div></div><input type="range" id="sp3-L-slider" min="10" max="120" step="0.5" value="35"></div>',
            '<div class="control-group"><div class="label-row"><label>Profondeur (mm)</label><div class="input-wrapper"><input type="number" id="sp3-P" value="35" min="10" max="120"><span class="unit">mm</span></div></div><input type="range" id="sp3-P-slider" min="10" max="120" step="0.5" value="35"></div>',
            '<div class="control-group"><div class="label-row"><label>Forme</label><div class="input-wrapper"><select id="sp3-forme">' + SELECT_FORME_OPTIONS + '</select></div></div></div>',
            '<div class="control-group js-carre-niveau" data-section="sp3" style="display: none;"><div class="label-row"><label>Niveau de carré</label><span class="carre-niveau-value">0 %</span></div><input type="range" id="sp3-carre-niveau" min="0" max="100" value="0"></div>',
            '</div></div>',
            '<div class="setting-card setting-card--rattachement"><button class="accordion sub-accordion">Rattachement 3</button><div class="panel-controls">',
            '<div class="control-group"><div class="label-row"><label>Hauteur (mm)</label><div class="input-wrapper"><input type="number" id="rp3-h" value="30" min="0" max="100"><span class="unit">mm</span></div></div><input type="range" id="rp3-h-slider" min="0" max="100" step="0.5" value="30"></div>',
            '</div></div>'
        ].join('');
    }

    function renderBague(container) {
        if (!container) return;
        container.innerHTML = [
            '<div class="setting-card"><button class="accordion main-accordion">1 — Bas bague</button><div class="panel-controls">',
            '<div class="control-group"><div class="label-row"><label>Hauteur (mm)</label><div class="input-wrapper"><input type="number" id="sb1-h" value="282" min="0" max="400"><span class="unit">mm</span></div></div><input type="range" id="sb1-h-slider" min="0" max="400" step="0.5" value="282"></div>',
            '<div class="control-group"><div class="label-row"><label>Largeur (mm)</label><div class="input-wrapper"><input type="number" id="sb1-L" value="35" min="10" max="120"><span class="unit">mm</span></div></div><input type="range" id="sb1-L-slider" min="10" max="120" step="0.5" value="35"></div>',
            '<div class="control-group"><div class="label-row"><label>Profondeur (mm)</label><div class="input-wrapper"><input type="number" id="sb1-P" value="35" min="10" max="120"><span class="unit">mm</span></div></div><input type="range" id="sb1-P-slider" min="10" max="120" step="0.5" value="35"></div></div></div>',
            '<div class="setting-card setting-card--rattachement"><button class="accordion sub-accordion">Rattachement</button><div class="panel-controls">',
            '<div class="control-group"><div class="label-row"><label>Profil</label><div class="input-wrapper"><select id="rb1-type">' + SELECT_PROFIL_OPTIONS + '</select></div></div></div>',
            '<div class="control-group"><div class="label-row"><label>Rayon courbure ρ (mm)</label><div class="input-wrapper"><input type="number" id="rb1-rho" value="5" min="0" max="50"><span class="unit">mm</span></div></div><input type="range" id="rb1-rho-slider" min="0" max="50" step="0.5" value="5"></div></div></div>',
            '<div class="setting-card"><button class="accordion main-accordion">2 — Haut bague</button><div class="panel-controls">',
            '<div class="control-group"><div class="label-row"><label>Hauteur (mm)</label><div class="input-wrapper"><input type="number" id="sb2-h" value="297" min="0" max="400"><span class="unit">mm</span></div></div><input type="range" id="sb2-h-slider" min="0" max="400" step="0.5" value="297"></div>',
            '<div class="control-group"><div class="label-row"><label>Largeur (mm)</label><div class="input-wrapper"><input type="number" id="sb2-L" value="35" min="10" max="120"><span class="unit">mm</span></div></div><input type="range" id="sb2-L-slider" min="10" max="120" step="0.5" value="35"></div>',
            '<div class="control-group"><div class="label-row"><label>Profondeur (mm)</label><div class="input-wrapper"><input type="number" id="sb2-P" value="35" min="10" max="120"><span class="unit">mm</span></div></div><input type="range" id="sb2-P-slider" min="10" max="120" step="0.5" value="35"></div></div></div>',
            '<div class="setting-card setting-card--rattachement"><button class="accordion sub-accordion">Rattachement 2</button><div class="panel-controls">',
            '<div class="control-group"><div class="label-row"><label>Profil</label><div class="input-wrapper"><select id="rb2-type">' + SELECT_PROFIL_OPTIONS + '</select></div></div></div>',
            '<div class="control-group"><div class="label-row"><label>Rayon courbure ρ (mm)</label><div class="input-wrapper"><input type="number" id="rb2-rho" value="5" min="0" max="50"><span class="unit">mm</span></div></div><input type="range" id="rb2-rho-slider" min="0" max="50" step="0.5" value="5"></div></div></div>',
            '<div class="setting-card"><button class="accordion main-accordion">3 — Haut bague</button><div class="panel-controls">',
            '<div class="control-group"><div class="label-row"><label>Hauteur (mm)</label><div class="input-wrapper"><input type="number" id="sb3-h" value="299" min="0" max="400"><span class="unit">mm</span></div></div><input type="range" id="sb3-h-slider" min="0" max="400" step="0.5" value="299"></div>',
            '<div class="control-group"><div class="label-row"><label>Largeur (mm)</label><div class="input-wrapper"><input type="number" id="sb3-L" value="33" min="10" max="120"><span class="unit">mm</span></div></div><input type="range" id="sb3-L-slider" min="10" max="120" step="0.5" value="33"></div>',
            '<div class="control-group"><div class="label-row"><label>Profondeur (mm)</label><div class="input-wrapper"><input type="number" id="sb3-P" value="33" min="10" max="120"><span class="unit">mm</span></div></div><input type="range" id="sb3-P-slider" min="10" max="120" step="0.5" value="33"></div></div></div>',
            '<div class="setting-card setting-card--rattachement"><button class="accordion sub-accordion">Rattachement 3</button><div class="panel-controls">',
            '<div class="control-group"><div class="label-row"><label>Profil</label><div class="input-wrapper"><select id="rb3-type">' + SELECT_PROFIL_OPTIONS + '</select></div></div></div>',
            '<div class="control-group"><div class="label-row"><label>Rayon courbure ρ (mm)</label><div class="input-wrapper"><input type="number" id="rb3-rho" value="5" min="0" max="50"><span class="unit">mm</span></div></div><input type="range" id="rb3-rho-slider" min="0" max="50" step="0.5" value="5"></div></div></div>',
            '<div class="setting-card"><button class="accordion main-accordion">4 — Plat bague</button><div class="panel-controls">',
            '<div class="control-group"><div class="label-row"><label>Largeur (mm)</label><div class="input-wrapper"><input type="number" id="sb4-L" value="31" min="10" max="120"><span class="unit">mm</span></div></div><input type="range" id="sb4-L-slider" min="10" max="120" step="0.5" value="31"></div>',
            '<div class="control-group"><div class="label-row"><label>Profondeur (mm)</label><div class="input-wrapper"><input type="number" id="sb4-P" value="31" min="10" max="120"><span class="unit">mm</span></div></div><input type="range" id="sb4-P-slider" min="10" max="120" step="0.5" value="31"></div></div></div>',
            '<div class="setting-card setting-card--rattachement"><button class="accordion sub-accordion">Rattachement 4</button><div class="panel-controls">',
            '<div class="control-group"><div class="label-row"><label>Profil</label><div class="input-wrapper"><select id="rb4-type">' + SELECT_PROFIL_OPTIONS + '</select></div></div></div>',
            '<div class="control-group"><div class="label-row"><label>Rayon courbure ρ (mm)</label><div class="input-wrapper"><input type="number" id="rb4-rho" value="5" min="0" max="50"><span class="unit">mm</span></div></div><input type="range" id="rb4-rho-slider" min="0" max="50" step="0.5" value="5"></div></div></div>',
            '<div class="setting-card"><button class="accordion main-accordion">5 — Bas plat bague</button><div class="panel-controls">',
            '<div class="control-group"><div class="label-row"><label>Hauteur (mm)</label><div class="input-wrapper"><input type="number" id="sb5-h" value="297" min="0" max="400"><span class="unit">mm</span></div></div><input type="range" id="sb5-h-slider" min="0" max="400" step="0.5" value="297"></div>',
            '<div class="control-group"><div class="label-row"><label>Largeur (mm)</label><div class="input-wrapper"><input type="number" id="sb5-L" value="29" min="10" max="120"><span class="unit">mm</span></div></div><input type="range" id="sb5-L-slider" min="10" max="120" step="0.5" value="29"></div>',
            '<div class="control-group"><div class="label-row"><label>Profondeur (mm)</label><div class="input-wrapper"><input type="number" id="sb5-P" value="29" min="10" max="120"><span class="unit">mm</span></div></div><input type="range" id="sb5-P-slider" min="10" max="120" step="0.5" value="29"></div></div></div>'
        ].join('');
    }

    function renderSections() {
        renderMainSections(document.getElementById(CONTAINER_SECTIONS));
        renderPiqure(document.getElementById(CONTAINER_PIQURE));
        renderBague(document.getElementById(CONTAINER_BAGUE));
    }

    return {
        renderSections: renderSections
    };
})();
