// saas/store/state.js
// Mémoire globale partagée (scène 3D, projet ouvert, options d’affichage).
// Chargé tôt dans app.html. Pas de logique métier ici.

// Scène Three.js (remplie par canvas/3d)
var scene, camera, renderer, controls, bottleGroup;
var viewport3D;

// Fichier projet lié (File System Access API) — voir store/storage.js
var currentFileHandle = null;

// true après le 1er initLogiciel() (évite de ré-init le moteur 3D)
var isLogicielInit = false;

// PNG des gravures (clé = id carte) — features/gravure
window.engravingImages = {};

// Source UNIQUE des défauts Affichage (storage / display / realtime y puisent)
function createDefaultDisplayOptions() {
    return {
        showAxes: true,
        showGrid: true,
        showSectionRings: true,
        showMoldJoint: true
    };
}

window.displayOptions = createDefaultDisplayOptions();
