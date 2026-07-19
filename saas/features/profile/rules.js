// saas/features/profile/rules.js
// Constantes du profil bouteille : formes, rayons min, résolution d'échantillonnage.
// Utilisées par ProfileMath (math.js). Pas de logique ici, seulement des valeurs par défaut.
// Pour les liaisons entre sections → RattachementRules (rattachement/rules.js).

var ProfileRules = (function () {
    return {
        DEFAULT_SHAPE: 'cylindrique',
        DEFAULT_CARRE_NIVEAU: 0,
        MIN_PROFILE_RADIUS: 0.1,
        // Nombre de points par segment/arc quand ProfileMath tesselle le profil (sampler 3D)
        SAMPLER_TESSELLATION_RES: 48
    };
})();
