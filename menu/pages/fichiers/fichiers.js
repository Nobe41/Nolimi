// menu/pages/fichiers/ — dossiers + projets cloud (navigation / créer / déplacer / supprimer).

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;
    var Cloud = typeof CloudProjects !== 'undefined' ? CloudProjects : null;
    var statusEl = document.getElementById('fichiers-status');
    var listEl = document.getElementById('fichiers-list');
    var breadcrumbEl = document.getElementById('fichiers-breadcrumb');
    var titleEl = document.getElementById('fichiers-title');
    var btnCreateFolder = document.getElementById('btn-create-folder');
    var btnNewProject = document.getElementById('btn-new-project');
    var openMenuWrap = null;
    var currentFolderId = null;

    var ICON_FOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z"/></svg>';
    var ICON_FILE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5h6l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z"/><path d="M13 3.5V9h5.5"/></svg>';

    function setStatus(text, isError) {
        if (!statusEl) return;
        statusEl.textContent = text || '';
        statusEl.classList.toggle('fichiers-status--error', !!isError);
        statusEl.hidden = !text;
    }

    function formatCreatedDate(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            return d.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long'
            });
        } catch (e) {
            return '';
        }
    }

    function formatModifiedDate(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            return d.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        } catch (e) {
            return '';
        }
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
            return Cloud.update(row.id, { folder_id: folderId }).then(refresh);
        }).catch(function (err) {
            alert(Cloud.mapError(err));
        });
    }

    function closeOpenMenu() {
        if (!openMenuWrap) return;
        var dropdown = openMenuWrap.querySelector('.fichiers-menu-dropdown');
        var btn = openMenuWrap.querySelector('.fichiers-menu-btn');
        if (dropdown) dropdown.hidden = true;
        if (btn) btn.setAttribute('aria-expanded', 'false');
        openMenuWrap.classList.remove('is-open');
        openMenuWrap = null;
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
            btn.addEventListener('click', function () {
                closeOpenMenu();
                action.onClick();
            });
            dropdown.appendChild(btn);
        });

        menuBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleMenu(menuWrap);
        });

        menuWrap.appendChild(menuBtn);
        menuWrap.appendChild(dropdown);
        return menuWrap;
    }

    function buildIcon(svg) {
        var wrap = document.createElement('div');
        wrap.className = 'fichiers-item__icon';
        wrap.innerHTML = svg;
        return wrap;
    }

    function renderBreadcrumb(crumbs) {
        if (!breadcrumbEl) return;
        breadcrumbEl.innerHTML = '';

        if (!crumbs || !crumbs.length) {
            breadcrumbEl.hidden = true;
            if (titleEl) titleEl.textContent = 'Tous vos projets';
            return;
        }

        breadcrumbEl.hidden = false;
        if (titleEl) {
            titleEl.textContent = crumbs[crumbs.length - 1].name || 'Dossier';
        }

        var rootBtn = document.createElement('button');
        rootBtn.type = 'button';
        rootBtn.className = 'fichiers-breadcrumb__link';
        rootBtn.textContent = 'Tous vos projets';
        rootBtn.addEventListener('click', function () {
            navigateTo(null);
        });
        breadcrumbEl.appendChild(rootBtn);

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
                link.addEventListener('click', function () {
                    navigateTo(crumb.id);
                });
                breadcrumbEl.appendChild(link);
            }
        });
    }

    function folderMetaText(folder) {
        var count = folder.projectCount || 0;
        var label = count <= 1 ? (count + ' fichier') : (count + ' fichiers');
        var created = formatCreatedDate(folder.created_at);
        return created ? (label + ' • Créé le ' + created) : label;
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
                : 'Aucun projet pour le moment. Dans l’atelier : Fichier → Enregistrer.');
            return;
        }

        setStatus('');
        listEl.hidden = false;

        folders.forEach(function (folder) {
            var li = document.createElement('li');
            li.className = 'fichiers-item fichiers-item--folder';

            var info = document.createElement('div');
            info.className = 'fichiers-item__info';

            var name = document.createElement('div');
            name.className = 'fichiers-item__name';
            name.textContent = folder.name || 'Dossier';

            var meta = document.createElement('div');
            meta.className = 'fichiers-item__meta';
            meta.textContent = folderMetaText(folder);

            info.appendChild(name);
            info.appendChild(meta);

            var menuWrap = buildMenu([
                {
                    label: 'Ouvrir',
                    onClick: function () { navigateTo(folder.id); }
                },
                {
                    label: 'Supprimer',
                    danger: true,
                    onClick: function () {
                        if (!confirm('Supprimer le dossier « ' + (folder.name || 'Dossier') + ' » et ses sous-dossiers ?\nLes projets iront à la racine.')) return;
                        Cloud.removeFolder(folder.id).then(refresh).catch(function (err) {
                            alert(Cloud.mapError(err));
                        });
                    }
                }
            ]);

            li.appendChild(buildIcon(ICON_FOLDER));
            li.appendChild(info);
            li.appendChild(menuWrap);
            li.addEventListener('click', function (e) {
                if (e.target.closest('.fichiers-item__menu')) return;
                navigateTo(folder.id);
            });
            li.addEventListener('dblclick', function () {
                navigateTo(folder.id);
            });
            listEl.appendChild(li);
        });

        projects.forEach(function (row) {
            var li = document.createElement('li');
            li.className = 'fichiers-item';

            var info = document.createElement('div');
            info.className = 'fichiers-item__info';

            var name = document.createElement('div');
            name.className = 'fichiers-item__name';
            name.textContent = row.name || 'Sans titre';

            var meta = document.createElement('div');
            meta.className = 'fichiers-item__meta';
            meta.textContent = 'Modifié le ' + formatModifiedDate(row.updated_at);

            info.appendChild(name);
            info.appendChild(meta);

            var menuWrap = buildMenu([
                {
                    label: 'Ouvrir',
                    onClick: function () { openProject(row.id); }
                },
                {
                    label: 'Déplacer',
                    onClick: function () { moveProject(row); }
                },
                {
                    label: 'Supprimer',
                    danger: true,
                    onClick: function () {
                        if (!confirm('Supprimer « ' + (row.name || 'Sans titre') + ' » ?')) return;
                        Cloud.remove(row.id).then(refresh).catch(function (err) {
                            alert(Cloud.mapError(err));
                        });
                    }
                }
            ]);

            li.appendChild(buildIcon(ICON_FILE));
            li.appendChild(info);
            li.appendChild(menuWrap);
            li.addEventListener('dblclick', function () {
                openProject(row.id);
            });
            listEl.appendChild(li);
        });
    }

    function refresh() {
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
        setStatus('Chargement…');
        refresh();
    }

    function createFolderHere() {
        var name = prompt('Nom du dossier :', 'Nouveau dossier');
        if (name == null) return;
        name = String(name).trim();
        if (!name) {
            alert('Le nom du dossier ne peut pas être vide.');
            return;
        }
        Cloud.createFolder(name, currentFolderId).then(refresh).catch(function (err) {
            alert(Cloud.mapError(err));
        });
    }

    document.addEventListener('click', function () {
        closeOpenMenu();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeOpenMenu();
    });

    if (btnCreateFolder) {
        btnCreateFolder.addEventListener('click', function () {
            createFolderHere();
        });
    }

    if (btnNewProject) {
        btnNewProject.addEventListener('click', function () {
            if (!Auth || !Auth.getAppUrl) return;
            window.location.href = Auth.getAppUrl();
        });
    }

    function boot() {
        if (!Cloud) {
            setStatus('Module Fichiers indisponible.', true);
            return;
        }
        refresh();
    }

    if (Auth && Auth.requireLicenseAccount) {
        Auth.requireLicenseAccount().then(boot).catch(function () {});
    } else if (Auth && Auth.requireAccountSession) {
        Auth.requireAccountSession().then(boot).catch(function () {});
    } else {
        boot();
    }
})();
