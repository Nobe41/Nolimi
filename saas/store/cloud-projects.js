// saas/store/cloud-projects.js
// Projets + dossiers cloud (tables Supabase public.projects / public.folders).
// Utilisé par : menu/pages/fichiers, app (Fichier → Enregistrer).

var CloudProjects = (function () {
    var TABLE = 'projects';
    var FOLDERS = 'folders';

    function getClient() {
        if (typeof NolimiAuth === 'undefined' || !NolimiAuth.getClient) return null;
        return NolimiAuth.getClient();
    }

    function mapError(error) {
        if (!error) return 'Erreur inconnue.';
        return error.message || String(error);
    }

    function requireUser() {
        var sb = getClient();
        if (!sb) {
            return Promise.reject(new Error('Configuration Supabase manquante.'));
        }
        return sb.auth.getSession().then(function (result) {
            var session = result && result.data ? result.data.session : null;
            var user = session && session.user ? session.user : null;
            if (!user) {
                return Promise.reject(new Error('Vous devez être connecté.'));
            }
            if (user.is_anonymous === true) {
                return Promise.reject(new Error('Compte invité : connexion requise pour Fichiers.'));
            }
            return { sb: sb, user: user };
        });
    }

    function isUuid(id) {
        return !!(id && /^[0-9a-f-]{36}$/i.test(String(id)));
    }

    // --- Dossiers ---

    function listFolders(parentId) {
        return requireUser().then(function (ctx) {
            var q = ctx.sb
                .from(FOLDERS)
                .select('id, name, parent_id, created_at')
                .eq('user_id', ctx.user.id)
                .order('name', { ascending: true });

            if (parentId && isUuid(parentId)) {
                q = q.eq('parent_id', parentId);
            } else {
                q = q.is('parent_id', null);
            }

            return q.then(function (result) {
                if (result.error) return Promise.reject(result.error);
                return result.data || [];
            });
        });
    }

    function listAllFolders() {
        return requireUser().then(function (ctx) {
            return ctx.sb
                .from(FOLDERS)
                .select('id, name, parent_id, created_at')
                .eq('user_id', ctx.user.id)
                .order('name', { ascending: true })
                .then(function (result) {
                    if (result.error) return Promise.reject(result.error);
                    return result.data || [];
                });
        });
    }

    function getFolder(folderId) {
        if (!isUuid(folderId)) {
            return Promise.resolve(null);
        }
        return requireUser().then(function (ctx) {
            return ctx.sb
                .from(FOLDERS)
                .select('id, name, parent_id, created_at')
                .eq('id', folderId)
                .eq('user_id', ctx.user.id)
                .maybeSingle()
                .then(function (result) {
                    if (result.error) return Promise.reject(result.error);
                    return result.data || null;
                });
        });
    }

    function createFolder(name, parentId) {
        return requireUser().then(function (ctx) {
            var row = {
                user_id: ctx.user.id,
                name: String(name || '').trim() || 'Nouveau dossier',
                parent_id: (parentId && isUuid(parentId)) ? parentId : null
            };
            return ctx.sb
                .from(FOLDERS)
                .insert(row)
                .select('id, name, parent_id, created_at')
                .single()
                .then(function (result) {
                    if (result.error) return Promise.reject(result.error);
                    return result.data;
                });
        });
    }

    function removeFolder(folderId) {
        return requireUser().then(function (ctx) {
            return ctx.sb
                .from(FOLDERS)
                .delete()
                .eq('id', folderId)
                .eq('user_id', ctx.user.id)
                .then(function (result) {
                    if (result.error) return Promise.reject(result.error);
                    return true;
                });
        });
    }

    // Chemins plats pour le sélecteur à l’enregistrement
    function listFoldersWithPaths() {
        return listAllFolders().then(function (folders) {
            var byId = {};
            folders.forEach(function (f) { byId[f.id] = f; });

            function pathOf(folder) {
                var parts = [];
                var cur = folder;
                var guard = 0;
                while (cur && guard < 40) {
                    parts.unshift(cur.name);
                    cur = cur.parent_id ? byId[cur.parent_id] : null;
                    guard += 1;
                }
                return parts.join(' / ');
            }

            return folders
                .map(function (f) {
                    return { id: f.id, name: f.name, parent_id: f.parent_id, path: pathOf(f) };
                })
                .sort(function (a, b) {
                    return a.path.localeCompare(b.path, 'fr');
                });
        });
    }

    function buildBreadcrumb(folderId) {
        if (!folderId) return Promise.resolve([]);
        return listAllFolders().then(function (folders) {
            var byId = {};
            folders.forEach(function (f) { byId[f.id] = f; });
            var crumbs = [];
            var cur = byId[folderId];
            var guard = 0;
            while (cur && guard < 40) {
                crumbs.unshift({ id: cur.id, name: cur.name });
                cur = cur.parent_id ? byId[cur.parent_id] : null;
                guard += 1;
            }
            return crumbs;
        });
    }

    // --- Projets ---

    function list(folderId) {
        return requireUser().then(function (ctx) {
            var q = ctx.sb
                .from(TABLE)
                .select('id, name, folder_id, created_at, updated_at')
                .eq('user_id', ctx.user.id)
                .order('name', { ascending: true });

            if (folderId && isUuid(folderId)) {
                q = q.eq('folder_id', folderId);
            } else {
                q = q.is('folder_id', null);
            }

            return q.then(function (result) {
                if (result.error) return Promise.reject(result.error);
                return result.data || [];
            });
        });
    }

    function listContents(folderId) {
        return Promise.all([
            listFolders(folderId || null),
            list(folderId || null)
        ]).then(function (parts) {
            var folders = parts[0] || [];
            var projects = parts[1] || [];
            if (!folders.length) {
                return { folders: folders, projects: projects };
            }
            return requireUser().then(function (ctx) {
                var ids = folders.map(function (f) { return f.id; });
                return ctx.sb
                    .from(TABLE)
                    .select('folder_id')
                    .eq('user_id', ctx.user.id)
                    .in('folder_id', ids)
                    .then(function (result) {
                        if (result.error) return Promise.reject(result.error);
                        var counts = {};
                        (result.data || []).forEach(function (row) {
                            if (!row.folder_id) return;
                            counts[row.folder_id] = (counts[row.folder_id] || 0) + 1;
                        });
                        folders.forEach(function (folder) {
                            folder.projectCount = counts[folder.id] || 0;
                        });
                        return { folders: folders, projects: projects };
                    });
            });
        });
    }

    function get(projectId) {
        return requireUser().then(function (ctx) {
            return ctx.sb
                .from(TABLE)
                .select('id, name, folder_id, data, created_at, updated_at')
                .eq('id', projectId)
                .eq('user_id', ctx.user.id)
                .maybeSingle()
                .then(function (result) {
                    if (result.error) return Promise.reject(result.error);
                    if (!result.data) return Promise.reject(new Error('Projet introuvable.'));
                    return result.data;
                });
        });
    }

    function create(name, data, folderId) {
        return requireUser().then(function (ctx) {
            var row = {
                user_id: ctx.user.id,
                name: String(name || 'Sans titre').trim() || 'Sans titre',
                data: data || {},
                folder_id: (folderId && isUuid(folderId)) ? folderId : null,
                updated_at: new Date().toISOString()
            };
            return ctx.sb
                .from(TABLE)
                .insert(row)
                .select('id, name, folder_id, data, created_at, updated_at')
                .single()
                .then(function (result) {
                    if (result.error) return Promise.reject(result.error);
                    return result.data;
                });
        });
    }

    function update(projectId, fields) {
        return requireUser().then(function (ctx) {
            var patch = { updated_at: new Date().toISOString() };
            if (fields && typeof fields.name === 'string') {
                patch.name = fields.name.trim() || 'Sans titre';
            }
            if (fields && fields.data != null) {
                patch.data = fields.data;
            }
            if (fields && Object.prototype.hasOwnProperty.call(fields, 'folder_id')) {
                patch.folder_id = (fields.folder_id && isUuid(fields.folder_id))
                    ? fields.folder_id
                    : null;
            }
            return ctx.sb
                .from(TABLE)
                .update(patch)
                .eq('id', projectId)
                .eq('user_id', ctx.user.id)
                .select('id, name, folder_id, data, created_at, updated_at')
                .single()
                .then(function (result) {
                    if (result.error) return Promise.reject(result.error);
                    return result.data;
                });
        });
    }

    function remove(projectId) {
        return requireUser().then(function (ctx) {
            return ctx.sb
                .from(TABLE)
                .delete()
                .eq('id', projectId)
                .eq('user_id', ctx.user.id)
                .then(function (result) {
                    if (result.error) return Promise.reject(result.error);
                    return true;
                });
        });
    }

    // Demande le dossier cible (null = racine, undefined = annulé).
    // force=true → affiche même s’il n’y a aucun dossier (uniquement racine).
    function askFolderId(options) {
        var force = !!(options && options.force);
        return listFoldersWithPaths().then(function (folders) {
            if (!folders.length && !force) return null;

            return new Promise(function (resolve) {
                var overlay = document.createElement('div');
                overlay.className = 'nolimi-folder-picker';
                overlay.innerHTML = [
                    '<div class="nolimi-folder-picker__panel" role="dialog" aria-modal="true" aria-labelledby="nolimi-folder-picker-title">',
                    '  <h2 id="nolimi-folder-picker-title" class="nolimi-folder-picker__title">' +
                        escapeHtml((options && options.title) || 'Choisir un dossier') + '</h2>',
                    '  <p class="nolimi-folder-picker__lead">' +
                        escapeHtml((options && options.lead) || 'Où enregistrer ce projet ?') + '</p>',
                    '  <label class="nolimi-folder-picker__label">',
                    '    <span>Dossier</span>',
                    '    <select id="nolimi-folder-picker-select" class="nolimi-folder-picker__select">',
                    '      <option value="">À la racine (Fichiers)</option>',
                    folders.map(function (f) {
                        return '<option value="' + f.id + '">' + escapeHtml(f.path) + '</option>';
                    }).join(''),
                    '    </select>',
                    '  </label>',
                    '  <div class="nolimi-folder-picker__actions">',
                    '    <button type="button" class="nolimi-folder-picker__btn" data-action="cancel">Annuler</button>',
                    '    <button type="button" class="nolimi-folder-picker__btn nolimi-folder-picker__btn--primary" data-action="ok">Valider</button>',
                    '  </div>',
                    '</div>'
                ].join('');

                ensurePickerStyles();
                document.body.appendChild(overlay);

                var select = overlay.querySelector('#nolimi-folder-picker-select');
                if (select && options && Object.prototype.hasOwnProperty.call(options, 'currentFolderId')) {
                    select.value = options.currentFolderId || '';
                }

                function finish(value) {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve(value);
                }

                overlay.addEventListener('click', function (e) {
                    if (e.target === overlay) finish(undefined);
                });

                overlay.querySelector('[data-action="cancel"]').addEventListener('click', function () {
                    finish(undefined);
                });

                overlay.querySelector('[data-action="ok"]').addEventListener('click', function () {
                    var val = select && select.value ? select.value : null;
                    finish(val || null);
                });
            });
        });
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function ensurePickerStyles() {
        if (document.getElementById('nolimi-folder-picker-styles')) return;
        var style = document.createElement('style');
        style.id = 'nolimi-folder-picker-styles';
        style.textContent = [
            '.nolimi-folder-picker{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(10,10,11,.35);padding:1rem;}',
            '.nolimi-folder-picker__panel{width:100%;max-width:22rem;background:#fff;border-radius:10px;padding:1.15rem 1.2rem;box-shadow:0 8px 28px rgba(0,0,0,.16);}',
            '.nolimi-folder-picker__title{margin:0 0 .35rem;font-size:1.05rem;font-weight:600;}',
            '.nolimi-folder-picker__lead{margin:0 0 1rem;font-size:.85rem;color:#6b6b73;}',
            '.nolimi-folder-picker__label{display:flex;flex-direction:column;gap:.4rem;font-size:.8rem;color:#6b6b73;}',
            '.nolimi-folder-picker__select{width:100%;padding:.55rem .65rem;font:inherit;font-size:.9rem;color:#0a0a0b;border:1px solid #ccc;border-radius:6px;background:#fff;}',
            '.nolimi-folder-picker__actions{display:flex;justify-content:flex-end;gap:.5rem;margin-top:1.1rem;}',
            '.nolimi-folder-picker__btn{padding:.45rem .9rem;font:inherit;font-size:.85rem;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer;}',
            '.nolimi-folder-picker__btn--primary{background:#5cb3ff;border-color:#5cb3ff;color:#fff;}',
            '.nolimi-folder-picker__btn--primary:hover{background:#4aa6f7;}'
        ].join('');
        document.head.appendChild(style);
    }

    function getProjectIdFromUrl() {
        try {
            var id = new URLSearchParams(window.location.search).get('project');
            if (isUuid(id)) return id;
        } catch (e) { /* ignore */ }
        return '';
    }

    function setProjectIdInUrl(projectId) {
        try {
            var u = new URL(window.location.href);
            if (projectId) u.searchParams.set('project', projectId);
            else u.searchParams.delete('project');
            window.history.replaceState({}, '', u.href);
        } catch (e) { /* ignore */ }
    }

    return {
        list: list,
        listContents: listContents,
        listFolders: listFolders,
        listAllFolders: listAllFolders,
        listFoldersWithPaths: listFoldersWithPaths,
        buildBreadcrumb: buildBreadcrumb,
        getFolder: getFolder,
        createFolder: createFolder,
        removeFolder: removeFolder,
        get: get,
        create: create,
        update: update,
        remove: remove,
        askFolderId: askFolderId,
        mapError: mapError,
        getProjectIdFromUrl: getProjectIdFromUrl,
        setProjectIdInUrl: setProjectIdInUrl
    };
})();
