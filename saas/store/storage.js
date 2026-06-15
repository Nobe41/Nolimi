// ==========================================
// STORAGE — Sauvegarde et chargement projet (JSON)
// ==========================================

var WorkspaceAutosave = (function () {
    var AUTOSAVE_KEY = 'nolimi-workspace-v1';
    var AUTOSAVE_INTERVAL_MS = 45000;
    var DEBOUNCE_MS = 1500;
    var pendingRestore = null;
    var saveTimer = null;
    var intervalId = null;
    var listenersBound = false;
    var isApplyingRestore = false;

    function collectProjectInputs() {
        var projectData = {};
        var inputs = document.querySelectorAll('#Panel-gauche input, #Panel-gauche select, #Panel-gauche textarea');
        inputs.forEach(function (input) {
            if (!input.id || input.type === 'file') return;
            projectData[input.id] = (input.type === 'checkbox') ? input.checked : input.value;
        });
        return projectData;
    }

    function syncSectionsStateFromDom() {
        if (typeof SectionsEvents !== 'undefined' && SectionsEvents.syncAllFromDom) {
            SectionsEvents.syncAllFromDom();
        }
    }

    function collectPayload() {
        syncSectionsStateFromDom();
        var payload = {
            version: 1,
            savedAt: Date.now(),
            inputs: collectProjectInputs()
        };
        if (typeof SectionsState !== 'undefined' && SectionsState.getState) {
            payload.sectionsState = SectionsState.getState();
        }
        if (typeof NavigationState !== 'undefined' && NavigationState.getState) {
            payload.navigationState = NavigationState.getState();
        }
        if (typeof window !== 'undefined' && window.displayOptions) {
            payload.displayOptions = window.displayOptions;
        }
        if (typeof GravureEvents !== 'undefined' && GravureEvents.collectSaveState) {
            payload.gravureState = GravureEvents.collectSaveState();
        }
        if (typeof RenderFeature !== 'undefined' && RenderFeature.collectSaveState) {
            payload.renderLabelState = RenderFeature.collectSaveState();
        }
        if (typeof InterieurFeature !== 'undefined' && InterieurFeature.getGlassThicknessMm) {
            payload.interiorState = {
                glassThicknessMm: InterieurFeature.getGlassThicknessMm()
            };
        } else if (typeof window !== 'undefined' && window.interiorState) {
            payload.interiorState = {
                glassThicknessMm: window.interiorState.glassThicknessMm
            };
        }
        return payload;
    }

    function normalizePayload(data) {
        if (data && data.version && data.inputs) return data;
        return { version: 0, inputs: data || {} };
    }

    function applyInputValues(inputs) {
        if (!inputs) return;
        for (var id in inputs) {
            if (!Object.prototype.hasOwnProperty.call(inputs, id)) continue;
            var el = document.getElementById(id);
            if (!el) continue;
            if (el.type === 'checkbox') el.checked = !!inputs[id];
            else el.value = inputs[id];
        }
    }

    function applyProjectPayload(payload, done) {
        if (!payload) {
            if (typeof done === 'function') done();
            return;
        }
        var normalized = normalizePayload(payload);
        isApplyingRestore = true;
        try {
            if (normalized.sectionsState && typeof SectionsState !== 'undefined' && SectionsState.setState) {
                SectionsState.setState(normalized.sectionsState);
            }
            if (typeof UIInspector !== 'undefined' && UIInspector.renderSections) {
                UIInspector.renderSections();
            }
            if (normalized.displayOptions && typeof window !== 'undefined') {
                window.displayOptions = normalized.displayOptions;
            }
            if (normalized.interiorState && typeof window !== 'undefined') {
                window.interiorState = {
                    glassThicknessMm: normalized.interiorState.glassThicknessMm
                };
                if (typeof InterieurFeature !== 'undefined' && InterieurFeature.render) {
                    InterieurFeature.render();
                }
            }
            applyInputValues(normalized.inputs);
            if (normalized.navigationState && typeof NavigationState !== 'undefined' && NavigationState.patch) {
                NavigationState.patch(normalized.navigationState);
            }
            if (typeof setupListeners === 'function') setupListeners();
            if (typeof UIControls !== 'undefined' && UIControls.syncAllRangeSliders) UIControls.syncAllRangeSliders();
            if (typeof SceneSetup3D !== 'undefined' && SceneSetup3D.applyDisplayOptions) SceneSetup3D.applyDisplayOptions();
            if (typeof Validator !== 'undefined' && Validator.applyAllUserConstraints) Validator.applyAllUserConstraints();
        } finally {
            isApplyingRestore = false;
        }

        function afterRenderRestore() {
            if (typeof updateBouteille === 'function') updateBouteille();
            if (typeof done === 'function') done();
        }

        function afterGravureRestore() {
            if (typeof RenderFeature !== 'undefined' && RenderFeature.restoreSaveState) {
                RenderFeature.restoreSaveState(normalized.renderLabelState, afterRenderRestore);
            } else if (typeof RenderFeature !== 'undefined' && RenderFeature.applyControlsFromDom) {
                RenderFeature.applyControlsFromDom();
                afterRenderRestore();
            } else {
                afterRenderRestore();
            }
        }

        if (typeof GravureEvents !== 'undefined' && GravureEvents.restoreSaveState) {
            GravureEvents.restoreSaveState(normalized.gravureState || { items: [] }, afterGravureRestore);
        } else {
            afterGravureRestore();
        }
    }

    function saveNow() {
        if (isApplyingRestore) return;
        try {
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(collectPayload()));
        } catch (err) {
            console.warn('Autosave localStorage indisponible', err);
        }
    }

    function scheduleSave() {
        if (isApplyingRestore) return;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(saveNow, DEBOUNCE_MS);
        if (typeof RealtimeFeature !== 'undefined' && RealtimeFeature.onLocalChange) {
            RealtimeFeature.onLocalChange();
        }
    }

    function clear() {
        try {
            localStorage.removeItem(AUTOSAVE_KEY);
        } catch (e) { /* ignore */ }
    }

    function prepareRestoreFromStorage() {
        pendingRestore = null;
        try {
            var raw = localStorage.getItem(AUTOSAVE_KEY);
            if (!raw) return;
            pendingRestore = JSON.parse(raw);
            if (pendingRestore && pendingRestore.sectionsState && typeof SectionsState !== 'undefined' && SectionsState.setState) {
                SectionsState.setState(pendingRestore.sectionsState);
            }
        } catch (err) {
            console.warn('Autosave corrompu, ignoré', err);
            pendingRestore = null;
        }
    }

    function applyRestoredValues() {
        if (!pendingRestore) return;
        applyProjectPayload(pendingRestore);
        pendingRestore = null;
    }

    function bindListeners() {
        if (listenersBound) return;
        listenersBound = true;
        var panel = document.getElementById('Panel-gauche');
        if (panel) {
            panel.addEventListener('input', scheduleSave);
            panel.addEventListener('change', scheduleSave);
        }
        window.addEventListener('beforeunload', saveNow);
        intervalId = setInterval(saveNow, AUTOSAVE_INTERVAL_MS);
    }

    function init() {
        bindListeners();
    }

    return {
        prepareRestoreFromStorage: prepareRestoreFromStorage,
        applyRestoredValues: applyRestoredValues,
        applyProjectPayload: applyProjectPayload,
        collectPayload: collectPayload,
        scheduleSave: scheduleSave,
        saveNow: saveNow,
        clear: clear,
        init: init
    };
})();

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
        if (pageMenuEl) pageMenuEl.classList.add('hidden');
        if (pageBouteilleEl) pageBouteilleEl.classList.remove('hidden');
        setTimeout(function () {
            if (typeof initLogiciel === 'function' && !isLogicielInit) {
                initLogiciel();
                isLogicielInit = true;
            }
            if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.applyProjectPayload) {
                WorkspaceAutosave.applyProjectPayload(savedData, function () {
                    if (typeof draw2D === 'function' && viewport2DEl && !viewport2DEl.classList.contains('hidden')) draw2D();
                    if (typeof WorkspaceAutosave !== 'undefined') WorkspaceAutosave.saveNow();
                });
                return;
            }
            if (typeof updateBouteille === 'function') updateBouteille();
            if (typeof draw2D === 'function' && viewport2DEl && !viewport2DEl.classList.contains('hidden')) draw2D();
            if (typeof WorkspaceAutosave !== 'undefined') WorkspaceAutosave.saveNow();
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

async function saveProject(isSaveAs) {
    if (typeof isSaveAs === 'undefined') isSaveAs = false;
    hideFichierDropdown();
    var payload = (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.collectPayload)
        ? WorkspaceAutosave.collectPayload()
        : { version: 1, inputs: {} };
    var titleInput = document.getElementById('cartouche-title');
    var fileName = (titleInput && titleInput.value.trim() !== "") ? titleInput.value.trim() : "Bouteille_SansNom";
    var jsonString = JSON.stringify(payload, null, 2);

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

if (btnSave) btnSave.addEventListener('click', function () { saveProject(false); });
if (btnSaveAs) btnSaveAs.addEventListener('click', function () { saveProject(true); });

if (typeof WorkspaceAutosave !== 'undefined') WorkspaceAutosave.init();
