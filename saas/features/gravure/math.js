// saas/features/gravure/math.js
// Pont UI → données : lit les champs d’une carte .gravure-item dans le DOM.
// Retourne position, angle, taille, relief, miroir/inverser pour le mesh 3D.
// Pas de géométrie ici — uniquement parsing des contrôles utilisateur.

var GravureMath = (function () {
    function toRadians(deg) {
        return deg * Math.PI / 180;
    }

    function parseItemData(item) {
        var enabledEl = item.querySelector('.gravure-enabled');
        return {
            id: item.dataset.id,
            enabled: enabledEl ? enabledEl.checked : true,
            y: parseFloat(item.querySelector('.gravure-y').value),
            angle: toRadians(parseFloat(item.querySelector('.gravure-angle').value)),
            width: parseFloat(item.querySelector('.gravure-largeur').value),
            depth: parseFloat(item.querySelector('.gravure-profondeur').value),
            flip: item.querySelector('.gravure-flip').checked,
            invert: item.querySelector('.gravure-invert').checked
        };
    }

    return {
        parseItemData: parseItemData
    };
})();
