// 01-saas/shared/inspector-ui.js
// État UI inspecteur : accordéons, scroll, menus dropdown (sync session partagée / realtime).
// API : collectState, applyState, notifyChange, bindScrollSync

var InspectorUISync = (function () {
    var isApplying = false;
    var scrollRaf = 0;
    var scrollDebounceTimer = null;

    // --- Accordéons : clés stables pour sync distant ---

    function accordionPanelFor(btn) {
        var card = btn.closest ? btn.closest('.setting-card') : null;
        if (card) {
            var panel = card.querySelector('.panel-controls');
            if (panel) return panel;
        }
        return btn.nextElementSibling;
    }

    // Clé unique : id DOM, gravure, section, liaison, ou libellé
    function accordionKeyFor(btn) {
        if (!btn || !btn.classList.contains('accordion')) return null;
        if (btn.id) return 'id:' + btn.id;

        var card = btn.closest ? btn.closest('.setting-card') : null;
        if (!card) {
            var label = (btn.textContent || '').trim();
            return label ? 'label:' + label : null;
        }

        var gravureFile = card.querySelector('input.gravure-file[data-id]');
        if (gravureFile) return 'gravure:' + gravureFile.getAttribute('data-id');

        var sectionMeta = card.querySelector('[data-section-index]');
        if (sectionMeta && btn.classList.contains('main-accordion')) {
            return 'section:' + sectionMeta.getAttribute('data-section-mode') + ':' + sectionMeta.getAttribute('data-section-index');
        }

        var typeSelect = card.querySelector('select[id$="-type"]');
        if (typeSelect && typeSelect.id) return 'link:' + typeSelect.id;

        var text = (btn.textContent || '').trim();
        return text ? 'label:' + text : null;
    }

    function findAccordionByKey(key) {
        if (!key) return null;
        if (key.indexOf('id:') === 0) return document.getElementById(key.slice(3));

        var accordions = document.querySelectorAll('.accordion');
        for (var i = 0; i < accordions.length; i++) {
            if (accordionKeyFor(accordions[i]) === key) return accordions[i];
        }
        return null;
    }

    function closeAccordions(selector) {
        document.querySelectorAll(selector).forEach(function (btn) {
            btn.classList.remove('active');
            var panel = accordionPanelFor(btn);
            if (panel && panel.classList.contains('panel-controls')) {
                panel.style.maxHeight = '0px';
            }
        });
    }

    function getMainAccordionIndex(btn) {
        var mains = document.querySelectorAll('.accordion.main-accordion');
        for (var i = 0; i < mains.length; i++) {
            if (mains[i] === btn) return i + 1;
        }
        return 0;
    }

    function openAccordion(btn) {
        if (!btn) return;
        var panel = accordionPanelFor(btn);
        if (!panel) return;

        if (btn.classList.contains('main-accordion')) {
            closeAccordions('.accordion.main-accordion');
            btn.classList.add('active');
            panel.style.maxHeight = panel.scrollHeight + 'px';
            window.activeSectionIndex = getMainAccordionIndex(btn);
        } else if (btn.classList.contains('sub-accordion')) {
            closeAccordions('.accordion.sub-accordion');
            btn.classList.add('active');
            panel.style.maxHeight = panel.scrollHeight + 'px';
        }
    }

    // --- Collecte / application état UI ---

    function collectOpenAccordions() {
        var keys = [];
        document.querySelectorAll('.accordion.active').forEach(function (btn) {
            var key = accordionKeyFor(btn);
            if (key) keys.push(key);
        });
        return keys;
    }

    function collectDropdown() {
        var fichier = document.getElementById('fichier-dropdown');
        var affichage = document.getElementById('affichage-dropdown');
        var realtime = document.getElementById('realtime-dropdown');
        if (fichier && !fichier.classList.contains('hidden')) return 'fichier';
        if (affichage && !affichage.classList.contains('hidden')) return 'affichage';
        if (realtime && !realtime.classList.contains('hidden')) return 'realtime';
        return null;
    }

    function collectScrollRatio() {
        var el = document.getElementById('inspector-scroll');
        if (!el) return 0;
        var max = el.scrollHeight - el.clientHeight;
        if (max <= 0) return 0;
        return Math.max(0, Math.min(1, el.scrollTop / max));
    }

    function collectState() {
        return {
            openAccordions: collectOpenAccordions(),
            activeSectionIndex: typeof window.activeSectionIndex !== 'undefined' ? window.activeSectionIndex : 0,
            inspectorScroll: collectScrollRatio(),
            openDropdown: collectDropdown()
        };
    }

    function applyDropdown(which) {
        var fichier = document.getElementById('fichier-dropdown');
        var affichage = document.getElementById('affichage-dropdown');
        var realtime = document.getElementById('realtime-dropdown');
        if (fichier) fichier.classList.add('hidden');
        if (affichage) affichage.classList.add('hidden');
        if (realtime) realtime.classList.add('hidden');
        if (which === 'fichier' && fichier) fichier.classList.remove('hidden');
        else if (which === 'affichage' && affichage) affichage.classList.remove('hidden');
        else if (which === 'realtime' && realtime) realtime.classList.remove('hidden');
    }

    function applyScrollRatio(ratio) {
        var el = document.getElementById('inspector-scroll');
        if (!el || typeof ratio !== 'number' || !isFinite(ratio)) return;
        var max = el.scrollHeight - el.clientHeight;
        el.scrollTop = Math.max(0, Math.min(max, ratio * max));
    }

    function applyAccordions(keys) {
        if (!keys || !keys.length) {
            closeAccordions('.accordion.main-accordion');
            closeAccordions('.accordion.sub-accordion');
            window.activeSectionIndex = 0;
            return;
        }

        var mainKey = null;
        var subKeys = [];
        keys.forEach(function (key) {
            var btn = findAccordionByKey(key);
            if (!btn) return;
            if (btn.classList.contains('main-accordion')) mainKey = key;
            else if (btn.classList.contains('sub-accordion')) subKeys.push(key);
        });

        closeAccordions('.accordion.main-accordion');
        closeAccordions('.accordion.sub-accordion');

        if (mainKey) openAccordion(findAccordionByKey(mainKey));

        subKeys.forEach(function (key) {
            var btn = findAccordionByKey(key);
            if (!btn) return;
            btn.classList.add('active');
            var panel = accordionPanelFor(btn);
            if (panel && panel.classList.contains('panel-controls')) {
                panel.style.maxHeight = panel.scrollHeight + 'px';
            }
        });

        if (!mainKey) window.activeSectionIndex = 0;
    }

    function applyState(ui) {
        if (!ui) return;
        isApplying = true;
        try {
            applyAccordions(ui.openAccordions);
            if (typeof ui.activeSectionIndex === 'number') {
                window.activeSectionIndex = ui.activeSectionIndex;
            }
            applyDropdown(ui.openDropdown || null);
            requestAnimationFrame(function () {
                applyScrollRatio(ui.inspectorScroll);
                if (typeof scheduleViewRefresh === 'function') scheduleViewRefresh();
            });
        } finally {
            isApplying = false;
        }
    }

    // --- Scroll inspecteur → sync realtime ---

    function notifyChange() {
        if (isApplying) return;
        if (typeof RealtimeViewSync !== 'undefined' && RealtimeViewSync.isApplying && RealtimeViewSync.isApplying()) return;
        if (typeof RealtimeState === 'undefined' || !RealtimeState.isConnected || !RealtimeState.isConnected()) return;
        if (typeof RealtimeViewSync !== 'undefined' && RealtimeViewSync.scheduleBroadcast) {
            RealtimeViewSync.scheduleBroadcast();
        }
    }

    function notifyScrollChange() {
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(function () {
            scrollRaf = 0;
            if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
            scrollDebounceTimer = setTimeout(function () {
                scrollDebounceTimer = null;
                notifyChange();
            }, 200);
        });
    }

    function bindScrollSync() {
        var el = document.getElementById('inspector-scroll');
        if (!el || el.dataset.inspectorUiScrollBound === '1') return;
        el.dataset.inspectorUiScrollBound = '1';
        el.addEventListener('scroll', notifyScrollChange, { passive: true });
    }

    return {
        collectState: collectState,
        applyState: applyState,
        notifyChange: notifyChange,
        bindScrollSync: bindScrollSync
    };
})();
