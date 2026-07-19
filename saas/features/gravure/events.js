// saas/features/gravure/events.js
// Couche UI : création/suppression de cartes, chargement PNG, save/restore projet.
// Chaque changement appelle updateBouteille() → regénère le mesh 3D (mesh.js).
// getEngravingsData() expose les paramètres actifs au moteur de relief.

var GravureEvents = (function () {
    function triggerUpdate() {
        if (typeof updateBouteille === 'function') updateBouteille();
    }

    function scheduleProjectSave() {
        if (typeof WorkspaceAutosave !== 'undefined' && WorkspaceAutosave.scheduleSave) {
            WorkspaceAutosave.scheduleSave();
        }
    }

    function imageToDataUrl(img) {
        if (!img) return null;
        if (img.src && img.src.indexOf('data:') === 0) return img.src;
        try {
            var w = img.naturalWidth || img.width;
            var h = img.naturalHeight || img.height;
            if (!w || !h) return null;
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            return canvas.toDataURL('image/png');
        } catch (err) {
            return null;
        }
    }

    function clearAllGravures() {
        var ids = GravureRules && GravureRules.IDS ? GravureRules.IDS : {};
        var container = document.getElementById(ids.container || 'engravings-container');
        if (container) container.innerHTML = '';
        if (typeof GravureState !== 'undefined' && GravureState.reset) GravureState.reset();
        window.engravingImages = (typeof GravureState !== 'undefined' && GravureState.getImages)
            ? GravureState.getImages()
            : {};
    }

    function collectSaveState() {
        var items = [];
        var gravureItems = document.querySelectorAll('.gravure-item');
        var images = (typeof GravureState !== 'undefined' && GravureState.getImages) ? GravureState.getImages() : {};
        gravureItems.forEach(function (item) {
            if (!item || !item.dataset || !item.dataset.id) return;
            var id = item.dataset.id;
            var parsed = GravureMath.parseItemData(item);
            var angleInput = item.querySelector('.gravure-angle');
            var fileNameEl = document.getElementById('gravure-filename-' + id);
            items.push({
                id: id,
                fileName: fileNameEl ? fileNameEl.textContent : '',
                imageDataUrl: imageToDataUrl(images[id]),
                enabled: parsed.enabled,
                y: parsed.y,
                angleDeg: angleInput ? parseFloat(angleInput.value) : 0,
                width: parsed.width,
                depth: parsed.depth,
                flip: parsed.flip,
                invert: parsed.invert
            });
        });
        return {
            counter: (typeof GravureState !== 'undefined' && GravureState.getCounter) ? GravureState.getCounter() : 0,
            items: items
        };
    }

    function createEngravingCard(id, displayIndex, data) {
        var ids = GravureRules.IDS;
        var container = document.getElementById(ids.container);
        if (!container) return null;
        var card = document.createElement('div');
        card.className = 'setting-card setting-card--liaison gravure-item';
        card.id = 'gravure-' + id;
        card.dataset.id = String(id);
        card.innerHTML = GravureBloc.buildCardHtml(id, displayIndex, data || {});
        container.appendChild(card);
        bindCard(card, id);
        return card;
    }

    function restoreSaveState(state, done) {
        clearAllGravures();
        var callback = typeof done === 'function' ? done : function () { };
        if (!state || !Array.isArray(state.items) || !state.items.length) {
            callback();
            return;
        }
        if (typeof GravureState !== 'undefined' && GravureState.setCounter) {
            GravureState.setCounter(state.counter);
        }
        var pending = 0;
        var finished = false;
        function finish() {
            if (finished) return;
            finished = true;
            GravureBloc.updateTitles();
            window.engravingImages = GravureState.getImages();
            callback();
        }
        function markDone() {
            pending -= 1;
            if (pending <= 0) finish();
        }
        for (var i = 0; i < state.items.length; i++) {
            var item = state.items[i];
            if (!item || item.id == null) continue;
            createEngravingCard(item.id, i + 1, item);
            if (item.imageDataUrl) {
                pending += 1;
                (function (entry) {
                    var img = new Image();
                    img.onload = function () {
                        GravureState.setImage(entry.id, img);
                        markDone();
                    };
                    img.onerror = markDone;
                    img.src = entry.imageDataUrl;
                })(item);
            }
        }
        if (pending === 0) finish();
    }

    function removeEngraving(id) {
        var card = document.getElementById('gravure-' + id);
        if (card) {
            card.remove();
            GravureBloc.updateTitles();
        }
        GravureState.removeImage(id);
        scheduleProjectSave();
        triggerUpdate();
    }

    // Données lues par mesh.js : uniquement les gravures activées
    function getEngravingsData() {
        var items = document.querySelectorAll('.gravure-item');
        var data = [];
        items.forEach(function (item) {
            var parsed = GravureMath.parseItemData(item);
            if (parsed.enabled) data.push(parsed);
        });
        return data;
    }

    function bindNumericSlider(numId, sliderId) {
        var num = document.getElementById(numId);
        var slider = document.getElementById(sliderId);
        if (!num || !slider) return;
        function applyFromNum() {
            slider.value = num.value;
            if (typeof UIControls !== 'undefined' && UIControls.syncRangeSlider) {
                UIControls.syncRangeSlider(slider);
            }
            triggerUpdate();
        }
        function applyFromSlider() {
            num.value = slider.value;
            triggerUpdate();
        }
        if (typeof UIControls !== 'undefined' && UIControls.bindApplyOnEnter) {
            UIControls.bindApplyOnEnter(num, applyFromNum);
        } else {
            num.addEventListener('keydown', function (e) {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                applyFromNum();
                num.blur();
            });
        }
        slider.addEventListener('input', applyFromSlider);
    }

    // Charge le PNG en mémoire (GravureState) — le mesh 3D l’utilise ensuite
    function bindFileCard(card, id) {
        var fileInput = card.querySelector('.gravure-file');
        var fileBtn = card.querySelector('.gravure-file-btn');
        var fileRow = card.querySelector('.gravure-file-row');
        var fileNameDisplay = card.querySelector('#gravure-filename-' + id);
        if (!fileInput || !fileBtn || !fileRow || !fileNameDisplay) return;

        fileBtn.addEventListener('click', function () { fileInput.click(); });

        function handleSelectedFile(file) {
            if (!file) { fileNameDisplay.textContent = ''; return; }
            var lowerName = (file.name || '').toLowerCase();
            var isPngMime = file.type === 'image/png';
            var isPngExt = lowerName.endsWith('.png');
            if (!isPngMime && !isPngExt) {
                fileNameDisplay.textContent = 'Fichier non PNG';
                fileInput.value = '';
                return;
            }
            fileNameDisplay.textContent = file.name;
            var reader = new FileReader();
            reader.onload = function (event) {
                var img = new Image();
                img.onload = function () {
                    GravureState.setImage(id, img);
                    scheduleProjectSave();
                    triggerUpdate();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }

        fileInput.addEventListener('change', function (e) { handleSelectedFile(e.target.files[0]); });
        fileRow.addEventListener('dragover', function (e) { e.preventDefault(); fileRow.classList.add('drag-over'); });
        fileRow.addEventListener('dragleave', function () { fileRow.classList.remove('drag-over'); });
        fileRow.addEventListener('drop', function (e) {
            e.preventDefault();
            fileRow.classList.remove('drag-over');
            var file = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null;
            handleSelectedFile(file);
        });
    }

    function bindCard(card, id) {
        var accBtn = card.querySelector('.accordion');
        accBtn.onclick = function () {
            this.classList.toggle('active');
            var panel = this.nextElementSibling;
            panel.style.maxHeight = (panel.style.maxHeight && panel.style.maxHeight !== '0px') ? '0px' : (panel.scrollHeight + 'px');
            if (typeof InspectorUISync !== 'undefined' && InspectorUISync.notifyChange) {
                InspectorUISync.notifyChange();
            }
        };
        bindFileCard(card, id);
        bindNumericSlider('gravure-y-num-' + id, 'gravure-y-slider-' + id);
        bindNumericSlider('gravure-angle-num-' + id, 'gravure-angle-slider-' + id);
        bindNumericSlider('gravure-largeur-num-' + id, 'gravure-largeur-slider-' + id);
        bindNumericSlider('gravure-profondeur-num-' + id, 'gravure-profondeur-slider-' + id);
        var flipCheckbox = document.getElementById('gravure-flip-' + id);
        var invertCheckbox = document.getElementById('gravure-invert-' + id);
        var enabledCheckbox = document.getElementById('gravure-enabled-' + id);
        if (flipCheckbox) flipCheckbox.addEventListener('change', triggerUpdate);
        if (invertCheckbox) invertCheckbox.addEventListener('change', triggerUpdate);
        if (enabledCheckbox) {
            enabledCheckbox.addEventListener('change', function () {
                scheduleProjectSave();
                triggerUpdate();
            });
        }
        var removeBtn = card.querySelector('.btn-remove-gravure');
        if (removeBtn) removeBtn.addEventListener('click', function () { removeEngraving(id); });
    }

    function addEngravingCard() {
        var ids = GravureRules.IDS;
        var container = document.getElementById(ids.container);
        if (!container) return;
        var id = GravureState.nextId();
        createEngravingCard(id, GravureState.getCounter(), null);
        GravureBloc.updateTitles();
        scheduleProjectSave();
    }

    function init() {
        var btn = document.getElementById(GravureRules.IDS.addButton);
        if (btn && !btn.dataset.bound) {
            btn.dataset.bound = '1';
            btn.addEventListener('click', addEngravingCard);
        }
        window.removeEngraving = removeEngraving;
        window.getEngravingsData = getEngravingsData;
        window.engravingImages = GravureState.getImages();
    }

    return {
        init: init,
        addEngravingCard: addEngravingCard,
        collectSaveState: collectSaveState,
        restoreSaveState: restoreSaveState,
        clearAllGravures: clearAllGravures
    };
})();

if (typeof GravureEvents !== 'undefined' && GravureEvents.init) GravureEvents.init();
