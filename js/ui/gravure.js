// js/ui/gravure.js
// UI du panneau Gravures : ajout/suppression de cartes, fichier PNG, réglages (Y, angle, taille, relief).
// Données exposées : window.getEngravingsData(), window.removeEngraving(), window.engravingImages.

const btnAddEngraving = document.getElementById('btn-add-engraving');
const engravingsContainer = document.getElementById('engravings-container');
let gravureCounter = 0;

function updateEngravingTitles() {
    const items = document.querySelectorAll('.gravure-item');
    items.forEach((item, index) => {
        const btn = item.querySelector('.accordion');
        if (btn) {
            btn.textContent = `Gravure ${index + 1}`;
        }
    });
}

btnAddEngraving.addEventListener('click', () => {
    const id = Date.now(); 
    gravureCounter++; 
    
    const card = document.createElement('div');
    card.className = 'setting-card setting-card--rattachement gravure-item';
    card.id = `gravure-${id}`;
    card.dataset.id = id;
    
    card.innerHTML = `
        <button class="accordion sub-accordion">Gravure ${gravureCounter}</button>
        <div class="panel-controls">

            <div class="control-group">
                <div class="label-row"><label>Fichier image (PNG)</label></div>
                <div class="gravure-file-row">
                    <label for="gravure-file-${id}" class="gravure-file-btn">Parcourir…</label>
                    <input type="file" id="gravure-file-${id}" class="gravure-file" accept="image/png" data-id="${id}">
                    <span id="gravure-filename-${id}" class="gravure-filename"></span>
                </div>
            </div>

            <div class="control-group">
                <div class="label-row">
                    <label for="gravure-flip-${id}">Miroir</label>
                    <div class="input-wrapper">
                        <input type="checkbox" class="gravure-flip" id="gravure-flip-${id}">
                    </div>
                </div>
            </div>

            <div class="control-group">
                <div class="label-row">
                    <label>Hauteur (Y)</label>
                    <div class="input-wrapper">
                        <input type="number" id="gravure-y-num-${id}" value="150" min="10" max="350">
                        <span class="unit">mm</span>
                    </div>
                </div>
                <input type="range" class="gravure-y" id="gravure-y-slider-${id}" min="10" max="350" step="1" value="150">
            </div>

            <div class="control-group">
                <div class="label-row">
                    <label>Angle (rotation)</label>
                    <div class="input-wrapper">
                        <input type="number" id="gravure-angle-num-${id}" value="0" min="0" max="360">
                        <span class="unit">°</span>
                    </div>
                </div>
                <input type="range" class="gravure-angle" id="gravure-angle-slider-${id}" min="0" max="360" step="1" value="0">
            </div>

            <div class="control-group">
                <div class="label-row">
                    <label>Taille</label>
                    <div class="input-wrapper">
                        <input type="number" id="gravure-largeur-num-${id}" value="50" min="10" max="150">
                        <span class="unit">mm</span>
                    </div>
                </div>
                <input type="range" class="gravure-largeur" id="gravure-largeur-slider-${id}" min="10" max="150" step="1" value="50">
            </div>

            <div class="control-group">
                <div class="label-row">
                    <label>Relief</label>
                    <div class="input-wrapper">
                        <input type="number" id="gravure-profondeur-num-${id}" value="1.5" min="0.1" max="5" step="0.1">
                        <span class="unit">mm</span>
                    </div>
                </div>
                <input type="range" class="gravure-profondeur" id="gravure-profondeur-slider-${id}" min="0.1" max="5" step="0.1" value="1.5">
            </div>

            <div class="control-group">
                <button type="button" class="btn-remove-gravure" onclick="removeEngraving(${id})">Supprimer la gravure</button>
            </div>

        </div>
    `;
    
    engravingsContainer.appendChild(card);
    
    updateEngravingTitles();
    
    const accBtn = card.querySelector('.accordion');
    accBtn.onclick = function() {
        this.classList.toggle("active");
        const panel = this.nextElementSibling;
        if (panel.style.maxHeight && panel.style.maxHeight !== "0px") {
            panel.style.maxHeight = "0px";
        } else {
            panel.style.maxHeight = panel.scrollHeight + "px";
        }
    };

    const fileInput = card.querySelector('.gravure-file');
    const fileNameDisplay = card.querySelector(`#gravure-filename-${id}`);
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
            fileNameDisplay.textContent = ""; 
            return;
        }
        
        fileNameDisplay.textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                window.engravingImages[id] = img; 
                if (typeof updateBouteille === 'function') updateBouteille();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    const syncInputs = (numId, sliderId) => {
        const num = document.getElementById(numId);
        const slider = document.getElementById(sliderId);
        
        num.addEventListener('input', () => { 
            slider.value = num.value; 
            if (typeof updateBouteille === 'function') updateBouteille(); 
        });
        
        slider.addEventListener('input', () => { 
            num.value = slider.value; 
            if (typeof updateBouteille === 'function') updateBouteille(); 
        });
    };

    syncInputs(`gravure-y-num-${id}`, `gravure-y-slider-${id}`);
    syncInputs(`gravure-angle-num-${id}`, `gravure-angle-slider-${id}`);
    syncInputs(`gravure-largeur-num-${id}`, `gravure-largeur-slider-${id}`);
    syncInputs(`gravure-profondeur-num-${id}`, `gravure-profondeur-slider-${id}`);

    const flipCheckbox = document.getElementById(`gravure-flip-${id}`);
    flipCheckbox.addEventListener('change', () => {
        if (typeof updateBouteille === 'function') updateBouteille();
    });
});

window.removeEngraving = function(id) {
    const card = document.getElementById(`gravure-${id}`);
    if (card) {
        card.remove();
        updateEngravingTitles();
    }
    delete window.engravingImages[id]; 
    if (typeof updateBouteille === 'function') updateBouteille();
};

window.getEngravingsData = function() {
    const items = document.querySelectorAll('.gravure-item');
    const data = [];
    items.forEach(item => {
        const id = item.dataset.id;
        data.push({
            id: id,
            y: parseFloat(item.querySelector('.gravure-y').value),
            angle: parseFloat(item.querySelector('.gravure-angle').value) * Math.PI / 180, 
            width: parseFloat(item.querySelector('.gravure-largeur').value),
            depth: parseFloat(item.querySelector('.gravure-profondeur').value),
            flip: item.querySelector('.gravure-flip').checked
        });
    });
    return data;
};
