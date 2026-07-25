// menu/pages/fichiers/ — dossiers + projets cloud (navigation / créer / déplacer / supprimer).

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;
    var Cloud = typeof CloudProjects !== 'undefined' ? CloudProjects : null;
    var statusEl = document.getElementById('fichiers-status');
    var listEl = document.getElementById('fichiers-list');
    var breadcrumbEl = document.getElementById('fichiers-breadcrumb');
    var btnCreateFolder = document.getElementById('btn-create-folder');
    var openMenuWrap = null;
    var currentFolderId = null;

    function setStatus(text, isError) {
        if (!statusEl) return;
        statusEl.textContent = text || '';
        statusEl.classList.toggle('fichiers-status--error', !!isError);
        statusEl.hidden = !text;
    }

    function formatDate(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            return d.toLocaleString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
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

    function renderBreadcrumb(crumbs) {
        if (!breadcrumbEl) return;
        breadcrumbEl.innerHTML = '';

        if (!crumbs || !crumbs.length) {
            breadcrumbEl.hidden = true;
            return;
        }

        breadcrumbEl.hidden = false;

        var rootBtn = document.createElement('button');
        rootBtn.type = 'button';
        rootBtn.className = 'fichiers-breadcrumb__link';
        rootBtn.textContent = 'Fichiers';
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

        // Dossiers d’abord, puis fichiers A→Z
        folders.forEach(function (folder) {
            var li = document.createElement('li');
            li.className = 'fichiers-item fichiers-item--folder';

            var info = document.createElement('div');
            info.className = 'fichiers-item__info';

            var name = document.createElement('div');
            name.className = 'fichiers-item__name';
            name.textContent = '📁 ' + (folder.name || 'Dossier');

            info.appendChild(name);

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
            meta.textContent = 'Modifié le ' + formatDate(row.updated_at);

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

    function boot() {
        if (!Cloud) {
            setStatus('Module Fichiers indisponible.', true);
            return;
        }
        refresh();
    }

    if (Auth && Auth.requireAccountSession) {
        Auth.requireAccountSession().then(boot).catch(function () {});
    } else {
        boot();
    }
})();
