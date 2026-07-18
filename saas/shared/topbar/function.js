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

        function notifyUiSync() {
            if (typeof InspectorUISync !== 'undefined' && InspectorUISync.notifyChange) {
                InspectorUISync.notifyChange();
            }
        }

        if (btnFichierMenu && fichierDropdown) {
            btnFichierMenu.addEventListener('click', function (e) {
                e.stopPropagation();
                hideOtherDropdowns('fichier');
                fichierDropdown.classList.toggle('hidden');
                notifyUiSync();
            });

            document.addEventListener('click', function (e) {
                var changed = false;
                if (!fichierDropdown.contains(e.target) && !btnFichierMenu.contains(e.target)) {
                    if (!fichierDropdown.classList.contains('hidden')) changed = true;
                    fichierDropdown.classList.add('hidden');
                }
                if (affichageDropdown && btnAffichageMenu && !affichageDropdown.contains(e.target) && !btnAffichageMenu.contains(e.target)) {
                    if (!affichageDropdown.classList.contains('hidden')) changed = true;
                    affichageDropdown.classList.add('hidden');
                }
                if (realtimeDropdown && btnRealtimeMenu && !realtimeDropdown.contains(e.target) && !btnRealtimeMenu.contains(e.target)) {
                    if (!realtimeDropdown.classList.contains('hidden')) changed = true;
                    realtimeDropdown.classList.add('hidden');
                }
                if (changed) notifyUiSync();
            });
        }

        if (btnAffichageMenu && affichageDropdown) {
            btnAffichageMenu.addEventListener('click', function (e) {
                e.stopPropagation();
                hideOtherDropdowns('affichage');
                affichageDropdown.classList.toggle('hidden');
                notifyUiSync();
            });
        }

        if (btnRealtimeMenu && realtimeDropdown) {
            btnRealtimeMenu.addEventListener('click', function (e) {
                e.stopPropagation();
                hideOtherDropdowns('realtime');
                realtimeDropdown.classList.toggle('hidden');
                notifyUiSync();
            });
        }

        initMobileMenu();
        initContactMail();
        initGuideModal();
    }

    function initGuideModal() {
        var GUIDE_SLIDES = [
            { src: '../assets/guide/01-welcome.png', alt: 'Bienvenue — Le guide de Nolimi' },
            { src: '../assets/guide/02-principe-parametrique.png', alt: 'Principe de conception 3D paramétrique' },
            { src: '../assets/guide/03-barre-outils.png', alt: 'Barre d’outils supérieure' },
            { src: '../assets/guide/04-navigation.png', alt: 'Navigation latérale' },
            { src: '../assets/guide/05-partie-section.png', alt: 'Partie Section' },
            { src: '../assets/guide/06-partie-gravure.png', alt: 'Partie Gravure' },
            { src: '../assets/guide/07-partie-plan.png', alt: 'Partie Plan' },
            { src: '../assets/guide/08-partie-rendu.png', alt: 'Partie Rendu' },
            { src: '../assets/guide/09-partie-calcule.png', alt: 'Partie Calcule' },
            { src: '../assets/guide/10-fin.png', alt: 'Fin du guide' }
        ];

        var modal = document.getElementById('guide-modal');
        var btnOpen = document.getElementById('btn-guide');
        var btnClose = document.getElementById('guide-modal-close');
        var btnPrev = document.getElementById('guide-prev');
        var btnNext = document.getElementById('guide-next');
        var img = document.getElementById('guide-slide-img');
        var dotsEl = document.getElementById('guide-dots');
        var indexEl = document.getElementById('guide-slide-index');
        var totalEl = document.getElementById('guide-slide-total');

        if (!modal || !btnOpen || !img || btnOpen.dataset.boundGuide === '1') return;
        btnOpen.dataset.boundGuide = '1';

        var current = 0;
        var isOpen = false;

        if (totalEl) totalEl.textContent = String(GUIDE_SLIDES.length);

        if (dotsEl) {
            dotsEl.innerHTML = '';
            for (var i = 0; i < GUIDE_SLIDES.length; i++) {
                (function (slideIndex) {
                    var dot = document.createElement('button');
                    dot.type = 'button';
                    dot.className = 'guide-modal__dot';
                    dot.setAttribute('aria-label', 'Aller à la diapositive ' + (slideIndex + 1));
                    dot.addEventListener('click', function (e) {
                        e.stopPropagation();
                        goTo(slideIndex);
                    });
                    dotsEl.appendChild(dot);
                })(i);
            }
        }

        function render() {
            var slide = GUIDE_SLIDES[current];
            if (!slide) return;
            img.src = slide.src;
            img.alt = slide.alt;
            if (indexEl) indexEl.textContent = String(current + 1);
            if (btnPrev) btnPrev.disabled = current === 0;
            if (btnNext) btnNext.disabled = current === GUIDE_SLIDES.length - 1;
            if (dotsEl) {
                var dots = dotsEl.querySelectorAll('.guide-modal__dot');
                for (var d = 0; d < dots.length; d++) {
                    dots[d].classList.toggle('is-active', d === current);
                }
            }
        }

        function goTo(index) {
            if (index < 0 || index >= GUIDE_SLIDES.length) return;
            current = index;
            render();
        }

        function open() {
            current = 0;
            render();
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
            isOpen = true;
            document.body.classList.add('guide-modal-open');
            if (btnClose) btnClose.focus();
        }

        function close() {
            if (!isOpen) return;
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
            isOpen = false;
            document.body.classList.remove('guide-modal-open');
            btnOpen.focus();
        }

        btnOpen.addEventListener('click', function (e) {
            e.stopPropagation();
            open();
        });

        if (btnClose) {
            btnClose.addEventListener('click', function (e) {
                e.stopPropagation();
                close();
            });
        }

        if (btnPrev) {
            btnPrev.addEventListener('click', function (e) {
                e.stopPropagation();
                goTo(current - 1);
            });
        }

        if (btnNext) {
            btnNext.addEventListener('click', function (e) {
                e.stopPropagation();
                goTo(current + 1);
            });
        }

        modal.addEventListener('click', function (e) {
            if (e.target && e.target.hasAttribute('data-guide-close')) close();
        });

        document.addEventListener('keydown', function (e) {
            if (!isOpen) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                goTo(current - 1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                goTo(current + 1);
            }
        });

        render();
    }

    function initContactMail() {
        var btn = document.getElementById('btn-contact-mail');
        if (!btn || btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';

        var email = 'hello.nolimi+contact@gmail.com';
        var defaultLabel = 'Mail';
        var copiedLabel = 'email copié !';
        var resetTimer = null;

        function showCopiedFeedback() {
            btn.textContent = copiedLabel;
            btn.classList.add('is-copied');
            if (resetTimer) clearTimeout(resetTimer);
            resetTimer = setTimeout(function () {
                btn.textContent = defaultLabel;
                btn.classList.remove('is-copied');
                resetTimer = null;
            }, 1800);
        }

        function fallbackCopy() {
            var ta = document.createElement('textarea');
            ta.value = email;
            ta.setAttribute('readonly', '');
            ta.style.position = 'absolute';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            try {
                if (document.execCommand('copy')) showCopiedFeedback();
            } catch (err) { /* ignore */ }
            document.body.removeChild(ta);
        }

        function copyEmail() {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(email).then(showCopiedFeedback).catch(fallbackCopy);
                return;
            }
            fallbackCopy();
        }

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            copyEmail();
        });
    }

    return {
        init: init,
        closeMobileMenu: closeMobileMenu
    };
})();
