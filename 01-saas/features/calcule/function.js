// calcule/function.js — panneau « Volume » et overlay 3D des résultats.
// Rôle : état utilisateur (capacité, bouchon, densité), formatage et affichage.
// Calculs → CalculeVolumeMath (math.js). Constantes → CalculeRules (rules.js).

var CalculeVolumeFeature = (function () {
    var R = typeof CalculeRules !== 'undefined' ? CalculeRules : {};
    var MOBILE_MQ = typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia(R.MOBILE_MQ || '(max-width: 768px)')
        : null;
    var lastResults = null;
    var lastSectionsData = null;
    var mobileLayoutListenerBound = false;

    function id(key, fallback) {
        return (R.IDS && R.IDS[key]) || fallback;
    }

    // État global window.calculeState : capacité utile, bouchon rentrant, densité verre.
    function getState() {
        if (typeof window === 'undefined') {
            return {
                capaciteUtileCl: R.DEFAULT_CAPACITE_UTILE_CL || 75,
                bouchonRentrantOn: !!R.DEFAULT_BOUCHON_RENTRANT_ON,
                bouchonRentrantMm: R.DEFAULT_BOUCHON_RENTRANT_MM || 0,
                densiteVerre: R.DEFAULT_DENSITE_VERRE || 2.5
            };
        }
        if (!window.calculeState) {
            window.calculeState = {
                capaciteUtileCl: R.DEFAULT_CAPACITE_UTILE_CL || 75,
                bouchonRentrantOn: !!R.DEFAULT_BOUCHON_RENTRANT_ON,
                bouchonRentrantMm: R.DEFAULT_BOUCHON_RENTRANT_MM || 0,
                densiteVerre: R.DEFAULT_DENSITE_VERRE || 2.5
            };
        }
        return window.calculeState;
    }

    function clampCapaciteUtileCl(v) {
        var lo = R.CAPACITE_UTILE_CL_MIN != null ? R.CAPACITE_UTILE_CL_MIN : 10;
        var hi = R.CAPACITE_UTILE_CL_MAX != null ? R.CAPACITE_UTILE_CL_MAX : 600;
        var def = R.DEFAULT_CAPACITE_UTILE_CL != null ? R.DEFAULT_CAPACITE_UTILE_CL : 75;
        if (!isFinite(v)) return def;
        return Math.round(Math.max(lo, Math.min(hi, v)));
    }

    function clampBouchonRentrantMm(v) {
        var hi = R.BOUCHON_RENTRANT_MM_MAX != null ? R.BOUCHON_RENTRANT_MM_MAX : 70;
        var def = R.DEFAULT_BOUCHON_RENTRANT_MM != null ? R.DEFAULT_BOUCHON_RENTRANT_MM : 0;
        if (!isFinite(v)) return def;
        return Math.round(Math.max(0, Math.min(hi, v)));
    }

    function clampDensiteVerre(v) {
        var lo = R.DENSITE_VERRE_MIN != null ? R.DENSITE_VERRE_MIN : 2.30;
        var hi = R.DENSITE_VERRE_MAX != null ? R.DENSITE_VERRE_MAX : 2.60;
        var def = R.DEFAULT_DENSITE_VERRE != null ? R.DEFAULT_DENSITE_VERRE : 2.5;
        if (!isFinite(v)) return def;
        return Math.max(lo, Math.min(hi, v));
    }

    function mm3PerCl() {
        return R.MM3_PER_CL || 10000;
    }

    function formatVolumeCl(volumeMm3) {
        return (volumeMm3 / mm3PerCl()).toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
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
        return 'Capacite ras bord: ' + formatVolumeCl(results.volumeMm3) + ' cl'
            + '\nNiveau utile: ' + results.degarnieMm.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mm'
            + '\nChambre d expansion: ' + results.chamberPct.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %'
            + '\nØ brochage: ' + results.canuleMm.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mm'
            + '\nPoids verre: ' + results.poidsVerreG.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' g';
    }

    function updateResultsPanel() {
        if (typeof document === 'undefined') return;
        var panel = document.getElementById(id('resultsPanel', 'calcule-results-display'));
        if (!panel) return;
        panel.textContent = getResultsText(lastResults);
    }

    function ensureOverlay() {
        if (typeof document === 'undefined') return null;
        var viewport = document.getElementById(id('viewport3d', 'viewport-3d'));
        if (!viewport) return null;
        var overlayId = id('overlay', 'volume-total-overlay');
        var el = document.getElementById(overlayId);
        if (!el) {
            el = document.createElement('div');
            el.id = overlayId;
            el.className = 'volume-total-overlay';
            viewport.appendChild(el);
        }
        return el;
    }

    // Overlay fixe sur viewport-3d (desktop) ; vide sur mobile (résultats dans le panneau).
    function updateOverlayDisplay() {
        var el = ensureOverlay();
        if (!el) return;
        el.textContent = isMobileLayout() ? '' : getResultsText(lastResults);
    }

    // Agrège tous les résultats : ras bord, niveau utile, chambre d'expansion, poids verre (g).
    function computeFromSectionsData(sectionsData) {
        if (typeof CalculeVolumeMath === 'undefined' || !CalculeVolumeMath.computeTotalInteriorVolumeMm3) {
            return { available: false };
        }
        var data = sectionsData || {};
        var volumeMm3 = CalculeVolumeMath.computeTotalInteriorVolumeMm3(data);
        var outerMm3 = CalculeVolumeMath.computeTotalOuterVolumeMm3
            ? CalculeVolumeMath.computeTotalOuterVolumeMm3(data)
            : volumeMm3;
        var rasBordCl = volumeMm3 / mm3PerCl();
        var st = getState();
        var capaciteUtileCl = Math.min(rasBordCl, clampCapaciteUtileCl(st.capaciteUtileCl));
        // Niveau utile (mm) = hauteur du haut de bague jusqu'au niveau liquide
        // (volume intérieur, parois prises en compte). Le bouchon n'entre pas ici.
        var niveauUtileMm = CalculeVolumeMath.computeDegarnieMmFromUsefulCapacityCl
            ? CalculeVolumeMath.computeDegarnieMmFromUsefulCapacityCl(data, capaciteUtileCl)
            : 0;
        var bouchonMm = st.bouchonRentrantOn ? clampBouchonRentrantMm(st.bouchonRentrantMm) : 0;
        var chamberPct = CalculeVolumeMath.computeExpansionChamberPct
            ? CalculeVolumeMath.computeExpansionChamberPct(data, capaciteUtileCl, bouchonMm)
            : 0;
        var canuleMm = CalculeVolumeMath.computeCanuleDiameterMm
            ? CalculeVolumeMath.computeCanuleDiameterMm()
            : 0;
        var densite = clampDensiteVerre(st.densiteVerre);
        // Poids verre = (volume extérieur − volume intérieur) × densité
        var volumeVerreMm3 = Math.max(0, outerMm3 - volumeMm3);
        var poidsVerreG = (volumeVerreMm3 / 1000) * densite;
        return {
            available: true,
            volumeMm3: volumeMm3,
            rasBordCl: rasBordCl,
            capaciteUtileCl: capaciteUtileCl,
            degarnieMm: Math.max(0, niveauUtileMm),
            chamberPct: chamberPct,
            canuleMm: canuleMm,
            poidsVerreG: poidsVerreG
        };
    }

    // Point d'entrée appelé quand les sections changent : recalcule et rafraîchit l'affichage.
    function updateFromSectionsData(sectionsData) {
        if (sectionsData) lastSectionsData = sectionsData;
        lastResults = computeFromSectionsData(lastSectionsData || sectionsData || {});
        updateOverlayDisplay();
        updateResultsPanel();
        if (typeof draw2D === 'function') draw2D();
    }

    function getResults() {
        return lastResults;
    }

    // Recalcule à partir des dernières sections (densité / capacité / bouchon)
    // sans reconstruire la 3D — obligatoire car updateBouteille court-circuite si géométrie inchangée.
    function recompute() {
        if (lastSectionsData) {
            updateFromSectionsData(lastSectionsData);
            return;
        }
        if (typeof updateBouteille === 'function') updateBouteille();
    }

    function bindCalculeNum(el, applyFn) {
        if (!el) return;
        if (typeof UIControls !== 'undefined' && UIControls.bindApplyOnEnter) {
            UIControls.bindApplyOnEnter(el, function () { applyFn(parseFloat(el.value)); });
            return;
        }
        el.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            applyFn(parseFloat(el.value));
            el.blur();
        });
    }

    // Construit le panneau latéral (sliders capacité, bouchon, densité) et lie les événements.
    function renderPanel() {
        if (typeof document === 'undefined') return;
        var container = document.getElementById(id('panel', 'panel-content-calcule'));
        if (!container) return;
        var st = getState();
        var cap = clampCapaciteUtileCl(st.capaciteUtileCl);
        var br = clampBouchonRentrantMm(st.bouchonRentrantMm);
        var dens = clampDensiteVerre(st.densiteVerre);
        var capMin = R.CAPACITE_UTILE_CL_MIN != null ? R.CAPACITE_UTILE_CL_MIN : 10;
        var capMax = R.CAPACITE_UTILE_CL_MAX != null ? R.CAPACITE_UTILE_CL_MAX : 600;
        var brMax = R.BOUCHON_RENTRANT_MM_MAX != null ? R.BOUCHON_RENTRANT_MM_MAX : 70;
        var dMin = R.DENSITE_VERRE_MIN != null ? R.DENSITE_VERRE_MIN : 2.30;
        var dMax = R.DENSITE_VERRE_MAX != null ? R.DENSITE_VERRE_MAX : 2.60;
        var resultsId = id('resultsPanel', 'calcule-results-display');

        container.innerHTML = ''
            + '<div class="setting-card">'
            + '  <div style="padding: 8px 12px; font-size: 0.85rem; font-weight: bold;">Volume</div>'
            + '  <div class="panel-controls" style="max-height: none; overflow: visible; padding-bottom: 8px;">'
            + '    <div class="control-group">'
            + '      <div class="label-row"><label>Capacite utile</label><div class="input-wrapper"><input type="number" id="' + id('capaciteUtileCl', 'calcule-capacite-utile-cl') + '" value="' + cap + '" min="' + capMin + '" max="' + capMax + '" step="1"><span class="unit">cl</span></div></div>'
            + '      <input type="range" id="' + id('capaciteUtileClSlider', 'calcule-capacite-utile-cl-slider') + '" min="' + capMin + '" max="' + capMax + '" step="1" value="' + cap + '">'
            + '    </div>'
            + '    <div class="control-group">'
            + '      <div class="checkbox-row"><input type="checkbox" id="' + id('bouchonOn', 'calcule-bouchon-rentrant-on') + '" ' + (st.bouchonRentrantOn ? 'checked' : '') + '><label for="' + id('bouchonOn', 'calcule-bouchon-rentrant-on') + '">bouchon rentrant</label></div>'
            + '    </div>'
            + '    <div class="control-group" id="' + id('bouchonGroup', 'calcule-bouchon-rentrant-group') + '" style="' + (st.bouchonRentrantOn ? '' : 'display:none;') + '">'
            + '      <div class="label-row"><label>Bouchon rentrant</label><div class="input-wrapper"><input type="number" id="' + id('bouchonMm', 'calcule-bouchon-rentrant-mm') + '" value="' + br + '" min="0" max="' + brMax + '" step="1"><span class="unit">mm</span></div></div>'
            + '      <input type="range" id="' + id('bouchonMmSlider', 'calcule-bouchon-rentrant-mm-slider') + '" min="0" max="' + brMax + '" step="1" value="' + br + '">'
            + '    </div>'
            + '    <div class="control-group">'
            + '      <div class="label-row"><label>Densite du verre</label><div class="input-wrapper"><input type="number" id="' + id('densite', 'calcule-densite-verre') + '" value="' + dens.toFixed(2) + '" min="' + dMin + '" max="' + dMax + '" step="0.01"><span class="unit">g/cm3</span></div></div>'
            + '      <input type="range" id="' + id('densiteSlider', 'calcule-densite-verre-slider') + '" min="' + dMin + '" max="' + dMax + '" step="0.01" value="' + dens.toFixed(2) + '">'
            + '    </div>'
            + '  </div>'
            + '</div>'
            + '<div id="' + resultsId + '" class="calcule-results-display" aria-live="polite"></div>';

        var num = document.getElementById(id('capaciteUtileCl', 'calcule-capacite-utile-cl'));
        var rng = document.getElementById(id('capaciteUtileClSlider', 'calcule-capacite-utile-cl-slider'));
        function applyCapaciteUtile(v) {
            var s = getState();
            s.capaciteUtileCl = clampCapaciteUtileCl(v);
            if (num) num.value = s.capaciteUtileCl;
            if (rng) rng.value = s.capaciteUtileCl;
            recompute();
        }
        if (num && rng) {
            bindCalculeNum(num, applyCapaciteUtile);
            rng.addEventListener('input', function () { applyCapaciteUtile(parseFloat(rng.value)); });
        }

        var cb = document.getElementById(id('bouchonOn', 'calcule-bouchon-rentrant-on'));
        var group = document.getElementById(id('bouchonGroup', 'calcule-bouchon-rentrant-group'));
        var brNum = document.getElementById(id('bouchonMm', 'calcule-bouchon-rentrant-mm'));
        var brRng = document.getElementById(id('bouchonMmSlider', 'calcule-bouchon-rentrant-mm-slider'));
        if (cb && group) {
            cb.addEventListener('change', function () {
                getState().bouchonRentrantOn = !!cb.checked;
                group.style.display = getState().bouchonRentrantOn ? '' : 'none';
                recompute();
            });
        }
        function applyBouchon(v) {
            var s = getState();
            s.bouchonRentrantMm = clampBouchonRentrantMm(v);
            if (brNum) brNum.value = s.bouchonRentrantMm;
            if (brRng) brRng.value = s.bouchonRentrantMm;
            recompute();
        }
        if (brNum && brRng) {
            bindCalculeNum(brNum, applyBouchon);
            brRng.addEventListener('input', function () { applyBouchon(parseFloat(brRng.value)); });
        }

        var dNum = document.getElementById(id('densite', 'calcule-densite-verre'));
        var dRng = document.getElementById(id('densiteSlider', 'calcule-densite-verre-slider'));
        function applyDensite(v) {
            var s = getState();
            s.densiteVerre = clampDensiteVerre(v);
            if (dNum) dNum.value = s.densiteVerre.toFixed(2);
            if (dRng) dRng.value = s.densiteVerre.toFixed(2);
            recompute();
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
