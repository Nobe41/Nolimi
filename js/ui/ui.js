const pageMenu = document.getElementById('Page-menu');
const pageBouteille = document.getElementById('Page-Bouteille');
const btnNewProject = document.getElementById('btn-new-project');

viewport3D = document.getElementById('viewport-3d');

// ==========================================
// PANNEAU GAUCHE — Menu gauche (Sections | Gravure) ; barre (Sections actuelles | Piqûre)
// ==========================================
function setupPanelTabs() {
    const tabSections = document.getElementById('panel-tab-sections');
    const tabGravure = document.getElementById('panel-tab-gravure');
    const tabInformation = document.getElementById('panel-tab-information');
    const sectionsArea = document.getElementById('panel-sections-area');
    const contentGravure = document.getElementById('panel-content-gravure');
    const contentInformation = document.getElementById('panel-content-information');
    const contentSections = document.getElementById('panel-content-sections');
    const contentPiqure = document.getElementById('panel-content-piqure');
    const contentBague = document.getElementById('panel-content-bague');
    const barTabSections = document.getElementById('panel-bar-tab-sections');
    const barTabPiqure = document.getElementById('panel-bar-tab-piqure');
    const barTabBague = document.getElementById('panel-bar-tab-bague');
    if (!sectionsArea || !contentGravure || !contentInformation || !contentSections || !contentPiqure || !contentBague) return;

    function addTabInteraction(el, handler) {
        if (!el || !handler) return;
        el.addEventListener('click', handler);
        el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handler();
            }
        });
    }

    /* Seules les icônes de la colonne logo (🥃 / ✏️) contrôlent l’affichage Sections / Gravure. */
    function showLeftSections() {
        sectionsArea.classList.remove('hidden');
        contentGravure.classList.add('hidden');
        contentInformation.classList.add('hidden');
        if (tabSections) tabSections.classList.add('active');
        if (tabGravure) tabGravure.classList.remove('active');
        if (tabInformation) tabInformation.classList.remove('active');
    }
    function showLeftGravure() {
        sectionsArea.classList.add('hidden');
        contentGravure.classList.remove('hidden');
        contentInformation.classList.add('hidden');
        if (tabSections) tabSections.classList.remove('active');
        if (tabGravure) tabGravure.classList.add('active');
        if (tabInformation) tabInformation.classList.remove('active');
    }
    function showLeftInformation() {
        sectionsArea.classList.add('hidden');
        contentGravure.classList.add('hidden');
        contentInformation.classList.remove('hidden');
        if (tabSections) tabSections.classList.remove('active');
        if (tabGravure) tabGravure.classList.remove('active');
        if (tabInformation) tabInformation.classList.add('active');
    }
    function showBarSections() {
        contentSections.classList.remove('hidden');
        contentPiqure.classList.add('hidden');
        contentBague.classList.add('hidden');
        if (barTabSections) barTabSections.classList.add('active');
        if (barTabPiqure) barTabPiqure.classList.remove('active');
        if (barTabBague) barTabBague.classList.remove('active');
        if (typeof updateBouteille === 'function') updateBouteille();
    }
    function showBarPiqure() {
        contentSections.classList.add('hidden');
        contentPiqure.classList.remove('hidden');
        contentBague.classList.add('hidden');
        if (barTabSections) barTabSections.classList.remove('active');
        if (barTabPiqure) barTabPiqure.classList.add('active');
        if (barTabBague) barTabBague.classList.remove('active');
        if (typeof updateBouteille === 'function') updateBouteille();
    }
    function showBarBague() {
        contentSections.classList.add('hidden');
        contentPiqure.classList.add('hidden');
        contentBague.classList.remove('hidden');
        if (barTabSections) barTabSections.classList.remove('active');
        if (barTabPiqure) barTabPiqure.classList.remove('active');
        if (barTabBague) barTabBague.classList.add('active');
        if (typeof updateBouteille === 'function') updateBouteille();
    }

    addTabInteraction(tabSections, showLeftSections);
    addTabInteraction(tabGravure, showLeftGravure);
    addTabInteraction(tabInformation, showLeftInformation);
    addTabInteraction(barTabSections, showBarSections);
    addTabInteraction(barTabPiqure, showBarPiqure);
    addTabInteraction(barTabBague, showBarBague);

    showLeftSections();
    showBarSections();

    /* Les deux icônes au-dessus des blocs n’ont aucun lien avec le menu à gauche : pas de listener, pas d’action sur le contenu. */
}

