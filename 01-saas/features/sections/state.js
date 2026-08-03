// 01-saas/features/sections/state.js
// État runtime unique des sections (corps / piqûre / bague).
//
// Cycle de vie :
//   1. Init depuis SectionsRules.createInitialState()
//   2. UI lit/écrit via getState / setState
//   3. Avant save : SectionsEvents.syncAllFromDom() recopie le DOM → state
//   4. Storage (store/storage.js) persiste payload.sectionsState
//
// Champs d’une section : label, h, L, P, bornes, userAdded (supprimable si true)
// Champs d’une liaison : rho, type (ligne|courbeS|rayon|spline), id (piqûre/bague)

var SectionsState = (function () {
    function fallbackState() {
        return {
            sectionsMain: [],
            liaisonsMain: [],
            piqureSections: [],
            piqureLiaisons: [],
            bagueSections: [],
            bagueLiaisons: [],
            bagueColLiaison: null
        };
    }

    var state = (typeof SectionsRules !== 'undefined' && SectionsRules.createInitialState)
        ? SectionsRules.createInitialState()
        : fallbackState();

    function getState() {
        return state;
    }

    // Clone profond pour éviter de partager des refs avec le storage / restore
    function setState(next) {
        if (!next) return state;
        try {
            state = JSON.parse(JSON.stringify(next));
        } catch (e) {
            state = next;
        }
        return state;
    }

    return {
        getState: getState,
        setState: setState
    };
})();
