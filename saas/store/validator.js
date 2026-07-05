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

    function getLastMainSectionHeightId() {
        var inputs = document.querySelectorAll('input[id^="s"][id$="-h"]');
        var maxIdx = 0;
        for (var i = 0; i < inputs.length; i++) {
            var m = (inputs[i].id || '').match(/^s(\d+)-h$/);
            if (!m) continue;
            var k = parseInt(m[1], 10);
            if (isFinite(k) && k > maxIdx) maxIdx = k;
        }
        if (!maxIdx) maxIdx = 5;
        return 's' + maxIdx + '-h';
    }

    // ====== VALIDATION HAUTEUR (valeur corrigée) ======
    function validateHeight(id, newHeight) {
        var h = parseFloat(newHeight);
        if (!isFinite(h)) h = MIN_HEIGHT;

        var links = HEIGHT_GRAPH[id];
        if (!links) return h;

        // Bague : toujours accrochée à la dernière section principale (pas forcément s5).
        var belowId = links.below;
        if (id === 'sb1-h') belowId = getLastMainSectionHeightId();

        if (belowId) {
            var belowH = getHeightById(belowId);
            if (belowH != null && h < belowH) h = belowH;
        }
        if (links.above) {
            var aboveH = getHeightById(links.above);
            if (aboveH != null && h > aboveH) h = aboveH;
        }
        return h;
    }

    function validateSectionHeights(sectionIndex, newHeight) {
        var id = 's' + sectionIndex + '-h';
        // Si la section est dans le graphe (historique), appliquer exactement les mêmes règles.
        if (HEIGHT_GRAPH[id]) return validateHeight(id, newHeight);

        // Sinon (sections ajoutées dynamiquement), clamp générique : entre section précédente et suivante si elles existent.
        var h = parseFloat(newHeight);
        if (!isFinite(h)) h = MIN_HEIGHT;
        var belowId = 's' + (sectionIndex - 1) + '-h';
        var aboveId = 's' + (sectionIndex + 1) + '-h';
        var belowH = getHeightById(belowId);
        var aboveH = getHeightById(aboveId);
        if (belowH != null && h < belowH) h = belowH;
        if (aboveH != null && h > aboveH) h = aboveH;
        return h;
    }

    function validatePiqureHeight(newHeight) {
        var h = parseFloat(newHeight);
        if (!isFinite(h)) h = MIN_HEIGHT;
        var piedH = getPiedHeight();
        // La piqûre doit rester au-dessus (ou au niveau) du pied.
        if (piedH != null && h < piedH) h = piedH;
        return h;
    }

    // ====== APPLICATION DES CONTRAINTES HAUTEUR (min/max + valeur) ======
    function applyHeightConstraints() {
        var id, links, input, slider, minH, maxH, v;
        var lastMainId = getLastMainSectionHeightId();

        for (id in HEIGHT_GRAPH) {
            if (!HEIGHT_GRAPH.hasOwnProperty(id)) continue;
            // Bague dynamique (sb1..sbN) : entièrement gérée plus bas, évite sb4-h=sb3-h après renumérotation.
            if (/^sb\d+-h$/.test(id)) continue;
            links = HEIGHT_GRAPH[id];
            input = document.getElementById(id);
            if (!input) continue;

            slider = document.getElementById(id + '-slider');

            var belowRef = links.below;
            if (id === 'sb1-h') belowRef = lastMainId;

            if (links.fixedToBelow) {
                minH = getHeightById(belowRef);
                if (minH == null) minH = MIN_HEIGHT;
                input.value = minH;
                input.max = minH;
                if (slider) {
                    slider.value = minH;
                    slider.max = minH;
                }
                continue;
            }

            var belowVal = belowRef ? getHeightById(belowRef) : null;
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

        // Sections principales dynamiques : assurer min/max selon les sections voisines (monotone croissant)
        var mainInputs = document.querySelectorAll('input[id^="s"][id$="-h"]');
        var idxs = [];
        for (var i = 0; i < mainInputs.length; i++) {
            var mid = (mainInputs[i].id || '').match(/^s(\d+)-h$/);
            if (mid) {
                var k = parseInt(mid[1], 10);
                if (isFinite(k)) idxs.push(k);
            }
        }
        idxs.sort(function (a, b) { return a - b; });
        // Dédupe
        var clean = [];
        for (var j = 0; j < idxs.length; j++) if (j === 0 || idxs[j] !== idxs[j - 1]) clean.push(idxs[j]);

        for (var t = 0; t < clean.length; t++) {
            var k2 = clean[t];
            var sid = 's' + k2 + '-h';
            var sinput = document.getElementById(sid);
            if (!sinput) continue;
            var sslider = document.getElementById(sid + '-slider');

            var below = (t > 0) ? getHeightById('s' + clean[t - 1] + '-h') : null;
            var above = (t < clean.length - 1) ? getHeightById('s' + clean[t + 1] + '-h') : null;
            var smin = below != null ? below : MIN_HEIGHT;
            sinput.min = smin;
            if (sslider) sslider.min = smin;
            if (above != null) {
                sinput.max = above;
                if (sslider) sslider.max = above;
            }
            var sv = parseFloat(sinput.value);
            if (!isFinite(sv)) sv = smin;
            if (sv < smin) {
                sv = smin;
                sinput.value = sv;
                if (sslider) sslider.value = sv;
            } else if (above != null && sv > above) {
                sv = above;
                sinput.value = sv;
                if (sslider) sslider.value = sv;
            }
        }

        // Sections PIQÛRE dynamiques : sp2, sp3 et sections ajoutées (sp4, sp5, ...)
        var piqInputs = document.querySelectorAll('input[id^="sp"][id$="-h"]');
        var pIdxs = [];
        for (var ip = 0; ip < piqInputs.length; ip++) {
            var mp = (piqInputs[ip].id || '').match(/^sp(\d+)-h$/);
            if (mp) {
                var kp = parseInt(mp[1], 10);
                if (isFinite(kp)) pIdxs.push(kp);
            }
        }
        pIdxs.sort(function (a, b) { return a - b; });
        var pClean = [];
        for (var jp = 0; jp < pIdxs.length; jp++) if (jp === 0 || pIdxs[jp] !== pIdxs[jp - 1]) pClean.push(pIdxs[jp]);

        for (var tp = 0; tp < pClean.length; tp++) {
            var kp2 = pClean[tp];
            var pid = 'sp' + kp2 + '-h';
            var pinput = document.getElementById(pid);
            if (!pinput) continue;
            var pslider = document.getElementById(pid + '-slider');

            var pBelow = (tp > 0) ? getHeightById('sp' + pClean[tp - 1] + '-h') : getHeightById('s1-h');
            var pAbove = (tp < pClean.length - 1) ? getHeightById('sp' + pClean[tp + 1] + '-h') : getHeightById('rp3-h');
            var pmin = pBelow != null ? pBelow : MIN_HEIGHT;
            pinput.min = pmin;
            if (pslider) pslider.min = pmin;
            if (pAbove != null) {
                pinput.max = pAbove;
                if (pslider) pslider.max = pAbove;
            }
            var pv = parseFloat(pinput.value);
            if (!isFinite(pv)) pv = pmin;
            if (pv < pmin) {
                pv = pmin;
                pinput.value = pv;
                if (pslider) pslider.value = pv;
            } else if (pAbove != null && pv > pAbove) {
                pv = pAbove;
                pinput.value = pv;
                if (pslider) pslider.value = pv;
            }
        }

        // Sections BAGUE dynamiques : sb1..sbN (bague ajoutée)
        var bagInputs = document.querySelectorAll('input[id^="sb"][id$="-h"]');
        var bIdxs = [];
        for (var ib = 0; ib < bagInputs.length; ib++) {
            var mb = (bagInputs[ib].id || '').match(/^sb(\d+)-h$/);
            if (mb) {
                var kb = parseInt(mb[1], 10);
                if (isFinite(kb)) bIdxs.push(kb);
            }
        }
        bIdxs.sort(function (a, b) { return a - b; });
        var bClean = [];
        for (var jb = 0; jb < bIdxs.length; jb++) if (jb === 0 || bIdxs[jb] !== bIdxs[jb - 1]) bClean.push(bIdxs[jb]);

        for (var tb = 0; tb < bClean.length; tb++) {
            var kb2 = bClean[tb];
            var bid = 'sb' + kb2 + '-h';
            var binput = document.getElementById(bid);
            if (!binput) continue;
            var bslider = document.getElementById(bid + '-slider');

            var bBelow;
            if (kb2 === 1) {
                bBelow = getHeightById(getLastMainSectionHeightId());
            } else {
                bBelow = getHeightById('sb' + bClean[tb - 1] + '-h');
            }
            var bAbove = (tb < bClean.length - 1) ? getHeightById('sb' + bClean[tb + 1] + '-h') : null;
            var bmin = bBelow != null ? bBelow : MIN_HEIGHT;
            binput.min = bmin;
            if (bslider) bslider.min = bmin;
            if (bAbove != null) {
                binput.max = bAbove;
                if (bslider) bslider.max = bAbove;
            }
            var bv = parseFloat(binput.value);
            if (!isFinite(bv)) bv = bmin;
            if (bv < bmin) {
                bv = bmin;
                binput.value = bv;
                if (bslider) bslider.value = bv;
            } else if (bAbove != null && bv > bAbove) {
                bv = bAbove;
                binput.value = bv;
                if (bslider) bslider.value = bv;
            }
        }
    }

    // ====== RÈGLES DIMENSIONS (L/P) ======
    // Piqûre : chaînage diamètre. Bague : dernière section plafonnée par celle du dessous.
    var DIMENSION_RULES = [
        { sourceL: 's1-L',  sourceP: 's1-P',  targetL: 'sp-L',  targetP: 'sp-P',  min: MIN_DIMENSION, defaultSourceL: 70, defaultSourceP: 70 },
        { sourceL: 'sp-L',  sourceP: 'sp-P',  targetL: 'sp2-L', targetP: 'sp2-P', min: MIN_DIMENSION, defaultSourceL: 55, defaultSourceP: 55 },
        { sourceL: 'sp2-L', sourceP: 'sp2-P', targetL: 'sp3-L', targetP: 'sp3-P', min: MIN_DIMENSION, defaultSourceL: 45, defaultSourceP: 45 }
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

    function getBagueSectionKeys() {
        var state = (typeof SectionsState !== 'undefined' && SectionsState.getState)
            ? SectionsState.getState()
            : null;
        if (state && state.bagueSections && state.bagueSections.length) {
            var fromState = [];
            for (var si = 0; si < state.bagueSections.length; si++) {
                if (state.bagueSections[si].key) fromState.push(state.bagueSections[si].key);
            }
            if (fromState.length) return fromState;
        }
        var inputs = document.querySelectorAll('input[id^="sb"][id$="-L"]');
        var idxs = [];
        for (var i = 0; i < inputs.length; i++) {
            var m = (inputs[i].id || '').match(/^sb(\d+)-L$/);
            if (!m) continue;
            var k = parseInt(m[1], 10);
            if (isFinite(k)) idxs.push(k);
        }
        idxs.sort(function (a, b) { return a - b; });
        var keys = [];
        for (var j = 0; j < idxs.length; j++) {
            if (j === 0 || idxs[j] !== idxs[j - 1]) keys.push('sb' + idxs[j]);
        }
        return keys;
    }

    function restoreBagueDimensionLimits() {
        var state = (typeof SectionsState !== 'undefined' && SectionsState.getState)
            ? SectionsState.getState()
            : null;
        if (!state || !state.bagueSections) return;
        var keys = getBagueSectionKeys();
        var topKey = keys.length >= 2 ? keys[keys.length - 1] : null;
        for (var i = 0; i < state.bagueSections.length; i++) {
            var s = state.bagueSections[i];
            if (topKey && s.key === topKey) continue;
            var key = s.key;
            var lMin = s.LMin != null ? s.LMin : MIN_DIMENSION;
            var lMax = s.LMax != null ? s.LMax : 120;
            var inputL = document.getElementById(key + '-L');
            var sliderL = document.getElementById(key + '-L-slider');
            var inputP = document.getElementById(key + '-P');
            var sliderP = document.getElementById(key + '-P-slider');
            if (inputL) {
                inputL.min = lMin;
                inputL.max = lMax;
                if (sliderL) { sliderL.min = lMin; sliderL.max = lMax; }
            }
            if (inputP) {
                inputP.min = lMin;
                inputP.max = lMax;
                if (sliderP) { sliderP.min = lMin; sliderP.max = lMax; }
            }
        }
    }

    function applyTopBagueDimensionConstraint() {
        var keys = getBagueSectionKeys();
        if (keys.length < 2) return;
        var belowKey = keys[keys.length - 2];
        var topKey = keys[keys.length - 1];
        if (!document.getElementById(topKey + '-L') || !document.getElementById(belowKey + '-L')) return;
        clampDimensionsRule({
            sourceL: belowKey + '-L',
            sourceP: belowKey + '-P',
            targetL: topKey + '-L',
            targetP: topKey + '-P',
            min: MIN_DIMENSION
        });
    }

    function applyDimensionRules() {
        for (var i = 0; i < DIMENSION_RULES.length; i++) {
            clampDimensionsRule(DIMENSION_RULES[i]);
        }
        restoreBagueDimensionLimits();
        applyTopBagueDimensionConstraint();
    }

    function applyAllUserConstraints() {
        applyHeightConstraints();
        applyDimensionRules();
        if (typeof SliderLimits !== 'undefined' && SliderLimits.applyRhoMinConstraints) {
            SliderLimits.applyRhoMinConstraints();
        }
    }

    return {
        validateHeight: validateHeight,
        validateSectionHeights: validateSectionHeights,
        validatePiqureHeight: validatePiqureHeight,
        applyAllUserConstraints: applyAllUserConstraints
    };
})();
