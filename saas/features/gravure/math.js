var GravureMath = (function () {
    function toRadians(deg) {
        return deg * Math.PI / 180;
    }

    function clamp(value, min, max) {
        var n = parseFloat(value);
        if (!isFinite(n)) n = min;
        if (n < min) n = min;
        if (n > max) n = max;
        return n;
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
        toRadians: toRadians,
        clamp: clamp,
        parseItemData: parseItemData
    };
})();
