// 01-saas/shared/navigation/function.js
// Navigation atelier : pages menu↔projet, onglets sidebar/inspector, vue 3D/2D.
// Constantes → NavigationRules. État → NavigationState.
// API : UIEvents.init, UIEvents.applyFromState (restore / realtime).

var UIEvents = (function () {
    var IDS = (typeof NavigationRules !== 'undefined' && NavigationRules.IDS) ? NavigationRules.IDS : {};
    var applyingRemoteNav = false;

    function get(id) { return document.getElementById(id); }

    // Click + clavier (Entrée / Espace) pour les onglets
    function bindNav(el, handler) {
        if (!el || !handler) return;
        el.addEventListener('click', handler);
        el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handler();
            }
        });
    }

    function setAddSectionBarVisibility(show) {
        var bar = get(IDS.addSectionBar || 'inspector-add-section-bar');
        if (!bar) return;
        if (show) bar.classList.remove('hidden');
        else bar.classList.add('hidden');
    }

    // --- Navigation pages (menu ↔ projet) ---

    function initPageNavigation() {
        var pageMenu = get(IDS.pageMenu);
        var pageBouteille = get(IDS.pageBouteille);
        var btnNewProject = get(IDS.btnNewProject);
        var btnBackMenu = get(IDS.btnBackMenu);
        var fichierDropdown = get(IDS.fichierDropdown);

        if (btnNewProject && pageMenu && pageBouteille && !btnNewProject.dataset.navBound) {
            btnNewProject.dataset.navBound = '1';
            btnNewProject.addEventListener('click', function () {
                pageMenu.classList.add('hidden');
                pageBouteille.classList.remove('hidden');
                setTimeout(function () {
                    if (typeof initLogiciel === 'function' && !isLogicielInit) {
                        initLogiciel();
                        isLogicielInit = true;
                    }
                    if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.resetToDefaults) {
                        WorkspaceAutosave.resetToDefaults();
                    } else {
                        if (typeof clearProjectFileBinding === 'function') clearProjectFileBinding();
                        else currentFileHandle = null;
                        if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.clear) WorkspaceAutosave.clear();
                        if (typeof updateBouteille === 'function') updateBouteille();
                    }
                }, 50);
            });
        }

        function goToAppMenu() {
            if (fichierDropdown) fichierDropdown.classList.add('hidden');
            if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.saveNow) WorkspaceAutosave.saveNow();
            if (typeof NolimiInProgress !== 'undefined' && NolimiInProgress.captureFromAtelier) {
                NolimiInProgress.captureFromAtelier();
            }
            var menuUrl = (typeof NolimiAuth !== 'undefined' && NolimiAuth.getMenuUrl)
                ? NolimiAuth.getMenuUrl()
                : '../02-menu/pages/accueil/index.html';
            window.location.href = menuUrl;
        }

        if (btnBackMenu && !btnBackMenu.dataset.navBound) {
            btnBackMenu.dataset.navBound = '1';
            btnBackMenu.addEventListener('click', goToAppMenu);
        }

        var btnSidebarHome = get(IDS.btnSidebarHome);
        if (btnSidebarHome && !btnSidebarHome.dataset.navBound) {
            btnSidebarHome.dataset.navBound = '1';
            btnSidebarHome.addEventListener('click', goToAppMenu);
        }

        var btnBackWebsite = get(IDS.btnBackWebsite);
        if (btnBackWebsite && !btnBackWebsite.dataset.navBound) {
            btnBackWebsite.dataset.navBound = '1';
            btnBackWebsite.addEventListener('click', function () {
                if (fichierDropdown) fichierDropdown.classList.add('hidden');
                if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.saveNow) WorkspaceAutosave.saveNow();
                window.location.href = '../03-website/pages/accueil/index.html';
            });
        }
    }

    // --- Bascule vue 3D / 2D ---

    function notifyViewSync() {
        if (typeof RealtimeViewSync !== 'undefined' && RealtimeViewSync.scheduleBroadcast) {
            RealtimeViewSync.scheduleBroadcast();
        }
    }

    function switchView(activeBtn, activeView) {
        var btn3D = get(IDS.btn3D), btn2D = get(IDS.btn2D);
        var view3D = get(IDS.view3D), view2D = get(IDS.view2D);
        if (!btn3D || !btn2D || !view3D || !view2D) return;
        btn3D.classList.remove('active');
        btn2D.classList.remove('active');
        view3D.classList.add('hidden');
        view2D.classList.add('hidden');
        activeBtn.classList.add('active');
        activeView.classList.remove('hidden');
        NavigationState.patch({ activeView: activeBtn === btn2D ? '2d' : '3d' });
        if (activeBtn === btn2D) {
            if (typeof resizeCanvas2D === 'function') resizeCanvas2D();
            if (typeof draw2D === 'function') draw2D();
        } else if (typeof Canvas3DLifecycle !== 'undefined' && Canvas3DLifecycle.resize) {
            Canvas3DLifecycle.resize();
        }
        if (!applyingRemoteNav) notifyViewSync();
    }

    // --- Restauration état (autosave / realtime) ---

    function applyFromState(state) {
        if (!state) return;
        applyingRemoteNav = true;
        try {
            var btn3D = get(IDS.btn3D), btn2D = get(IDS.btn2D);
            var view3D = get(IDS.view3D), view2D = get(IDS.view2D);
            if (btn3D && btn2D && view3D && view2D && state.activeView === '2d') {
                switchView(btn2D, view2D);
            } else if (btn3D && btn2D && view3D && view2D) {
                switchView(btn3D, view3D);
            }

            var leftTabMap = {
                sections: IDS.tabSections,
                calcule: IDS.tabCalcule,
                gravure: IDS.tabGravure,
                information: IDS.tabInformation,
                rendu: IDS.tabRendu
            };
            var barTabMap = {
                sections: IDS.barTabSections,
                piqure: IDS.barTabPiqure,
                bague: IDS.barTabBague,
                interieur: IDS.barTabInterieur
            };

            if (state.activeLeftTab && leftTabMap[state.activeLeftTab]) {
                var leftTab = get(leftTabMap[state.activeLeftTab]);
                if (leftTab && !leftTab.classList.contains('active')) leftTab.click();
            }
            if (state.activeBarTab && barTabMap[state.activeBarTab]) {
                var barTab = get(barTabMap[state.activeBarTab]);
                if (barTab && !barTab.classList.contains('active')) barTab.click();
            }
        } finally {
            applyingRemoteNav = false;
        }
    }

    function initViewSwitch() {
        var btn3D = get(IDS.btn3D), btn2D = get(IDS.btn2D);
        var view3D = get(IDS.view3D), view2D = get(IDS.view2D);
        if (!btn3D || !btn2D || !view3D || !view2D) return;

        if (!btn3D.dataset.navBound) {
            btn3D.dataset.navBound = '1';
            btn3D.addEventListener('click', function () { switchView(btn3D, view3D); });
        }
        if (!btn2D.dataset.navBound) {
            btn2D.dataset.navBound = '1';
            btn2D.addEventListener('click', function () { switchView(btn2D, view2D); });
        }
    }

    // --- Onglets sidebar + barre inspector (sections / piqûre / bague / intérieur) ---

    function initPanelTabs() {
        var tabSections = get(IDS.tabSections), tabCalcule = get(IDS.tabCalcule), tabGravure = get(IDS.tabGravure), tabInformation = get(IDS.tabInformation), tabRendu = get(IDS.tabRendu);
        var brandHeader = get(IDS.brandHeader), sectionsArea = get(IDS.sectionsArea), contentCalcule = get(IDS.contentCalcule), contentGravure = get(IDS.contentGravure), contentInformation = get(IDS.contentInformation), contentRendu = get(IDS.contentRendu);
        var contentSections = get(IDS.contentSections), contentPiqure = get(IDS.contentPiqure), contentBague = get(IDS.contentBague), contentInterieur = get(IDS.contentInterieur);
        var barTabSections = get(IDS.barTabSections), barTabPiqure = get(IDS.barTabPiqure), barTabBague = get(IDS.barTabBague), barTabInterieur = get(IDS.barTabInterieur);
        var mobileMq = typeof window !== 'undefined' && window.matchMedia
            ? window.matchMedia('(max-width: 768px)')
            : null;
        var brandHeaderAnchor = { inspectorParent: null, inspectorBefore: null };
        var sectionsSlotId = IDS.sectionsSlot || 'sidebar-sections-slot';
        if (!sectionsArea || !contentCalcule || !contentGravure || !contentInformation || !contentRendu || !contentSections || !contentPiqure || !contentBague || !contentInterieur) return;

        function isMobileNav() {
            return !!(mobileMq && mobileMq.matches);
        }

        // Mobile : crée un slot sidebar pour déplacer l’onglet Sections + brand header.
        function getSectionsSlot(create) {
            var sidebar = document.getElementById(IDS.sidebar || 'sidebar');
            if (!sidebar || !tabSections) return null;
            var slot = document.getElementById(sectionsSlotId);
            if (!slot && create) {
                slot = document.createElement('div');
                slot.id = sectionsSlotId;
                slot.className = 'sidebar-sections-slot';
                sidebar.insertBefore(slot, tabSections);
                slot.appendChild(tabSections);
            }
            return slot;
        }

        function unwrapSectionsSlot() {
            var slot = document.getElementById(sectionsSlotId);
            var sidebar = document.getElementById(IDS.sidebar || 'sidebar');
            if (!slot || !sidebar || !tabSections) return;
            sidebar.insertBefore(tabSections, slot);
            slot.remove();
        }

        function restoreBrandHeaderToInspector() {
            if (!brandHeader || !brandHeaderAnchor.inspectorParent) return;
            var before = brandHeaderAnchor.inspectorBefore;
            if (before && before.parentElement === brandHeaderAnchor.inspectorParent) {
                brandHeaderAnchor.inspectorParent.insertBefore(brandHeader, before);
            } else {
                brandHeaderAnchor.inspectorParent.insertBefore(brandHeader, brandHeaderAnchor.inspectorParent.firstChild);
            }
            brandHeader.classList.remove('brand-header--sidebar');
            brandHeader.classList.remove('brand-header--vertical');
        }

        function syncBrandHeaderPlacement() {
            if (!brandHeader) return;
            if (!brandHeaderAnchor.inspectorParent) {
                brandHeaderAnchor.inspectorParent = brandHeader.parentElement;
                brandHeaderAnchor.inspectorBefore = document.getElementById(IDS.inspectorScroll || 'inspector-scroll');
            }
            if (isMobileNav()) {
                var slot = getSectionsSlot(true);
                if (!slot) return;
                if (brandHeader.parentElement !== slot) {
                    slot.insertBefore(brandHeader, tabSections);
                }
                brandHeader.classList.add('brand-header--sidebar');
            } else {
                unwrapSectionsSlot();
                restoreBrandHeaderToInspector();
                if (brandHeader && tabSections && tabSections.classList.contains('active')) {
                    brandHeader.classList.remove('hidden');
                }
            }
        }

        function hideBrandHeaderMobile() {
            if (!brandHeader || !isMobileNav()) return;
            brandHeader.classList.add('hidden');
            brandHeader.classList.remove('brand-header--vertical');
        }

        function toggleBrandHeaderVertical() {
            if (!brandHeader || !isMobileNav()) return;
            if (brandHeader.classList.contains('hidden')) {
                brandHeader.classList.remove('hidden');
                brandHeader.classList.add('brand-header--vertical');
            } else {
                hideBrandHeaderMobile();
            }
        }

        function handleSectionsTabClick() {
            if (isMobileNav() && tabSections && tabSections.classList.contains('active')) {
                toggleBrandHeaderVertical();
                return;
            }
            showLeftSections();
        }

        function refreshAfterTabChange() {
            if (typeof updateBouteille === 'function') updateBouteille();
            if (typeof UIInspector !== 'undefined' && UIInspector.refreshAddSectionFooter) UIInspector.refreshAddSectionFooter();
        }
        function showLeftSections() {
            sectionsArea.classList.remove('hidden'); contentCalcule.classList.add('hidden'); contentGravure.classList.add('hidden'); contentInformation.classList.add('hidden'); contentRendu.classList.add('hidden');
            if (brandHeader && !isMobileNav()) brandHeader.classList.remove('hidden');
            if (tabSections) tabSections.classList.add('active'); if (tabCalcule) tabCalcule.classList.remove('active'); if (tabGravure) tabGravure.classList.remove('active'); if (tabInformation) tabInformation.classList.remove('active'); if (tabRendu) tabRendu.classList.remove('active');
            NavigationState.patch({ activeLeftTab: 'sections' }); setAddSectionBarVisibility(true);
        }
        function showLeftCalcule() {
            sectionsArea.classList.add('hidden'); contentCalcule.classList.remove('hidden'); contentGravure.classList.add('hidden'); contentInformation.classList.add('hidden'); contentRendu.classList.add('hidden');
            hideBrandHeaderMobile();
            if (brandHeader && !isMobileNav()) brandHeader.classList.add('hidden');
            if (tabSections) tabSections.classList.remove('active'); if (tabCalcule) tabCalcule.classList.add('active'); if (tabGravure) tabGravure.classList.remove('active'); if (tabInformation) tabInformation.classList.remove('active'); if (tabRendu) tabRendu.classList.remove('active');
            NavigationState.patch({ activeLeftTab: 'calcule' }); setAddSectionBarVisibility(false);
            if (typeof CalculeVolumeFeature !== 'undefined' && CalculeVolumeFeature.renderPanel) CalculeVolumeFeature.renderPanel();
        }
        function showLeftGravure() {
            sectionsArea.classList.add('hidden'); contentCalcule.classList.add('hidden'); contentGravure.classList.remove('hidden'); contentInformation.classList.add('hidden'); contentRendu.classList.add('hidden');
            hideBrandHeaderMobile();
            if (brandHeader && !isMobileNav()) brandHeader.classList.add('hidden');
            if (tabSections) tabSections.classList.remove('active'); if (tabCalcule) tabCalcule.classList.remove('active'); if (tabGravure) tabGravure.classList.add('active'); if (tabInformation) tabInformation.classList.remove('active'); if (tabRendu) tabRendu.classList.remove('active');
            NavigationState.patch({ activeLeftTab: 'gravure' }); setAddSectionBarVisibility(false);
        }
        function showLeftInformation() {
            sectionsArea.classList.add('hidden'); contentCalcule.classList.add('hidden'); contentGravure.classList.add('hidden'); contentInformation.classList.remove('hidden'); contentRendu.classList.add('hidden');
            hideBrandHeaderMobile();
            if (brandHeader && !isMobileNav()) brandHeader.classList.add('hidden');
            if (tabSections) tabSections.classList.remove('active'); if (tabCalcule) tabCalcule.classList.remove('active'); if (tabGravure) tabGravure.classList.remove('active'); if (tabInformation) tabInformation.classList.add('active'); if (tabRendu) tabRendu.classList.remove('active');
            NavigationState.patch({ activeLeftTab: 'information' }); setAddSectionBarVisibility(false);
        }
        function showLeftRendu() {
            sectionsArea.classList.add('hidden'); contentCalcule.classList.add('hidden'); contentGravure.classList.add('hidden'); contentInformation.classList.add('hidden'); contentRendu.classList.remove('hidden');
            hideBrandHeaderMobile();
            if (brandHeader && !isMobileNav()) brandHeader.classList.add('hidden');
            if (tabSections) tabSections.classList.remove('active'); if (tabCalcule) tabCalcule.classList.remove('active'); if (tabGravure) tabGravure.classList.remove('active'); if (tabInformation) tabInformation.classList.remove('active'); if (tabRendu) tabRendu.classList.add('active');
            NavigationState.patch({ activeLeftTab: 'rendu' }); setAddSectionBarVisibility(false);
        }
        function showBarSections() {
            contentSections.classList.remove('hidden');
            contentPiqure.classList.add('hidden');
            contentBague.classList.add('hidden');
            contentInterieur.classList.add('hidden');
            if (barTabSections) barTabSections.classList.add('active');
            if (barTabPiqure) barTabPiqure.classList.remove('active');
            if (barTabBague) barTabBague.classList.remove('active');
            if (barTabInterieur) barTabInterieur.classList.remove('active');
            NavigationState.patch({ activeBarTab: 'sections' });
            setAddSectionBarVisibility(true);
            refreshAfterTabChange();
        }
        function showBarPiqure() {
            contentSections.classList.add('hidden');
            contentPiqure.classList.remove('hidden');
            contentBague.classList.add('hidden');
            contentInterieur.classList.add('hidden');
            if (barTabSections) barTabSections.classList.remove('active');
            if (barTabPiqure) barTabPiqure.classList.add('active');
            if (barTabBague) barTabBague.classList.remove('active');
            if (barTabInterieur) barTabInterieur.classList.remove('active');
            NavigationState.patch({ activeBarTab: 'piqure' });
            setAddSectionBarVisibility(true);
            refreshAfterTabChange();
        }
        function showBarBague() {
            contentSections.classList.add('hidden');
            contentPiqure.classList.add('hidden');
            contentBague.classList.remove('hidden');
            contentInterieur.classList.add('hidden');
            if (barTabSections) barTabSections.classList.remove('active');
            if (barTabPiqure) barTabPiqure.classList.remove('active');
            if (barTabBague) barTabBague.classList.add('active');
            if (barTabInterieur) barTabInterieur.classList.remove('active');
            NavigationState.patch({ activeBarTab: 'bague' });
            setAddSectionBarVisibility(true);
            refreshAfterTabChange();
        }
        function showBarInterieur() {
            contentSections.classList.add('hidden');
            contentPiqure.classList.add('hidden');
            contentBague.classList.add('hidden');
            contentInterieur.classList.remove('hidden');
            if (barTabSections) barTabSections.classList.remove('active');
            if (barTabPiqure) barTabPiqure.classList.remove('active');
            if (barTabBague) barTabBague.classList.remove('active');
            if (barTabInterieur) barTabInterieur.classList.add('active');
            NavigationState.patch({ activeBarTab: 'interieur' });
            setAddSectionBarVisibility(false);
            if (typeof InterieurFeature !== 'undefined' && InterieurFeature.render) InterieurFeature.render();
            refreshAfterTabChange();
        }

        // Évite un broadcast realtime pendant applyFromState (clics simulés).
        function wrapNavHandler(handler) {
            return function () {
                handler();
                if (!applyingRemoteNav) notifyViewSync();
            };
        }

        bindNav(tabSections, wrapNavHandler(handleSectionsTabClick));
        bindNav(tabCalcule, wrapNavHandler(showLeftCalcule));
        bindNav(tabGravure, wrapNavHandler(showLeftGravure));
        bindNav(tabInformation, wrapNavHandler(showLeftInformation));
        bindNav(tabRendu, wrapNavHandler(showLeftRendu));
        bindNav(barTabSections, wrapNavHandler(showBarSections));
        bindNav(barTabPiqure, wrapNavHandler(showBarPiqure));
        bindNav(barTabBague, wrapNavHandler(showBarBague));
        bindNav(barTabInterieur, wrapNavHandler(showBarInterieur));

        syncBrandHeaderPlacement();
        showLeftSections();
        showBarSections();
        hideBrandHeaderMobile();

        if (mobileMq) {
            var onMobileLayoutChange = function () {
                syncBrandHeaderPlacement();
                hideBrandHeaderMobile();
            };
            if (typeof mobileMq.addEventListener === 'function') {
                mobileMq.addEventListener('change', onMobileLayoutChange);
            } else if (typeof mobileMq.addListener === 'function') {
                mobileMq.addListener(onMobileLayoutChange);
            }
        }
    }

    function init() {
        initPageNavigation();
        initPanelTabs();
        initViewSwitch();
    }

    return {
        init: init,
        applyFromState: applyFromState
    };
})();
