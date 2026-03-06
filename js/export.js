// ==========================================
// SYSTEME DE SAUVEGARDE ET CHARGEMENT (JSON)
// ==========================================

const btnOpenProject = document.getElementById('btn-open-project');
const btnOpenWorkspace = document.getElementById('btn-open-workspace'); // Le nouveau bouton dans "Fichier"
const fileLoader = document.getElementById('file-loader');
const btnSave = document.getElementById('btn-save');
const btnSaveAs = document.getElementById('btn-save-as');

// Charger un projet depuis un JSON
function loadProjectData(jsonString) {
    try {
        const savedData = JSON.parse(jsonString);
        
        for (const id in savedData) {
            const element = document.getElementById(id);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = savedData[id];
                } else {
                    element.value = savedData[id];
                }
            }
        }

        document.getElementById('Page-menu').classList.add('hidden');
        document.getElementById('Page-Bouteille').classList.remove('hidden');
        
        setTimeout(() => {
            if (typeof initLogiciel === 'function' && !isLogicielInit) {
                initLogiciel(); 
                isLogicielInit = true;
            }
            if (typeof updateBouteille === 'function') updateBouteille();
            if (typeof draw2D === 'function' && !document.getElementById('viewport-2d').classList.contains('hidden')) draw2D();
        }, 50);

    } catch (err) {
        alert("Erreur : Le fichier de sauvegarde n'est pas valide.");
        console.error(err);
    }
}

// Fonction centrale pour ouvrir un fichier
async function handleOpenProject() {
    const dropdown = document.getElementById('fichier-dropdown');
    if (dropdown) dropdown.classList.add('hidden');

    if ('showOpenFilePicker' in window) {
        try {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [{
                    description: 'Fichier Bouteille JSON',
                    accept: {'application/json': ['.json']},
                }],
            });
            currentFileHandle = fileHandle; 
            const file = await fileHandle.getFile();
            const text = await file.text();
            loadProjectData(text);
        } catch (err) {
            console.log("Ouverture annulée", err);
        }
    } else {
        fileLoader.click(); 
    }
}

// Boutons d'ouverture
if (btnOpenProject) btnOpenProject.addEventListener('click', handleOpenProject);
if (btnOpenWorkspace) btnOpenWorkspace.addEventListener('click', handleOpenProject);

fileLoader.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    currentFileHandle = null; 
    const reader = new FileReader();
    reader.onload = function(e) {
        loadProjectData(e.target.result);
        fileLoader.value = "";
    };
    reader.readAsText(file);
});

// Sauvegarder un projet
async function saveProject(isSaveAs = false) {
    document.getElementById('fichier-dropdown').classList.add('hidden');

    const inputs = document.querySelectorAll('#Panel-gauche input, #Panel-gauche select');
    const projectData = {};
    inputs.forEach(input => {
        if (input.id) projectData[input.id] = input.type === 'checkbox' ? input.checked : input.value;
    });

    const titleInput = document.getElementById('cartouche-title');
    let fileName = titleInput && titleInput.value.trim() !== "" ? titleInput.value.trim() : "Bouteille_SansNom";
    const jsonString = JSON.stringify(projectData, null, 2);

    if ('showSaveFilePicker' in window) {
        try {
            if (isSaveAs || !currentFileHandle) {
                currentFileHandle = await window.showSaveFilePicker({
                    suggestedName: fileName + '.json',
                    types: [{
                        description: 'Fichier Bouteille JSON',
                        accept: {'application/json': ['.json']},
                    }],
                });
            }
            
            const writable = await currentFileHandle.createWritable();
            await writable.write(jsonString);
            await writable.close();
            
            const btnFichierMenu = document.getElementById('btn-fichier-menu');
            btnFichierMenu.innerText = "SAUVEGARDÉ ✓";
            setTimeout(() => { btnFichierMenu.innerText = "Fichier"; }, 1500);

        } catch (err) {
            console.log("Sauvegarde annulée", err);
        }
    } else {
        if (isSaveAs || !currentFileHandle) {
            const userFileName = prompt("Entrez le nom de la sauvegarde :", fileName);
            if (!userFileName) return; 
            fileName = userFileName;
        }
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName + ".json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        currentFileHandle = true; 
    }
}

if (btnSave) btnSave.addEventListener('click', () => saveProject(false)); 
if (btnSaveAs) btnSaveAs.addEventListener('click', () => saveProject(true)); 

// ==========================================
// FONCTIONS D'EXPORTATION 3D (STL) ET 2D (PDF)
// ==========================================

