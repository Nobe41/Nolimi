// 01-saas/layout/function.js
// Câblage UI de l’atelier : inputs inspector, accordéons, highlights, sync col↔bague.
// API globales : setupListeners, scheduleViewRefresh, bindInspectorWheelScroll, viewport3D.
// updateBouteille / draw2D viennent du canvas (pas ici).
// Restore autosave → app/main.js (après chargement de tous les scripts).

viewport3D = document.getElementById('viewport-3d');
const view2D = document.getElementById('viewport-2d');

// --- Rafraîchissement vues (3D + 2D si visible) ---
let viewRefreshRaf = 0;

function scheduleViewRefresh() {
    if (viewRefreshRaf) return;
    viewRefreshRaf = requestAnimationFrame(function () {
        viewRefreshRaf = 0;
        if (typeof updateBouteille === 'function') updateBouteille();
        if (typeof draw2D === 'function' && view2D && !view2D.classList.contains('hidden')) draw2D();
    });
}

function bindInspectorWheelScroll() {
    var scroller = document.getElementById('inspector-scroll');
    if (!scroller || scroller.dataset.wheelScrollBound === '1') return;
    scroller.dataset.wheelScrollBound = '1';
    scroller.addEventListener('wheel', function (e) {
        var el = e.target;
        if (!el || !scroller.contains(el)) return;
        var tag = el.tagName;
        if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return;
        if (tag === 'INPUT' && (el.type === 'checkbox' || el.type === 'button' || el.type === 'file')) return;
        e.preventDefault();
        scroller.scrollTop += e.deltaY;
    }, { passive: false });
    if (typeof InspectorUISync !== 'undefined' && InspectorUISync.bindScrollSync) {
        InspectorUISync.bindScrollSync();
    }
}

