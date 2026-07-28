// 01-saas/features/sections/function.js
// Orchestration UI sections — API globale : UIInspector.
//
// Rôle :
//   renderSections()           → remplit les 3 panneaux (corps / piqûre / bague)
//   refreshAddSectionFooter()  → met à jour la barre « + » selon le panneau actif
//
// Dépend de : SectionsState, SectionsBloc, SectionsEvents, SectionsRules
// Appelé par : layout/function.js (init), store/storage.js (restore), navigation

var UIInspector = (function () {
    var R = typeof SectionsRules !== 'undefined' ? SectionsRules : {};
    var IDS = R.IDS || {};
    var DEF_MAIN = R.DEFAULT_LIAISON_MAIN || { rho: 10, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 };
    var DEF = R.DEFAULT_LIAISON || { rho: 5, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 };

    var CONTAINER_SECTIONS = IDS.panelSections || 'panel-content-sections';
    var CONTAINER_PIQURE = IDS.panelPiqure || 'panel-content-piqure';
    var CONTAINER_BAGUE = IDS.panelBague || 'panel-content-bague';
    var CONTAINER_INTERIEUR = IDS.panelInterieur || 'panel-content-interieur';
    var INSPECTOR_ID = IDS.inspector || 'inspector';
    var ADD_BAR_ID = IDS.addSectionBar || 'inspector-add-section-bar';

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

    // Quel panneau est visible ? (interieur → pas de barre « + »)
    function getActiveMode() {
        var contentPiqure = document.getElementById(CONTAINER_PIQURE);
        var contentBague = document.getElementById(CONTAINER_BAGUE);
        var contentInterieur = document.getElementById(CONTAINER_INTERIEUR);
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

    // Panneau corps : sections s* + liaisons r*
    function renderMainSections(container) {
        if (!container || typeof SectionsBloc === 'undefined') return;
        var state = getState();
        var html = '';
        for (var i = 0; i < state.sectionsMain.length; i++) {
            html += SectionsBloc.buildSectionCard(state.sectionsMain[i], i);
            if (i < state.sectionsMain.length - 1) {
                if (!state.liaisonsMain[i]) {
                    state.liaisonsMain[i] = {
                        rho: DEF_MAIN.rho,
                        rhoMin: DEF_MAIN.rhoMin,
                        rhoMax: DEF_MAIN.rhoMax,
                        rhoStep: DEF_MAIN.rhoStep
                    };
                }
                html += SectionsBloc.buildLiaisonCard(state.liaisonsMain[i], i);
            }
        }
        container.innerHTML = html;
    }

    // Panneau piqûre : sections sp* + liaisons rp* + pointe rp3-h
    function renderPiqure(container) {
        if (!container || typeof SectionsBloc === 'undefined') return;
        var state = getState();
        var html = '';
        for (var i = 0; i < state.piqureSections.length; i++) {
            html += SectionsBloc.buildPiqureSectionCard(state.piqureSections[i], i);
            if (i < state.piqureSections.length - 1) {
                var r = state.piqureLiaisons[i] || {
                    id: 'rp' + (i + 1),
                    rho: DEF.rho,
                    rhoMin: DEF.rhoMin,
                    rhoMax: DEF.rhoMax,
                    rhoStep: DEF.rhoStep
                };
                state.piqureLiaisons[i] = r;
                html += SectionsBloc.buildSimpleLiaisonCard(r.id, i + 1, r);
            }
        }
        if (SectionsBloc.buildPiqureTipCard) {
            html += SectionsBloc.buildPiqureTipCard(state.piqureSections.length);
        }
        container.innerHTML = html;
    }

    // Panneau bague : sections sb* + liaisons rb*
    function renderBague(container) {
        if (!container || typeof SectionsBloc === 'undefined') return;
        var state = getState();
        var html = '';
        for (var i = 0; i < state.bagueSections.length; i++) {
            html += SectionsBloc.buildBagueSectionCard(state.bagueSections[i], i);
            if (i < state.bagueSections.length - 1) {
                var r = state.bagueLiaisons[i] || {
                    id: 'rb' + (i + 1),
                    rho: DEF.rho,
                    rhoMin: DEF.rhoMin,
                    rhoMax: DEF.rhoMax,
                    rhoStep: DEF.rhoStep
                };
                state.bagueLiaisons[i] = r;
                html += SectionsBloc.buildSimpleLiaisonCard(r.id, i + 1, r);
            }
        }
        container.innerHTML = html;
    }

    function mountAddSectionFooter() {
        var host = document.getElementById(INSPECTOR_ID);
        if (!host) return;
        var existing = document.getElementById(ADD_BAR_ID);
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

    // Point d’entrée : rendu complet + rebranchement événements
    function renderSections() {
        renderMainSections(document.getElementById(CONTAINER_SECTIONS));
        renderPiqure(document.getElementById(CONTAINER_PIQURE));
        renderBague(document.getElementById(CONTAINER_BAGUE));
        mountAddSectionFooter();
        bindEvents();
    }

    // Après changement d’onglet navigation (corps ↔ piqûre ↔ bague)
    function refreshAddSectionFooter() {
        mountAddSectionFooter();
        bindEvents();
    }

    return {
        renderSections: renderSections,
        refreshAddSectionFooter: refreshAddSectionFooter
    };
})();
