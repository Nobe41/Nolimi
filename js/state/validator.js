// js/state/validator.js
// Règles de validation globales côté UI (hauteurs, largeurs, profondeurs).

var Validator = (function () {
    // ====== CONSTANTES ======
    var MIN_HEIGHT = 0;
    var MIN_DIMENSION = 10;

    // ====== GRAPHE DES HAUTEURS ======
    // Chaque ID : below = section du dessous (min), above = section du dessus (max).
    // fixedToBelow : la valeur est forcée égale à below (ex. sb4-h = sb3-h).
    var HEIGHT_GRAPH = {
        's1-h':  { below: null,    above: 's2-h' },
        's2-h':  { below: 's1-h',   above: 's3-h' },
        's3-h':  { below: 's2-h',   above: 's4-h' },
        's4-h':  { below: 's3-h',   above: 's5-h' },
        's5-h':  { below: 's4-h',   above: null   },
        'sp2-h': { below: 's1-h',   above: 'sp3-h' },
        'sp3-h': { below: 'sp2-h',  above: 'rp3-h' },
        'rp3-h': { below: 'sp3-h',  above: null   },
        'sb1-h': { below: 's5-h',   above: 'sb2-h' },
        'sb2-h': { below: 'sb1-h',  above: 'sb3-h' },
        'sb3-h': { below: 'sb2-h',  above: 'sb4-h' },
        'sb4-h': { below: 'sb3-h',  above: 'sb5-h', fixedToBelow: true },
        'sb5-h': { below: 'sb4-h',  above: 'sb3-h' }
    };

    function getHeightById(id) {
        var input = document.getElementById(id);
        if (!input) return null;
        var v = parseFloat(input.value);
        return isNaN(v) ? null : v;
    }

    function getSectionHeight(index) {
        return getHeightById('s' + index + '-h');
    }

    function getPiedHeight() {
        return getSectionHeight(1);
    }

    // ====== VALIDATION HAUTEUR (valeur corrigée) ======
    function validateHeight(id, newHeight) {
        var h = parseFloat(newHeight);
        if (!isFinite(h)) h = MIN_HEIGHT;

        var links = HEIGHT_GRAPH[id];
        if (!links) return h;

        if (links.below) {
            var belowH = getHeightById(links.below);
            if (belowH != null && h < belowH) h = belowH;
        }
        if (links.above) {
            var aboveH = getHeightById(links.above);
            if (aboveH != null && h > aboveH) h = aboveH;
        }
        return h;
    }

    function validateSectionHeights(sectionIndex, newHeight) {
        return validateHeight('s' + sectionIndex + '-h', newHeight);
    }

    function validatePiqureHeight(newHeight) {
        var h = parseFloat(newHeight);
        if (!isFinite(h)) h = MIN_HEIGHT;
        var piedH = getPiedHeight();
        if (piedH != null && h > piedH) h = piedH;
        return h;
    }

    // ====== APPLICATION DES CONTRAINTES HAUTEUR (min/max + valeur) ======
    function applyHeightConstraints() {
        var id, links, input, slider, minH, maxH, v;

        for (id in HEIGHT_GRAPH) {
            if (!HEIGHT_GRAPH.hasOwnProperty(id)) continue;
            links = HEIGHT_GRAPH[id];
            input = document.getElementById(id);
            if (!input) continue;

            slider = document.getElementById(id + '-slider');

            if (links.fixedToBelow) {
                minH = getHeightById(links.below);
                if (minH == null) minH = MIN_HEIGHT;
                input.value = minH;
                input.max = minH;
                if (slider) {
                    slider.value = minH;
                    slider.max = minH;
                }
                continue;
            }

            var belowVal = links.below ? getHeightById(links.below) : null;
            minH = belowVal != null ? belowVal : MIN_HEIGHT;
            maxH = links.above ? getHeightById(links.above) : null;

            input.min = minH;
            if (slider) slider.min = minH;

            if (maxH != null) {
                input.max = maxH;
                if (slider) slider.max = maxH;
            }

            v = parseFloat(input.value);
            if (!isFinite(v)) v = minH;
            if (v < minH) {
                v = minH;
                input.value = v;
                if (slider) slider.value = v;
            } else if (maxH != null && v > maxH) {
                v = maxH;
                input.value = v;
                if (slider) slider.value = v;
            }
        }
    }

    // ====== RÈGLES DIMENSIONS (L/P) ======
    var DIMENSION_RULES = [
        { sourceL: 's1-L',  sourceP: 's1-P',  targetL: 'sp-L',  targetP: 'sp-P',  min: MIN_DIMENSION, defaultSourceL: 71, defaultSourceP: 71 },
        { sourceL: 'sp-L',  sourceP: 'sp-P',  targetL: 'sp2-L', targetP: 'sp2-P', min: MIN_DIMENSION, defaultSourceL: 58, defaultSourceP: 58 },
        { sourceL: 'sp2-L', sourceP: 'sp2-P', targetL: 'sp3-L', targetP: 'sp3-P', min: MIN_DIMENSION, defaultSourceL: 48, defaultSourceP: 48 },
        { sourceL: 'sb2-L', sourceP: 'sb2-P', targetL: 'sb3-L', targetP: 'sb3-P', min: MIN_DIMENSION, defaultSourceL: 35, defaultSourceP: 35 },
        { sourceL: 'sb3-L', sourceP: 'sb3-P', targetL: 'sb4-L', targetP: 'sb4-P', min: MIN_DIMENSION, defaultSourceL: 33, defaultSourceP: 33 },
        { sourceL: 'sb4-L', sourceP: 'sb4-P', targetL: 'sb5-L', targetP: 'sb5-P', min: MIN_DIMENSION, defaultSourceL: 31, defaultSourceP: 31 }
    ];

    function clampDimensionsRule(rule) {
        var sourceL = document.getElementById(rule.sourceL);
        var sourceP = document.getElementById(rule.sourceP);
        var targetL = document.getElementById(rule.targetL);
        var targetLSlider = document.getElementById(rule.targetL + '-slider');
        var targetP = document.getElementById(rule.targetP);
        var targetPSlider = document.getElementById(rule.targetP + '-slider');
        if (!sourceL || !sourceP || !targetL || !targetP) return;

        var baseL = parseFloat(sourceL.value);
        var baseP = parseFloat(sourceP.value);
        if (!isFinite(baseL)) baseL = rule.defaultSourceL;
        if (!isFinite(baseP)) baseP = rule.defaultSourceP;

        var maxL = Math.max(rule.min, baseL);
        var maxP = Math.max(rule.min, baseP);

        targetL.max = maxL;
        if (targetLSlider) targetLSlider.max = maxL;
        targetP.max = maxP;
        if (targetPSlider) targetPSlider.max = maxP;

        var vL = parseFloat(targetL.value) || 0;
        var vP = parseFloat(targetP.value) || 0;
        if (vL > maxL) {
            targetL.value = maxL;
            if (targetLSlider) targetLSlider.value = maxL;
        }
        if (vP > maxP) {
            targetP.value = maxP;
            if (targetPSlider) targetPSlider.value = maxP;
        }
    }

    function applyDimensionRules() {
        for (var i = 0; i < DIMENSION_RULES.length; i++) {
            clampDimensionsRule(DIMENSION_RULES[i]);
        }
    }

    function applyAllUserConstraints() {
        applyHeightConstraints();
        applyDimensionRules();
    }

    return {
        validateHeight: validateHeight,
        validateSectionHeights: validateSectionHeights,
        validatePiqureHeight: validatePiqureHeight,
        applyAllUserConstraints: applyAllUserConstraints
    };
})();
