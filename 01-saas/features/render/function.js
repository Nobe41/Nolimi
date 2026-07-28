// 01-saas/features/render/function.js
// Point d’entrée du mode rendu : toggle, matériau verre, étiquettes PNG.
// Branche les contrôles DOM, persiste l’état (autosave) et rafraîchit la bouteille.
// Pas de scène décorative — uniquement verre + étiquettes sur le viewport existant.

var RenderFeature = (function () {
    var RULES = (typeof RenderRules !== 'undefined') ? RenderRules : {};
    var IDS = RULES.IDS || {};
    var labelRefreshRaf = 0;

    function refreshLabelsInView() {
        if (typeof RenderLabels !== 'undefined' && RenderLabels.refreshLabelsOnly && RenderLabels.refreshLabelsOnly()) {
            return true;
        }
        if (typeof updateBouteille === 'function') updateBouteille();
        return false;
    }

    function requestLabelRefresh(immediate) {
        if (immediate) {
            if (labelRefreshRaf) {
                cancelAnimationFrame(labelRefreshRaf);
                labelRefreshRaf = 0;
            }
            refreshLabelsInView();
            return;
        }
        if (labelRefreshRaf) return;
        labelRefreshRaf = requestAnimationFrame(function () {
            labelRefreshRaf = 0;
            refreshLabelsInView();
        });
    }

    function createLabel(id) {
        return {
            id: id,
            imageUrl: null,
            texture: null,
            height: RULES.LABEL_HEIGHT_DEFAULT != null ? RULES.LABEL_HEIGHT_DEFAULT : 40,
            size: RULES.LABEL_SIZE_DEFAULT != null ? RULES.LABEL_SIZE_DEFAULT : 100,
            rotation: RULES.LABEL_ROTATION_DEFAULT != null ? RULES.LABEL_ROTATION_DEFAULT : 0,
            flipX: false,
            flipY: false
        };
    }

    function ensureLabelState() {
        if (typeof window === 'undefined') return null;
        if (!window.renderLabelState) {
            window.renderLabelState = {
                enabled: false,
                labels: [],
                activeId: null,
                nextId: 1
            };
        } else if (!Array.isArray(window.renderLabelState.labels)) {
            // Migration ancienne version mono-étiquette -> multi-étiquettes.
            var legacy = window.renderLabelState;
            var migrated = createLabel('label-1');
            migrated.imageUrl = legacy.imageUrl || null;
            migrated.texture = legacy.texture || null;
            migrated.height = (legacy.height !== undefined) ? legacy.height : (RULES.LABEL_HEIGHT_DEFAULT != null ? RULES.LABEL_HEIGHT_DEFAULT : 40);
            migrated.size = (legacy.size !== undefined) ? legacy.size : (RULES.LABEL_SIZE_DEFAULT != null ? RULES.LABEL_SIZE_DEFAULT : 100);
            migrated.rotation = (legacy.rotation !== undefined) ? legacy.rotation : (RULES.LABEL_ROTATION_DEFAULT != null ? RULES.LABEL_ROTATION_DEFAULT : 0);
            migrated.flipX = !!legacy.flipX;
            migrated.flipY = !!legacy.flipY;
            window.renderLabelState = {
                enabled: !!legacy.enabled,
                labels: migrated.texture ? [migrated] : [],
                activeId: migrated.texture ? 'label-1' : null,
                nextId: 2
            };
        }
        return window.renderLabelState;
    }

    function getActiveLabel(state) {
        if (!state || !state.labels || !state.labels.length) return null;
        var activeId = state.activeId || state.labels[0].id;
        for (var i = 0; i < state.labels.length; i++) {
            if (state.labels[i].id === activeId) return state.labels[i];
        }
        state.activeId = state.labels[0].id;
        return state.labels[0];
    }

    function applyMaterialMode(mode) {
        if (typeof RenderMaterials !== 'undefined' && RenderMaterials.setMaterialMode) {
            RenderMaterials.setMaterialMode(mode);
        } else if (typeof BottleMaterials !== 'undefined' && BottleMaterials.setRenderMaterialMode) {
            BottleMaterials.setRenderMaterialMode(mode);
        }
        if (typeof updateBouteille === 'function') updateBouteille();
    }

    /** Rafraîchit le viewport (fond base + pipeline ACES). Le nom est ignoré par RenderScene.setActive. */
    function applyBackgroundScene(sceneName) {
        if (typeof SceneSetup3D !== 'undefined' && SceneSetup3D.setBackgroundScene) {
            SceneSetup3D.setBackgroundScene(sceneName || 'none');
        }
    }

    function syncCardDisabledFromDom() {
        var modeToggle = document.getElementById(IDS.modeToggle || 'render-mode-toggle');
        var radioGlass = document.getElementById(IDS.materialGlass || 'render-material-glass');
        var materialCard = radioGlass ? radioGlass.closest('.setting-card') : null;
        var labelCard = document.getElementById(IDS.labelCard || 'render-label-card');
        if (!modeToggle) return;
        var enabled = !!modeToggle.checked;
        if (materialCard) materialCard.classList.toggle('is-disabled', !enabled);
        if (labelCard) labelCard.classList.toggle('is-disabled', !enabled);
    }

    function scheduleWorkspaceSave() {
        if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.scheduleSave) {
            WorkspaceAutosave.scheduleSave();
        }
    }

    function clampToInputRange(inputEl, value, fallback) {
        if (!inputEl) return (isNaN(value) ? fallback : value);
        var v = isNaN(value) ? fallback : value;
        var min = parseFloat(inputEl.min);
        var max = parseFloat(inputEl.max);
        if (!isNaN(min) && v < min) v = min;
        if (!isNaN(max) && v > max) v = max;
        return v;
    }

    function updateLabelHeightLimits(options) {
        options = options || {};
        var fallback = RULES.LABEL_HEIGHT_FALLBACK || { min: -120, max: 400 };
        var limits = { min: fallback.min, max: fallback.max };
        if (typeof Plans2DData !== 'undefined' && Plans2DData.getBottleVerticalExtents) {
            limits = Plans2DData.getBottleVerticalExtents();
        }
        var labelHeight = document.getElementById(IDS.labelHeight || 'render-label-height');
        var labelHeightNumber = document.getElementById(IDS.labelHeightNumber || 'render-label-height-number');
        if (labelHeight) {
            labelHeight.min = String(limits.min);
            labelHeight.max = String(limits.max);
            if (!options.skipSliderResync && typeof UIControls !== 'undefined' && UIControls.syncRangeSlider) {
                UIControls.syncRangeSlider(labelHeight);
            }
        }
        if (labelHeightNumber) {
            labelHeightNumber.min = String(limits.min);
            labelHeightNumber.max = String(limits.max);
        }
        if (options.clampValues === false) return;
        var state = ensureLabelState();
        if (!state || !state.labels || !state.labels.length) return;
        var changed = false;
        for (var i = 0; i < state.labels.length; i++) {
            var h = parseFloat(state.labels[i].height);
            if (!isFinite(h)) h = limits.min;
            if (h < limits.min) { state.labels[i].height = limits.min; changed = true; }
            else if (h > limits.max) { state.labels[i].height = limits.max; changed = true; }
        }
        if (changed) syncActiveLabelInputsToDom();
    }

    // Lie toggle mode rendu, radio verre, sliders étiquettes et upload PNG
    function initModeRenduControls() {
        var state = ensureLabelState();
        var modeToggle = document.getElementById(IDS.modeToggle || 'render-mode-toggle');
        var radioGlass = document.getElementById(IDS.materialGlass || 'render-material-glass');
        var materialCard = radioGlass ? radioGlass.closest('.setting-card') : null;
        var labelCard = document.getElementById(IDS.labelCard || 'render-label-card');
        var labelList = document.getElementById(IDS.labelList || 'render-label-list');
        var labelInput = document.getElementById(IDS.labelImage || 'render-label-image');
        var labelHeight = document.getElementById(IDS.labelHeight || 'render-label-height');
        var labelHeightNumber = document.getElementById(IDS.labelHeightNumber || 'render-label-height-number');
        var labelSize = document.getElementById(IDS.labelSize || 'render-label-size');
        var labelSizeNumber = document.getElementById(IDS.labelSizeNumber || 'render-label-size-number');
        var labelRotation = document.getElementById(IDS.labelRotation || 'render-label-rotation');
        var labelRotationNumber = document.getElementById(IDS.labelRotationNumber || 'render-label-rotation-number');
        var labelFlipX = document.getElementById(IDS.labelFlipX || 'render-label-flip-x');
        var labelFlipY = document.getElementById(IDS.labelFlipY || 'render-label-flip-y');
        if (!state || !modeToggle || !radioGlass) return;

        function setLabelControlsDisabled(disabled) {
            if (labelHeight) labelHeight.disabled = disabled;
            if (labelHeightNumber) labelHeightNumber.disabled = disabled;
            if (labelSize) labelSize.disabled = disabled;
            if (labelSizeNumber) labelSizeNumber.disabled = disabled;
            if (labelRotation) labelRotation.disabled = disabled;
            if (labelRotationNumber) labelRotationNumber.disabled = disabled;
            if (labelFlipX) labelFlipX.disabled = disabled;
            if (labelFlipY) labelFlipY.disabled = disabled;
        }

        function refreshLabelAccordionHeight() {
            if (!labelCard) return;
            var btn = labelCard.querySelector('.accordion.main-accordion');
            var panel = labelCard.querySelector('.panel-controls');
            if (!btn || !panel) return;
            if (!btn.classList.contains('active')) return;
            panel.style.maxHeight = panel.scrollHeight + 'px';
        }

        function renderLabelList() {
            if (!labelList) return;
            var html = '';
            for (var i = 0; i < state.labels.length; i++) {
                var l = state.labels[i];
                var isActive = l.id === state.activeId;
                html += '<div class="label-row" style="align-items:center; margin-bottom:4px; background:' + (isActive ? 'rgba(0,120,212,0.12)' : 'transparent') + '; border-radius:4px; padding:2px 4px;">'
                    + '<button type="button" class="btn-render-label-select" data-label-id="' + l.id + '" style="background:none;border:none;cursor:pointer;text-align:left;padding:0;flex:1;">Etiquette ' + (i + 1) + '</button>'
                    + '<button type="button" class="btn-render-label-delete" data-label-id="' + l.id + '" title="Supprimer" style="background:none;border:none;cursor:pointer;color:#a33;font-size:14px;line-height:1;">×</button>'
                    + '</div>';
            }
            labelList.innerHTML = html;
            refreshLabelAccordionHeight();
        }

        function syncLabelInputsFromActive() {
            var active = getActiveLabel(state);
            if (!active) {
                setLabelControlsDisabled(true);
                return;
            }
            setLabelControlsDisabled(false);
            if (labelHeight) labelHeight.value = String(active.height || 0);
            if (labelSize) labelSize.value = String(active.size || 100);
            if (labelRotation) labelRotation.value = String(active.rotation || 0);
            if (labelHeightNumber) labelHeightNumber.value = String(active.height || 0);
            if (labelSizeNumber) labelSizeNumber.value = String(active.size || 100);
            if (labelRotationNumber) labelRotationNumber.value = String(active.rotation || 0);
            if (labelFlipX) labelFlipX.checked = !!active.flipX;
            if (labelFlipY) labelFlipY.checked = !!active.flipY;
        }

        function syncModeAvailability() {
            var enabled = !!modeToggle.checked;
            if (materialCard) materialCard.classList.toggle('is-disabled', !enabled);
            if (labelCard) labelCard.classList.toggle('is-disabled', !enabled);
            // En mode rendu, on repart à zéro à l'activation puis on autorise de nouvelles étiquettes.
            state.enabled = enabled;
            if (enabled && state.labels && state.labels.length) {
                for (var li = 0; li < state.labels.length; li++) {
                    var lab = state.labels[li];
                    if (lab && lab.texture && lab.texture.dispose) lab.texture.dispose();
                }
                state.labels = [];
                state.activeId = null;
                renderLabelList();
                syncLabelInputsFromActive();
            }
        }

        function refreshViewport() {
            applyBackgroundScene('none');
            if (typeof updateBouteille === 'function') updateBouteille();
        }

        function applyMaterialFromMode() {
            var mode = RenderMath.materialModeFromToggle(!!modeToggle.checked);
            applyMaterialMode(mode);
        }

        if (!modeToggle.dataset.bound) {
            modeToggle.dataset.bound = '1';
            modeToggle.addEventListener('change', function () {
                applyMaterialFromMode();
                syncModeAvailability();
                refreshViewport();
            });
        }
        if (!radioGlass.dataset.bound) {
            radioGlass.dataset.bound = '1';
            radioGlass.addEventListener('change', function () {
                if (radioGlass.checked && modeToggle.checked) applyMaterialMode(RULES.MODE_GLASS || 'glass');
            });
        }
        if (labelInput && !labelInput.dataset.bound) {
            labelInput.dataset.bound = '1';
            labelInput.addEventListener('change', function (ev) {
                var file = ev && ev.target && ev.target.files ? ev.target.files[0] : null;
                if (!file || !/^image\/png$/i.test(file.type || '')) return;
                var reader = new FileReader();
                reader.onload = function (e) {
                    var dataUrl = e && e.target ? e.target.result : null;
                    if (!dataUrl || typeof THREE === 'undefined') return;
                    var loader = new THREE.TextureLoader();
                    loader.load(dataUrl, function (tx) {
                        var newId = 'label-' + (state.nextId++);
                        var label = createLabel(newId);
                        label.texture = tx;
                        label.imageUrl = dataUrl;
                        label.texture.needsUpdate = true;
                        state.labels.push(label);
                        state.activeId = newId;
                        state.enabled = !!modeToggle.checked;
                        renderLabelList();
                        syncLabelInputsFromActive();
                        requestLabelRefresh(true);
                        scheduleWorkspaceSave();
                        if (labelInput) labelInput.value = '';
                    });
                };
                reader.readAsDataURL(file);
            });
        }

        function bindLabelNumberOnEnter(numberEl, rangeEl, fallback, applyToActive) {
            if (!numberEl || !rangeEl) return;
            var apply = function () {
                var raw = parseFloat(numberEl.value);
                var next = clampToInputRange(rangeEl, raw, parseFloat(rangeEl.value) || fallback);
                rangeEl.value = String(next);
                if (typeof UIControls !== 'undefined' && UIControls.syncRangeSlider) {
                    UIControls.syncRangeSlider(rangeEl);
                }
                applyToActive(next);
                syncLabelInputsFromActive();
                requestLabelRefresh(true);
            };
            if (typeof UIControls !== 'undefined' && UIControls.bindApplyOnEnter) {
                UIControls.bindApplyOnEnter(numberEl, apply);
            } else {
                numberEl.addEventListener('keydown', function (e) {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    apply();
                    numberEl.blur();
                });
            }
        }

        function bindLabelRangeSlider(rangeEl, numberEl, fallback, applyToActive) {
            if (!rangeEl) return;
            var finishDrag = function () {
                if (typeof window !== 'undefined') window._renderLabelSliderDragging = false;
                updateLabelHeightLimits();
                requestLabelRefresh(true);
                scheduleWorkspaceSave();
            };
            rangeEl.addEventListener('pointerdown', function () {
                if (typeof window !== 'undefined') window._renderLabelSliderDragging = true;
            });
            rangeEl.addEventListener('pointerup', finishDrag);
            rangeEl.addEventListener('pointercancel', finishDrag);
            rangeEl.addEventListener('input', function () {
                var active = getActiveLabel(state);
                if (!active) return;
                var next = parseFloat(rangeEl.value);
                if (!isFinite(next)) next = fallback;
                applyToActive(next);
                if (numberEl) numberEl.value = String(next);
                requestLabelRefresh(false);
            });
            rangeEl.addEventListener('change', finishDrag);
        }

        if (labelHeight && !labelHeight.dataset.bound) {
            labelHeight.dataset.bound = '1';
            bindLabelRangeSlider(labelHeight, labelHeightNumber, 0, function (v) {
                var active = getActiveLabel(state);
                if (active) active.height = v;
            });
        }
        if (labelHeightNumber && !labelHeightNumber.dataset.bound) {
            labelHeightNumber.dataset.bound = '1';
            bindLabelNumberOnEnter(labelHeightNumber, labelHeight, 0, function (v) {
                var active = getActiveLabel(state);
                if (active) active.height = v;
            });
        }
        if (labelSize && !labelSize.dataset.bound) {
            labelSize.dataset.bound = '1';
            bindLabelRangeSlider(labelSize, labelSizeNumber, 100, function (v) {
                var active = getActiveLabel(state);
                if (active) active.size = v;
            });
        }
        if (labelSizeNumber && !labelSizeNumber.dataset.bound) {
            labelSizeNumber.dataset.bound = '1';
            bindLabelNumberOnEnter(labelSizeNumber, labelSize, 100, function (v) {
                var active = getActiveLabel(state);
                if (active) active.size = v;
            });
        }
        if (labelRotation && !labelRotation.dataset.bound) {
            labelRotation.dataset.bound = '1';
            bindLabelRangeSlider(labelRotation, labelRotationNumber, 0, function (v) {
                var active = getActiveLabel(state);
                if (active) active.rotation = v;
            });
        }
        if (labelRotationNumber && !labelRotationNumber.dataset.bound) {
            labelRotationNumber.dataset.bound = '1';
            bindLabelNumberOnEnter(labelRotationNumber, labelRotation, 0, function (v) {
                var active = getActiveLabel(state);
                if (active) active.rotation = v;
            });
        }
        if (labelFlipX && !labelFlipX.dataset.bound) {
            labelFlipX.dataset.bound = '1';
            labelFlipX.addEventListener('change', function () {
                var active = getActiveLabel(state);
                if (!active) return;
                active.flipX = !!labelFlipX.checked;
                requestLabelRefresh(true);
            });
        }
        if (labelFlipY && !labelFlipY.dataset.bound) {
            labelFlipY.dataset.bound = '1';
            labelFlipY.addEventListener('change', function () {
                var active = getActiveLabel(state);
                if (!active) return;
                active.flipY = !!labelFlipY.checked;
                requestLabelRefresh(true);
            });
        }
        if (labelList && !labelList.dataset.bound) {
            labelList.dataset.bound = '1';
            labelList.addEventListener('click', function (ev) {
                var target = ev.target;
                if (!target) return;
                var selectBtn = target.closest('.btn-render-label-select');
                var deleteBtn = target.closest('.btn-render-label-delete');
                if (selectBtn && selectBtn.dataset.labelId) {
                    state.activeId = selectBtn.dataset.labelId;
                    renderLabelList();
                    syncLabelInputsFromActive();
                    return;
                }
                if (deleteBtn && deleteBtn.dataset.labelId) {
                    var delId = deleteBtn.dataset.labelId;
                    var idx = -1;
                    for (var i = 0; i < state.labels.length; i++) {
                        if (state.labels[i].id === delId) { idx = i; break; }
                    }
                    if (idx < 0) return;
                    var removed = state.labels.splice(idx, 1)[0];
                    if (removed && removed.texture && removed.texture.dispose) removed.texture.dispose();
                    if (state.activeId === delId) {
                        state.activeId = state.labels.length ? state.labels[Math.max(0, idx - 1)].id : null;
                    }
                    renderLabelList();
                    syncLabelInputsFromActive();
                    requestLabelRefresh(true);
                    scheduleWorkspaceSave();
                }
            });
        }

        // Synchroniser l'UI avec l'état courant (valeurs HTML ou restauration projet).
        if (!state.labels) state.labels = [];
        renderLabelList();
        syncLabelInputsFromActive();
        refreshLabelAccordionHeight();
        updateLabelHeightLimits();
        applyMaterialFromMode();
        syncModeAvailability();
        refreshViewport();
    }

    function renderLabelListUi() {
        var state = ensureLabelState();
        var labelList = document.getElementById(IDS.labelList || 'render-label-list');
        if (!state || !labelList) return;
        var html = '';
        for (var i = 0; i < state.labels.length; i++) {
            var l = state.labels[i];
            var isActive = l.id === state.activeId;
            html += '<div class="label-row" style="align-items:center; margin-bottom:4px; background:' + (isActive ? 'rgba(0,120,212,0.12)' : 'transparent') + '; border-radius:4px; padding:2px 4px;">'
                + '<button type="button" class="btn-render-label-select" data-label-id="' + l.id + '" style="background:none;border:none;cursor:pointer;text-align:left;padding:0;flex:1;">Etiquette ' + (i + 1) + '</button>'
                + '<button type="button" class="btn-render-label-delete" data-label-id="' + l.id + '" title="Supprimer" style="background:none;border:none;cursor:pointer;color:#a33;font-size:14px;line-height:1;">×</button>'
                + '</div>';
        }
        labelList.innerHTML = html;
    }

    function syncActiveLabelInputsToDom() {
        var state = ensureLabelState();
        var active = getActiveLabel(state);
        var labelHeight = document.getElementById(IDS.labelHeight || 'render-label-height');
        var labelHeightNumber = document.getElementById(IDS.labelHeightNumber || 'render-label-height-number');
        var labelSize = document.getElementById(IDS.labelSize || 'render-label-size');
        var labelSizeNumber = document.getElementById(IDS.labelSizeNumber || 'render-label-size-number');
        var labelRotation = document.getElementById(IDS.labelRotation || 'render-label-rotation');
        var labelRotationNumber = document.getElementById(IDS.labelRotationNumber || 'render-label-rotation-number');
        var labelFlipX = document.getElementById(IDS.labelFlipX || 'render-label-flip-x');
        var labelFlipY = document.getElementById(IDS.labelFlipY || 'render-label-flip-y');
        if (!active) return;
        if (labelHeight) labelHeight.value = String(active.height || 0);
        if (labelSize) labelSize.value = String(active.size || 100);
        if (labelRotation) labelRotation.value = String(active.rotation || 0);
        if (labelHeightNumber) labelHeightNumber.value = String(active.height || 0);
        if (labelSizeNumber) labelSizeNumber.value = String(active.size || 100);
        if (labelRotationNumber) labelRotationNumber.value = String(active.rotation || 0);
        if (labelFlipX) labelFlipX.checked = !!active.flipX;
        if (labelFlipY) labelFlipY.checked = !!active.flipY;
    }

    function applyControlsFromDom() {
        var modeToggle = document.getElementById(IDS.modeToggle || 'render-mode-toggle');
        var state = ensureLabelState();
        if (!modeToggle || !state) return;
        state.enabled = !!modeToggle.checked;
        applyMaterialMode(RenderMath.materialModeFromToggle(!!modeToggle.checked));
        applyBackgroundScene('none');
        renderLabelListUi();
        syncActiveLabelInputsToDom();
        syncCardDisabledFromDom();
    }

    function collectSaveState() {
        var state = ensureLabelState();
        if (!state) return { enabled: false, labels: [], activeId: null, nextId: 1 };
        var items = [];
        for (var i = 0; i < state.labels.length; i++) {
            var l = state.labels[i];
            items.push({
                id: l.id,
                imageDataUrl: l.imageUrl || null,
                height: l.height,
                size: l.size,
                rotation: l.rotation,
                flipX: !!l.flipX,
                flipY: !!l.flipY
            });
        }
        return {
            enabled: !!state.enabled,
            activeId: state.activeId,
            nextId: state.nextId || 1,
            labels: items
        };
    }

    function disposeLabelTextures(state) {
        if (!state || !state.labels) return;
        for (var i = 0; i < state.labels.length; i++) {
            var lab = state.labels[i];
            if (lab && lab.texture && lab.texture.dispose) lab.texture.dispose();
        }
    }

    function restoreSaveState(data, done) {
        var callback = typeof done === 'function' ? done : function () { };
        var state = ensureLabelState();
        if (!state) {
            callback();
            return;
        }
        disposeLabelTextures(state);
        state.labels = [];
        state.activeId = null;
        if (!data || !Array.isArray(data.labels) || !data.labels.length) {
            state.enabled = !!(data && data.enabled);
            state.nextId = (data && data.nextId) ? data.nextId : 1;
            applyControlsFromDom();
            callback();
            return;
        }
        state.enabled = !!data.enabled;
        state.nextId = data.nextId || 1;
        state.activeId = data.activeId || null;
        state.labels = new Array(data.labels.length);
        var pending = 0;
        var finished = false;
        function finish() {
            if (finished) return;
            finished = true;
            state.labels = state.labels.filter(function (entry) { return !!entry; });
            if (!state.activeId && state.labels.length) state.activeId = state.labels[0].id;
            applyControlsFromDom();
            callback();
        }
        function markDone() {
            pending -= 1;
            if (pending <= 0) finish();
        }
        for (var i = 0; i < data.labels.length; i++) {
            (function (entry, index) {
                var label = createLabel(entry.id);
                label.height = entry.height;
                label.size = entry.size;
                label.rotation = entry.rotation;
                label.flipX = !!entry.flipX;
                label.flipY = !!entry.flipY;
                if (!entry.imageDataUrl || typeof THREE === 'undefined') {
                    state.labels[index] = label;
                    return;
                }
                pending += 1;
                var loader = new THREE.TextureLoader();
                loader.load(entry.imageDataUrl, function (tx) {
                    label.texture = tx;
                    label.imageUrl = entry.imageDataUrl;
                    label.texture.needsUpdate = true;
                    state.labels[index] = label;
                    markDone();
                }, undefined, markDone);
            })(data.labels[i], i);
        }
        if (pending === 0) finish();
    }

    return {
        initModeRenduControls: initModeRenduControls,
        updateLabelHeightLimits: updateLabelHeightLimits,
        collectSaveState: collectSaveState,
        restoreSaveState: restoreSaveState,
        applyControlsFromDom: applyControlsFromDom
    };
})();
