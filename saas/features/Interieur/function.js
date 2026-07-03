// Feature interieur : reglage epaisseur de verre et rendu de la peau interieure.
var InterieurFeature = (function () {
    var DEFAULT_STATE = {
        glassThicknessMm: 3.5
    };

    function getState() {
        if (typeof window === 'undefined') return { glassThicknessMm: DEFAULT_STATE.glassThicknessMm };
        if (!window.interiorState) window.interiorState = { glassThicknessMm: DEFAULT_STATE.glassThicknessMm };
        return window.interiorState;
    }

    function clampThickness(v) {
        if (!isFinite(v)) return DEFAULT_STATE.glassThicknessMm;
        return Math.max(0, Math.min(12, v));
    }

    function buildPanelHtml() {
        var st = getState();
        return ''
            + '<div class="setting-card">'
            + '  <button class="accordion main-accordion">Intérieur</button>'
            + '  <div class="panel-controls">'
            + '    <div class="control-group">'
            + '      <div class="label-row"><label>Épaisseur du verre (mm)</label><div class="input-wrapper"><input type="number" id="interieur-epaisseur" value="' + st.glassThicknessMm + '" min="0" max="12" step="0.1"><span class="unit">mm</span></div></div>'
            + '      <input type="range" id="interieur-epaisseur-slider" min="0" max="12" step="0.1" value="' + st.glassThicknessMm + '">'
            + '    </div>'
            + '  </div>'
            + '</div>';
    }

    function syncInputs(value) {
        var num = document.getElementById('interieur-epaisseur');
        var rng = document.getElementById('interieur-epaisseur-slider');
        if (num) num.value = value;
        if (rng) rng.value = value;
    }

    function wirePanelEvents() {
        var num = document.getElementById('interieur-epaisseur');
        var rng = document.getElementById('interieur-epaisseur-slider');
        var acc = document.querySelector('#panel-content-interieur .accordion.main-accordion');
        var panel = document.querySelector('#panel-content-interieur .panel-controls');
        if (!num || !rng) return;
        if (num.dataset.boundInterieur === '1') return;

        function apply(v) {
            var st = getState();
            st.glassThicknessMm = clampThickness(v);
            syncInputs(st.glassThicknessMm);
            if (typeof updateBouteille === 'function') updateBouteille();
        }

        // Le bloc est rendu dynamiquement, il a besoin de son propre toggle d'accordeon.
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
        var container = document.getElementById('panel-content-interieur');
        if (!container) return;
        container.innerHTML = buildPanelHtml();
        wirePanelEvents();
    }

    function getGlassThicknessMm() {
        return clampThickness(getState().glassThicknessMm);
    }

    return {
        render: render,
        wirePanelEvents: wirePanelEvents,
        getGlassThicknessMm: getGlassThicknessMm
    };
})();
