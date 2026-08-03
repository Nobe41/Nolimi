// 02-menu/components/notif-reads/ — état lu des notifications, par compte.
// Source de vérité : table Supabase notification_reads (sync multi-appareils).
// Cache localStorage pour affichage rapide / hors-ligne ; migré au premier sync.

(function (global) {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;
    var STORAGE_PREFIX = 'nolimi_notif_read_ids:';
    var TABLE = 'notification_reads';

    var currentUserId = null;
    var cachedIds = null; // null = pas encore syncé
    var syncPromise = null;

    function storageKey() {
        return STORAGE_PREFIX + (currentUserId || 'anon');
    }

    function uniqueIds(ids) {
        var out = [];
        var seen = {};
        (ids || []).forEach(function (id) {
            if (!id || seen[id]) return;
            seen[id] = true;
            out.push(String(id));
        });
        return out;
    }

    function readLocal() {
        try {
            var raw = localStorage.getItem(storageKey());
            if (raw == null) return [];
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? uniqueIds(parsed) : [];
        } catch (e) {
            return [];
        }
    }

    function writeLocal(ids) {
        cachedIds = uniqueIds(ids);
        try {
            localStorage.setItem(storageKey(), JSON.stringify(cachedIds));
        } catch (e) {}
        return cachedIds;
    }

    function getClient() {
        if (Auth && Auth.getClient) return Auth.getClient();
        return null;
    }

    function setUser(user) {
        var nextId = user && user.id ? String(user.id) : null;
        if (nextId !== currentUserId) {
            currentUserId = nextId;
            cachedIds = null;
            syncPromise = null;
        }
    }

    function getReadIds() {
        if (cachedIds) return cachedIds.slice();
        return readLocal();
    }

    function fetchRemoteIds(sb, userId) {
        return sb
            .from(TABLE)
            .select('notification_id')
            .eq('user_id', userId)
            .then(function (result) {
                if (result.error) throw result.error;
                var rows = result.data || [];
                return rows.map(function (row) { return row.notification_id; });
            });
    }

    function upsertRemoteIds(sb, userId, ids) {
        if (!ids || !ids.length) return Promise.resolve();
        var rows = ids.map(function (id) {
            return { user_id: userId, notification_id: id };
        });
        return sb
            .from(TABLE)
            .upsert(rows, { onConflict: 'user_id,notification_id' })
            .then(function (result) {
                if (result.error) throw result.error;
            });
    }

    // Charge le serveur, fusionne avec le cache local (migration), renvoie les ids lus.
    function sync() {
        if (syncPromise) return syncPromise;

        var local = readLocal();
        var sb = getClient();

        if (!sb || !currentUserId) {
            cachedIds = local;
            return Promise.resolve(cachedIds.slice());
        }

        syncPromise = fetchRemoteIds(sb, currentUserId)
            .then(function (remote) {
                var merged = uniqueIds(local.concat(remote || []));
                writeLocal(merged);

                // Migrer vers le serveur les lectures locales absentes côté cloud
                var remoteSet = {};
                (remote || []).forEach(function (id) { remoteSet[id] = true; });
                var toUpload = merged.filter(function (id) { return !remoteSet[id]; });
                if (!toUpload.length) return merged;

                return upsertRemoteIds(sb, currentUserId, toUpload)
                    .then(function () { return merged; })
                    .catch(function () { return merged; });
            })
            .catch(function () {
                // Hors-ligne / table absente : rester sur le cache local
                cachedIds = local;
                return cachedIds.slice();
            })
            .then(function (ids) {
                syncPromise = null;
                return ids.slice();
            });

        return syncPromise;
    }

    function markRead(id) {
        if (!id) return Promise.resolve(getReadIds());
        var ids = getReadIds();
        if (ids.indexOf(id) !== -1) return Promise.resolve(ids);

        ids.push(id);
        writeLocal(ids);

        var sb = getClient();
        if (!sb || !currentUserId) return Promise.resolve(ids.slice());

        return upsertRemoteIds(sb, currentUserId, [id])
            .then(function () { return ids.slice(); })
            .catch(function () { return ids.slice(); });
    }

    function markAllRead(ids) {
        var next = uniqueIds(ids);
        var prev = getReadIds();
        var prevSet = {};
        prev.forEach(function (id) { prevSet[id] = true; });
        var added = next.filter(function (id) { return !prevSet[id]; });

        writeLocal(next);

        var sb = getClient();
        if (!sb || !currentUserId || !added.length) {
            return Promise.resolve(next.slice());
        }

        return upsertRemoteIds(sb, currentUserId, added)
            .then(function () { return next.slice(); })
            .catch(function () { return next.slice(); });
    }

    function prune(validIds) {
        var valid = {};
        (validIds || []).forEach(function (id) { valid[id] = true; });
        var next = getReadIds().filter(function (id) { return valid[id]; });
        writeLocal(next);
        return next.slice();
    }

    function unreadCount(total) {
        var all = typeof total === 'number' ? total : 0;
        return Math.max(0, all - getReadIds().length);
    }

    global.NolimiNotifReads = {
        setUser: setUser,
        sync: sync,
        getReadIds: getReadIds,
        markRead: markRead,
        markAllRead: markAllRead,
        prune: prune,
        unreadCount: unreadCount
    };
})(window);
