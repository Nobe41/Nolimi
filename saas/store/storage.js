// saas/store/storage.js
// Persistance projet :
//   1) WorkspaceAutosave — localStorage (debounce + intervalle). Un refresh repart des défauts
//      (clear au boot). Reprise = Ouvrir un fichier JSON. resetToDefaults = bouton NOUVEAU.
//   2) Fichier JSON — File System Access API / download (menu Fichier)
// Globals utiles : clearProjectFileBinding, currentFileHandle (state.js)

var WorkspaceAutosave = (function () {
    var AUTOSAVE_KEY = 'nolimi-workspace-v1';
    var AUTOSAVE_INTERVAL_MS = 45000;
    var DEBOUNCE_MS = 1500;
    var pendingRestore = null;
    var saveTimer = null;
    var intervalId = null;
    var listenersBound = false;
    var isApplyingRestore = false;

    // --- Collecte / restore payload ---

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
        if (typeof RealtimeViewSync !== 'undefined' && RealtimeViewSync.collectViewState) {
            payload.viewState = RealtimeViewSync.collectViewState();
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
                if (!window.displayOptions) {
                    window.displayOptions = (typeof createDefaultDisplayOptions === 'function')
                        ? createDefaultDisplayOptions()
                        : { showAxes: true, showGrid: true, showSectionRings: true, showMoldJoint: true };
                }
                Object.assign(window.displayOptions, normalized.displayOptions);
                // Resync checkboxes Affichage (DisplayShared.init a déjà tourné avec les défauts)
                if (typeof DisplayShared !== 'undefined' && DisplayShared.syncTogglesFromOptions) {
                    DisplayShared.syncTogglesFromOptions();
                }
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
            if (normalized.viewState && typeof RealtimeViewSync !== 'undefined' && RealtimeViewSync.applyViewState) {
                RealtimeViewSync.applyViewState(normalized.viewState, { force: true });
            } else if (normalized.navigationState && typeof UIEvents !== 'undefined' && UIEvents.applyFromState) {
                UIEvents.applyFromState(normalized.navigationState);
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
        pendingRestore = null;
    }

    function resetCameraViews() {
        if (typeof camera !== 'undefined' && camera && typeof SceneSetup3D !== 'undefined') {
            var sceneRules = (typeof Canvas3DRules !== 'undefined' && Canvas3DRules.SCENE) ? Canvas3DRules.SCENE : {};
            var pos = sceneRules.CAMERA_POSITION || { x: 400, y: 300, z: 400 };
            var targetY = sceneRules.CONTROLS_TARGET_Y != null ? sceneRules.CONTROLS_TARGET_Y : 150;
            camera.position.set(pos.x, pos.y, pos.z);
            camera.zoom = 1;
            camera.updateProjectionMatrix();
            if (typeof controls !== 'undefined' && controls) {
                controls.target.set(0, targetY, 0);
                controls.update();
            }
        }
        if (typeof Canvas2DView !== 'undefined' && Canvas2DView.setCamera && Canvas2DView.getCamera) {
            var size = { w: 0, h: 0 };
            var view2dEl = document.getElementById('viewport-2d');
            if (view2dEl) {
                size.w = view2dEl.clientWidth || 0;
                size.h = view2dEl.clientHeight || 0;
            }
            if (size.w > 0 && size.h > 0) {
                Canvas2DView.setCamera({ x: size.w / 2, y: size.h / 2, zoom: 0 });
            }
            if (typeof resizeCanvas2D === 'function') resizeCanvas2D();
        }
    }

    // Remet le projet aux valeurs d’usine (sections, UI, caméras, gravure…).
    function resetToDefaults(done) {
        clear();
        if (typeof clearProjectFileBinding === 'function') clearProjectFileBinding();
        else if (typeof window !== 'undefined') window.currentFileHandle = null;

        isApplyingRestore = true;
        try {
            if (typeof SectionsRules !== 'undefined' && SectionsRules.createInitialState
                && typeof SectionsState !== 'undefined' && SectionsState.setState) {
                SectionsState.setState(SectionsRules.createInitialState());
            }
            if (typeof NavigationState !== 'undefined' && NavigationState.patch) {
                NavigationState.patch({
                    activeLeftTab: 'sections',
                    activeBarTab: 'sections',
                    activeView: '3d'
                });
            }
            if (typeof window !== 'undefined') {
                window.displayOptions = (typeof createDefaultDisplayOptions === 'function')
                    ? createDefaultDisplayOptions()
                    : { showAxes: true, showGrid: true, showSectionRings: true, showMoldJoint: true };
                if (typeof DisplayShared !== 'undefined' && DisplayShared.syncTogglesFromOptions) {
                    DisplayShared.syncTogglesFromOptions();
                }
                var defaultThickness = (typeof InterieurRules !== 'undefined' && InterieurRules.DEFAULT_GLASS_THICKNESS_MM != null)
                    ? InterieurRules.DEFAULT_GLASS_THICKNESS_MM
                    : 3.5;
                window.interiorState = { glassThicknessMm: defaultThickness };
            }
            if (typeof UIInspector !== 'undefined' && UIInspector.renderSections) {
                UIInspector.renderSections();
            }
            if (typeof InterieurFeature !== 'undefined' && InterieurFeature.render) {
                InterieurFeature.render();
            }
            if (typeof UIEvents !== 'undefined' && UIEvents.applyFromState) {
                UIEvents.applyFromState({
                    activeLeftTab: 'sections',
                    activeBarTab: 'sections',
                    activeView: '3d'
                });
            }
            if (typeof setupListeners === 'function') setupListeners();
            if (typeof UIControls !== 'undefined' && UIControls.syncAllRangeSliders) UIControls.syncAllRangeSliders();
            if (typeof SceneSetup3D !== 'undefined' && SceneSetup3D.applyDisplayOptions) SceneSetup3D.applyDisplayOptions();
            if (typeof Validator !== 'undefined' && Validator.applyAllUserConstraints) Validator.applyAllUserConstraints();
            resetCameraViews();
        } finally {
            isApplyingRestore = false;
        }

        function afterReset() {
            if (typeof updateBouteille === 'function') updateBouteille();
            if (typeof draw2D === 'function') draw2D();
            if (typeof done === 'function') done();
        }

        function afterGravure() {
            if (typeof RenderFeature !== 'undefined' && RenderFeature.restoreSaveState) {
                RenderFeature.restoreSaveState({ labels: [] }, afterReset);
            } else {
                afterReset();
            }
        }

        if (typeof GravureEvents !== 'undefined' && GravureEvents.restoreSaveState) {
            GravureEvents.restoreSaveState({ items: [] }, afterGravure);
        } else if (typeof GravureState !== 'undefined' && GravureState.reset) {
            GravureState.reset();
            afterGravure();
        } else {
            afterGravure();
        }
    }

    // --- Restore boot (appelé par app/main.js AVANT le 1er saveNow) ---
    // Désactivé : un refresh doit repartir des valeurs d’usine.
    // Ouvrir un fichier JSON continue d’utiliser applyProjectPayload.

    function prepareRestoreFromStorage() {
        pendingRestore = null;
    }

    function applyRestoredValues() {
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

    // Bind save seulement — le restore est déclenché par app/main.js
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
        resetToDefaults: resetToDefaults,
        init: init
    };
})();

// --- Fichier projet (File System Access + fallback download) ---

var PROJECT_HANDLE_DB = 'nolimi-project-files';
var PROJECT_HANDLE_STORE = 'handles';
var PROJECT_HANDLE_KEY = 'current';
var PROJECT_FILE_NAME_KEY = 'nolimi-last-project-file-name';

function isFileSystemHandle(handle) {
    return !!(handle && typeof handle.createWritable === 'function');
}

function rememberProjectFileName(name) {
    if (!name) return;
    try {
        localStorage.setItem(PROJECT_FILE_NAME_KEY, String(name).replace(/\.json$/i, '') + '.json');
    } catch (e) { /* ignore */ }
}

function openProjectHandleDb() {
    return new Promise(function (resolve, reject) {
        var req = indexedDB.open(PROJECT_HANDLE_DB, 1);
        req.onupgradeneeded = function () {
            if (!req.result.objectStoreNames.contains(PROJECT_HANDLE_STORE)) {
                req.result.createObjectStore(PROJECT_HANDLE_STORE);
            }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
    });
}

function persistProjectFileHandle(handle) {
    if (!isFileSystemHandle(handle)) return Promise.resolve();
    return openProjectHandleDb().then(function (db) {
        return new Promise(function (resolve, reject) {
            var tx = db.transaction(PROJECT_HANDLE_STORE, 'readwrite');
            tx.objectStore(PROJECT_HANDLE_STORE).put(handle, PROJECT_HANDLE_KEY);
            tx.oncomplete = function () { db.close(); resolve(); };
            tx.onerror = function () { db.close(); reject(tx.error); };
        });
    }).catch(function (err) {
        console.warn('Persistance du fichier projet impossible', err);
    });
}

function restoreProjectFileHandle() {
    return openProjectHandleDb().then(function (db) {
        return new Promise(function (resolve, reject) {
            var tx = db.transaction(PROJECT_HANDLE_STORE, 'readonly');
            var req = tx.objectStore(PROJECT_HANDLE_STORE).get(PROJECT_HANDLE_KEY);
            req.onsuccess = function () { resolve(req.result || null); };
            req.onerror = function () { reject(req.error); };
            tx.oncomplete = function () { db.close(); };
        });
    }).catch(function () {
        return null;
    });
}

function clearPersistedProjectFileHandle() {
    return openProjectHandleDb().then(function (db) {
        return new Promise(function (resolve, reject) {
            var tx = db.transaction(PROJECT_HANDLE_STORE, 'readwrite');
            tx.objectStore(PROJECT_HANDLE_STORE).delete(PROJECT_HANDLE_KEY);
            tx.oncomplete = function () { db.close(); resolve(); };
            tx.onerror = function () { db.close(); reject(tx.error); };
        });
    }).catch(function () { /* ignore */ });
}

function clearProjectFileBinding() {
    currentFileHandle = null;
    linkedProjectFileRestorePromise = null;
    clearPersistedProjectFileHandle();
    try {
        localStorage.removeItem(PROJECT_FILE_NAME_KEY);
        sessionStorage.removeItem('nolimi-project-file-linked');
    } catch (e) { /* ignore */ }
}

var linkedProjectFileRestorePromise = null;

function resolveLinkedProjectFileHandle() {
    if (isFileSystemHandle(currentFileHandle)) {
        return Promise.resolve(currentFileHandle);
    }
    if (!linkedProjectFileRestorePromise) {
        linkedProjectFileRestorePromise = restoreProjectFileHandle().then(function (handle) {
            if (isFileSystemHandle(handle)) currentFileHandle = handle;
            return isFileSystemHandle(currentFileHandle) ? currentFileHandle : null;
        });
    }
    return linkedProjectFileRestorePromise;
}

function hasKnownProjectFileContext() {
    if (isFileSystemHandle(currentFileHandle)) return true;
    try {
        return sessionStorage.getItem('nolimi-project-file-linked') === '1';
    } catch (e) {
        return false;
    }
}

async function pickProjectFileHandleForWrite() {
    if (!('showOpenFilePicker' in window)) return null;
    var handles = await window.showOpenFilePicker({
        mode: 'readwrite',
        multiple: false,
        types: [{ description: 'Fichier Bouteille JSON', accept: { 'application/json': ['.json'] } }]
    });
    return handles && handles.length ? handles[0] : null;
}

async function ensureWritePermission(handle) {
    if (!isFileSystemHandle(handle) || typeof handle.queryPermission !== 'function') return false;
    var opts = { mode: 'readwrite' };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if (typeof handle.requestPermission !== 'function') return false;
    return (await handle.requestPermission(opts)) === 'granted';
}

async function bindProjectFileHandle(handle, fileName) {
    if (!isFileSystemHandle(handle)) return false;
    currentFileHandle = handle;
    linkedProjectFileRestorePromise = null;
    rememberProjectFileName(fileName || (handle.name || ''));
    try { sessionStorage.setItem('nolimi-project-file-linked', '1'); } catch (e) { /* ignore */ }
    await persistProjectFileHandle(handle);
    return true;
}

function showSavedFeedback() {
    var btnFichierMenu = document.getElementById('btn-fichier-menu');
    if (!btnFichierMenu) return;
    btnFichierMenu.innerText = 'SAUVEGARDÉ ✓';
    setTimeout(function () { btnFichierMenu.innerText = 'Fichier'; }, 1500);
}

function getKnownProjectFileName(fallback) {
    try {
        var stored = localStorage.getItem(PROJECT_FILE_NAME_KEY);
        if (stored) return stored.replace(/\.json$/i, '');
    } catch (e) { /* ignore */ }
    return fallback;
}

async function initProjectFileHandleRestore() {
    await resolveLinkedProjectFileHandle();
}

// --- UI menu Fichier : Enregistrer → cloud (menu Fichiers) ---

var btnSave = document.getElementById('btn-save');
var fichierDropdown = document.getElementById('fichier-dropdown');

function hideFichierDropdown() {
    if (fichierDropdown) fichierDropdown.classList.add('hidden');
}

function getCloudProjectDisplayName() {
    var titleInput = document.getElementById('cartouche-title');
    if (titleInput && titleInput.value.trim()) return titleInput.value.trim();
    if (typeof currentCloudProjectName === 'string' && currentCloudProjectName.trim()) {
        return currentCloudProjectName.trim();
    }
    return 'Sans titre';
}

// Crée le projet cloud si nouveau (choix dossier si besoin), sinon écrase l’existant
async function saveProjectToCloud() {
    hideFichierDropdown();
    if (typeof CloudProjects === 'undefined') {
        alert('Module Fichiers indisponible.');
        return;
    }
    var payload = (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.collectPayload)
        ? WorkspaceAutosave.collectPayload()
        : { version: 1, inputs: {} };
    var name = getCloudProjectDisplayName();

    try {
        var row;
        if (typeof currentCloudProjectId === 'string' && currentCloudProjectId) {
            row = await CloudProjects.update(currentCloudProjectId, { name: name, data: payload });
        } else {
            var folderId = await CloudProjects.askFolderId();
            if (typeof folderId === 'undefined') return; // annulé
            row = await CloudProjects.create(name, payload, folderId);
            currentCloudProjectId = row.id;
            CloudProjects.setProjectIdInUrl(row.id);
        }
        currentCloudProjectName = row.name || name;
        showSavedFeedback();
    } catch (err) {
        alert(CloudProjects.mapError(err));
        console.error(err);
    }
}

if (btnSave) {
    btnSave.addEventListener('click', function () {
        saveProjectToCloud();
    });
}

// Boot : restaure le handle fichier si présent ; démarre l’autosave (listeners seulement)
initProjectFileHandleRestore();
if (typeof WorkspaceAutosave !== 'undefined') WorkspaceAutosave.init();
