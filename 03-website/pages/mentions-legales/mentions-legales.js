// website/pages/mentions-legales/ — onglets des documents + bouton retour.

(function () {
    var VALID_TABS = ['mentions-legales', 'cgu', 'confidentialite', 'cgv'];
    var tabButtons = document.querySelectorAll('[data-legal-tab]');
    var panels = document.querySelectorAll('[data-legal-panel]');
    var tabs = document.querySelector('.legal-tabs');

    // Bouton ← Retour
    var backBtn = document.getElementById('legal-back');
    if (backBtn) {
        backBtn.addEventListener('click', function () {
            if (window.history.length > 1) {
                window.history.back();
                return;
            }
            window.location.href = '../accueil/index.html';
        });
    }

    // Affiche l’onglet demandé (et met à jour le #hash)
    function setActiveTab(tabId, updateHash) {
        if (VALID_TABS.indexOf(tabId) === -1) tabId = 'mentions-legales';

        tabButtons.forEach(function (button) {
            var isActive = button.getAttribute('data-legal-tab') === tabId;
            button.classList.toggle('legal-tabs__btn--active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panels.forEach(function (panel) {
            panel.hidden = panel.getAttribute('data-legal-panel') !== tabId;
        });

        if (updateHash !== false && window.location.hash.replace(/^#/, '') !== tabId) {
            history.replaceState(null, '', '#' + tabId);
        }
    }

    tabButtons.forEach(function (button) {
        button.setAttribute('role', 'tab');
        button.addEventListener('click', function () {
            setActiveTab(button.getAttribute('data-legal-tab'));
        });
    });

    panels.forEach(function (panel) {
        panel.setAttribute('role', 'tabpanel');
    });

    if (tabs) tabs.setAttribute('role', 'tablist');

    function openFromHash() {
        setActiveTab(window.location.hash.replace(/^#/, '') || 'mentions-legales', false);
    }

    openFromHash();
    window.addEventListener('hashchange', openFromHash);

    // Sur mobile / trackpad : éviter que le scroll vertical de la page parte quand on swipe les onglets
    if (tabs) {
        tabs.addEventListener('wheel', function (e) {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.preventDefault();
        }, { passive: false });

        var touchStartX = 0;
        var touchStartY = 0;
        var touchAxis = null;

        tabs.addEventListener('touchstart', function (e) {
            if (!e.touches.length) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchAxis = null;
        }, { passive: true });

        tabs.addEventListener('touchmove', function (e) {
            if (!e.touches.length) return;
            var dx = e.touches[0].clientX - touchStartX;
            var dy = e.touches[0].clientY - touchStartY;
            if (!touchAxis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
                touchAxis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
            }
            if (touchAxis === 'y') e.preventDefault();
        }, { passive: false });
    }
})();
