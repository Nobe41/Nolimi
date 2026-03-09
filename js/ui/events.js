// js/ui/events.js
// Point d’entrée pour la délégation d’événements (onglets, panneau, futurs listeners).
// Les listeners des inputs/sliders/accordéons sont dans ui.js (setupListeners). Ce module
// peut être étendu pour centraliser la délégation ou des handlers globaux.

var UIEvents = (function () {
    function init() {
        // Appelé quand l’UI est prêt. Pour l’instant vide ; à étendre si on déplace
        // des listeners depuis ui.js ou si on ajoute délégation (document-level).
    }

    return {
        init: init
    };
})();