function setupListeners() {
    bindInspectorWheelScroll();
    if (!window.nolimiSetupListenersDone && typeof UIControls !== 'undefined' && UIControls.syncAllRangeSliders) {
        UIControls.syncAllRangeSliders();
    }

    function getMainSectionCount() {
        var inputs = document.querySelectorAll('input[id^="s"][id$="-h"]');
        var maxIdx = 0;
        for (var i = 0; i < inputs.length; i++) {
            var m = (inputs[i].id || '').match(/^s(\d+)-h$/);
            if (!m) continue;
            var k = parseInt(m[1], 10);
            if (isFinite(k) && k > maxIdx) maxIdx = k;
        }
        return Math.max(0, maxIdx);
    }

    function getMainTopHeight() {
        var n = getMainSectionCount();
        if (!n) return 0;
        var input = document.getElementById('s' + n + '-h');
        var v = input ? parseFloat(input.value) : NaN;
        return isFinite(v) ? v : 0;
    }

    // --- Bague suit le col ---
    // Écarts fixes col → sections bague (évite les deltas cumulés pendant un drag rapide).
    var bagueHeightOffsetsFromTop = null;

    function getSortedBagueHeightInputs() {
        var inputs = document.querySelectorAll('input[id^="sb"][id$="-h"]');
        var list = [];
        for (var i = 0; i < inputs.length; i++) {
            var m = (inputs[i].id || '').match(/^sb(\d+)-h$/);
            if (!m) continue;
            var k = parseInt(m[1], 10);
            if (!isFinite(k)) continue;
            list.push({ k: k, el: inputs[i] });
        }
        list.sort(function (a, b) { return a.k - b.k; });
        return list;
    }

    function captureBagueHeightOffsetsFromTop() {
        var top = getMainTopHeight();
        var list = getSortedBagueHeightInputs();
        var offsets = [];
        for (var i = 0; i < list.length; i++) {
            var v = parseFloat(list[i].el.value);
            offsets.push(isFinite(v) ? (v - top) : 0);
        }
        bagueHeightOffsetsFromTop = offsets;
    }

    function applyBagueHeightOffsetsFromTop() {
        var list = getSortedBagueHeightInputs();
        if (!bagueHeightOffsetsFromTop || !bagueHeightOffsetsFromTop.length
            || bagueHeightOffsetsFromTop.length !== list.length) {
            captureBagueHeightOffsetsFromTop();
            return;
        }
        var top = getMainTopHeight();
        for (var i = 0; i < list.length; i++) {
            var next = top + bagueHeightOffsetsFromTop[i];
            list[i].el.value = next;
            var slider = document.getElementById(list[i].el.id + '-slider');
            if (slider) slider.value = next;
        }
    }

    captureBagueHeightOffsetsFromTop();

    // --- Liaisons corps + spline max ---
    var sectionCount = getMainSectionCount() || 5;
    const MAIN_RATTACHEMENTS = [];
    for (var si = 1; si < sectionCount; si++) {
        MAIN_RATTACHEMENTS.push({ id: 'r' + si + (si + 1), fromSection: si, toSection: si + 1 });
    }

    // Spline (Bézier quadratique, amp = |R| * 0.3) : max R avec courbe à ≥ 5 mm de l’axe.
    var SPLINE_MARGIN_AXIS_MM = 5;
    function computeSplineMaxR(p0, p1) {
        var dx = p1.x - p0.x;
        var dy = p1.y - p0.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1e-6) return 250;
        var nx = -dy / d;
        var ny = dx / d;
        var x0 = p0.x;
        var x1 = p1.x;
        var xMinAllowed = SPLINE_MARGIN_AXIS_MM;
        var low = 0;
        var high = 250;
        var steps = 24;
        for (var i = 0; i < steps; i++) {
            var R = (low + high) * 0.5;
            var amp = R * 0.3;
            var cx = (x0 + x1) * 0.5 + nx * amp;
            var minX = Math.min(x0, x1);
            var denom = 2 * cx - x0 - x1;
            if (Math.abs(denom) > 1e-9) {
                var t = (cx - x0) / denom;
                if (t > 0 && t < 1) {
                    var oneMinusT = 1 - t;
                    var xT = oneMinusT * oneMinusT * x0 + 2 * oneMinusT * t * cx + t * t * x1;
                    minX = Math.min(minX, xT);
                }
            }
            if (minX >= xMinAllowed) low = R; else high = R;
        }
        return Math.max(0, (low + high) * 0.5);
    }

    // --- Bind inputs ---
    const inputs = document.querySelectorAll('input[type=range], input[type=number], select, input[type=checkbox]');
    
    inputs.forEach(input => {
        if (input.classList.contains('gravure-y') || input.classList.contains('gravure-angle') || input.classList.contains('gravure-largeur') || input.classList.contains('gravure-profondeur')) return;
        var inputId = input.id || '';
        if (inputId.indexOf('calcule-') === 0) return;
        if (inputId.indexOf('interieur-epaisseur') === 0) return;
        if (inputId.indexOf('render-label-') === 0) return;
        if (input.dataset.nolimiInputBound === '1') return;
        input.dataset.nolimiInputBound = '1';

        const onUpdate = () => {
            const controlGroup = input.closest('.control-group');
            var id = input.id || '';
            if (controlGroup) {
                if (input.type === 'range') {
                    const num = controlGroup.querySelector('input[type=number]');
                    if (num && num !== input) num.value = input.value;
                    const valSpan = controlGroup.querySelector('.carre-niveau-value');
                    if (valSpan) valSpan.textContent = input.value + ' %';
                } else if (input.type === 'number') {
                    const rng = controlGroup.querySelector('input[type=range]');
                    if (rng && rng !== input) {
                        rng.value = input.value;
                        if (typeof UIControls !== 'undefined' && UIControls.syncRangeSlider) {
                            UIControls.syncRangeSlider(rng);
                        }
                    }
                }
            }
            if (/-L(-slider)?$/.test(id)) {
                syncCylindriqueDimensionsForCard(input.closest('.setting-card'));
            }
            if (isSplineRhoSliderDrag(id)) return;
            scheduleInputHeavyUpdate(id);
        };
        if (input.type === 'number') {
            var applyOnEnter = function () { onUpdate(); };
            if (typeof UIControls !== 'undefined' && UIControls.bindApplyOnEnter) {
                UIControls.bindApplyOnEnter(input, applyOnEnter);
            } else {
                input.addEventListener('keydown', function (e) {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    applyOnEnter();
                    input.blur();
                });
            }
        } else {
            input.addEventListener('input', onUpdate);
            if (input.type === 'range') input.addEventListener('change', onUpdate);
        }
        if (input.tagName === 'SELECT') {
            if (!/-type$/.test(inputId) && !/-forme$/.test(inputId)) {
                input.addEventListener('change', onUpdate);
            }
        }
    });

    function getSectionFormeFromCard(card) {
        if (!card) return 'cylindrique';
        const formeSelect = card.querySelector('select[id$="-forme"]');
        if (!formeSelect) return 'cylindrique';
        const value = formeSelect.value;
        return (value === 'rond' || !value) ? 'cylindrique' : value;
    }

    function syncCylindriqueDimensionsForCard(card) {
        if (!card || getSectionFormeFromCard(card) !== 'cylindrique') return;
        const lNum = card.querySelector('.js-section-L input[type="number"]');
        const pNum = card.querySelector('.js-section-P input[type="number"]');
        const pSlider = card.querySelector('.js-section-P input[type="range"]');
        if (!lNum || !pNum) return;
        pNum.value = lNum.value;
        if (pSlider) {
            pSlider.value = lNum.value;
            if (typeof UIControls !== 'undefined' && UIControls.syncRangeSlider) {
                UIControls.syncRangeSlider(pSlider);
            }
        }
    }

    function refreshOpenAccordionPanels() {
        document.querySelectorAll('.panel-controls').forEach(panel => {
            if (panel.style.maxHeight && panel.style.maxHeight !== '0px') {
                panel.style.maxHeight = panel.scrollHeight + 'px';
            }
        });
    }

    // --- Visibilité forme / carré / rho ---
    function toggleFormeDimensionsVisibility() {
        document.querySelectorAll('select[id$="-forme"]').forEach(sel => {
            if (sel.value === 'rond') sel.value = 'cylindrique';
            const card = sel.closest('.setting-card');
            if (!card) return;
            const forme = getSectionFormeFromCard(card);
            const isCylindrique = forme === 'cylindrique';
            const pGroup = card.querySelector('.js-section-P');
            const lLabel = card.querySelector('.js-section-L label');
            if (pGroup) pGroup.style.display = isCylindrique ? 'none' : 'block';
            if (lLabel) lLabel.textContent = isCylindrique ? 'Diamètre (mm)' : 'Largeur (mm)';
            if (isCylindrique) syncCylindriqueDimensionsForCard(card);
        });
        refreshOpenAccordionPanels();
    }

    function toggleCarreNiveauVisibility() {
        document.querySelectorAll('.js-carre-niveau').forEach(cg => {
            const card = cg.closest('.setting-card');
            const formeSelect = card && card.querySelector('select[id$="-forme"]');
            const isCarre = formeSelect && formeSelect.value === 'carre';
            cg.style.display = isCarre ? 'block' : 'none';
            const rng = cg.querySelector('input[type="range"]');
            const valSpan = cg.querySelector('.carre-niveau-value');
            if (rng && valSpan) valSpan.textContent = rng.value + ' %';
        });
        refreshOpenAccordionPanels();
    }
    function toggleRhoVisibility() {
        document.querySelectorAll('select[id$="-type"]').forEach(sel => {
            const card = sel.closest('.setting-card--rattachement, .setting-card--liaison');
            if (!card) return;
            const rhoGroup = card.querySelector('.js-rho-group');
            if (!rhoGroup) return;
            const numberInput = rhoGroup.querySelector('input[type="number"]');
            const rangeInput = rhoGroup.querySelector('input[type="range"]');
            const type = (sel.value || '').trim();

            if (type === 'courbeS') {
                // Courbe S : slider = rayon R0 du 1er arc ; R1 est calculé automatiquement.
                var courbeSMin = (typeof RattachementRules !== 'undefined' && RattachementRules.COURBE_S_ABS_MIN_MM != null)
                    ? RattachementRules.COURBE_S_ABS_MIN_MM
                    : 1;
                rhoGroup.style.display = 'block';
                rhoGroup.style.visibility = 'visible';
                if (rangeInput) {
                    rangeInput.style.display = 'block';
                    rangeInput.style.visibility = 'visible';
                }
                if (numberInput) {
                    numberInput.readOnly = false;
                    numberInput.min = courbeSMin;
                    numberInput.max = 400;
                }
                if (rangeInput) {
                    rangeInput.min = courbeSMin;
                    rangeInput.max = 400;
                }
            } else if (type === 'spline') {
                // Spline : curseur au milieu (0), gauche = négatif (-250), droite = positif (+250 max, ou moins si surfaces se touchent).
                rhoGroup.style.display = 'block';
                if (rangeInput) rangeInput.style.display = 'block';
                if (numberInput) numberInput.readOnly = false;
                var splineMin = -250;
                var splineMaxBase = 250;
                var rattId = sel.id ? sel.id.replace(/-type$/, '') : '';
                var cfg = MAIN_RATTACHEMENTS.find(function (c) { return c.id === rattId; });
                var splineMax = splineMaxBase;
                if (cfg) {
                    var p0 = getSectionPointForRayon(cfg.fromSection);
                    var p1 = getSectionPointForRayon(cfg.toSection);
                    var maxR = computeSplineMaxR(p0, p1);
                    splineMax = Math.min(splineMaxBase, Math.max(0, maxR));
                }
                if (numberInput) {
                    numberInput.min = splineMin;
                    numberInput.max = splineMax;
                    numberInput.step = 1;
                }
                if (rangeInput) {
                    rangeInput.min = splineMin;
                    rangeInput.max = splineMax;
                    rangeInput.step = 1;
                }
                // Clamper la valeur si hors plage (ex. après changement de sections ou ancienne valeur courbeS).
                var v = numberInput ? parseFloat(numberInput.value) : NaN;
                if (!isFinite(v) || v < splineMin) v = 0;
                else if (v > splineMax) v = splineMax;
                if (numberInput) numberInput.value = v;
                if (rangeInput) rangeInput.value = v;
            } else if (type === 'rayon') {
                // Cas rayon : pas de slider utilisateur, juste une valeur affichée (readonly).
                rhoGroup.style.display = 'block';
                if (rangeInput) rangeInput.style.display = 'none';
                if (numberInput) {
                    numberInput.readOnly = true;
                }
            } else {
                // Cas ligne (ou autres) : pas de contrôle de rayon du tout.
                rhoGroup.style.display = 'none';
            }
        });
        updateCourbeSSliderLimits();
        updateCourbeSAutoValues();
        refreshOpenAccordionPanels();
        requestAnimationFrame(refreshOpenAccordionPanels);
    }

    // --- Courbe S / rayon auto ---
    function getNumberValue(id, fallback) {
        const el = document.getElementById(id);
        if (!el) return fallback;
        const v = parseFloat(el.value);
        return isFinite(v) ? v : fallback;
    }

    function getSectionPointForRayon(sectionIndex) {
        const H = getNumberValue('s' + sectionIndex + '-h', 0);
        const L = getNumberValue('s' + sectionIndex + '-L', 0);
        const r = Math.max(0, L / 2);
        return { x: r, y: H };
    }

    function getBagueColBridgePoints() {
        var n = getMainSectionCount();
        if (!n) return null;
        var p0 = getSectionPointForRayon(n);
        var H = getNumberValue('sb1-h', p0.y + 2);
        var L = getNumberValue('sb1-L', p0.x * 2);
        var p1 = { x: Math.max(0, L / 2), y: H };
        var pPrev = n > 1 ? getSectionPointForRayon(n - 1) : null;
        var pNext = null;
        var sb2El = document.getElementById('sb2-h');
        if (sb2El) {
            pNext = {
                x: Math.max(0, getNumberValue('sb2-L', L) / 2),
                y: getNumberValue('sb2-h', H + 1)
            };
        }
        return { p0: p0, p1: p1, pPrev: pPrev, pNext: pNext };
    }

    function applyCourbeSLimitsToInputs(rattId, p0, p1, pPrev, pNext) {
        var numberInput = document.getElementById(rattId + '-rho');
        var rangeInput = document.getElementById(rattId + '-rho-slider');
        if (!numberInput) return;
        var range = getCourbeSRange(p0, p1, pPrev, pNext);
        var sliderMin = (typeof RattachementRules !== 'undefined' && RattachementRules.COURBE_S_ABS_MIN_MM != null)
            ? RattachementRules.COURBE_S_ABS_MIN_MM
            : 1;
        var sliderMax = 400;
        if (range) {
            sliderMin = range.min;
            sliderMax = range.max;
        }
        numberInput.min = sliderMin;
        numberInput.max = sliderMax;
        if (rangeInput) {
            rangeInput.min = sliderMin;
            rangeInput.max = sliderMax;
        }
        var v = parseFloat(numberInput.value);
        if (isFinite(v)) {
            if (v < sliderMin) {
                numberInput.value = sliderMin;
                if (rangeInput) rangeInput.value = sliderMin;
            } else if (v > sliderMax) {
                numberInput.value = sliderMax;
                if (rangeInput) rangeInput.value = sliderMax;
            }
        }
    }

    function getDistanceForRattachement(cfg) {
        var p0 = getSectionPointForRayon(cfg.fromSection);
        var p1 = getSectionPointForRayon(cfg.toSection);
        var dx = p1.x - p0.x;
        var dy = p1.y - p0.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Rapport ρ/d par rattachement (forme Courbe S stable quand la distance change).
    var courbeSRatios = {};

    // Mémorise ρ/d quand l’utilisateur édite le ρ en mode Courbe S.
    function storeCourbeSRatio(rattId, rho, d) {
        if (!rattId || d < 1e-6) return;
        courbeSRatios[rattId] = rho / d;
    }

    // Min / max R0 valides pour la Courbe S entre deux points.
    function getCourbeSRange(p0, p1, pPrev, pNext) {
        var dx = p1.x - p0.x;
        var dy = p1.y - p0.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1e-6) return null;
        var sliderMin = (typeof RattachementRules !== 'undefined' && RattachementRules.COURBE_S_ABS_MIN_MM != null)
            ? RattachementRules.COURBE_S_ABS_MIN_MM
            : 1;
        var sliderMax = 400;
        if (typeof RattachementMath !== 'undefined') {
            if (RattachementMath.computeCourbeSMinR0) {
                var geomMin = RattachementMath.computeCourbeSMinR0(p0, p1, pPrev || null, pNext || null);
                if (geomMin != null) sliderMin = geomMin;
            }
            if (RattachementMath.computeCourbeSMaxR0) {
                var geomMax = RattachementMath.computeCourbeSMaxR0(p0, p1, pPrev || null, pNext || null);
                if (geomMax != null && geomMax > sliderMin) sliderMax = geomMax;
            }
        }
        if (sliderMax < sliderMin) sliderMax = sliderMin;
        return { min: Math.round(sliderMin * 10) / 10, max: Math.round(sliderMax * 10) / 10 };
    }

    // Met à jour min/max du slider Courbe S selon la géométrie actuelle.
    function updateCourbeSSliderLimits() {
        MAIN_RATTACHEMENTS.forEach(function (cfg) {
            var typeSelect = document.getElementById(cfg.id + '-type');
            if (!typeSelect || typeSelect.value !== 'courbeS') return;
            var p0 = getSectionPointForRayon(cfg.fromSection);
            var p1 = getSectionPointForRayon(cfg.toSection);
            var pPrev = cfg.fromSection > 1 ? getSectionPointForRayon(cfg.fromSection - 1) : null;
            var pNext = cfg.toSection < getMainSectionCount() ? getSectionPointForRayon(cfg.toSection + 1) : null;
            applyCourbeSLimitsToInputs(cfg.id, p0, p1, pPrev, pNext);
        });
        var rb0Type = document.getElementById('rb0-type');
        if (rb0Type && rb0Type.value === 'courbeS') {
            var bridge = getBagueColBridgePoints();
            if (bridge) applyCourbeSLimitsToInputs('rb0', bridge.p0, bridge.p1, bridge.pPrev, bridge.pNext);
        }
    }

    // Sections déplacées : recalcule ρ Courbe S pour garder le même rapport ρ/d.
    function updateCourbeSRhosFromDistance() {
        MAIN_RATTACHEMENTS.forEach(function (cfg) {
            var typeSelect = document.getElementById(cfg.id + '-type');
            if (!typeSelect || typeSelect.value !== 'courbeS') return;
            var d = getDistanceForRattachement(cfg);
            if (d < 1e-6) return;
            var numberInput = document.getElementById(cfg.id + '-rho');
            var rangeInput = document.getElementById(cfg.id + '-rho-slider');
            if (!numberInput) return;
            var currentRho = parseFloat(numberInput.value);
            if (!isFinite(currentRho)) currentRho = d * 0.6;
            var ratio = courbeSRatios[cfg.id];
            if (ratio === undefined) {
                ratio = currentRho / d;
                courbeSRatios[cfg.id] = ratio;
            }
            var rhoNew = Math.round(ratio * d * 10) / 10;
            var minR = parseFloat(numberInput.min);
            var maxR = parseFloat(numberInput.max);
            if (!isFinite(minR)) minR = (typeof RattachementRules !== 'undefined' && RattachementRules.COURBE_S_ABS_MIN_MM != null)
                ? RattachementRules.COURBE_S_ABS_MIN_MM
                : 1;
            if (!isFinite(maxR)) maxR = 400;
            rhoNew = Math.max(minR, Math.min(maxR, rhoNew));
            numberInput.value = rhoNew;
            if (rangeInput) rangeInput.value = rhoNew;
        });
        var rb0Type = document.getElementById('rb0-type');
        var rb0Input = document.getElementById('rb0-rho');
        if (rb0Type && rb0Type.value === 'courbeS' && rb0Input) {
            var bridge = getBagueColBridgePoints();
            if (bridge) {
                var dxb = bridge.p1.x - bridge.p0.x;
                var dyb = bridge.p1.y - bridge.p0.y;
                var db = Math.sqrt(dxb * dxb + dyb * dyb);
                if (db >= 1e-6) {
                    var currentRhoB = parseFloat(rb0Input.value);
                    if (!isFinite(currentRhoB)) currentRhoB = db * 0.6;
                    var ratioB = courbeSRatios.rb0;
                    if (ratioB === undefined) {
                        ratioB = currentRhoB / db;
                        courbeSRatios.rb0 = ratioB;
                    }
                    var rhoNewB = Math.round(ratioB * db * 10) / 10;
                    var minRB = parseFloat(rb0Input.min);
                    var maxRB = parseFloat(rb0Input.max);
                    if (!isFinite(minRB)) minRB = 1;
                    if (!isFinite(maxRB)) maxRB = 400;
                    rhoNewB = Math.max(minRB, Math.min(maxRB, rhoNewB));
                    rb0Input.value = rhoNewB;
                    var rb0Slider = document.getElementById('rb0-rho-slider');
                    if (rb0Slider) rb0Slider.value = rhoNewB;
                }
            }
        }
    }

    // Max ρ spline (surfaces qui se touchent).
    function updateSplineMaxLimits(clampValues) {
        MAIN_RATTACHEMENTS.forEach(function (cfg) {
            var typeSelect = document.getElementById(cfg.id + '-type');
            if (!typeSelect || typeSelect.value !== 'spline') return;
            var p0 = getSectionPointForRayon(cfg.fromSection);
            var p1 = getSectionPointForRayon(cfg.toSection);
            var maxR = computeSplineMaxR(p0, p1);
            var splineMax = Math.min(250, Math.max(0, maxR));
            var numberInput = document.getElementById(cfg.id + '-rho');
            var rangeInput = document.getElementById(cfg.id + '-rho-slider');
            if (numberInput) {
                numberInput.min = -250;
                numberInput.max = splineMax;
                if (clampValues !== false) {
                    var v = parseFloat(numberInput.value);
                    if (isFinite(v) && v > splineMax) {
                        numberInput.value = splineMax;
                        if (rangeInput) rangeInput.value = splineMax;
                    }
                }
            }
            if (rangeInput) {
                rangeInput.min = -250;
                rangeInput.max = splineMax;
            }
        });
    }

    // Centre ρ (R0) sur la liaison Courbe S indiquée.
    function setCourbeSRhoToMid(rattId) {
        var p0;
        var p1;
        var pPrev;
        var pNext;
        var d;
        if (rattId === 'rb0') {
            var bridge = getBagueColBridgePoints();
            if (!bridge) return;
            p0 = bridge.p0;
            p1 = bridge.p1;
            pPrev = bridge.pPrev;
            pNext = bridge.pNext;
            var dx = p1.x - p0.x;
            var dy = p1.y - p0.y;
            d = Math.sqrt(dx * dx + dy * dy);
        } else {
            var cfg = MAIN_RATTACHEMENTS.find(function (c) { return c.id === rattId; });
            if (!cfg) return;
            p0 = getSectionPointForRayon(cfg.fromSection);
            p1 = getSectionPointForRayon(cfg.toSection);
            pPrev = cfg.fromSection > 1 ? getSectionPointForRayon(cfg.fromSection - 1) : null;
            pNext = cfg.toSection < getMainSectionCount() ? getSectionPointForRayon(cfg.toSection + 1) : null;
            d = getDistanceForRattachement(cfg);
        }
        var range = getCourbeSRange(p0, p1, pPrev, pNext);
        if (!range) return;
        var val = rattId === 'r34'
            ? Math.max(range.min, Math.min(range.max, 24))
            : Math.round(((range.min + range.max) / 2) * 10) / 10;
        var inputEl = document.getElementById(rattId + '-rho');
        var sliderEl = document.getElementById(rattId + '-rho-slider');
        if (inputEl) inputEl.value = val;
        if (sliderEl) sliderEl.value = val;
        if (d >= 1e-6) storeCourbeSRatio(rattId, val, d);
    }

    // Valeur ρ par défaut (R0 du 1er arc) en mode Courbe S.
    function updateCourbeSAutoValues() {
        MAIN_RATTACHEMENTS.forEach(function (cfg) {
            var typeSelect = document.getElementById(cfg.id + '-type');
            if (!typeSelect || typeSelect.value !== 'courbeS') return;
            var p0 = getSectionPointForRayon(cfg.fromSection);
            var p1 = getSectionPointForRayon(cfg.toSection);
            var pPrev = cfg.fromSection > 1 ? getSectionPointForRayon(cfg.fromSection - 1) : null;
            var pNext = cfg.toSection < getMainSectionCount() ? getSectionPointForRayon(cfg.toSection + 1) : null;
            var inputEl = document.getElementById(cfg.id + '-rho');
            var sliderEl = document.getElementById(cfg.id + '-rho-slider');
            if (!inputEl) return;
            var defaultR = (typeof RattachementMath !== 'undefined' && RattachementMath.computeCourbeSDefaultRho)
                ? RattachementMath.computeCourbeSDefaultRho(p0, p1, pPrev, pNext)
                : null;
            if (defaultR == null) return;
            var val = Math.round(defaultR * 10) / 10;
            var current = parseFloat(inputEl.value);
            if (!isFinite(current) || current <= 0) {
                inputEl.value = val;
                if (sliderEl) sliderEl.value = val;
                var d = getDistanceForRattachement(cfg);
                if (d >= 1e-6) storeCourbeSRatio(cfg.id, val, d);
            }
        });
    }

    function updateRayonAutoValues() {
        MAIN_RATTACHEMENTS.forEach(cfg => {
            const typeSelect = document.getElementById(cfg.id + '-type');
            if (!typeSelect || typeSelect.value !== 'rayon') return;

            const p0 = getSectionPointForRayon(cfg.fromSection);
            const p1 = getSectionPointForRayon(cfg.toSection);
            const pPrev = cfg.fromSection > 1
                ? getSectionPointForRayon(cfg.fromSection - 1)
                : null;
            const pNext = cfg.toSection < getMainSectionCount()
                ? getSectionPointForRayon(cfg.toSection + 1)
                : null;
            const card = document.getElementById(cfg.id + '-rho')?.closest('.setting-card');

            const inputEl = document.getElementById(cfg.id + '-rho');
            const sliderEl = document.getElementById(cfg.id + '-rho-slider');

            if (!inputEl) return;

            var info = (typeof RattachementMath !== 'undefined' && RattachementMath.computeRayonValidity)
                ? RattachementMath.computeRayonValidity(p0, p1, pPrev, pNext)
                : { valid: false, R: null };

            if (info.valid && info.R != null) {
                const val = Math.round(info.R * 10) / 10;
                inputEl.value = val;
                if (sliderEl) sliderEl.value = val;
                if (card) card.classList.remove('rayon-impossible');
            } else {
                inputEl.value = '';
                if (sliderEl) sliderEl.value = '';
                if (card) card.classList.add('rayon-impossible');
            }
        });
    }

    // --- Heavy update (validator + refresh) ---
    var inputHeavyRaf = 0;
    var pendingHeavyInputId = '';
    var activeRhoSliderDragId = '';

    function isRhoSliderId(id) {
        return /^(r\d+|rp\d+|rb\d+)-rho-slider$/.test(id || '');
    }

    function isSplineRhoSliderDrag(id) {
        if (!isRhoSliderId(id) || activeRhoSliderDragId !== id) return false;
        var typeSelect = document.getElementById(id.replace(/-rho-slider$/, '') + '-type');
        return typeSelect && typeSelect.value === 'spline';
    }

    function bindRhoSliderDragTracking() {
        if (window.nolimiRhoDragTrackingBound) return;
        window.nolimiRhoDragTrackingBound = true;
        document.addEventListener('pointerdown', function (e) {
            var target = e.target;
            if (!target || !target.matches || !target.matches('input[type=range][id$="-rho-slider"]')) return;
            activeRhoSliderDragId = target.id;
        }, true);
        function clearRhoSliderDrag() {
            activeRhoSliderDragId = '';
        }
        window.addEventListener('pointerup', clearRhoSliderDrag);
        window.addEventListener('pointercancel', clearRhoSliderDrag);
    }
    bindRhoSliderDragTracking();

    function scheduleInputHeavyUpdate(id) {
        if (id) pendingHeavyInputId = id;
        if (inputHeavyRaf) return;
        inputHeavyRaf = requestAnimationFrame(function () {
            inputHeavyRaf = 0;
            var heavyId = pendingHeavyInputId;
            pendingHeavyInputId = '';
            runInputHeavyUpdate(heavyId);
        });
    }

    function runInputHeavyUpdate(id) {
        var sourceEl = id ? (document.getElementById(id) || document.getElementById(id.replace(/-slider$/, ''))) : null;
        var controlGroup = sourceEl ? sourceEl.closest('.control-group') : null;
        if (typeof Validator !== 'undefined') {
            if (Validator.validateSectionHeights) {
                const match = id.match(/^s(\d+)-h(?:-slider)?$/);
                if (match) {
                    const sectionIndex = parseInt(match[1], 10);
                    const input = document.getElementById('s' + sectionIndex + '-h') || document.getElementById('s' + sectionIndex + '-h-slider');
                    const rawValue = input ? parseFloat(input.value) : NaN;
                    if (input && isFinite(rawValue)) {
                        const corrected = Validator.validateSectionHeights(sectionIndex, rawValue);
                        if (corrected !== rawValue) {
                            input.value = corrected;
                            const num = controlGroup && controlGroup.querySelector('input[type=number]');
                            const rng = controlGroup && controlGroup.querySelector('input[type=range]');
                            if (num && num !== input) num.value = corrected;
                            if (rng && rng !== input) rng.value = corrected;
                        }
                    }
                }
            }
            if (Validator.validatePiqureHeight && /^(sp\d+-h|rp3-h)(?:-slider)?$/.test(id)) {
                const pInput = document.getElementById(id.replace(/-slider$/, ''));
                const rawValue = pInput ? parseFloat(pInput.value) : NaN;
                if (pInput && isFinite(rawValue)) {
                    const corrected = Validator.validatePiqureHeight(rawValue);
                    if (corrected !== rawValue) {
                        pInput.value = corrected;
                        const slider = document.getElementById(pInput.id + '-slider');
                        if (slider) slider.value = corrected;
                    }
                }
            }
        }

        // Si on bouge le col (dernière section), la bague suit via des écarts absolus
        // (pas de delta cumulé → stable même en drag rapide).
        var isTopMainHeightEdit = false;
        var topMatch = id.match(/^s(\d+)-h(?:-slider)?$/);
        if (topMatch) {
            var editedSectionIndex = parseInt(topMatch[1], 10);
            var mainCountNow = getMainSectionCount();
            isTopMainHeightEdit = isFinite(editedSectionIndex) && editedSectionIndex === mainCountNow;
            if (isTopMainHeightEdit) {
                applyBagueHeightOffsetsFromTop();
            }
        }
        var isBagueHeightEdit = /^sb\d+-h(?:-slider)?$/.test(id || '');

        var isRhoOnlyEdit = /^(r\d+|rp\d+|rb\d+)-rho(?:-slider)?$/.test(id);
        if (typeof Validator !== 'undefined' && Validator.applyAllUserConstraints && !isRhoOnlyEdit) {
            Validator.applyAllUserConstraints();
        }
        // Mémoriser les écarts seulement quand l’utilisateur édite la bague elle-même.
        if (isBagueHeightEdit) {
            captureBagueHeightOffsetsFromTop();
        }

        if (/^s\d+-(h|L|P)(?:-slider)?$/.test(id)) {
            updateCourbeSSliderLimits();
            updateCourbeSRhosFromDistance();
            updateCourbeSAutoValues();
            updateRayonAutoValues();
            updateSplineMaxLimits(true);
        } else {
            var rhoMatch = id.match(/^(r\d+|rp\d+|rb\d+)-(?:type|rho)(?:-slider)?$/);
            if (rhoMatch) {
                if (/-type$/.test(id)) {
                    var typeSel = document.getElementById(rhoMatch[1] + '-type');
                    if (typeSel && typeSel.value === 'courbeS') {
                        updateCourbeSAutoValues();
                    }
                }
                if (/-rho(?:-slider)?$/.test(id)) {
                    var rattId = rhoMatch[1];
                    var typeSelect = document.getElementById(rattId + '-type');
                    if (typeSelect && typeSelect.value === 'courbeS') {
                        var cfg = MAIN_RATTACHEMENTS.find(function (c) { return c.id === rattId; });
                        if (cfg) {
                            var d = getDistanceForRattachement(cfg);
                            var rhoEl = document.getElementById(rattId + '-rho');
                            var rhoVal = rhoEl ? parseFloat(rhoEl.value) : NaN;
                            if (isFinite(rhoVal) && d >= 1e-6) storeCourbeSRatio(rattId, rhoVal, d);
                        }
                    }
                }
                if (!isRhoOnlyEdit) {
                    updateRayonAutoValues();
                }
                updateSplineMaxLimits(true);
            }
        }

        scheduleViewRefresh();
    }

    // --- Accordéons + highlights ---
    toggleFormeDimensionsVisibility();
    toggleCarreNiveauVisibility();
    toggleRhoVisibility();
    updateCourbeSAutoValues();
    updateRayonAutoValues();
    document.querySelectorAll('select[id$="-forme"]').forEach(sel => {
        if (sel.dataset.nolimiFormeBound === '1') return;
        sel.dataset.nolimiFormeBound = '1';
        sel.addEventListener('change', () => {
            toggleFormeDimensionsVisibility();
            toggleCarreNiveauVisibility();
            updateRayonAutoValues();
            scheduleViewRefresh();
        });
    });
    document.querySelectorAll('select[id$="-type"]').forEach(sel => {
        if (sel.dataset.nolimiTypeBound === '1') return;
        sel.dataset.nolimiTypeBound = '1';
        sel.addEventListener('change', () => {
            if (sel.value === 'spline') {
                var card = sel.closest('.setting-card');
                var rhoGroup = card && card.querySelector('.js-rho-group');
                var num = rhoGroup && rhoGroup.querySelector('input[type="number"]');
                var rng = rhoGroup && rhoGroup.querySelector('input[type="range"]');
                if (num) num.value = 0;
                if (rng) rng.value = 0;
            }
            toggleRhoVisibility();
            if (sel.value === 'courbeS') {
                var rattId = (sel.id || '').replace(/-type$/, '');
                if (rattId) setCourbeSRhoToMid(rattId);
            }
            updateRayonAutoValues();
            scheduleViewRefresh();
        });
    });
    if (typeof Validator !== 'undefined' && Validator.applyAllUserConstraints) {
        Validator.applyAllUserConstraints();
    }

    const allAccordions = document.getElementsByClassName("accordion");
    const mainAccordions = document.querySelectorAll(".accordion.main-accordion");
    const subAccordions = document.querySelectorAll(".accordion.sub-accordion");

    function accordionPanelFor(btn) {
        var card = btn.closest ? btn.closest('.setting-card') : null;
        if (card) {
            var panel = card.querySelector('.panel-controls');
            if (panel) return panel;
        }
        return btn.nextElementSibling;
    }

    function closeMainAccordions() {
        mainAccordions.forEach(btn => {
            btn.classList.remove("active");
            const panel = accordionPanelFor(btn);
            if (panel && panel.classList.contains("panel-controls")) {
                panel.style.maxHeight = "0px";
            }
        });
    }

    function closeSubAccordions() {
        subAccordions.forEach(btn => {
            btn.classList.remove("active");
            const panel = accordionPanelFor(btn);
            if (panel && panel.classList.contains("panel-controls")) {
                panel.style.maxHeight = "0px";
            }
        });
    }

    function getSectionPanelId(btn) {
        var panel = btn && btn.closest ? btn.closest('.panel-content') : null;
        return panel && panel.id ? panel.id : '';
    }

    function getSectionIndexInPanel(btn) {
        if (!btn || !btn.classList.contains('main-accordion')) return 0;
        var panel = btn.closest('.panel-content');
        if (!panel) return 0;
        var mains = panel.querySelectorAll('.accordion.main-accordion');
        for (var mi = 0; mi < mains.length; mi++) {
            if (mains[mi] === btn) return mi + 1;
        }
        return 0;
    }

    function setActiveSectionHighlight(panelId, index) {
        window.sectionHighlightActive = { panelId: panelId || '', index: index || 0 };
        window.activeSectionIndex = (panelId === 'panel-content-sections') ? (index || 0) : 0;
        if (index) {
            window.liaisonHighlightActive = { panelId: '', index: 0 };
        }
    }

    function setActiveLiaisonHighlight(panelId, index) {
        window.liaisonHighlightActive = { panelId: panelId || '', index: index || 0 };
        if (index) {
            window.sectionHighlightActive = { panelId: '', index: 0 };
            window.activeSectionIndex = 0;
        }
    }

    function setHoverSectionHighlight(panelId, index) {
        window.sectionHighlightHover = { panelId: panelId || '', index: index || 0 };
        window.hoveredSectionIndex = (panelId === 'panel-content-sections') ? (index || 0) : 0;
        clearHoverLiaisonHighlight();
    }

    function clearHoverSectionHighlight() {
        window.sectionHighlightHover = { panelId: '', index: 0 };
        window.hoveredSectionIndex = 0;
    }

    function setHoverLiaisonHighlight(panelId, index) {
        window.liaisonHighlightHover = { panelId: panelId || '', index: index || 0 };
        clearHoverSectionHighlight();
    }

    function clearHoverLiaisonHighlight() {
        window.liaisonHighlightHover = { panelId: '', index: 0 };
    }

    function getLiaisonIndexInPanel(card) {
        if (!card || !card.classList.contains('setting-card--liaison')) return 0;
        var panel = card.closest('.panel-content');
        if (!panel) return 0;
        var liaisons = panel.querySelectorAll('.setting-card--liaison');
        for (var i = 0; i < liaisons.length; i++) {
            if (liaisons[i] === card) return i + 1;
        }
        return 0;
    }

    var SECTION_HIGHLIGHT_PANELS = ['panel-content-sections', 'panel-content-piqure', 'panel-content-bague'];

    for (let i = 0; i < allAccordions.length; i++) {
        if (allAccordions[i].dataset.nolimiAccordionBound === '1') continue;
        allAccordions[i].dataset.nolimiAccordionBound = '1';
        allAccordions[i].onclick = function () {
            if (this.id === 'render-mode-title') return;
            var card = this.closest ? this.closest('.setting-card') : null;
            if (card && card.classList.contains('is-disabled')) return;
            const panel = accordionPanelFor(this);
            const isOpen = panel && panel.style.maxHeight && panel.style.maxHeight !== "0px";
            const isMain = this.classList.contains("main-accordion");
            const isSub = this.classList.contains("sub-accordion");

            if (isMain) {
                // Fermer uniquement les autres sections principales.
                closeMainAccordions();
                var panelId = getSectionPanelId(this);
                if (!isOpen) {
                    this.classList.add("active");
                    if (panel && panel.classList.contains("panel-controls")) {
                        panel.style.maxHeight = panel.scrollHeight + "px";
                    }
                    setActiveSectionHighlight(panelId, getSectionIndexInPanel(this));
                } else {
                    setActiveSectionHighlight(panelId, 0);
                }
            } else if (isSub) {
                // Fermer uniquement les autres rattachements.
                closeSubAccordions();
                var liaisonCard = card && card.classList.contains('setting-card--liaison') ? card : null;
                var subPanelId = getSectionPanelId(this);
                if (!isOpen) {
                    this.classList.add("active");
                    if (panel && panel.classList.contains("panel-controls")) {
                        panel.style.maxHeight = panel.scrollHeight + "px";
                    }
                    if (liaisonCard) {
                        setActiveLiaisonHighlight(subPanelId, getLiaisonIndexInPanel(liaisonCard));
                    }
                } else if (liaisonCard) {
                    setActiveLiaisonHighlight(subPanelId, 0);
                }
            }

            scheduleViewRefresh();
            if (typeof InspectorUISync !== 'undefined' && InspectorUISync.notifyChange) {
                InspectorUISync.notifyChange();
            }
        };
    }

    function bindSectionHoverHighlight() {
        for (var pi = 0; pi < SECTION_HIGHLIGHT_PANELS.length; pi++) {
            var panel = document.getElementById(SECTION_HIGHLIGHT_PANELS[pi]);
            if (!panel) continue;
            var cards = panel.querySelectorAll('.setting-card');
            for (var ci = 0; ci < cards.length; ci++) {
                var card = cards[ci];
                if (card.classList.contains('setting-card--liaison')) continue;
                if (card.dataset.nolimiSectionHoverBound === '1') continue;
                var btn = card.querySelector('.accordion.main-accordion');
                if (!btn) continue;
                card.dataset.nolimiSectionHoverBound = '1';
                card.addEventListener('mouseenter', function () {
                    var accordion = this.querySelector('.accordion.main-accordion');
                    if (!accordion) return;
                    setHoverSectionHighlight(getSectionPanelId(accordion), getSectionIndexInPanel(accordion));
                    scheduleViewRefresh();
                });
                card.addEventListener('mouseleave', function () {
                    clearHoverSectionHighlight();
                    scheduleViewRefresh();
                });
            }
        }
    }

    bindSectionHoverHighlight();

    function bindLiaisonHoverHighlight() {
        for (var pi = 0; pi < SECTION_HIGHLIGHT_PANELS.length; pi++) {
            var panel = document.getElementById(SECTION_HIGHLIGHT_PANELS[pi]);
            if (!panel) continue;
            var cards = panel.querySelectorAll('.setting-card--liaison');
            for (var ci = 0; ci < cards.length; ci++) {
                var card = cards[ci];
                if (card.dataset.nolimiLiaisonHoverBound === '1') continue;
                card.dataset.nolimiLiaisonHoverBound = '1';
                card.addEventListener('mouseenter', function () {
                    var accordion = this.querySelector('.accordion.sub-accordion');
                    if (!accordion) return;
                    setHoverLiaisonHighlight(getSectionPanelId(accordion), getLiaisonIndexInPanel(this));
                    scheduleViewRefresh();
                });
                card.addEventListener('mouseleave', function () {
                    clearHoverLiaisonHighlight();
                    scheduleViewRefresh();
                });
            }
        }
    }

    bindLiaisonHoverHighlight();
}

// --- Boot ---
// Restore autosave dans app/main.js (après tous les scripts).
bindInspectorWheelScroll();
if (typeof UIInspector !== 'undefined' && UIInspector.renderSections) {
    UIInspector.renderSections();
}
if (typeof RenderFeature !== 'undefined' && RenderFeature.initModeRenduControls) {
    RenderFeature.initModeRenduControls();
}
if (typeof UIControls !== 'undefined' && UIControls.syncAllRangeSliders) {
    UIControls.syncAllRangeSliders();
}
if (typeof TopbarShared !== 'undefined' && TopbarShared.init) TopbarShared.init();
if (typeof RealtimeFeature !== 'undefined' && RealtimeFeature.init) RealtimeFeature.init();
if (typeof DisplayShared !== 'undefined' && DisplayShared.init) DisplayShared.init();
if (typeof HistoryShared !== 'undefined' && HistoryShared.init) HistoryShared.init();
if (typeof UIEvents !== 'undefined' && UIEvents.init) UIEvents.init();
