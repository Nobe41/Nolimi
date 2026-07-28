// 02-menu/pages/fichiers/ — dossiers + projets perso + collaboratifs.

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;
    var Cloud = typeof CloudProjects !== 'undefined' ? CloudProjects : null;
    var pageAbort = new AbortController();
    var pageSignal = pageAbort.signal;

    window.__nolimiPageCleanup = function () {
        pageAbort.abort();
        window.__nolimiPageCleanup = null;
    };

    var statusEl = document.getElementById('fichiers-status');
    var listEl = document.getElementById('fichiers-list');
    var breadcrumbEl = document.getElementById('fichiers-breadcrumb');
    var titleEl = document.getElementById('fichiers-title');
    var btnCreateFolder = document.getElementById('btn-create-folder');
    var btnNewProject = document.getElementById('btn-new-project');

    var collabStatusEl = document.getElementById('collab-status');
    var collabListEl = document.getElementById('collab-list');
    var collabTitleEl = document.getElementById('collab-title');
    var collabBreadcrumbEl = document.getElementById('collab-breadcrumb');
    var btnNewCollabProject = document.getElementById('btn-new-collab-project');

    var folderModal = document.getElementById('folder-modal');
    var folderModalName = document.getElementById('folder-modal-name');
    var folderModalParent = document.getElementById('folder-modal-parent');
    var folderModalPersonal = document.getElementById('folder-modal-personal');
    var folderModalCollab = document.getElementById('folder-modal-collab');
    var folderModalMembers = document.getElementById('folder-modal-members');
    var folderModalError = document.getElementById('folder-modal-error');
    var folderModalCancel = document.getElementById('folder-modal-cancel');
    var folderModalSubmit = document.getElementById('folder-modal-submit');

    var openMenuWrap = null;
    var currentFolderId = null;
    var currentCollabId = null;
    var currentUserEmail = '';
    var currentUserId = '';
    var accessToken = '';

    var ICON_FOLDER = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10.4 5.5H5.8A2.3 2.3 0 0 0 3.5 7.8v8.9A2.3 2.3 0 0 0 5.8 19h12.4a2.3 2.3 0 0 0 2.3-2.3V9.6a2.3 2.3 0 0 0-2.3-2.3h-6.1l-1.7-1.8Z"/></svg>';
    var ICON_FILE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v15A1.5 1.5 0 0 0 7 21.5h10A1.5 1.5 0 0 0 18.5 20V8.5L14 3.5Zm0 1.6 3.4 3.4H14.5a.5.5 0 0 1-.5-.5V5.1Z"/></svg>';
    var ICON_EMPTY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8A2.5 2.5 0 0 1 6 5.5h4l2 2h6A2.5 2.5 0 0 1 20.5 10v7A2.5 2.5 0 0 1 18 19.5H6A2.5 2.5 0 0 1 3.5 17V8Z"/></svg>';

    function setStatus(text, isError, isEmpty) {
        if (!statusEl) return;
        statusEl.classList.toggle('fichiers-status--error', !!isError);
        statusEl.classList.toggle('fichiers-status--empty', !!isEmpty && !isError);
        if (isEmpty && text && !isError) {
            statusEl.innerHTML = ICON_EMPTY + '<span>' + text + '</span>';
        } else {
            statusEl.textContent = text || '';
        }
        statusEl.hidden = !text;
    }

    function setCollabStatus(text, isError, isEmpty) {
        if (!collabStatusEl) return;
        collabStatusEl.classList.toggle('fichiers-status--error', !!isError);
        collabStatusEl.classList.toggle('fichiers-status--empty', !!isEmpty && !isError);
        if (isEmpty && text && !isError) {
            collabStatusEl.innerHTML = ICON_EMPTY + '<span>' + text + '</span>';
        } else {
            collabStatusEl.textContent = text || '';
        }
        collabStatusEl.hidden = !text;
    }

    function pad2(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function formatModifiedDate(iso) {
        if (!iso) return '—';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '—';
            return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() +
                ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
        } catch (e) {
            return '—';
        }
    }

    function filesLabel(count) {
        var n = count || 0;
        return n <= 1 ? (n + ' fichier') : (n + ' fichiers');
    }

    function sortByName(items) {
        return (items || []).slice().sort(function (a, b) {
            return String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' });
        });
    }

    function openProject(projectId) {
        if (!Auth || !Auth.getAppUrl) return;
        window.location.href = Auth.getAppUrl(null, projectId);
    }

    function moveProject(row) {
        Cloud.askFolderId({
            force: true,
            title: 'Déplacer le fichier',
            lead: 'Choisir le dossier de destination pour « ' + (row.name || 'Sans titre') + ' ».',
            currentFolderId: row.folder_id || null
        }).then(function (folderId) {
            if (typeof folderId === 'undefined') return;
            return Cloud.update(row.id, { folder_id: folderId }).then(refreshPersonal);
        }).catch(function (err) {
            alert(Cloud.mapError(err));
        });
    }

    function closeOpenMenu() {
        if (!openMenuWrap) return;
        var dropdown = openMenuWrap.querySelector('.fichiers-menu-dropdown');
        var btn = openMenuWrap.querySelector('.fichiers-menu-btn');
        if (dropdown) {
            dropdown.hidden = true;
            dropdown.style.position = '';
            dropdown.style.top = '';
            dropdown.style.left = '';
            dropdown.style.right = '';
            dropdown.style.bottom = '';
        }
        if (btn) btn.setAttribute('aria-expanded', 'false');
        openMenuWrap.classList.remove('is-open');
        openMenuWrap = null;
    }

    function positionMenuDropdown(wrap, dropdown) {
        var btn = wrap.querySelector('.fichiers-menu-btn');
        if (!btn) return;
        var rect = btn.getBoundingClientRect();
        var menuWidth = Math.max(dropdown.offsetWidth || 136, 136);
        var menuHeight = dropdown.offsetHeight || 120;
        var left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8);
        left = Math.max(8, left);
        var top = rect.bottom + 4;
        if (top + menuHeight > window.innerHeight - 8) {
            top = Math.max(8, rect.top - menuHeight - 4);
        }
        dropdown.style.position = 'fixed';
        dropdown.style.top = top + 'px';
        dropdown.style.left = left + 'px';
        dropdown.style.right = 'auto';
        dropdown.style.bottom = 'auto';
    }

    function toggleMenu(wrap) {
        var dropdown = wrap.querySelector('.fichiers-menu-dropdown');
        var btn = wrap.querySelector('.fichiers-menu-btn');
        if (!dropdown || !btn) return;
        if (openMenuWrap === wrap) {
            closeOpenMenu();
            return;
        }
        closeOpenMenu();
        dropdown.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        wrap.classList.add('is-open');
        openMenuWrap = wrap;
        positionMenuDropdown(wrap, dropdown);
    }

    function buildMenu(actions) {
        var menuWrap = document.createElement('div');
        menuWrap.className = 'fichiers-item__menu';

        var menuBtn = document.createElement('button');
        menuBtn.type = 'button';
        menuBtn.className = 'fichiers-menu-btn';
        menuBtn.setAttribute('aria-label', 'Actions');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.setAttribute('aria-haspopup', 'true');
        menuBtn.textContent = '⋯';

        var dropdown = document.createElement('div');
        dropdown.className = 'fichiers-menu-dropdown';
        dropdown.hidden = true;
        dropdown.setAttribute('role', 'menu');

        actions.forEach(function (action) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'fichiers-menu-item' + (action.danger ? ' fichiers-menu-item--danger' : '');
            btn.setAttribute('role', 'menuitem');
            btn.textContent = action.label;
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                closeOpenMenu();
                action.onClick();
            });
            dropdown.appendChild(btn);
        });

        menuBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleMenu(menuWrap);
        });

        dropdown.addEventListener('click', function (e) {
            e.stopPropagation();
        });

        menuWrap.appendChild(menuBtn);
        menuWrap.appendChild(dropdown);
        return menuWrap;
    }

    function buildIcon(svg, kind) {
        var wrap = document.createElement('div');
        wrap.className = 'fichiers-item__icon fichiers-item__icon--' + (kind || 'folder');
        wrap.innerHTML = svg;
        return wrap;
    }

    function buildRow(options) {
        var li = document.createElement('li');
        li.className = 'fichiers-item' + (options.folder ? ' fichiers-item--folder' : '');

        var nameCell = document.createElement('div');
        nameCell.className = 'fichiers-item__name-cell';
        nameCell.appendChild(buildIcon(options.icon, options.iconKind));
        var name = document.createElement('div');
        name.className = 'fichiers-item__name';
        name.textContent = options.name;
        nameCell.appendChild(name);

        var count = document.createElement('div');
        count.className = 'fichiers-item__count';
        count.textContent = options.countText;

        var date = document.createElement('div');
        date.className = 'fichiers-item__date';
        date.textContent = options.dateText;

        li.appendChild(nameCell);
        li.appendChild(count);
        li.appendChild(date);
        li.appendChild(options.menu);
        return li;
    }

    function renderBreadcrumb(crumbs) {
        if (!breadcrumbEl) return;
        breadcrumbEl.innerHTML = '';
        if (titleEl) titleEl.textContent = 'Mes projets';

        if (!crumbs || !crumbs.length) {
            breadcrumbEl.hidden = true;
            return;
        }

        breadcrumbEl.hidden = false;

        crumbs.forEach(function (crumb, index) {
            var sep = document.createElement('span');
            sep.className = 'fichiers-breadcrumb__sep';
            sep.textContent = '/';
            breadcrumbEl.appendChild(sep);

            if (index === crumbs.length - 1) {
                var current = document.createElement('span');
                current.className = 'fichiers-breadcrumb__current';
                current.textContent = crumb.name;
                breadcrumbEl.appendChild(current);
            } else {
                var link = document.createElement('button');
                link.type = 'button';
                link.className = 'fichiers-breadcrumb__link';
                link.textContent = crumb.name;
                link.addEventListener('click', function () { navigateTo(crumb.id); });
                breadcrumbEl.appendChild(link);
            }
        });
    }

    function renameFolder(folder) {
        var next = prompt('Nouveau nom du dossier :', folder.name || 'Dossier');
        if (next == null) return;
        next = String(next).trim();
        if (!next) {
            alert('Le nom du dossier ne peut pas être vide.');
            return;
        }
        Cloud.renameFolder(folder.id, next).then(refreshPersonal).catch(function (err) {
            alert(Cloud.mapError(err));
        });
    }

    function folderMetaText(folder) {
        return filesLabel(folder.projectCount);
    }

    function renderList(contents) {
        if (!listEl) return;
        closeOpenMenu();
        listEl.innerHTML = '';

        var folders = sortByName((contents && contents.folders) || []);
        var projects = sortByName((contents && contents.projects) || []);

        if (!folders.length && !projects.length) {
            listEl.hidden = true;
            setStatus(currentFolderId
                ? 'Ce dossier est vide.'
                : 'Aucun projet pour le moment. Dans l’atelier : Fichier → Enregistrer.', false, true);
            return;
        }

        setStatus('');
        listEl.hidden = false;

        folders.forEach(function (folder) {
            var menuWrap = buildMenu([
                { label: 'Ouvrir', onClick: function () { navigateTo(folder.id); } },
                { label: 'Renommer', onClick: function () { renameFolder(folder); } },
                {
                    label: 'Supprimer',
                    danger: true,
                    onClick: function () {
                        if (!confirm('Supprimer le dossier « ' + (folder.name || 'Dossier') + ' » et ses sous-dossiers ?\nLes projets iront à la racine.')) return;
                        Cloud.removeFolder(folder.id).then(refreshPersonal).catch(function (err) {
                            alert(Cloud.mapError(err));
                        });
                    }
                }
            ]);

            var li = buildRow({
                folder: true,
                icon: ICON_FOLDER,
                iconKind: 'folder',
                name: folder.name || 'Dossier',
                countText: folderMetaText(folder),
                dateText: formatModifiedDate(folder.updated_at || folder.created_at),
                menu: menuWrap
            });
            li.addEventListener('click', function (e) {
                if (e.target.closest('.fichiers-item__menu')) return;
                navigateTo(folder.id);
            });
            listEl.appendChild(li);
        });

        projects.forEach(function (row) {
            var menuWrap = buildMenu([
                { label: 'Ouvrir', onClick: function () { openProject(row.id); } },
                { label: 'Déplacer', onClick: function () { moveProject(row); } },
                {
                    label: 'Supprimer',
                    danger: true,
                    onClick: function () {
                        if (!confirm('Supprimer « ' + (row.name || 'Sans titre') + ' » ?')) return;
                        Cloud.remove(row.id).then(refreshPersonal).catch(function (err) {
                            alert(Cloud.mapError(err));
                        });
                    }
                }
            ]);

            var li = buildRow({
                folder: false,
                icon: ICON_FILE,
                iconKind: 'file',
                name: row.name || 'Sans titre',
                countText: '1 fichier',
                dateText: formatModifiedDate(row.updated_at),
                menu: menuWrap
            });
            li.addEventListener('dblclick', function () { openProject(row.id); });
            listEl.appendChild(li);
        });
    }

    function refreshPersonal() {
        if (!Cloud) return Promise.resolve();
        return Promise.all([
            Cloud.listContents(currentFolderId),
            Cloud.buildBreadcrumb(currentFolderId)
        ]).then(function (parts) {
            renderBreadcrumb(parts[1]);
            renderList(parts[0]);
        }).catch(function (err) {
            setStatus(Cloud.mapError(err), true);
            if (listEl) listEl.hidden = true;
        });
    }

    function navigateTo(folderId) {
        currentFolderId = folderId || null;
        closeOpenMenu();
        refreshPersonal();
    }

    // --- Collaboratif ---

    function setCollabMode(inside) {
        if (btnNewProject) btnNewProject.hidden = !!inside;
        if (btnNewCollabProject) btnNewCollabProject.hidden = !inside;
        if (collabTitleEl) {
            collabTitleEl.textContent = 'Projets collaboratifs';
        }
    }

    function renderCollabBreadcrumb(workspace) {
        if (!collabBreadcrumbEl) return;
        collabBreadcrumbEl.innerHTML = '';
        if (collabTitleEl) collabTitleEl.textContent = 'Projets collaboratifs';

        if (!workspace) {
            collabBreadcrumbEl.hidden = true;
            return;
        }

        collabBreadcrumbEl.hidden = false;

        var sep = document.createElement('span');
        sep.className = 'fichiers-breadcrumb__sep';
        sep.textContent = '/';
        collabBreadcrumbEl.appendChild(sep);

        var current = document.createElement('span');
        current.className = 'fichiers-breadcrumb__current';
        current.textContent = workspace.name || 'Dossier';
        collabBreadcrumbEl.appendChild(current);
    }

    function collabWorkspaceMeta(ws) {
        return filesLabel(ws.projectCount);
    }

    function renderCollabRoot(workspaces) {
        if (!collabListEl) return;
        closeOpenMenu();
        collabListEl.innerHTML = '';
        setCollabMode(false);
        renderCollabBreadcrumb(null);

        var items = sortByName(workspaces || []);
        if (!items.length) {
            collabListEl.hidden = true;
            setCollabStatus('Aucun projet collaboratif. Créez-en un avec des personnes de votre équipe.', false, true);
            return;
        }

        setCollabStatus('');
        collabListEl.hidden = false;

        items.forEach(function (ws) {
            var actions = [
                { label: 'Ouvrir', onClick: function () { navigateCollab(ws.id); } },
                {
                    label: 'Supprimer',
                    danger: true,
                    onClick: function () {
                        if (!confirm('Supprimer le dossier collaboratif « ' + (ws.name || '') + ' » et tous ses fichiers pour tous les membres ?')) return;
                        Cloud.removeCollabWorkspace(ws.id).then(refreshCollab).catch(function (err) {
                            alert(Cloud.mapError(err));
                        });
                    }
                }
            ];

            var li = buildRow({
                folder: true,
                icon: ICON_FOLDER,
                iconKind: 'folder',
                name: ws.name || 'Projet collaboratif',
                countText: collabWorkspaceMeta(ws),
                dateText: formatModifiedDate(ws.updated_at || ws.created_at),
                menu: buildMenu(actions)
            });
            li.addEventListener('click', function (e) {
                if (e.target.closest('.fichiers-item__menu')) return;
                navigateCollab(ws.id);
            });
            collabListEl.appendChild(li);
        });
    }

    function renderCollabInside(workspace, projects) {
        if (!collabListEl) return;
        closeOpenMenu();
        collabListEl.innerHTML = '';
        setCollabMode(true);
        renderCollabBreadcrumb(workspace);

        var items = sortByName(projects || []);
        if (!items.length) {
            collabListEl.hidden = true;
            setCollabStatus('Ce dossier collaboratif est vide.', false, true);
            return;
        }

        setCollabStatus('');
        collabListEl.hidden = false;

        items.forEach(function (row) {
            var menuWrap = buildMenu([
                { label: 'Ouvrir', onClick: function () { openProject(row.id); } },
                {
                    label: 'Supprimer',
                    danger: true,
                    onClick: function () {
                        if (!confirm('Supprimer « ' + (row.name || 'Sans titre') + ' » pour tous les membres ?')) return;
                        Cloud.remove(row.id).then(refreshCollab).catch(function (err) {
                            alert(Cloud.mapError(err));
                        });
                    }
                }
            ]);

            var li = buildRow({
                folder: false,
                icon: ICON_FILE,
                iconKind: 'file',
                name: row.name || 'Sans titre',
                countText: '1 fichier',
                dateText: formatModifiedDate(row.updated_at),
                menu: menuWrap
            });
            li.addEventListener('dblclick', function () { openProject(row.id); });
            collabListEl.appendChild(li);
        });
    }

    function refreshCollab() {
        if (!Cloud) return Promise.resolve();

        if (!currentCollabId) {
            return Cloud.listCollabWorkspaces().then(function (workspaces) {
                renderCollabRoot(workspaces);
            }).catch(function (err) {
                var msg = Cloud.mapError(err);
                if (/collab_workspaces|schema cache|does not exist/i.test(msg)) {
                    setCollabStatus('Projets collaboratifs non activés : exécutez schema-collab.sql dans Supabase.', true);
                } else {
                    setCollabStatus(msg, true);
                }
                if (collabListEl) collabListEl.hidden = true;
            });
        }

        return Promise.all([
            Cloud.getCollabWorkspace(currentCollabId),
            Cloud.listCollabProjects(currentCollabId)
        ]).then(function (parts) {
            if (!parts[0]) {
                currentCollabId = null;
                return refreshCollab();
            }
            renderCollabInside(parts[0], parts[1]);
        }).catch(function (err) {
            setCollabStatus(Cloud.mapError(err), true);
            if (collabListEl) collabListEl.hidden = true;
        });
    }

    function navigateCollab(workspaceId) {
        currentCollabId = workspaceId || null;
        closeOpenMenu();
        refreshCollab();
    }

    function getFolderType() {
        var checked = folderModal && folderModal.querySelector('input[name="folder-type"]:checked');
        return checked ? checked.value : 'personal';
    }

    function syncFolderModalType() {
        var type = getFolderType();
        var isCollab = type === 'collab';
        if (folderModalPersonal) folderModalPersonal.hidden = isCollab;
        if (folderModalCollab) folderModalCollab.hidden = !isCollab;
        if (folderModalError) folderModalError.textContent = '';
    }

    function loadTeamMembers() {
        if (!folderModalMembers) return Promise.resolve();
        folderModalMembers.innerHTML = '';
        folderModalSubmit.disabled = true;
        folderModalSubmit.textContent = 'Chargement…';

        return fetch(new URL('/api/team-members', window.location.origin).href, {
            method: 'GET',
            headers: { Authorization: 'Bearer ' + accessToken }
        }).then(function (response) {
            return response.json().then(function (data) {
                return { ok: response.ok, data: data };
            });
        }).then(function (result) {
            folderModalSubmit.textContent = 'Créer';
            folderModalSubmit.disabled = false;

            if (!result.ok || !result.data) {
                folderModalError.textContent = (result.data && result.data.error) || 'Impossible de charger l’équipe.';
                return;
            }

            var emails = [];
            if (result.data.adminEmail) emails.push(result.data.adminEmail);
            (result.data.licenses || []).forEach(function (e) { emails.push(e); });

            var others = emails.filter(function (e) {
                return e && e.toLowerCase() !== currentUserEmail;
            });

            if (!others.length) {
                folderModalError.textContent = 'Aucune autre personne dans votre équipe pour collaborer.';
                folderModalSubmit.disabled = true;
                return;
            }

            others.forEach(function (email) {
                var label = document.createElement('label');
                label.className = 'collab-modal__member';
                var input = document.createElement('input');
                input.type = 'checkbox';
                input.value = email;
                var span = document.createElement('span');
                span.textContent = email;
                label.appendChild(input);
                label.appendChild(span);
                folderModalMembers.appendChild(label);
            });
        }).catch(function () {
            folderModalSubmit.textContent = 'Créer';
            folderModalSubmit.disabled = false;
            folderModalError.textContent = 'Erreur réseau.';
        });
    }

    function loadParentFolders() {
        if (!folderModalParent || !Cloud || !Cloud.listFoldersWithPaths) {
            return Promise.resolve();
        }
        return Cloud.listFoldersWithPaths().then(function (folders) {
            folderModalParent.innerHTML = '<option value="">À la racine</option>';
            (folders || []).forEach(function (f) {
                var opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = f.path || f.name || 'Dossier';
                if (currentFolderId && f.id === currentFolderId) opt.selected = true;
                folderModalParent.appendChild(opt);
            });
            if (currentFolderId && !folderModalParent.value) {
                folderModalParent.value = currentFolderId;
            }
        }).catch(function () {});
    }

    function openFolderModal() {
        if (!folderModal) return;
        folderModalError.textContent = '';
        folderModalName.value = '';
        folderModalMembers.innerHTML = '';
        var personalRadio = folderModal.querySelector('input[name="folder-type"][value="personal"]');
        if (personalRadio) personalRadio.checked = true;
        syncFolderModalType();
        folderModal.hidden = false;
        folderModalSubmit.disabled = false;
        folderModalSubmit.textContent = 'Créer';
        loadParentFolders();
        if (folderModalName) {
            setTimeout(function () { folderModalName.focus(); }, 30);
        }
    }

    function closeFolderModal() {
        if (folderModal) folderModal.hidden = true;
    }

    function submitFolderModal() {
        var name = String(folderModalName.value || '').trim();
        if (!name) {
            folderModalError.textContent = 'Indiquez un nom.';
            return;
        }

        var type = getFolderType();

        if (type === 'personal') {
            var parentId = folderModalParent && folderModalParent.value
                ? folderModalParent.value
                : null;
            folderModalSubmit.disabled = true;
            folderModalSubmit.textContent = 'Création…';
            folderModalError.textContent = '';
            Cloud.createFolder(name, parentId).then(function () {
                closeFolderModal();
                return refreshPersonal();
            }).catch(function (err) {
                folderModalError.textContent = Cloud.mapError(err);
                folderModalSubmit.disabled = false;
                folderModalSubmit.textContent = 'Créer';
            });
            return;
        }

        var selected = [];
        folderModalMembers.querySelectorAll('input[type="checkbox"]:checked').forEach(function (input) {
            selected.push(input.value);
        });
        if (!selected.length) {
            folderModalError.textContent = 'Choisissez au moins une personne.';
            return;
        }

        folderModalSubmit.disabled = true;
        folderModalSubmit.textContent = 'Création…';
        folderModalError.textContent = '';

        Cloud.createCollabWorkspace(name, selected, accessToken).then(function (workspace) {
            closeFolderModal();
            currentCollabId = workspace.id;
            return refreshCollab();
        }).catch(function (err) {
            folderModalError.textContent = Cloud.mapError(err);
            folderModalSubmit.disabled = false;
            folderModalSubmit.textContent = 'Créer';
        });
    }

    function onFolderTypeChange() {
        syncFolderModalType();
        if (getFolderType() === 'collab' && folderModalMembers && !folderModalMembers.children.length) {
            loadTeamMembers();
        }
    }

    document.addEventListener('click', function () { closeOpenMenu(); }, { signal: pageSignal });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeOpenMenu();
            closeFolderModal();
        }
    }, { signal: pageSignal });

    if (btnCreateFolder) btnCreateFolder.addEventListener('click', openFolderModal);
    if (btnNewProject) {
        btnNewProject.addEventListener('click', function () {
            if (!Auth || !Auth.getAppUrl) return;
            window.location.href = Auth.getAppUrl();
        });
    }
    function openBlankAtelier() {
        if (!Auth || !Auth.getAppUrl) return;
        window.location.href = Auth.getAppUrl();
    }

    if (btnNewCollabProject) {
        btnNewCollabProject.addEventListener('click', openBlankAtelier);
    }
    if (folderModalCancel) folderModalCancel.addEventListener('click', closeFolderModal);
    if (folderModalSubmit) folderModalSubmit.addEventListener('click', submitFolderModal);
    if (folderModal) {
        folderModal.addEventListener('click', function (e) {
            if (e.target === folderModal) closeFolderModal();
        });
        folderModal.querySelectorAll('input[name="folder-type"]').forEach(function (input) {
            input.addEventListener('change', onFolderTypeChange);
        });
    }

    var fichiersTitleBtn = document.getElementById('fichiers-title-btn');
    if (fichiersTitleBtn) {
        fichiersTitleBtn.addEventListener('click', function () {
            if (currentFolderId) navigateTo(null);
        });
    }
    var collabTitleBtn = document.getElementById('collab-title-btn');
    if (collabTitleBtn) {
        collabTitleBtn.addEventListener('click', function () {
            if (currentCollabId) navigateCollab(null);
        });
    }

    document.querySelectorAll('[data-collapsible]').forEach(function (panel) {
        var toggle = panel.querySelector('.fichiers-panel__toggle');
        if (!toggle) return;
        toggle.addEventListener('click', function () {
            var collapsed = panel.classList.toggle('is-collapsed');
            toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        });
    });

    function boot(session) {
        if (!Cloud) {
            setStatus('Module Fichiers indisponible.', true);
            return;
        }
        if (session && session.user) {
            currentUserEmail = String(session.user.email || '').trim().toLowerCase();
            currentUserId = session.user.id || '';
        }
        if (session && session.access_token) {
            accessToken = session.access_token;
        }
        refreshPersonal();
        refreshCollab();
    }

    if (Auth && Auth.requireLicenseAccount) {
        Auth.requireLicenseAccount().then(boot).catch(function () {});
    } else if (Auth && Auth.requireAccountSession) {
        Auth.requireAccountSession().then(boot).catch(function () {});
    } else {
        boot(null);
    }
})();
