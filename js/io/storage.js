// ==========================================
// STORAGE — Sauvegarde et chargement projet (JSON)
// ==========================================

var btnOpenProject = document.getElementById('btn-open-project');
var btnOpenWorkspace = document.getElementById('btn-open-workspace');
var fileLoader = document.getElementById('file-loader');
var btnSave = document.getElementById('btn-save');
var btnSaveAs = document.getElementById('btn-save-as');
var fichierDropdown = document.getElementById('fichier-dropdown');
var pageMenuEl = document.getElementById('Page-menu');
var pageBouteilleEl = document.getElementById('Page-Bouteille');
var viewport2DEl = document.getElementById('viewport-2d');

function hideFichierDropdown() {
    if (fichierDropdown) fichierDropdown.classList.add('hidden');
}

function loadProjectData(jsonString) {
    try {
        var savedData = JSON.parse(jsonString);
        for (var id in savedData) {
            var el = document.getElementById(id);
            if (el) {
                if (el.type === 'checkbox') el.checked = savedData[id];
                else el.value = savedData[id];
            }
        }
        if (pageMenuEl) pageMenuEl.classList.add('hidden');
        if (pageBouteilleEl) pageBouteilleEl.classList.remove('hidden');
        setTimeout(function () {
            if (typeof initLogiciel === 'function' && !isLogicielInit) {
                initLogiciel();
                isLogicielInit = true;
            }
            if (typeof updateBouteille === 'function') updateBouteille();
            if (typeof draw2D === 'function' && viewport2DEl && !viewport2DEl.classList.contains('hidden')) draw2D();
        }, 50);
    } catch (err) {
        alert("Erreur : Le fichier de sauvegarde n'est pas valide.");
        console.error(err);
    }
}

async function handleOpenProject() {
    hideFichierDropdown();
    if ('showOpenFilePicker' in window) {
        try {
            var fileHandle = (await window.showOpenFilePicker({
                types: [{ description: 'Fichier Bouteille JSON', accept: { 'application/json': ['.json'] } }]
            }))[0];
            currentFileHandle = fileHandle;
            var file = await fileHandle.getFile();
            loadProjectData(await file.text());
        } catch (err) {
            console.log("Ouverture annulée", err);
        }
    } else {
        fileLoader.click();
    }
}

if (btnOpenProject) btnOpenProject.addEventListener('click', handleOpenProject);
if (btnOpenWorkspace) btnOpenWorkspace.addEventListener('click', handleOpenProject);

if (fileLoader) {
    fileLoader.addEventListener('change', function (event) {
        var file = event.target.files[0];
        if (!file) return;
        currentFileHandle = null;
        var reader = new FileReader();
        reader.onload = function (e) {
            loadProjectData(e.target.result);
            fileLoader.value = "";
        };
        reader.readAsText(file);
    });
}

async function saveProject(isSaveAs) {
    if (typeof isSaveAs === 'undefined') isSaveAs = false;
    hideFichierDropdown();
    var inputs = document.querySelectorAll('#Panel-gauche input, #Panel-gauche select');
    var projectData = {};
    inputs.forEach(function (input) {
        if (input.id) projectData[input.id] = input.type === 'checkbox' ? input.checked : input.value;
    });
    var titleInput = document.getElementById('cartouche-title');
    var fileName = (titleInput && titleInput.value.trim() !== "") ? titleInput.value.trim() : "Bouteille_SansNom";
    var jsonString = JSON.stringify(projectData, null, 2);

    if ('showSaveFilePicker' in window) {
        try {
            if (isSaveAs || !currentFileHandle) {
                currentFileHandle = await window.showSaveFilePicker({
                    suggestedName: fileName + '.json',
                    types: [{ description: 'Fichier Bouteille JSON', accept: { 'application/json': ['.json'] } }]
                });
            }
            var writable = await currentFileHandle.createWritable();
            await writable.write(jsonString);
            await writable.close();
            var btnFichierMenu = document.getElementById('btn-fichier-menu');
            if (btnFichierMenu) {
                btnFichierMenu.innerText = "SAUVEGARDÉ ✓";
                setTimeout(function () { btnFichierMenu.innerText = "Fichier"; }, 1500);
            }
        } catch (err) {
            console.log("Sauvegarde annulée", err);
        }
    } else {
        if (isSaveAs || !currentFileHandle) {
            var userFileName = prompt("Entrez le nom de la sauvegarde :", fileName);
            if (!userFileName) return;
            fileName = userFileName;
        }
        var blob = new Blob([jsonString], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = fileName + ".json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        currentFileHandle = true;
    }
}

if (btnSave) btnSave.addEventListener('click', function () { saveProject(false); });
if (btnSaveAs) btnSaveAs.addEventListener('click', function () { saveProject(true); });
