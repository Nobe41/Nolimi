// 01-saas/features/gravure/events.js
// Couche UI : création/suppression de cartes, chargement SVG, save/restore projet.
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

    function meshRules() {
        return (typeof GravureRules !== 'undefined' && GravureRules.MESH) ? GravureRules.MESH : {};
    }

    function parseSvgSize(svgText) {
        var def = meshRules().SVG_RASTER_DEFAULT || 768;
        var out = { w: def, h: def };
        if (!svgText) return out;
        var vb = svgText.match(/viewBox\s*=\s*["']?\s*([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/);
        if (vb) {
            var vw = parseFloat(vb[3]);
            var vh = parseFloat(vb[4]);
            if (isFinite(vw) && vw > 0 && isFinite(vh) && vh > 0) {
                out.w = vw;
                out.h = vh;
            }
        }
        var wm = svgText.match(/\bwidth\s*=\s*["']?\s*([-\d.eE+]+)/);
        var hm = svgText.match(/\bheight\s*=\s*["']?\s*([-\d.eE+]+)/);
        if (wm) {
            var ww = parseFloat(wm[1]);
            if (isFinite(ww) && ww > 0) out.w = ww;
        }
        if (hm) {
            var hh = parseFloat(hm[1]);
            if (isFinite(hh) && hh > 0) out.h = hh;
        }
        return out;
    }

    function svgTextToDataUrl(svgText) {
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    }

    // Charge un SVG en Image avec dimensions fiables pour le masque 3D
    function loadSvgIntoImage(svgText, done) {
        var size = parseSvgSize(svgText);
        var maxSrc = meshRules().MASK_SRC_MAX || 768;
        var scale = Math.min(1, maxSrc / Math.max(size.w, size.h, 1));
        var rw = Math.max(1, Math.round(size.w * scale));
        var rh = Math.max(1, Math.round(size.h * scale));
        var dataUrl = svgTextToDataUrl(svgText);
        var img = new Image();
        img.onload = function () {
            var nw = img.naturalWidth || img.width || rw;
            var nh = img.naturalHeight || img.height || rh;
            if (!nw || !nh) {
                nw = rw;
                nh = rh;
            }
            img.width = nw;
            img.height = nh;
            img._svgSource = svgText;
            img._svgDataUrl = dataUrl;
            done(img);
        };
        img.onerror = function () { done(null); };
        img.src = dataUrl;
    }

    function imageToDataUrl(img) {
        if (!img) return null;
        if (img._svgDataUrl) return img._svgDataUrl;
        if (img.src && (img.src.indexOf('data:image/svg') === 0 || img.src.indexOf('data:') === 0)) {
            return img.src;
        }
        try {
            var w = img.naturalWidth || img.width;
            var h = img.naturalHeight || img.height;
            if (!w || !h) return null;
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
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
                    var url = entry.imageDataUrl;
                    if (url.indexOf('data:image/svg') === 0) {
                        var raw = url.replace(/^data:image\/svg\+xml[^,]*,/, '');
                        var svgText;
                        try {
                            svgText = decodeURIComponent(raw);
                        } catch (e1) {
                            try { svgText = atob(raw); } catch (e2) { svgText = null; }
                        }
                        if (svgText) {
                            loadSvgIntoImage(svgText, function (img) {
                                if (img) GravureState.setImage(entry.id, img);
                                markDone();
                            });
                            return;
                        }
                    }
                    var img = new Image();
                    img.onload = function () {
                        if (!img.width && img.naturalWidth) img.width = img.naturalWidth;
                        if (!img.height && img.naturalHeight) img.height = img.naturalHeight;
                        GravureState.setImage(entry.id, img);
                        markDone();
                    };
                    img.onerror = markDone;
                    img.src = url;
                })(item);
            }
        }
        if (pending <= 0) finish();
    }

    function removeEngraving(id) {
        var card = document.getElementById('gravure-' + id);
        if (card && card.parentNode) card.parentNode.removeChild(card);
        if (typeof GravureState !== 'undefined' && GravureState.removeImage) GravureState.removeImage(id);
        window.engravingImages = GravureState.getImages();
        GravureBloc.updateTitles();
        scheduleProjectSave();
        triggerUpdate();
    }

    function getEngravingsData() {
        var items = [];
        var gravureItems = document.querySelectorAll('.gravure-item');
        gravureItems.forEach(function (item) {
            var parsed = GravureMath.parseItemData(item);
            if (parsed) items.push(parsed);
        });
        return items;
    }

    function bindNumericSlider(numId, sliderId) {
        var num = document.getElementById(numId);
        var slider = document.getElementById(sliderId);
        if (!num || !slider) return;
        var raf = 0;
        function scheduleMeshUpdate() {
            scheduleProjectSave();
            if (raf) return;
            raf = requestAnimationFrame(function () {
                raf = 0;
                triggerUpdate();
            });
        }
        function applyFromNum() {
            slider.value = num.value;
            scheduleMeshUpdate();
        }
        function applyFromSlider() {
            num.value = slider.value;
            scheduleMeshUpdate();
        }
        if (num.type === 'range') {
            num.addEventListener('input', applyFromNum);
        } else {
            num.addEventListener('keydown', function (e) {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                applyFromNum();
                num.blur();
            });
            num.addEventListener('change', applyFromNum);
        }
        slider.addEventListener('input', applyFromSlider);
    }

    // Charge le SVG en mémoire (GravureState) — le mesh 3D l’utilise ensuite
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
            var isSvgMime = file.type === 'image/svg+xml' || file.type === 'text/xml' || file.type === 'application/xml';
            var isSvgExt = lowerName.endsWith('.svg');
            if (!isSvgMime && !isSvgExt) {
                fileNameDisplay.textContent = 'Fichier non SVG';
                fileInput.value = '';
                return;
            }
            fileNameDisplay.textContent = file.name;
            var reader = new FileReader();
            reader.onload = function (event) {
                var svgText = event.target.result;
                if (!svgText || typeof svgText !== 'string') {
                    fileNameDisplay.textContent = 'SVG invalide';
                    return;
                }
                loadSvgIntoImage(svgText, function (img) {
                    if (!img) {
                        fileNameDisplay.textContent = 'SVG invalide';
                        return;
                    }
                    GravureState.setImage(id, img);
                    window.engravingImages = GravureState.getImages();
                    scheduleProjectSave();
                    triggerUpdate();
                });
            };
            reader.readAsText(file);
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
