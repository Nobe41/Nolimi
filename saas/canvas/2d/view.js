// saas/canvas/2d/view.js
// Caméra, zoom, souris, redimensionnement.
// Dimensions papier → Plans2DFeature (features/2d) ; pas de copie ici.

var Canvas2DView = (function () {
    var rules = (typeof Canvas2DRules !== 'undefined') ? Canvas2DRules : {};
    var FIT_RATIO = rules.VIEWPORT_FIT_RATIO != null ? rules.VIEWPORT_FIT_RATIO : 0.98;
    var MAX_DPR = rules.MAX_DPR != null ? rules.MAX_DPR : 2.5;
    var ZOOM_MIN = rules.ZOOM_MIN != null ? rules.ZOOM_MIN : 0.1;
    var ZOOM_MAX = rules.ZOOM_MAX != null ? rules.ZOOM_MAX : 20;

    var canvas = null;
    var container = null;
    var dpr = 1;
    var lastViewportSize = { w: 0, h: 0 };
    var onAfterResize = null;
    var onCameraChange = null;
    var onDraw = null;

    // Même objet tout le temps (export / cam2D / realtime y écrivent dessus)
    var cam = { x: 0, y: 0, zoom: 0 };

    // Papier : toujours Plans2DFeature (formats = features/2d/rules.js)
    function paperInfo() {
        return Plans2DFeature.getPaperInfo();
    }

    // --- Caméra ---
    function getLogicalSize() {
        if (!container) return { w: 0, h: 0 };
        return { w: container.clientWidth, h: container.clientHeight };
    }

    function getDefaultFitZoom(size) {
        var paper = paperInfo();
        return Math.min((size.w * FIT_RATIO) / paper.w, (size.h * FIT_RATIO) / paper.h);
    }

    function getCamera() {
        return cam;
    }

    // Garde la même référence d’objet
    function setCamera(next) {
        if (!next) return;
        if (typeof next.x === 'number' && isFinite(next.x)) cam.x = next.x;
        if (typeof next.y === 'number' && isFinite(next.y)) cam.y = next.y;
        if (typeof next.zoom === 'number' && isFinite(next.zoom)) cam.zoom = next.zoom;
    }

    function getDpr() {
        return dpr;
    }

    function shouldApplyDpr() {
        if (!canvas) return false;
        var size = getLogicalSize();
        if (size.w <= 0 || size.h <= 0) return false;
        return (
            canvas.width === Math.round(size.w * dpr) &&
            canvas.height === Math.round(size.h * dpr)
        );
    }

    function centerPaper() {
        var size = getLogicalSize();
        if (size.w === 0 || size.h === 0) return;
        cam.zoom = getDefaultFitZoom(size);
        cam.x = size.w / 2;
        cam.y = size.h / 2;
        lastViewportSize = { w: size.w, h: size.h };
    }

    function resize() {
        if (!canvas || !container) return;
        var size = getLogicalSize();
        if (size.w === 0 || size.h === 0) return;
        var prev = lastViewportSize;

        dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        canvas.width = Math.round(size.w * dpr);
        canvas.height = Math.round(size.h * dpr);
        canvas.style.width = size.w + 'px';
        canvas.style.height = size.h + 'px';

        if (prev.w > 0 && prev.h > 0 && cam.zoom > 0) {
            cam.x += (size.w - prev.w) / 2;
            cam.y += (size.h - prev.h) / 2;
            var oldFit = getDefaultFitZoom(prev);
            var newFit = getDefaultFitZoom(size);
            if (oldFit > 0) cam.zoom *= newFit / oldFit;
        } else {
            centerPaper();
            if (onAfterResize) onAfterResize();
            return;
        }

        lastViewportSize = { w: size.w, h: size.h };
        if (onAfterResize) onAfterResize();
    }

    // --- Souris / molette ---
    function notifyCameraChange() {
        if (onCameraChange) onCameraChange();
    }

    function bindInput() {
        if (!canvas || !container) return;

        var dragging = false;
        var lastMouse = { x: 0, y: 0 };

        function onViewportResize() {
            if (!container.classList.contains('hidden')) resize();
        }

        window.addEventListener('resize', onViewportResize);
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(onViewportResize).observe(container);
        }
        // Quand on réaffiche le plan 2D
        new MutationObserver(function () {
            if (!container.classList.contains('hidden')) setTimeout(resize, 20);
        }).observe(container, { attributes: true, attributeFilter: ['class'] });

        canvas.addEventListener('mousedown', function (e) {
            dragging = true;
            lastMouse = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
        });

        canvas.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            cam.x += e.clientX - lastMouse.x;
            cam.y += e.clientY - lastMouse.y;
            lastMouse = { x: e.clientX, y: e.clientY };
            setCamera(cam);
            if (onDraw) onDraw();
            notifyCameraChange();
        });

        window.addEventListener('mouseup', function () {
            if (dragging) notifyCameraChange();
            dragging = false;
            canvas.style.cursor = 'grab';
        });

        canvas.addEventListener('wheel', function (e) {
            e.preventDefault();
            var newZoom = cam.zoom * (1 - e.deltaY * 0.00125);
            if (newZoom <= ZOOM_MIN || newZoom >= ZOOM_MAX) return;

            var rect = canvas.getBoundingClientRect();
            var mouseX = e.clientX - rect.left;
            var mouseY = e.clientY - rect.top;
            var ratio = newZoom / cam.zoom;

            cam.x = mouseX - (mouseX - cam.x) * ratio;
            cam.y = mouseY - (mouseY - cam.y) * ratio;
            cam.zoom = newZoom;

            setCamera(cam);
            if (onDraw) onDraw();
            notifyCameraChange();
        });
    }

    function init(config) {
        canvas = config && config.canvas;
        container = config && config.container;
        onAfterResize = config && config.onAfterResize;
        onCameraChange = config && config.onCameraChange;
        onDraw = config && config.onDraw;
        bindInput();
    }

    return {
        init: init,
        getCamera: getCamera,
        setCamera: setCamera,
        getDpr: getDpr,
        shouldApplyDpr: shouldApplyDpr,
        resize: resize
    };
})();
