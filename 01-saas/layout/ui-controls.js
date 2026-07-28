// saas/layout/ui-controls.js
// Helpers UI génériques (pas de métier bouteille).
// - sync des sliders range (--range-pct = piste remplie WebKit/Firefox)
// - Entrée → appliquer + blur sur les champs number
// API : window.UIControls

(function (global) {
    // Met à jour --range-pct (0–100 %) pour le style de la piste
    function syncRangeSlider(el) {
        if (!el || el.type !== 'range') return;
        var min = parseFloat(el.min);
        var max = parseFloat(el.max);
        var val = parseFloat(el.value);
        if (!isFinite(min)) min = 0;
        if (!isFinite(max)) max = 100;
        if (!isFinite(val)) val = min;
        var pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
        pct = Math.max(0, Math.min(100, pct));
        el.style.setProperty('--range-pct', pct + '%');
    }

    function bindRangeSlider(el) {
        if (!el || el.dataset.rangeUiBound === '1') return;
        el.dataset.rangeUiBound = '1';
        var handler = function () { syncRangeSlider(el); };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
        syncRangeSlider(el);
    }

    function syncAllRangeSliders(root) {
        var scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll('input[type="range"]').forEach(function (el) {
            bindRangeSlider(el);
            syncRangeSlider(el);
        });
    }

    // Quand l’inspector recrée des sliders (sections), on les rebranche auto
    function observeRanges() {
        if (typeof MutationObserver === 'undefined') return;
        var root = document.getElementById('inspector') || document.body;
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                if (m.type === 'childList') {
                    m.addedNodes.forEach(function (node) {
                        if (node.nodeType !== 1) return;
                        if (node.matches && node.matches('input[type="range"]')) bindRangeSlider(node);
                        if (node.querySelectorAll) syncAllRangeSliders(node);
                    });
                } else if (m.type === 'attributes' && m.target && m.target.type === 'range') {
                    syncRangeSlider(m.target);
                }
            });
        });
        observer.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['min', 'max', 'value']
        });
    }

    function bindApplyOnEnter(el, onApply) {
        if (!el || el.dataset.nolimiEnterApplyBound === '1') return;
        el.dataset.nolimiEnterApplyBound = '1';
        el.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (typeof onApply === 'function') onApply();
            el.blur();
        });
    }

    function init() {
        syncAllRangeSliders(document);
        observeRanges();
    }

    global.UIControls = {
        syncRangeSlider: syncRangeSlider,
        syncAllRangeSliders: syncAllRangeSliders,
        bindApplyOnEnter: bindApplyOnEnter,
        init: init
    };

    init();
})(typeof window !== 'undefined' ? window : this);
