var Canvas2DInteractions = (function () {
    function bind(config) {
        if (!config || !config.canvas || !config.container) return;
        var canvas = config.canvas;
        var container = config.container;
        var getCamera = config.getCamera;
        var setCamera = config.setCamera;
        var draw = config.draw;
        var resize = config.resize;
        var onCameraChange = config.onCameraChange;
        var dragging = false;
        var lastMouse = { x: 0, y: 0 };

        function onViewportResize() {
            if (!container.classList.contains('hidden')) resize();
        }

        window.addEventListener('resize', onViewportResize);

        if (typeof ResizeObserver !== 'undefined') {
            var resizeObserver = new ResizeObserver(onViewportResize);
            resizeObserver.observe(container);
        }

        var observer = new MutationObserver(function () {
            if (!container.classList.contains('hidden')) setTimeout(resize, 20);
        });
        observer.observe(container, { attributes: true, attributeFilter: ['class'] });

        function notifyCameraChange() {
            if (onCameraChange) onCameraChange();
        }

        canvas.addEventListener('mousedown', function (e) {
            dragging = true;
            lastMouse = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
        });
        canvas.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            var cam = getCamera();
            cam.x += e.clientX - lastMouse.x;
            cam.y += e.clientY - lastMouse.y;
            setCamera(cam);
            lastMouse = { x: e.clientX, y: e.clientY };
            draw();
            notifyCameraChange();
        });
        window.addEventListener('mouseup', function () {
            if (dragging) notifyCameraChange();
            dragging = false;
            canvas.style.cursor = 'grab';
        });
        canvas.addEventListener('wheel', function (e) {
            e.preventDefault();
            var cam = getCamera();
            var newZoom = cam.zoom * (1 - e.deltaY * 0.001);
            if (!(newZoom > 0.1 && newZoom < 20)) return;
            var rect = canvas.getBoundingClientRect();
            var mouseX = e.clientX - rect.left;
            var mouseY = e.clientY - rect.top;
            cam.x = mouseX - (mouseX - cam.x) * (newZoom / cam.zoom);
            cam.y = mouseY - (mouseY - cam.y) * (newZoom / cam.zoom);
            cam.zoom = newZoom;
            setCamera(cam);
            draw();
            notifyCameraChange();
        });
    }

    return {
        bind: bind
    };
})();
