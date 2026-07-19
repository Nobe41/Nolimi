// Interieur/function.js — panneau UI « Intérieur » et état utilisateur.
// Rôle : slider + champ numérique pour l'épaisseur du verre (mm).
// Constantes → InterieurRules. Géométrie → InterieurMath. Rafraîchit la bouteille via updateBouteille().

var InterieurFeature = (function () {
    var R = typeof InterieurRules !== 'undefined' ? InterieurRules : {};

    function id(key, fallback) {
        return (R.IDS && R.IDS[key]) || fallback;
    }

    function defaultThickness() {
        return R.DEFAULT_GLASS_THICKNESS_MM != null ? R.DEFAULT_GLASS_THICKNESS_MM : 3.5;
    }

    function thicknessMin() {
        return R.THICKNESS_MIN != null ? R.THICKNESS_MIN : 0;
    }

    function thicknessMax() {
        return R.THICKNESS_MAX != null ? R.THICKNESS_MAX : 12;
    }

    function thicknessStep() {
        return R.THICKNESS_STEP != null ? R.THICKNESS_STEP : 0.1;
    }

    // État global window.interiorState (épaisseur mm), initialisé au défaut rules.
    function getState() {
        var def = defaultThickness();
        if (typeof window === 'undefined') return { glassThicknessMm: def };
        if (!window.interiorState) window.interiorState = { glassThicknessMm: def };
        return window.interiorState;
    }

    function clampThickness(v) {
        if (!isFinite(v)) return defaultThickness();
        return Math.max(thicknessMin(), Math.min(thicknessMax(), v));
    }

    // HTML injecté dans panel-content-interieur (accordion + slider épaisseur).
    function buildPanelHtml() {
        var st = getState();
        var lo = thicknessMin();
        var hi = thicknessMax();
        var step = thicknessStep();
        var numId = id('epaisseur', 'interieur-epaisseur');
        var sliderId = id('epaisseurSlider', 'interieur-epaisseur-slider');
        return ''
            + '<div class="setting-card">'
            + '  <button class="accordion main-accordion">Intérieur</button>'
            + '  <div class="panel-controls">'
            + '    <div class="control-group">'
            + '      <div class="label-row"><label>Épaisseur du verre (mm)</label>'
            + '<div class="input-wrapper"><input type="number" id="' + numId + '" value="' + st.glassThicknessMm + '" min="' + lo + '" max="' + hi + '" step="' + step + '"><span class="unit">mm</span></div></div>'
            + '      <input type="range" id="' + sliderId + '" min="' + lo + '" max="' + hi + '" step="' + step + '" value="' + st.glassThicknessMm + '">'
            + '    </div>'
            + '  </div>'
            + '</div>';
    }

    function syncInputs(value) {
        var num = document.getElementById(id('epaisseur', 'interieur-epaisseur'));
        var rng = document.getElementById(id('epaisseurSlider', 'interieur-epaisseur-slider'));
        if (num) num.value = value;
        if (rng) rng.value = value;
    }

    // Lie slider, input et accordion ; chaque changement relance updateBouteille().
    function wirePanelEvents() {
        var num = document.getElementById(id('epaisseur', 'interieur-epaisseur'));
        var rng = document.getElementById(id('epaisseurSlider', 'interieur-epaisseur-slider'));
        var panelRoot = document.getElementById(id('panel', 'panel-content-interieur'));
        var acc = panelRoot ? panelRoot.querySelector('.accordion.main-accordion') : null;
        var panel = panelRoot ? panelRoot.querySelector('.panel-controls') : null;
        if (!num || !rng) return;
        if (num.dataset.boundInterieur === '1') return;

        function apply(v) {
            var st = getState();
            st.glassThicknessMm = clampThickness(v);
            syncInputs(st.glassThicknessMm);
            if (typeof updateBouteille === 'function') updateBouteille();
        }

        // Accordion du bloc rendu dynamiquement
        if (acc && panel && acc.dataset.boundInterieurAccordion !== '1') {
            acc.dataset.boundInterieurAccordion = '1';
            panel.style.maxHeight = '0px';
            acc.addEventListener('click', function () {
                var isOpen = panel.style.maxHeight && panel.style.maxHeight !== '0px';
                if (isOpen) {
                    acc.classList.remove('active');
                    panel.style.maxHeight = '0px';
                } else {
                    acc.classList.add('active');
                    panel.style.maxHeight = panel.scrollHeight + 'px';
                }
            });
        }

        num.dataset.boundInterieur = '1';
        rng.dataset.boundInterieur = '1';
        if (typeof UIControls !== 'undefined' && UIControls.bindApplyOnEnter) {
            UIControls.bindApplyOnEnter(num, function () { apply(parseFloat(num.value)); });
        } else {
            num.addEventListener('keydown', function (e) {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                apply(parseFloat(num.value));
                num.blur();
            });
        }
        rng.addEventListener('input', function () { apply(parseFloat(rng.value)); });
    }

    function render() {
        var container = document.getElementById(id('panel', 'panel-content-interieur'));
        if (!container) return;
        container.innerHTML = buildPanelHtml();
        wirePanelEvents();
    }

    // API publique : épaisseur courante (mm), bornée selon rules.
    function getGlassThicknessMm() {
        return clampThickness(getState().glassThicknessMm);
    }

    return {
        render: render,
        getGlassThicknessMm: getGlassThicknessMm
    };
})();
