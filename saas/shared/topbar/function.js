var TopbarShared = (function () {
    var MOBILE_MQ = window.matchMedia('(max-width: 768px)');

    var mobileSlots = null;
    var mobileAnchors = null;
    var mobileMenuOpen = false;
    var activeMobileSection = null;

    function isMobileLayout() {
        return MOBILE_MQ.matches;
    }

    function getMobileSlots() {
        if (!mobileSlots) {
            mobileSlots = {
                fichier: document.getElementById('mobile-slot-fichier'),
                affichage: document.getElementById('mobile-slot-affichage'),
                realtime: document.getElementById('mobile-slot-realtime'),
                history: document.getElementById('mobile-slot-history')
            };
        }
        return mobileSlots;
    }

    function getMobileAnchors() {
        if (!mobileAnchors) {
            mobileAnchors = {
                fichier: {
                    parent: document.querySelector('#topbar .dropdown'),
                    node: document.getElementById('fichier-dropdown')
                },
                affichage: {
                    parent: document.querySelectorAll('#topbar .dropdown')[1],
                    node: document.getElementById('affichage-dropdown')
                },
                realtime: {
                    parent: document.querySelector('#topbar .realtime-dropdown'),
                    node: document.getElementById('realtime-dropdown')
                },
                history: {
                    parent: document.querySelector('#topbar .panel-haut-bar'),
                    node: document.getElementById('desktop-history-group')
                }
            };
        }
        return mobileAnchors;
    }

    function moveNodeToSlot(key) {
        var anchors = getMobileAnchors();
        var slots = getMobileSlots();
        var anchor = anchors[key];
        var slot = slots[key];
        if (!anchor || !anchor.node || !slot) return;
        slot.appendChild(anchor.node);
        if (key !== 'history') {
            anchor.node.classList.add('hidden');
        }
    }

    function restoreNodeToDesktop(key) {
        var anchors = getMobileAnchors();
        var anchor = anchors[key];
        if (!anchor || !anchor.node || !anchor.parent) return;
        anchor.parent.appendChild(anchor.node);
        if (key !== 'history') {
            anchor.node.classList.add('hidden');
        }
    }

    function updateMobileSectionUI() {
        var groups = document.querySelectorAll('.mobile-menu-group[data-mobile-section]');
        var anchors = getMobileAnchors();

        for (var i = 0; i < groups.length; i++) {
            var group = groups[i];
            var section = group.getAttribute('data-mobile-section');
            var isActive = section === activeMobileSection;
            group.classList.toggle('is-expanded', isActive);

            var anchor = anchors[section];
            if (!anchor || !anchor.node) continue;
            if (section === 'history') continue;
            if (isActive) anchor.node.classList.remove('hidden');
            else anchor.node.classList.add('hidden');
        }
    }

    function setActiveMobileSection(section) {
        activeMobileSection = activeMobileSection === section ? null : section;
        updateMobileSectionUI();
    }

    function resetMobileSection() {
        activeMobileSection = null;
        updateMobileSectionUI();
    }

    function syncMobileMenuLayout() {
        if (isMobileLayout()) {
            moveNodeToSlot('fichier');
            moveNodeToSlot('affichage');
            moveNodeToSlot('realtime');
            moveNodeToSlot('history');
            resetMobileSection();
        } else {
            closeMobileMenu();
            restoreNodeToDesktop('fichier');
            restoreNodeToDesktop('affichage');
            restoreNodeToDesktop('realtime');
            restoreNodeToDesktop('history');
            resetMobileSection();
        }
    }

    function openMobileMenu() {
        if (!isMobileLayout() || mobileMenuOpen) return;
        var panel = document.getElementById('mobile-menu-panel');
        var backdrop = document.getElementById('mobile-menu-backdrop');
        var trigger = document.getElementById('btn-mobile-menu');
        if (!panel || !backdrop) return;

        resetMobileSection();
        mobileMenuOpen = true;
        requestAnimationFrame(function () {
            panel.classList.add('is-open');
            backdrop.classList.add('is-visible');
        });
        document.body.classList.add('mobile-menu-open');
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
        panel.setAttribute('aria-hidden', 'false');
        backdrop.setAttribute('aria-hidden', 'false');
    }

    function closeMobileMenu() {
        if (!mobileMenuOpen) return;
        var panel = document.getElementById('mobile-menu-panel');
        var backdrop = document.getElementById('mobile-menu-backdrop');
        var trigger = document.getElementById('btn-mobile-menu');
        if (!panel || !backdrop) return;

        mobileMenuOpen = false;
        panel.classList.remove('is-open');
        backdrop.classList.remove('is-visible');
        document.body.classList.remove('mobile-menu-open');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
        panel.setAttribute('aria-hidden', 'true');
        backdrop.setAttribute('aria-hidden', 'true');
        resetMobileSection();
    }

    function initMobileMenu() {
        var trigger = document.getElementById('btn-mobile-menu');
        var closeBtn = document.getElementById('btn-mobile-menu-close');
        var backdrop = document.getElementById('mobile-menu-backdrop');
        var panel = document.getElementById('mobile-menu-panel');
        var nav = document.getElementById('mobile-menu-nav');

        if (trigger) {
            trigger.addEventListener('click', function (e) {
                e.stopPropagation();
                if (mobileMenuOpen) closeMobileMenu();
                else openMobileMenu();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                closeMobileMenu();
            });
        }

        if (backdrop) {
            backdrop.addEventListener('click', closeMobileMenu);
        }

        if (nav) {
            nav.addEventListener('click', function (e) {
                var triggerBtn = e.target.closest('.mobile-menu-nav__trigger');
                if (!triggerBtn) return;
                e.preventDefault();
                e.stopPropagation();
                var section = triggerBtn.getAttribute('data-mobile-section');
                if (section) setActiveMobileSection(section);
            });
        }

        if (panel) {
            panel.addEventListener('click', function (e) {
                var target = e.target;
                if (!target) return;
                if (target.closest('.mobile-menu-nav__trigger')) return;
                if (target.tagName === 'INPUT' || target.closest('label')) return;
                if (target.tagName === 'BUTTON' && target.id !== 'btn-mobile-menu-close') {
                    closeMobileMenu();
                }
            });
        }

        if (typeof MOBILE_MQ.addEventListener === 'function') {
            MOBILE_MQ.addEventListener('change', syncMobileMenuLayout);
        } else if (typeof MOBILE_MQ.addListener === 'function') {
            MOBILE_MQ.addListener(syncMobileMenuLayout);
        }

        syncMobileMenuLayout();
    }

    function init() {
        var btnFichierMenu = document.getElementById('btn-fichier-menu');
        var fichierDropdown = document.getElementById('fichier-dropdown');
        var btnAffichageMenu = document.getElementById('btn-affichage-menu');
        var affichageDropdown = document.getElementById('affichage-dropdown');
        var btnRealtimeMenu = document.getElementById('btn-realtime-menu');
        var realtimeDropdown = document.getElementById('realtime-dropdown');

        function hideOtherDropdowns(except) {
            if (except !== 'fichier' && fichierDropdown) fichierDropdown.classList.add('hidden');
            if (except !== 'affichage' && affichageDropdown) affichageDropdown.classList.add('hidden');
            if (except !== 'realtime' && realtimeDropdown) realtimeDropdown.classList.add('hidden');
        }

        if (btnFichierMenu && fichierDropdown) {
            btnFichierMenu.addEventListener('click', function (e) {
                e.stopPropagation();
                hideOtherDropdowns('fichier');
                fichierDropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', function (e) {
                if (!fichierDropdown.contains(e.target) && !btnFichierMenu.contains(e.target)) {
                    fichierDropdown.classList.add('hidden');
                }
                if (affichageDropdown && btnAffichageMenu && !affichageDropdown.contains(e.target) && !btnAffichageMenu.contains(e.target)) {
                    affichageDropdown.classList.add('hidden');
                }
                if (realtimeDropdown && btnRealtimeMenu && !realtimeDropdown.contains(e.target) && !btnRealtimeMenu.contains(e.target)) {
                    realtimeDropdown.classList.add('hidden');
                }
            });
        }

        if (btnAffichageMenu && affichageDropdown) {
            btnAffichageMenu.addEventListener('click', function (e) {
                e.stopPropagation();
                hideOtherDropdowns('affichage');
                affichageDropdown.classList.toggle('hidden');
            });
        }

        if (btnRealtimeMenu && realtimeDropdown) {
            btnRealtimeMenu.addEventListener('click', function (e) {
                e.stopPropagation();
                hideOtherDropdowns('realtime');
                realtimeDropdown.classList.toggle('hidden');
            });
        }

        initMobileMenu();
    }

    return {
        init: init,
        closeMobileMenu: closeMobileMenu
    };
})();
