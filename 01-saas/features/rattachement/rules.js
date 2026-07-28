// 01-saas/features/rattachement/rules.js
// Constantes des liaisons (rattachements) entre deux sections du profil.
// Types : ligne, rayon, courbeS, spline. Pas de logique — consommé par RattachementMath.
// L'indicateur UI « courbe S impossible » utilise COURBE_S_MIN_RADIUS_FACTOR.

var RattachementRules = (function () {
    return {
        DEFAULT_EDGE_TYPE: 'ligne',
        DEFAULT_RHO: 0,
        QUARTER_ARC_TOLERANCE_MM: 0.5,
        RAYON_MIN_CORNER_ANGLE_DEG: 25,
        RAYON_MAX_CORNER_ANGLE_DEG: 155,
        SPLINE_STEPS: 48,
        MIN_SAFE_X: 1,
        // Seuil relatif (× distance S0→S1) : en dessous, la courbe S est marquée impossible dans l'UI
        COURBE_S_MIN_RADIUS_FACTOR: 0.5
    };
})();
