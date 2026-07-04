// Curseurs distants — position normalisée sur la fenêtre (0–1), même place relative quel que soit le format d'écran.
var RealtimeCursors = (function () {
    var overlay = null;
    var remoteByUser = {};
    var channel = null;
    var localUserId = null;
    var localDisplayName = 'Vous';
    var listenersBound = false;
    var throttleTimer = null;
    var pendingCursor = null;
    var staleTimers = {};

    var COLORS = ['#e53935', '#8e24aa', '#1e88e5', '#43a047', '#fb8c00', '#00acc1'];
    var COORD_SPACE = 'window';

    function colorForUser(userId) {
        var hash = 0;
        var id = String(userId || '');
        for (var i = 0; i < id.length; i++) {
            hash = ((hash << 5) - hash) + id.charCodeAt(i);
            hash |= 0;
        }
        return COLORS[Math.abs(hash) % COLORS.length];
    }

    function shortName(name, userId) {
        var n = String(name || '').trim();
        if (n) {
            if (n.indexOf('@') !== -1) n = n.split('@')[0];
            if (n.length > 14) n = n.slice(0, 14);
            return n;
        }
        return 'Invité ' + String(userId || '').slice(0, 4);
    }

    function getScreenMetrics() {
        var el = document.documentElement;
        return {
            w: el.clientWidth || window.innerWidth,
            h: el.clientHeight || window.innerHeight
        };
    }

    function clientToNormalized(clientX, clientY) {
        var m = getScreenMetrics();
        if (!m.w || !m.h) return null;
        return {
            x: Math.max(0, Math.min(1, clientX / m.w)),
            y: Math.max(0, Math.min(1, clientY / m.h))
        };
    }

    function removeLegacyViewportOverlay() {
        var viewport = document.getElementById('viewport');
        if (!viewport) return;
        var legacy = viewport.querySelector('#realtime-cursors-overlay');
        if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);
    }

    function ensureOverlay() {
        var root = document.body;
        if (!root) return null;
        removeLegacyViewportOverlay();
        if (overlay && overlay.parentNode === root) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'realtime-cursors-overlay';
        overlay.className = 'realtime-cursors-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        root.appendChild(overlay);
        return overlay;
    }

    function createCursorElement(userId, name) {
        var color = colorForUser(userId);
        var el = document.createElement('div');
        el.className = 'realtime-remote-cursor';
        el.dataset.userId = userId;
        el.innerHTML =
            '<svg class="realtime-remote-cursor-icon" width="16" height="22" viewBox="0 0 16 22" aria-hidden="true">'
            + '<path fill="' + color + '" stroke="#fff" stroke-width="1.2" d="M1 1l4.2 14.5 2.4-5.4 5.4-2.4L1 1z"></path>'
            + '</svg>'
            + '<span class="realtime-remote-cursor-label" style="background:' + color + '">' + shortName(name, userId) + '</span>';
        return el;
    }

    function placeCursorElement(el, nx, ny) {
        el.style.left = (nx * 100) + '%';
        el.style.top = (ny * 100) + '%';
    }

    function scheduleStaleHide(userId) {
        if (staleTimers[userId]) clearTimeout(staleTimers[userId]);
        staleTimers[userId] = setTimeout(function () {
            hideRemote(userId);
        }, RealtimeRules.CURSOR_STALE_MS);
    }

    function hideRemote(userId) {
        var entry = remoteByUser[userId];
        if (!entry || !entry.el) return;
        entry.el.classList.add('hidden');
        entry.visible = false;
    }

    function removeRemote(userId) {
        if (staleTimers[userId]) {
            clearTimeout(staleTimers[userId]);
            delete staleTimers[userId];
        }
        var entry = remoteByUser[userId];
        if (entry && entry.el && entry.el.parentNode) {
            entry.el.parentNode.removeChild(entry.el);
        }
        delete remoteByUser[userId];
    }

    function viewportPayloadToWindow(vx, vy) {
        var viewport = document.getElementById('viewport');
        if (!viewport) return { x: vx, y: vy };
        var rect = viewport.getBoundingClientRect();
        if (!rect.width || !rect.height) return { x: vx, y: vy };
        return clientToNormalized(
            rect.left + vx * rect.width,
            rect.top + vy * rect.height
        ) || { x: vx, y: vy };
    }

    function parseNormalizedPayload(payload) {
        if (!payload || typeof payload.x !== 'number' || typeof payload.y !== 'number') return null;
        if (payload.space === COORD_SPACE || payload.space === 'window') {
            return { x: payload.x, y: payload.y };
        }
        return viewportPayloadToWindow(payload.x, payload.y);
    }

    function updateRemoteCursor(payload) {
        if (!payload || !payload.userId || payload.userId === localUserId) return;

        var layer = ensureOverlay();
        if (!layer) return;

        var userId = payload.userId;
        var entry = remoteByUser[userId];
        if (!entry) {
            entry = {
                el: createCursorElement(userId, payload.name),
                visible: false,
                nx: 0,
                ny: 0
            };
            remoteByUser[userId] = entry;
            layer.appendChild(entry.el);
        }

        if (payload.visible === false) {
            hideRemote(userId);
            return;
        }

        var norm = parseNormalizedPayload(payload);
        if (!norm) return;

        entry.nx = norm.x;
        entry.ny = norm.y;
        placeCursorElement(entry.el, entry.nx, entry.ny);
        entry.el.classList.remove('hidden');
        entry.visible = true;

        if (payload.name) {
            var label = entry.el.querySelector('.realtime-remote-cursor-label');
            if (label) label.textContent = shortName(payload.name, userId);
        }

        scheduleStaleHide(userId);
    }

    function repositionAllRemote() {
        Object.keys(remoteByUser).forEach(function (userId) {
            var entry = remoteByUser[userId];
            if (!entry || !entry.visible) return;
            placeCursorElement(entry.el, entry.nx, entry.ny);
        });
    }

    function flushCursorBroadcast() {
        throttleTimer = null;
        if (!channel || !pendingCursor) return;
        channel.send({
            type: 'broadcast',
            event: 'cursor',
            payload: pendingCursor
        });
        pendingCursor = null;
    }

    function queueCursorBroadcast(payload) {
        pendingCursor = payload;
        if (throttleTimer) return;
        throttleTimer = setTimeout(flushCursorBroadcast, RealtimeRules.CURSOR_THROTTLE_MS);
    }

    function broadcastCursor(clientX, clientY, visible) {
        if (!channel || !localUserId) return;

        if (!visible) {
            queueCursorBroadcast({
                userId: localUserId,
                name: localDisplayName,
                visible: false,
                t: Date.now()
            });
            return;
        }

        var pos = clientToNormalized(clientX, clientY);
        if (!pos) {
            queueCursorBroadcast({
                userId: localUserId,
                name: localDisplayName,
                visible: false,
                t: Date.now()
            });
            return;
        }

        queueCursorBroadcast({
            userId: localUserId,
            name: localDisplayName,
            x: pos.x,
            y: pos.y,
            space: COORD_SPACE,
            visible: true,
            t: Date.now()
        });
    }

    function onPointerMove(e) {
        if (!RealtimeState.isConnected()) return;
        if (e.pointerType === 'touch') return;
        broadcastCursor(e.clientX, e.clientY, true);
    }

    function onMouseLeave() {
        if (!RealtimeState.isConnected()) return;
        broadcastCursor(0, 0, false);
    }

    function onDocumentMouseOut(e) {
        if (e.relatedTarget || e.toElement) return;
        onMouseLeave();
    }

    function onViewportChange() {
        repositionAllRemote();
    }

    function bindListeners() {
        if (listenersBound) return;
        listenersBound = true;
        document.addEventListener('pointermove', onPointerMove, true);
        document.addEventListener('mouseout', onDocumentMouseOut);
        window.addEventListener('blur', onMouseLeave);
        window.addEventListener('resize', onViewportChange);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', onViewportChange);
        }
    }

    function unbindListeners() {
        if (!listenersBound) return;
        document.removeEventListener('pointermove', onPointerMove, true);
        document.removeEventListener('mouseout', onDocumentMouseOut);
        window.removeEventListener('blur', onMouseLeave);
        window.removeEventListener('resize', onViewportChange);
        if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', onViewportChange);
        }
        listenersBound = false;
    }

    function clearAll() {
        Object.keys(remoteByUser).forEach(removeRemote);
        if (throttleTimer) {
            clearTimeout(throttleTimer);
            throttleTimer = null;
        }
        pendingCursor = null;
        Object.keys(staleTimers).forEach(function (key) {
            clearTimeout(staleTimers[key]);
        });
        staleTimers = {};
    }

    function start(activeChannel, userId, displayName) {
        channel = activeChannel;
        localUserId = userId;
        localDisplayName = displayName || localDisplayName;
        ensureOverlay();
        bindListeners();
    }

    function stop() {
        if (channel && localUserId) {
            broadcastCursor(0, 0, false);
            flushCursorBroadcast();
        }
        unbindListeners();
        clearAll();
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        overlay = null;
        channel = null;
        localUserId = null;
    }

    function handleBroadcast(payload) {
        updateRemoteCursor(payload);
    }

    function removeUser(userId) {
        removeRemote(userId);
    }

    return {
        start: start,
        stop: stop,
        handleBroadcast: handleBroadcast,
        removeUser: removeUser
    };
})();
