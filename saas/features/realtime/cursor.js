// saas/features/realtime/cursor.js
// Curseurs des autres participants, affichés par-dessus le viewport (#viewport).
// Position en coordonnées normalisées 0–1 (indépendant de la taille de l’écran).
// Broadcast throttlé via Supabase ; masquage auto si plus de nouvelles positions.

var RealtimeCursors = (function () {
    var overlay = null;
    var remoteByUser = {};
    var channel = null;
    var localCursorId = null;
    var localDisplayName = 'Vous';
    var listenersBound = false;
    var throttleTimer = null;
    var pendingCursor = null;
    var staleTimers = {};

    function cursorColors() {
        return (RealtimeRules && RealtimeRules.CURSOR_COLORS) || ['#e53935', '#8e24aa', '#1e88e5', '#43a047', '#fb8c00', '#00acc1'];
    }

    function makeCursorId(authUserId) {
        var suffix = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID().slice(0, 8)
            : Math.random().toString(36).slice(2, 10);
        return String(authUserId || 'guest') + ':' + suffix;
    }

    function colorForUser(userId) {
        var hash = 0;
        var id = String(userId || '');
        for (var i = 0; i < id.length; i++) {
            hash = ((hash << 5) - hash) + id.charCodeAt(i);
            hash |= 0;
        }
        var colors = cursorColors();
        return colors[Math.abs(hash) % colors.length];
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

    function getViewport() {
        return document.getElementById('viewport');
    }

    function ensureOverlay() {
        var viewport = getViewport();
        if (!viewport) return null;
        if (overlay && overlay.parentNode === viewport) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'realtime-cursors-overlay';
        overlay.className = 'realtime-cursors-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        viewport.appendChild(overlay);
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

    function placeCursor(el, nx, ny) {
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
        entry.el.classList.add('is-hidden');
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

    function decodePayload(raw) {
        if (!raw) return null;
        if (raw.userId !== undefined || raw.visible !== undefined) return raw;
        if (raw.payload && (raw.payload.userId !== undefined || raw.payload.visible !== undefined)) {
            return raw.payload;
        }
        return null;
    }

    // Crée ou déplace le curseur distant sur l’overlay
    function updateRemoteCursor(raw) {
        var payload = decodePayload(raw);
        if (!payload || !payload.userId || payload.userId === localCursorId) return;

        var layer = ensureOverlay();
        if (!layer) return;

        var userId = payload.userId;
        var entry = remoteByUser[userId];
        if (!entry) {
            entry = { el: createCursorElement(userId, payload.name), visible: false, nx: 0, ny: 0 };
            remoteByUser[userId] = entry;
            layer.appendChild(entry.el);
        }

        if (payload.visible === false) {
            hideRemote(userId);
            return;
        }

        if (typeof payload.x !== 'number' || typeof payload.y !== 'number') return;

        entry.nx = payload.x;
        entry.ny = payload.y;
        placeCursor(entry.el, entry.nx, entry.ny);
        entry.el.classList.remove('is-hidden');
        entry.visible = true;

        if (payload.name) {
            var label = entry.el.querySelector('.realtime-remote-cursor-label');
            if (label) label.textContent = shortName(payload.name, userId);
        }

        scheduleStaleHide(userId);
    }

    function getRelativePosition(clientX, clientY) {
        var viewport = getViewport();
        if (!viewport) return null;
        var rect = viewport.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        var x = (clientX - rect.left) / rect.width;
        var y = (clientY - rect.top) / rect.height;
        if (x < 0 || x > 1 || y < 0 || y > 1) return null;
        return { x: x, y: y };
    }

    // Envoie au plus une position toutes les CURSOR_THROTTLE_MS
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
        if (!channel || !localCursorId) return;

        if (!visible) {
            queueCursorBroadcast({
                userId: localCursorId,
                name: localDisplayName,
                visible: false,
                t: Date.now()
            });
            return;
        }

        var pos = getRelativePosition(clientX, clientY);
        if (!pos) {
            queueCursorBroadcast({
                userId: localCursorId,
                name: localDisplayName,
                visible: false,
                t: Date.now()
            });
            return;
        }

        queueCursorBroadcast({
            userId: localCursorId,
            name: localDisplayName,
            x: pos.x,
            y: pos.y,
            visible: true,
            t: Date.now()
        });
    }

    function onMouseMove(e) {
        if (!RealtimeState.isConnected()) return;
        broadcastCursor(e.clientX, e.clientY, true);
    }

    function onMouseLeave() {
        if (!RealtimeState.isConnected()) return;
        broadcastCursor(0, 0, false);
    }

    function bindListeners() {
        if (listenersBound) return;
        var viewport = getViewport();
        if (!viewport) return;
        listenersBound = true;
        viewport.addEventListener('mousemove', onMouseMove, { passive: true });
        viewport.addEventListener('mouseleave', onMouseLeave);
    }

    function unbindListeners() {
        if (!listenersBound) return;
        var viewport = getViewport();
        if (viewport) {
            viewport.removeEventListener('mousemove', onMouseMove);
            viewport.removeEventListener('mouseleave', onMouseLeave);
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

    function start(activeChannel, authUserId, displayName) {
        channel = activeChannel;
        localCursorId = makeCursorId(authUserId);
        localDisplayName = displayName || localDisplayName;
        ensureOverlay();
        bindListeners();
    }

    function stop() {
        if (channel && localCursorId) {
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
        localCursorId = null;
    }

    function handleBroadcast(msg) {
        updateRemoteCursor(msg);
    }

    function removeUser(userId) {
        if (!userId) return;
        Object.keys(remoteByUser).forEach(function (key) {
            if (key === userId || key.indexOf(userId + ':') === 0) {
                removeRemote(key);
            }
        });
    }

    return {
        start: start,
        stop: stop,
        handleBroadcast: handleBroadcast,
        removeUser: removeUser
    };
})();
