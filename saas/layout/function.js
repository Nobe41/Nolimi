viewport3D = document.getElementById('viewport-3d');
const view2D = document.getElementById('viewport-2d');

// ==========================================
// GESTION DES INPUTS ET ACCORDEONS
// ==========================================

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

    function shiftBagueHeights(delta) {
        if (!isFinite(delta) || Math.abs(delta) < 1e-9) return;
        var bagueInputs = document.querySelectorAll('input[id^="sb"][id$="-h"]');
        for (var i = 0; i < bagueInputs.length; i++) {
            var input = bagueInputs[i];
            var v = parseFloat(input.value);
            if (!isFinite(v)) continue;
            // Appliquer le décalage brut à toutes les sections pour conserver la forme,
            // puis laisser Validator recaler les bornes une fois l'ensemble déplacé.
            var next = v + delta;
            input.value = next;
            var slider = document.getElementById(input.id + '-slider');
            if (slider) slider.value = next;
        }
    }

    var lastMainTopHeight = getMainTopHeight();

    var sectionCount = getMainSectionCount() || 5;
    const MAIN_RATTACHEMENTS = [];
    for (var si = 1; si < sectionCount; si++) {
        MAIN_RATTACHEMENTS.push({ id: 'r' + si + (si + 1), fromSection: si, toSection: si + 1 });
    }

    /** Pour la spline (Bézier quadratique, amp = R * 0.3), retourne le max R dans [0, 250] tel que la courbe reste à au moins 10 mm de l'axe (x >= 10). */
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
        // Réouvrir la hauteur du panneau dépliant pour afficher le slider si visible
        document.querySelectorAll('.panel-controls').forEach(panel => {
            if (panel.style.maxHeight && panel.style.maxHeight !== '0px') {
                panel.style.maxHeight = panel.scrollHeight + 'px';
            }
        });
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
                var courbeSMin = 5;
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
                }
                if (rangeInput) {
                    rangeInput.min = splineMin;
                    rangeInput.max = splineMax;
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
        // Recalculer la hauteur des panneaux ouverts pour que le groupe Rayon (ex. Courbe S) ne soit pas coupé.
        document.querySelectorAll('.panel-controls').forEach(panel => {
            if (panel.style.maxHeight && panel.style.maxHeight !== '0px') {
                panel.style.maxHeight = panel.scrollHeight + 'px';
            }
        });
        requestAnimationFrame(function () {
            document.querySelectorAll('.panel-controls').forEach(panel => {
                if (panel.style.maxHeight && panel.style.maxHeight !== '0px') {
                    panel.style.maxHeight = panel.scrollHeight + 'px';
                }
            });
        });
    }
    // --- Mise à jour auto des valeurs de rayon (mode "rayon") sur le corps principal ---
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

    function getDistanceForRattachement(cfg) {
        var p0 = getSectionPointForRayon(cfg.fromSection);
        var p1 = getSectionPointForRayon(cfg.toSection);
        var dx = p1.x - p0.x;
        var dy = p1.y - p0.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /** Rapport ρ/d stocké par rattachement pour maintenir la forme de la Courbe S quand la distance change. */
    var courbeSRatios = {};

    /** Quand l'utilisateur change le ρ en mode Courbe S, on enregistre le rapport ρ/d pour mise à jour ultérieure. */
    function storeCourbeSRatio(rattId, rho, d) {
        if (!rattId || d < 1e-6) return;
        courbeSRatios[rattId] = rho / d;
    }

    /** Calcule le min et max R0 valides pour la Courbe S entre deux points. */
    function getCourbeSRange(p0, p1, pPrev, pNext) {
        var dx = p1.x - p0.x;
        var dy = p1.y - p0.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1e-6) return null;
        var sliderMin = 5;
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

    /** Met à jour les min/max du slider Courbe S pour qu'ils correspondent à la plage valide (géométrie actuelle). */
    function updateCourbeSSliderLimits() {
        MAIN_RATTACHEMENTS.forEach(function (cfg) {
            var typeSelect = document.getElementById(cfg.id + '-type');
            if (!typeSelect || typeSelect.value !== 'courbeS') return;
            var p0 = getSectionPointForRayon(cfg.fromSection);
            var p1 = getSectionPointForRayon(cfg.toSection);
            var pPrev = cfg.fromSection > 1 ? getSectionPointForRayon(cfg.fromSection - 1) : null;
            var pNext = cfg.toSection < getMainSectionCount() ? getSectionPointForRayon(cfg.toSection + 1) : null;
            var range = getCourbeSRange(p0, p1, pPrev, pNext);
            var numberInput = document.getElementById(cfg.id + '-rho');
            var rangeInput = document.getElementById(cfg.id + '-rho-slider');
            if (!numberInput) return;
            var sliderMin = 5;
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
        });
    }

    /** Quand les sections bougent, mettre à jour les ρ en Courbe S pour garder le même rapport ρ/d (même forme de courbe). */
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
            if (!isFinite(minR)) minR = 5;
            if (!isFinite(maxR)) maxR = 400;
            rhoNew = Math.max(minR, Math.min(maxR, rhoNew));
            numberInput.value = rhoNew;
            if (rangeInput) rangeInput.value = rhoNew;
        });
    }

    /** Met à jour le max du slider ρ pour les rattachements en mode spline (limite quand les surfaces se touchent). */
    function updateSplineMaxLimits() {
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
                var v = parseFloat(numberInput.value);
                if (isFinite(v) && v > splineMax) {
                    numberInput.value = splineMax;
                    if (rangeInput) rangeInput.value = splineMax;
                }
            }
            if (rangeInput) {
                rangeInput.min = -250;
                rangeInput.max = splineMax;
            }
        });
    }

    /** Centre le ρ (R0) sur la liaison Courbe S indiquée. */
    function setCourbeSRhoToMid(rattId) {
        var cfg = MAIN_RATTACHEMENTS.find(function (c) { return c.id === rattId; });
        if (!cfg) return;
        var p0 = getSectionPointForRayon(cfg.fromSection);
        var p1 = getSectionPointForRayon(cfg.toSection);
        var pPrev = cfg.fromSection > 1 ? getSectionPointForRayon(cfg.fromSection - 1) : null;
        var pNext = cfg.toSection < getMainSectionCount() ? getSectionPointForRayon(cfg.toSection + 1) : null;
        var range = getCourbeSRange(p0, p1, pPrev, pNext);
        if (!range) return;
        var val = rattId === 'r34'
            ? Math.max(range.min, Math.min(range.max, 24))
            : Math.round(((range.min + range.max) / 2) * 10) / 10;
        var inputEl = document.getElementById(rattId + '-rho');
        var sliderEl = document.getElementById(rattId + '-rho-slider');
        if (inputEl) inputEl.value = val;
        if (sliderEl) sliderEl.value = val;
        var d = getDistanceForRattachement(cfg);
        if (d >= 1e-6) storeCourbeSRatio(rattId, val, d);
    }

    /** Met à jour le ρ affiché (R0 du 1er arc) pour les rattachements en mode Courbe S. */
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

    var inputHeavyRaf = 0;
    var pendingHeavyInputId = '';

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

        var isTopMainHeightEdit = false;
        var topMatch = id.match(/^s(\d+)-h(?:-slider)?$/);
        if (topMatch) {
            var editedSectionIndex = parseInt(topMatch[1], 10);
            var mainCountNow = getMainSectionCount();
            isTopMainHeightEdit = isFinite(editedSectionIndex) && editedSectionIndex === mainCountNow;
            if (isTopMainHeightEdit) {
                var currentTop = getMainTopHeight();
                var deltaTop = currentTop - lastMainTopHeight;
                shiftBagueHeights(deltaTop);
            }
        }

        if (typeof Validator !== 'undefined' && Validator.applyAllUserConstraints) {
            Validator.applyAllUserConstraints();
        }
        if (isTopMainHeightEdit) {
            lastMainTopHeight = getMainTopHeight();
        }

        if (/^s\d+-(h|L|P)(?:-slider)?$/.test(id)) {
            updateCourbeSSliderLimits();
            updateCourbeSRhosFromDistance();
            updateCourbeSAutoValues();
            updateRayonAutoValues();
            updateSplineMaxLimits();
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
                updateRayonAutoValues();
                updateSplineMaxLimits();
            }
        }

        scheduleViewRefresh();
    }

    toggleCarreNiveauVisibility();
    toggleRhoVisibility();
    updateCourbeSAutoValues();
    updateRayonAutoValues();
    document.querySelectorAll('select[id$="-forme"]').forEach(sel => {
        if (sel.dataset.nolimiFormeBound === '1') return;
        sel.dataset.nolimiFormeBound = '1';
        sel.addEventListener('change', () => {
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

    function getMainAccordionIndex(btn) {
        if (!btn.classList.contains("main-accordion")) return 0;
        for (let i = 0; i < mainAccordions.length; i++) {
            if (mainAccordions[i] === btn) return i + 1;
        }
        return 0;
    }

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
                if (!isOpen) {
                    this.classList.add("active");
                    if (panel && panel.classList.contains("panel-controls")) {
                        panel.style.maxHeight = panel.scrollHeight + "px";
                    }
                    const sectionIndex = getMainAccordionIndex(this);
                    window.activeSectionIndex = sectionIndex;
                } else {
                    window.activeSectionIndex = 0;
                }
            } else if (isSub) {
                // Fermer uniquement les autres rattachements.
                closeSubAccordions();
                if (!isOpen) {
                    this.classList.add("active");
                    if (panel && panel.classList.contains("panel-controls")) {
                        panel.style.maxHeight = panel.scrollHeight + "px";
                    }
                }
            }

            scheduleViewRefresh();
            if (typeof InspectorUISync !== 'undefined' && InspectorUISync.notifyChange) {
                InspectorUISync.notifyChange();
            }
        };
    }
}

bindInspectorWheelScroll();
if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.prepareRestoreFromStorage) {
    WorkspaceAutosave.prepareRestoreFromStorage();
}
if (typeof UIInspector !== 'undefined' && UIInspector.renderSections) {
    UIInspector.renderSections();
}
if (typeof RenderFeature !== 'undefined' && RenderFeature.initModeRenduControls) {
    RenderFeature.initModeRenduControls();
}
if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.applyRestoredValues) {
    WorkspaceAutosave.applyRestoredValues();
}
if (typeof UIControls !== 'undefined' && UIControls.syncAllRangeSliders) {
    UIControls.syncAllRangeSliders();
}
if (typeof TopbarShared !== 'undefined' && TopbarShared.init) TopbarShared.init();
if (typeof RealtimeFeature !== 'undefined' && RealtimeFeature.init) RealtimeFeature.init();
if (typeof DisplayShared !== 'undefined' && DisplayShared.init) DisplayShared.init();
if (typeof HistoryShared !== 'undefined' && HistoryShared.init) HistoryShared.init();
if (typeof UIEvents !== 'undefined' && UIEvents.init) UIEvents.init();