// ==========================================
// NAVIGATION GLOBALE (MENU)
// ==========================================

if (btnNewProject && pageMenu && pageBouteille) {
    btnNewProject.addEventListener('click', () => {
        currentFileHandle = null;
        pageMenu.classList.add('hidden');
        pageBouteille.classList.remove('hidden');
        setTimeout(() => {
            if (typeof initLogiciel === 'function' && !isLogicielInit) {
                initLogiciel();
                isLogicielInit = true;
            }
            if (typeof updateBouteille === 'function') updateBouteille();
        }, 50);
    });
}

// Retour au site web depuis le menu "Fichier"
const btnBackMenu = document.getElementById('btn-back-menu');
if (btnBackMenu) {
    btnBackMenu.addEventListener('click', () => {
        document.getElementById('fichier-dropdown').classList.add('hidden');
        window.location.href = 'index.html';
    });
}

// ==========================================
// GESTION DU MENU DÉROULANT "FICHIER"
// ==========================================

const btnFichierMenu = document.getElementById('btn-fichier-menu');
const fichierDropdown = document.getElementById('fichier-dropdown');

if (btnFichierMenu && fichierDropdown) {
    btnFichierMenu.addEventListener('click', (e) => {
        e.stopPropagation(); 
        fichierDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!fichierDropdown.contains(e.target) && e.target !== btnFichierMenu) {
            fichierDropdown.classList.add('hidden');
        }
    });
}

// ==========================================
// NAVIGATION ONGLETS (3D / 2D / OUTILLAGE)
// ==========================================

const btn3D = document.getElementById('btn-view-3d');
const btn2D = document.getElementById('btn-view-2d');
const btnOutillage = document.getElementById('btn-outillage');
const view3D = document.getElementById('viewport-3d');
const view2D = document.getElementById('viewport-2d');
const viewOutillage = document.getElementById('viewport-outillage');

function switchView(activeBtn, activeView) {
    if (!btn3D || !btn2D || !btnOutillage || !view3D || !view2D || !viewOutillage) return;
    btn3D.classList.remove('active');
    btn2D.classList.remove('active');
    btnOutillage.classList.remove('active');
    view3D.classList.add('hidden');
    view2D.classList.add('hidden');
    viewOutillage.classList.add('hidden');
    
    activeBtn.classList.add('active');
    activeView.classList.remove('hidden');

    if (activeBtn === btn2D) {
        if (typeof resizeCanvas2D === 'function') resizeCanvas2D();
        if (typeof draw2D === 'function') draw2D();
    }
}

if (btn3D && btn2D && btnOutillage && view3D && view2D && viewOutillage) {
    btn3D.addEventListener('click', () => switchView(btn3D, view3D));
    btn2D.addEventListener('click', () => switchView(btn2D, view2D));
    btnOutillage.addEventListener('click', () => switchView(btnOutillage, viewOutillage));
}

// ==========================================
// GESTION DES INPUTS ET ACCORDEONS
// ==========================================

let updateTimer;

// Les règles de clamp utilisateur sont centralisées dans js/state/validator.js