const btnExport3D = document.getElementById('btn-export-3d');
const btnExport2D = document.getElementById('btn-export-2d');

// EXPORT 3D (STL BINAIRE AVEC EXPLORATEUR DE FICHIERS)
if (btnExport3D) {
    btnExport3D.addEventListener('click', async () => {
        document.getElementById('fichier-dropdown').classList.add('hidden'); 

        if (typeof THREE === 'undefined' || typeof THREE.STLExporter === 'undefined') {
            alert("La librairie d'exportation STL n'est pas chargée.");
            return;
        }
        
        let targetScene = typeof scene !== 'undefined' ? scene : window.scene;
        
        if (!targetScene) {
            alert("La scène 3D n'a pas pu être trouvée.");
            return;
        }
        
        try {
            const exporter = new THREE.STLExporter();
            const stlData = exporter.parse(targetScene, { binary: true });
            const blob = new Blob([stlData], { type: 'application/octet-stream' });
            
            const titleInput = document.getElementById('cartouche-title');
            let fileName = titleInput && titleInput.value.trim() !== "" ? titleInput.value.trim() : "Bouteille";
            
            if ('showSaveFilePicker' in window) {
                try {
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: fileName + '.stl',
                        types: [{
                            description: 'Fichier 3D STL',
                            accept: {'model/stl': ['.stl']}
                        }],
                    });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                } catch (err) {
                    console.log("Export 3D annulé", err);
                }
            } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName + '.stl';
                link.click();
                URL.revokeObjectURL(link.href);
            }

        } catch (error) {
            console.error("Erreur lors de l'exportation 3D :", error);
            alert("Une erreur est survenue pendant l'export 3D.");
        }
    });
}

// EXPORT 2D (PDF AVEC EXPLORATEUR DE FICHIERS)
if (btnExport2D) {
    btnExport2D.addEventListener('click', async () => {
        document.getElementById('fichier-dropdown').classList.add('hidden'); 

        if (!window.jspdf) {
            alert("La librairie jsPDF n'est pas chargée.");
            return;
        }
        
        const canvas = document.getElementById('canvas-2d');
        if (!canvas || canvas.width === 0) {
            alert("Le plan 2D n'est pas affiché. Veuillez d'abord cliquer sur l'onglet 2D.");
            return;
        }

        const formatSelect = document.getElementById('paper-format-select');
        const formatVal = formatSelect ? formatSelect.value : 'A4_P';
        
        const paper = typeof paperFormats !== 'undefined' ? paperFormats[formatVal] : { w: 210, h: 297 };
        
        let orientation = 'p'; 
        let formatArgs = 'a4';
        let w = paper.w, h = paper.h;
        
        if (formatVal === 'A4_L') { orientation = 'l'; formatArgs = 'a4'; }
        if (formatVal === 'A3_P') { orientation = 'p'; formatArgs = 'a3'; }
        if (formatVal === 'A3_L') { orientation = 'l'; formatArgs = 'a3'; }
        
        try {
            const savedW = canvas.width;
            const savedH = canvas.height;
            const savedCam = { x: cam2D.x, y: cam2D.y, zoom: cam2D.zoom };
            
            const scaleFactor = 8; 
            canvas.width = w * scaleFactor;
            canvas.height = h * scaleFactor;
            
            cam2D.x = canvas.width / 2;
            cam2D.y = canvas.height / 2;
            cam2D.zoom = scaleFactor;
            
            draw2D();
            
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            
            canvas.width = savedW;
            canvas.height = savedH;
            cam2D.x = savedCam.x;
            cam2D.y = savedCam.y;
            cam2D.zoom = savedCam.zoom;
            draw2D();

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: orientation, unit: 'mm', format: formatArgs });
            
            pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
            
            const titleInput = document.getElementById('cartouche-title');
            let fileName = titleInput && titleInput.value.trim() !== "" ? titleInput.value.trim() : "Plan_Bouteille";
            
            const pdfBlob = pdf.output('blob');

            if ('showSaveFilePicker' in window) {
                try {
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: fileName + '.pdf',
                        types: [{
                            description: 'Plan 2D PDF',
                            accept: {'application/pdf': ['.pdf']}
                        }],
                    });
                    const writable = await fileHandle.createWritable();
                    await writable.write(pdfBlob);
                    await writable.close();
                } catch (err) {
                    console.log("Export 2D annulé", err);
                }
            } else {
                pdf.save(fileName + '.pdf');
            }

        } catch (error) {
            console.error("Erreur lors de l'exportation 2D :", error);
            alert("Une erreur est survenue pendant l'export PDF.");
        }
    });
}
