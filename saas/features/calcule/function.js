// Affichage du volume total dans la vue 3D (coin bas-gauche) ou panneau Calcule (mobile).
var CalculeVolumeFeature = (function () {
    var OVERLAY_ID = 'volume-total-overlay';
    var RESULTS_PANEL_ID = 'calcule-results-display';
    var MOBILE_MQ = typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(max-width: 768px)')
        : null;
    var lastResults = null;
    var mobileLayoutListenerBound = false;
    var DEFAULT_CAPACITE_UTILE_CL = 75;
    var DEFAULT_BOUCHON_RENTRANT_ON = false;
    var DEFAULT_BOUCHON_RENTRANT_MM = 0;
    var DEFAULT_DENSITE_VERRE = 2.5;

    function getState() {
        if (typeof window === 'undefined') {
            return {
                capaciteUtileCl: DEFAULT_CAPACITE_UTILE_CL,
                bouchonRentrantOn: DEFAULT_BOUCHON_RENTRANT_ON,
                bouchonRentrantMm: DEFAULT_BOUCHON_RENTRANT_MM,
                densiteVerre: DEFAULT_DENSITE_VERRE
            };
        }
        if (!window.calculeState) {
            window.calculeState = {
                capaciteUtileCl: DEFAULT_CAPACITE_UTILE_CL,
                bouchonRentrantOn: DEFAULT_BOUCHON_RENTRANT_ON,
                bouchonRentrantMm: DEFAULT_BOUCHON_RENTRANT_MM,
                densiteVerre: DEFAULT_DENSITE_VERRE
            };
        }
        return window.calculeState;
    }

    function clampCapaciteUtileCl(v) {
        if (!isFinite(v)) return DEFAULT_CAPACITE_UTILE_CL;
        return Math.round(Math.max(10, Math.min(600, v)));
    }

    function formatVolume(volumeMm3) {
        var cl = volumeMm3 / 10000;
        return cl.toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function clampBouchonRentrantMm(v) {
        if (!isFinite(v)) return DEFAULT_BOUCHON_RENTRANT_MM;
        return Math.round(Math.max(0, Math.min(70, v)));
    }

    function clampDensiteVerre(v) {
        if (!isFinite(v)) return DEFAULT_DENSITE_VERRE;
        return Math.max(2.30, Math.min(2.60, v));
    }

    function isMobileLayout() {
        return !!(MOBILE_MQ && MOBILE_MQ.matches);
    }

    function bindMobileLayoutListener() {
        if (mobileLayoutListenerBound || !MOBILE_MQ) return;
        mobileLayoutListenerBound = true;
        var onLayoutChange = function () {
            updateOverlayDisplay();
            updateResultsPanel();
        };
        if (typeof MOBILE_MQ.addEventListener === 'function') {
            MOBILE_MQ.addEventListener('change', onLayoutChange);
        } else if (typeof MOBILE_MQ.addListener === 'function') {
            MOBILE_MQ.addListener(onLayoutChange);
        }
    }

    function getResultsText(results) {
        if (!results || !results.available) {
            return 'Volume total: calcul indisponible';
        }
        return 'Capacite ras bord: ' + formatVolume(results.volumeMm3) + ' cl'
            + '\nDegarnie: ' + results.degarnieMm.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mm'
            + '\nChambre d expansion: ' + results.chamberPct.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %'
            + '\nØ brochage: ' + results.canuleMm.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mm'
            + '\nPoids verre: ' + results.poidsVerreG.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' g';
    }

    function updateResultsPanel() {
        if (typeof document === 'undefined') return;
        var panel = document.getElementById(RESULTS_PANEL_ID);
        if (!panel) return;
        panel.textContent = getResultsText(lastResults);
    }

    function updateOverlayDisplay() {
        var el = ensureOverlay();
        if (!el) return;
        if (isMobileLayout()) {
            el.textContent = '';
            return;
        }
        el.textContent = getResultsText(lastResults);
    }

    function ensureOverlay() {
        if (typeof document === 'undefined') return null;
        var viewport = document.getElementById('viewport-3d');
        if (!viewport) return null;
        var el = document.getElementById(OVERLAY_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = OVERLAY_ID;
            el.className = 'volume-total-overlay';
            viewport.appendChild(el);
        }
        return el;
    }

    function computeFromSectionsData(sectionsData) {
        if (typeof CalculeVolumeMath === 'undefined' || !CalculeVolumeMath.computeTotalInteriorVolumeMm3) {
            return { available: false };
        }
        var volumeMm3 = CalculeVolumeMath.computeTotalInteriorVolumeMm3(sectionsData || {});
        var outerMm3 = CalculeVolumeMath.computeTotalOuterVolumeMm3
            ? CalculeVolumeMath.computeTotalOuterVolumeMm3(sectionsData || {})
            : volumeMm3;
        var rasBordCl = volumeMm3 / 10000;
        var capaciteUtileCl = Math.min(rasBordCl, clampCapaciteUtileCl(getState().capaciteUtileCl));
        var degarnieMmBrut = CalculeVolumeMath.computeDegarnieMmFromUsefulCapacityCl
            ? CalculeVolumeMath.computeDegarnieMmFromUsefulCapacityCl(sectionsData || {}, capaciteUtileCl)
            : 0;
        var st = getState();
        var bouchonMm = (st.bouchonRentrantOn ? clampBouchonRentrantMm(st.bouchonRentrantMm) : 0);
        var degarnieMm = degarnieMmBrut;
        var chamberClRaw = Math.max(0, rasBordCl - capaciteUtileCl);
        var chamberFactor = degarnieMmBrut > 1e-9
            ? Math.max(0, (degarnieMmBrut - bouchonMm) / degarnieMmBrut)
            : 0;
        var chamberCl = chamberClRaw * chamberFactor;
        var chamberPct = rasBordCl > 1e-9 ? (chamberCl / rasBordCl) * 100 : 0;
        var canuleMm = CalculeVolumeMath.computeCanuleDiameterMm
            ? CalculeVolumeMath.computeCanuleDiameterMm()
            : 0;
        var densite = clampDensiteVerre(st.densiteVerre);
        var volumeVerreMm3 = Math.max(0, outerMm3 - volumeMm3);
        var poidsVerreG = (volumeVerreMm3 / 1000) * densite;
        return {
            available: true,
            volumeMm3: volumeMm3,
            rasBordCl: rasBordCl,
            capaciteUtileCl: capaciteUtileCl,
            degarnieMm: degarnieMm,
            chamberPct: chamberPct,
            canuleMm: canuleMm,
            poidsVerreG: poidsVerreG
        };
    }

    function updateFromSectionsData(sectionsData) {
        lastResults = computeFromSectionsData(sectionsData);
        updateOverlayDisplay();
        if (isMobileLayout()) updateResultsPanel();
        if (typeof draw2D === 'function') draw2D();
    }

    function getResults() {
        return lastResults;
    }

    function renderPanel() {
        if (typeof document === 'undefined') return;
        var container = document.getElementById('panel-content-calcule');
        if (!container) return;
        var st = getState();
        container.innerHTML = ''
            + '<div class="setting-card">'
            + '  <div style="padding: 8px 12px; font-size: 0.85rem; font-weight: bold;">Volume</div>'
            + '  <div class="panel-controls" style="max-height: none; overflow: visible; padding-bottom: 8px;">'
            + '    <div class="control-group">'
            + '      <div class="label-row"><label>Capacite utile</label><div class="input-wrapper"><input type="number" id="calcule-capacite-utile-cl" value="' + clampCapaciteUtileCl(st.capaciteUtileCl) + '" min="10" max="600" step="1"><span class="unit">cl</span></div></div>'
            + '      <input type="range" id="calcule-capacite-utile-cl-slider" min="10" max="600" step="1" value="' + clampCapaciteUtileCl(st.capaciteUtileCl) + '">'
            + '    </div>'
            + '    <div class="control-group">'
            + '      <div class="checkbox-row"><input type="checkbox" id="calcule-bouchon-rentrant-on" ' + (st.bouchonRentrantOn ? 'checked' : '') + '><label for="calcule-bouchon-rentrant-on">bouchon rentrant</label></div>'
            + '    </div>'
            + '    <div class="control-group" id="calcule-bouchon-rentrant-group" style="' + (st.bouchonRentrantOn ? '' : 'display:none;') + '">'
            + '      <div class="label-row"><label>Bouchon rentrant</label><div class="input-wrapper"><input type="number" id="calcule-bouchon-rentrant-mm" value="' + clampBouchonRentrantMm(st.bouchonRentrantMm) + '" min="0" max="70" step="1"><span class="unit">mm</span></div></div>'
            + '      <input type="range" id="calcule-bouchon-rentrant-mm-slider" min="0" max="70" step="1" value="' + clampBouchonRentrantMm(st.bouchonRentrantMm) + '">'
            + '    </div>'
            + '    <div class="control-group">'
            + '      <div class="label-row"><label>Densite du verre</label><div class="input-wrapper"><input type="number" id="calcule-densite-verre" value="' + clampDensiteVerre(st.densiteVerre).toFixed(2) + '" min="2.30" max="2.60" step="0.01"><span class="unit">g/cm3</span></div></div>'
            + '      <input type="range" id="calcule-densite-verre-slider" min="2.30" max="2.60" step="0.01" value="' + clampDensiteVerre(st.densiteVerre).toFixed(2) + '">'
            + '    </div>'
            + '  </div>'
            + '</div>'
            + '<div id="' + RESULTS_PANEL_ID + '" class="calcule-results-display" aria-live="polite"></div>';

        var num = document.getElementById('calcule-capacite-utile-cl');
        var rng = document.getElementById('calcule-capacite-utile-cl-slider');
        function applyCapaciteUtile(v) {
            var s = getState();
            s.capaciteUtileCl = clampCapaciteUtileCl(v);
            if (num) num.value = s.capaciteUtileCl;
            if (rng) rng.value = s.capaciteUtileCl;
            if (typeof updateBouteille === 'function') updateBouteille();
        }
        function bindCalculeNum(el, applyFn) {
            if (!el) return;
            if (typeof UIControls !== 'undefined' && UIControls.bindApplyOnEnter) {
                UIControls.bindApplyOnEnter(el, function () { applyFn(parseFloat(el.value)); });
            } else {
                el.addEventListener('keydown', function (e) {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    applyFn(parseFloat(el.value));
                    el.blur();
                });
            }
        }
        if (num && rng) {
            bindCalculeNum(num, applyCapaciteUtile);
            rng.addEventListener('input', function () { applyCapaciteUtile(parseFloat(rng.value)); });
        }

        var cb = document.getElementById('calcule-bouchon-rentrant-on');
        var group = document.getElementById('calcule-bouchon-rentrant-group');
        var brNum = document.getElementById('calcule-bouchon-rentrant-mm');
        var brRng = document.getElementById('calcule-bouchon-rentrant-mm-slider');
        if (cb && group) {
            cb.addEventListener('change', function () {
                var s = getState();
                s.bouchonRentrantOn = !!cb.checked;
                group.style.display = s.bouchonRentrantOn ? '' : 'none';
                if (typeof updateBouteille === 'function') updateBouteille();
            });
        }
        function applyBouchon(v) {
            var s = getState();
            s.bouchonRentrantMm = clampBouchonRentrantMm(v);
            if (brNum) brNum.value = s.bouchonRentrantMm;
            if (brRng) brRng.value = s.bouchonRentrantMm;
            if (typeof updateBouteille === 'function') updateBouteille();
        }
        if (brNum && brRng) {
            bindCalculeNum(brNum, applyBouchon);
            brRng.addEventListener('input', function () { applyBouchon(parseFloat(brRng.value)); });
        }

        var dNum = document.getElementById('calcule-densite-verre');
        var dRng = document.getElementById('calcule-densite-verre-slider');
        function applyDensite(v) {
            var s = getState();
            s.densiteVerre = clampDensiteVerre(v);
            if (dNum) dNum.value = s.densiteVerre.toFixed(2);
            if (dRng) dRng.value = s.densiteVerre.toFixed(2);
            if (typeof updateBouteille === 'function') updateBouteille();
        }
        if (dNum && dRng) {
            bindCalculeNum(dNum, applyDensite);
            dRng.addEventListener('input', function () { applyDensite(parseFloat(dRng.value)); });
        }

        updateResultsPanel();
        updateOverlayDisplay();
        bindMobileLayoutListener();
    }

    return {
        updateFromSectionsData: updateFromSectionsData,
        getResults: getResults,
        renderPanel: renderPanel
    };
})();
