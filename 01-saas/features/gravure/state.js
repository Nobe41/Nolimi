// 01-saas/features/gravure/state.js
// Mémoire côté UI (pas le mesh 3D).
// Compteur d’IDs pour nommer les cartes ; images SVG chargées indexées par id.
// Le moteur 3D (mesh.js) lit ces images via window.engravingImages.

var GravureState = (function () {
    var counter = 0;
    var images = {};

    function nextId() {
        counter += 1;
        return Date.now();
    }

    function getCounter() {
        return counter;
    }

    function setCounter(value) {
        var n = parseInt(value, 10);
        counter = isFinite(n) && n >= 0 ? n : 0;
    }

    function getImages() {
        return images;
    }

    function setImage(id, img) {
        if (img) {
            img._maskBitmap = null;
            img._maskBitmapKey = '';
            img._svgParsed = null;
            img._svgParsedKey = '';
        }
        images[id] = img;
    }

    function removeImage(id) {
        delete images[id];
    }

    function reset() {
        counter = 0;
        images = {};
    }

    return {
        nextId: nextId,
        getCounter: getCounter,
        setCounter: setCounter,
        getImages: getImages,
        setImage: setImage,
        removeImage: removeImage,
        reset: reset
    };
})();
