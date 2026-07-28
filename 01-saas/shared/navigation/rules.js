// saas/shared/navigation/rules.js
// Constantes navigation atelier (IDs DOM pages, vues, onglets). Pas de logique.
// Consommé par UIEvents (navigation/function.js).

var NavigationRules = (function () {
    return {
        IDS: {
            // Pages
            pageMenu: 'Page-menu',
            pageBouteille: 'Page-Bouteille',
            btnNewProject: 'btn-new-project',
            btnBackMenu: 'btn-back-menu',
            btnSidebarHome: 'btn-sidebar-home',
            btnBackWebsite: 'btn-back-website',
            fichierDropdown: 'fichier-dropdown',
            // Vues 3D / 2D
            btn3D: 'btn-view-3d',
            btn2D: 'btn-view-2d',
            view3D: 'viewport-3d',
            view2D: 'viewport-2d',
            // Onglets colonne gauche (sidebar)
            tabSections: 'panel-tab-sections',
            tabCalcule: 'panel-tab-calcule',
            tabGravure: 'panel-tab-gravure',
            tabInformation: 'panel-tab-information',
            tabRendu: 'panel-tab-rendu',
            sectionsArea: 'panel-sections-area',
            contentCalcule: 'panel-content-calcule',
            contentGravure: 'panel-content-gravure',
            contentInformation: 'panel-content-information',
            contentRendu: 'panel-content-rendu',
            // Sous-onglets inspector (corps / piqûre / bague / intérieur)
            contentSections: 'panel-content-sections',
            contentPiqure: 'panel-content-piqure',
            contentBague: 'panel-content-bague',
            contentInterieur: 'panel-content-interieur',
            barTabSections: 'panel-bar-tab-sections',
            barTabPiqure: 'panel-bar-tab-piqure',
            barTabBague: 'panel-bar-tab-bague',
            barTabInterieur: 'panel-bar-tab-interieur',
            brandHeader: 'brand-header',
            addSectionBar: 'inspector-add-section-bar',
            sidebar: 'sidebar',
            inspectorScroll: 'inspector-scroll',
            sectionsSlot: 'sidebar-sections-slot'
        }
    };
})();