function setupListeners() {
    const inputs = document.querySelectorAll('input[type=range], input[type=number], select, input[type=checkbox]');
    
    inputs.forEach(input => {
        if (input.classList.contains('gravure-y') || input.classList.contains('gravure-angle') || input.classList.contains('gravure-largeur') || input.classList.contains('gravure-profondeur')) return;

        const onUpdate = () => {
            const controlGroup = input.closest('.control-group');
            if (controlGroup) {
                if (input.type === 'range') {
                    const num = controlGroup.querySelector('input[type=number]');
                    if (num && num !== input) num.value = input.value;
                    const valSpan = controlGroup.querySelector('.carre-niveau-value');
                    if (valSpan) valSpan.textContent = input.value + ' %';
                } else if (input.type === 'number') {
                    const rng = controlGroup.querySelector('input[type=range]');
                    if (rng && rng !== input) rng.value = input.value;
                }
            }

            // Validation globale des hauteurs de sections (1 à 5) via Validator
            if (typeof Validator !== 'undefined') {
                const id = input.id || '';

                if (Validator.validateSectionHeights) {
                    // IDs possibles : s1-h, s1-h-slider, ..., s5-h, s5-h-slider
                    const match = id.match(/^s([1-5])-h(?:-slider)?$/);
                    if (match) {
                        const sectionIndex = parseInt(match[1], 10);
                        const rawValue = parseFloat(input.value);
                        if (isFinite(rawValue)) {
                            const corrected = Validator.validateSectionHeights(sectionIndex, rawValue);
                            if (corrected !== rawValue) {
                                const isRange = input.type === 'range';
                                if (isRange) {
                                    input.value = corrected;
                                    const num = controlGroup && controlGroup.querySelector('input[type=number]');
                                    if (num) num.value = corrected;
                                } else {
                                    input.value = corrected;
                                    const rng = controlGroup && controlGroup.querySelector('input[type=range]');
                                    if (rng) rng.value = corrected;
                                }
                            }
                        }
                    }
                }

                if (Validator.validatePiqureHeight) {
                    // Hauteurs de piqûre : sp2-h, sp3-h, rp3-h (+ leurs sliders)
                    if (/^(sp[23]-h|rp3-h)(?:-slider)?$/.test(id)) {
                        const rawValue = parseFloat(input.value);
                        if (isFinite(rawValue)) {
                            const corrected = Validator.validatePiqureHeight(rawValue);
                            if (corrected !== rawValue) {
                                const isRange = input.type === 'range';
                                if (isRange) {
                                    input.value = corrected;
                                    const num = controlGroup && controlGroup.querySelector('input[type=number]');
                                    if (num) num.value = corrected;
                                } else {
                                    input.value = corrected;
                                    const rng = controlGroup && controlGroup.querySelector('input[type=range]');
                                    if (rng) rng.value = corrected;
                                }
                            }
                        }
                    }
                }
            }
            if (typeof Validator !== 'undefined' && Validator.applyAllUserConstraints) {
                Validator.applyAllUserConstraints();
            }
            clearTimeout(updateTimer);
            updateTimer = setTimeout(() => {
                if (typeof updateBouteille === 'function') updateBouteille();
                if (typeof draw2D === 'function' && view2D && !view2D.classList.contains('hidden')) draw2D();
            }, 20);
        };
        input.addEventListener('input', onUpdate);
        if (input.tagName === 'SELECT') input.addEventListener('change', onUpdate);
    });

    function toggleCarreNiveauVisibility() {
        document.querySelectorAll('.js-carre-niveau').forEach(cg => {
            const card = cg.closest('.setting-card');
            const formeSelect = card && card.querySelector('select[id$="-forme"]');
            const isCarre = formeSelect && formeSelect.value === 'carre';
            cg.style.display = isCarre ? 'block' : 'none';
            const rng = cg.querySelector('input[type="range"]');
            const valSpan = cg.querySelector('.carre-niveau-value');
            if (rng && valSpan) valSpan.textContent = rng.value + ' %';
        });
        // Réouvrir la hauteur du panneau dépliant pour afficher le slider si visible
        document.querySelectorAll('.panel-controls').forEach(panel => {
            if (panel.style.maxHeight && panel.style.maxHeight !== '0px') {
                panel.style.maxHeight = panel.scrollHeight + 'px';
            }
        });
    }
    toggleCarreNiveauVisibility();
    document.querySelectorAll('select[id$="-forme"]').forEach(sel => {
        sel.addEventListener('change', toggleCarreNiveauVisibility);
    });
    if (typeof Validator !== 'undefined' && Validator.applyAllUserConstraints) {
        Validator.applyAllUserConstraints();
    }
    var s5H = document.getElementById('s5-h');
    var sb1H = document.getElementById('sb1-h');
    var sb1HSlider = document.getElementById('sb1-h-slider');
    if (s5H && sb1H && sb1HSlider) {
        var h0 = (parseFloat(s5H.value) || 280) + 2;
        sb1H.value = h0;
        sb1HSlider.value = h0;
    }
    var sb2H = document.getElementById('sb2-h');
    var sb2HSlider = document.getElementById('sb2-h-slider');
    if (sb1H && sb2H && sb2HSlider) {
        var h2 = (parseFloat(sb1H.value) || 282) + 15;
        sb2H.value = h2;
        sb2HSlider.value = h2;
    }
    var sb3H = document.getElementById('sb3-h');
    var sb3HSlider = document.getElementById('sb3-h-slider');
    var sb3L = document.getElementById('sb3-L');
    var sb3LSlider = document.getElementById('sb3-L-slider');
    var sb3P = document.getElementById('sb3-P');
    var sb3PSlider = document.getElementById('sb3-P-slider');
    if (sb2H && sb3H && sb3HSlider) {
        var h3 = (parseFloat(sb2H.value) || 297) + 2;
        sb3H.value = h3;
        sb3HSlider.value = h3;
    }
    if (sb3L && sb3LSlider) { sb3L.value = 33; sb3LSlider.value = 33; }
    if (sb3P && sb3PSlider) { sb3P.value = 33; sb3PSlider.value = 33; }
    var sb5H = document.getElementById('sb5-h');
    var sb5HSlider = document.getElementById('sb5-h-slider');
    if (sb3H && sb5H && sb5HSlider) {
        var h5 = Math.max(0, (parseFloat(sb3H.value) || 299) - 2);
        sb5H.value = h5;
        sb5HSlider.value = h5;
    }

    const allAccordions = document.getElementsByClassName("accordion");
    const mainAccordions = document.querySelectorAll(".accordion.main-accordion");

    function closeAllAccordions() {
        for (let i = 0; i < allAccordions.length; i++) {
            allAccordions[i].classList.remove("active");
            const panel = allAccordions[i].nextElementSibling;
            if (panel && panel.classList.contains("panel-controls")) {
                panel.style.maxHeight = "0px";
            }
        }
    }

    function getMainAccordionIndex(btn) {
        if (!btn.classList.contains("main-accordion")) return 0;
        for (let i = 0; i < mainAccordions.length; i++) {
            if (mainAccordions[i] === btn) return i + 1;
        }
        return 0;
    }

    for (let i = 0; i < allAccordions.length; i++) {
        allAccordions[i].onclick = function () {
            const panel = this.nextElementSibling;
            const isOpen = panel && panel.style.maxHeight && panel.style.maxHeight !== "0px";

            closeAllAccordions();

            if (!isOpen) {
                this.classList.add("active");
                if (panel && panel.classList.contains("panel-controls")) {
                    panel.style.maxHeight = panel.scrollHeight + "px";
                }
                const sectionIndex = getMainAccordionIndex(this);
                window.activeSectionIndex = sectionIndex;
            } else {
                window.activeSectionIndex = 0;
            }

            if (typeof updateBouteille === 'function') updateBouteille();
        };
    }
}

if (typeof UIInspector !== 'undefined' && UIInspector.renderSections) {
    UIInspector.renderSections();
}
setupPanelTabs();
if (typeof UIEvents !== 'undefined' && UIEvents.init) UIEvents.init();
