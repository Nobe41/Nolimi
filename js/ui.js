const pageMenu = document.getElementById('Page-menu');
const pageBouteille = document.getElementById('Page-Bouteille');
const btnNewProject = document.getElementById('btn-new-project');

viewport3D = document.getElementById('viewport-3d');

// ==========================================
// PANNEAU GAUCHE — Onglets Sections / Gravure
// ==========================================
function setupPanelTabs() {
    const tabSections = document.getElementById('panel-tab-sections');
    const tabGravure = document.getElementById('panel-tab-gravure');
    const contentSections = document.getElementById('panel-content-sections');
    const contentGravure = document.getElementById('panel-content-gravure');
    if (!tabSections || !tabGravure || !contentSections || !contentGravure) return;

    function showSections() {
        contentSections.classList.remove('hidden');
        contentGravure.classList.add('hidden');
        tabSections.classList.add('active');
        tabGravure.classList.remove('active');
    }
    function showGravure() {
        contentSections.classList.add('hidden');
        contentGravure.classList.remove('hidden');
        tabSections.classList.remove('active');
        tabGravure.classList.add('active');
    }

    tabSections.addEventListener('click', showSections);
    tabGravure.addEventListener('click', showGravure);
    tabSections.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showSections(); } });
    tabGravure.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showGravure(); } });
}

// ==========================================
// NAVIGATION GLOBALE (MENU)
// ==========================================

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

btn3D.addEventListener('click', () => switchView(btn3D, view3D));
btn2D.addEventListener('click', () => switchView(btn2D, view2D));
btnOutillage.addEventListener('click', () => switchView(btnOutillage, viewOutillage));

// ==========================================
// GESTION DES INPUTS ET ACCORDEONS
// ==========================================

let updateTimer;

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
            clearTimeout(updateTimer);
            updateTimer = setTimeout(() => {
                if (typeof updateBouteille === 'function') updateBouteille();
                if (typeof draw2D === 'function' && !document.getElementById('viewport-2d').classList.contains('hidden')) draw2D();
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

setupPanelTabs();
