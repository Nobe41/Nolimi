// 01-saas/shared/navigation/state.js
// État runtime de la navigation (onglets + vue active).
// Non persisté dans le fichier projet : réinitialisé à l’ouverture.

var NavigationState = (function () {
    var state = {
        activeLeftTab: 'sections',   // sidebar : sections | calcule | gravure | …
        activeBarTab: 'sections',    // barre inspector : sections | piqure | bague | interieur
        activeView: '3d'             // viewport : 3d | 2d
    };

    function getState() {
        return state;
    }

    function patch(next) {
        if (!next) return state;
        for (var k in next) {
            if (Object.prototype.hasOwnProperty.call(next, k)) state[k] = next[k];
        }
        return state;
    }

    return {
        getState: getState,
        patch: patch
    };
})();
