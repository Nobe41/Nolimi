// Orchestration UI des sections (rendu + branchement événements).
var UIInspector = (function () {
    var CONTAINER_SECTIONS = 'panel-content-sections';
    var CONTAINER_PIQURE = 'panel-content-piqure';
    var CONTAINER_BAGUE = 'panel-content-bague';

    function getState() {
        return (typeof SectionsState !== 'undefined' && SectionsState.getState)
            ? SectionsState.getState()
            : {
                sectionsMain: [],
                liaisonsMain: [],
                piqureSections: [],
                piqureLiaisons: [],
                bagueSections: [],
                bagueLiaisons: []
            };
    }

    function getActiveMode() {
        var contentPiqure = document.getElementById(CONTAINER_PIQURE);
        var contentBague = document.getElementById(CONTAINER_BAGUE);
        var contentInterieur = document.getElementById('panel-content-interieur');
        if (contentPiqure && !contentPiqure.classList.contains('hidden')) return 'piqure';
        if (contentBague && !contentBague.classList.contains('hidden')) return 'bague';
        if (contentInterieur && !contentInterieur.classList.contains('hidden')) return 'interieur';
        return 'main';
    }

    function buildAddSectionFooter() {
        var state = getState();
        var mode = getActiveMode();
        var n = mode === 'piqure'
            ? state.piqureSections.length
            : (mode === 'bague' ? state.bagueSections.length : state.sectionsMain.length);
        if (mode === 'interieur') return '';
        if (n < 2) return '';
        if (typeof SectionsBloc === 'undefined' || !SectionsBloc.buildAddSectionFooter) return '';
        return SectionsBloc.buildAddSectionFooter(mode, n);
    }

    function renderMainSections(container) {
        if (!container || typeof SectionsBloc === 'undefined') return;
        var state = getState();
        var html = '';
        for (var i = 0; i < state.sectionsMain.length; i++) {
            html += SectionsBloc.buildSectionCard(state.sectionsMain[i], i);
            if (i < state.sectionsMain.length - 1) {
                if (!state.liaisonsMain[i]) {
                    state.liaisonsMain[i] = { rho: 10, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 };
                }
                html += SectionsBloc.buildLiaisonCard(state.liaisonsMain[i], i);
            }
        }
        container.innerHTML = html;
    }

    function renderPiqure(container) {
        if (!container || typeof SectionsBloc === 'undefined') return;
        var state = getState();
        var html = '';
        for (var i = 0; i < state.piqureSections.length; i++) {
            html += SectionsBloc.buildPiqureSectionCard(state.piqureSections[i], i);
            if (i < state.piqureSections.length - 1) {
                var r = state.piqureLiaisons[i] || { id: 'rp' + (i + 1), rho: 5, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 };
                state.piqureLiaisons[i] = r;
                html += SectionsBloc.buildSimpleLiaisonCard(r.id, i + 1, r);
            }
        }
        html += '<div class="setting-card setting-card--liaison"><button class="accordion sub-accordion">Liaison ' + (state.piqureSections.length) + '</button><div class="panel-controls">' +
            '<div class="control-group"><div class="label-row"><label>Hauteur (mm)</label><div class="input-wrapper"><input type="number" id="rp3-h" value="35" min="0" max="100"><span class="unit">mm</span></div></div><input type="range" id="rp3-h-slider" min="0" max="100" step="0.5" value="35"></div>' +
            '</div></div>';
        container.innerHTML = html;
    }

    function renderBague(container) {
        if (!container || typeof SectionsBloc === 'undefined') return;
        var state = getState();
        var html = '';
        for (var i = 0; i < state.bagueSections.length; i++) {
            html += SectionsBloc.buildBagueSectionCard(state.bagueSections[i], i);
            if (i < state.bagueSections.length - 1) {
                var r = state.bagueLiaisons[i] || { id: 'rb' + (i + 1), rho: 5, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 };
                state.bagueLiaisons[i] = r;
                html += SectionsBloc.buildSimpleLiaisonCard(r.id, i + 1, r);
            }
        }
        container.innerHTML = html;
    }

    function mountAddSectionFooter() {
        var host = document.getElementById('inspector');
        if (!host) return;
        var existing = document.getElementById('inspector-add-section-bar');
        var html = buildAddSectionFooter();
        if (!html) {
            if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
            return;
        }
        if (!existing) host.insertAdjacentHTML('beforeend', html);
        else existing.outerHTML = html;
    }

    function bindEvents() {
        if (typeof SectionsEvents === 'undefined') return;
        var eventConfig = {
            containerIds: {
                sections: CONTAINER_SECTIONS,
                piqure: CONTAINER_PIQURE,
                bague: CONTAINER_BAGUE
            },
            onRefresh: renderSections
        };
        if (SectionsEvents.wireAddSectionButton) SectionsEvents.wireAddSectionButton(eventConfig);
        if (SectionsEvents.wireAddSectionFab) SectionsEvents.wireAddSectionFab();
        if (SectionsEvents.wireRemoveSectionButtons) SectionsEvents.wireRemoveSectionButtons(eventConfig);
    }

    function renderSections() {
        renderMainSections(document.getElementById(CONTAINER_SECTIONS));
        renderPiqure(document.getElementById(CONTAINER_PIQURE));
        renderBague(document.getElementById(CONTAINER_BAGUE));
        mountAddSectionFooter();
        bindEvents();
    }

    function refreshAddSectionFooter() {
        mountAddSectionFooter();
        bindEvents();
    }

    return {
        renderSections: renderSections,
        refreshAddSectionFooter: refreshAddSectionFooter
    };
})();
