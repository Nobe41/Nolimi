// Les variables partagées entre les fichiers (La Mémoire globale)
var scene, camera, renderer, controls, bottleGroup;
var viewport3D;
var currentFileHandle = null; // Mémoire du projet ouvert
var isLogicielInit = false; // Mémorise si le moteur 3D est lancé

// Mémoire pour stocker les images (PNG) des gravures
window.engravingImages = {};
