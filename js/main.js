console.log("Atelier Bouteille chargé avec succès.");

// Affichage direct de l'atelier 3D (plus de page menu SAVER3D / Nouveau / Ouvrir)
(function () {
    var pageBouteille = document.getElementById('Page-Bouteille');
    if (pageBouteille) {
        setTimeout(function () {
            if (typeof initLogiciel === 'function' && !isLogicielInit) {
                initLogiciel();
                isLogicielInit = true;
            }
            if (typeof updateBouteille === 'function') updateBouteille();
        }, 50);
    }
})();
