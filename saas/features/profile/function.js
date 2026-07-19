// saas/features/profile/function.js
// BottleMaths = alias stable vers ProfileMath pour le canvas, calcule, gravure et 2D.
// Évite de renommer les imports partout si l'implémentation interne évolue.

var BottleMaths = (typeof ProfileMath !== 'undefined') ? ProfileMath : {};
