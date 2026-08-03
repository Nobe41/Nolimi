// 02-menu/pages/notifications/ — charge les notifs depuis mes-notifs/.
// État lu / non lu : par compte, sync cloud via NolimiNotifReads.

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;
    var Reads = typeof NolimiNotifReads !== 'undefined' ? NolimiNotifReads : null;
    var CATALOG_URL = './mes-notifs/catalog.json';
    var listEl = document.getElementById('notif-list');
    var markAllBtn = document.getElementById('notif-mark-all');
    var notifications = [];

    window.__nolimiPageCleanup = function () {
        window.__nolimiPageCleanup = null;
    };

    var ICONS = {
        equipe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4.5 13.2 8h3.8l-3 2.3 1.1 3.7L12 12.2 8.9 14l1.1-3.7-3-2.3h3.8L12 4.5Z"/></svg>',
        maintenance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 6.5a3.5 3.5 0 0 0-4.9 4.9L5 16l3 3 4.6-4.6a3.5 3.5 0 0 0 4.9-4.9l-2.2 2.2-1.8-1.8 2-2.1Z"/></svg>',
        securite: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 19 6.5v5c0 4.2-2.8 7.4-7 8.8-4.2-1.4-7-4.6-7-8.8v-5l7-3Z"/><path d="m9.5 12 1.8 1.8 3.7-3.8"/></svg>',
        welcome: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v3M7.5 6.5 9 9M16.5 6.5 15 9"/><path d="M8 14c1.2 1.5 2.5 2.2 4 2.2s2.8-.7 4-2.2"/><path d="M6 19c2-3 4-4.5 6-4.5S16 16 18 19"/></svg>'
    };

    function getReadIds() {
        return Reads && Reads.getReadIds ? Reads.getReadIds() : [];
    }

    function refreshBadge() {
        if (window.NolimiMenuSidebar && typeof NolimiMenuSidebar.refreshNotifBadge === 'function') {
            NolimiMenuSidebar.refreshNotifBadge(notifications.length);
        }
    }

    function isRead(id, readIds) {
        return readIds.indexOf(id) !== -1;
    }

    function markRead(id) {
        if (!Reads || !Reads.markRead) return;
        Reads.markRead(id).then(refreshBadge);
    }

    function markAllRead() {
        if (!Reads || !Reads.markAllRead) return;
        var ids = notifications.map(function (n) { return n.id; });
        Reads.markAllRead(ids).then(function () {
            render();
            refreshBadge();
        });
    }

    function render() {
        if (!listEl) return;
        var readIds = getReadIds();
        listEl.innerHTML = '';

        if (!notifications.length) {
            var empty = document.createElement('p');
            empty.className = 'notif-empty';
            empty.textContent = 'Aucune notification pour le moment.';
            listEl.appendChild(empty);
            return;
        }

        notifications.forEach(function (notif) {
            var type = notif.type || 'equipe';
            var read = isRead(notif.id, readIds);
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'notif-item' + (read ? ' is-read' : '');
            item.setAttribute('role', 'listitem');
            item.setAttribute('aria-expanded', 'false');
            item.dataset.id = notif.id;

            item.innerHTML = [
                '<div class="notif-item__icon notif-item__icon--' + type + '">' + (ICONS[type] || ICONS.equipe) + '</div>',
                '<div class="notif-item__body">',
                '  <div class="notif-item__cat-row">',
                '    <span class="notif-item__category notif-item__category--' + type + '"></span>',
                '    <span class="notif-item__dot" aria-hidden="true"></span>',
                '  </div>',
                '  <div class="notif-item__title"></div>',
                '  <div class="notif-item__content"></div>',
                '</div>',
                '<div class="notif-item__meta">',
                '  <span class="notif-item__time"></span>',
                '  <span class="notif-item__more" aria-hidden="true">⋯</span>',
                '</div>'
            ].join('');

            item.querySelector('.notif-item__category').textContent = notif.category || 'Nolimi';
            item.querySelector('.notif-item__title').textContent = notif.title || '';
            item.querySelector('.notif-item__content').textContent = notif.body || '';
            item.querySelector('.notif-item__time').textContent = notif.time || '';

            item.addEventListener('click', function () {
                var open = item.classList.contains('is-expanded');
                listEl.querySelectorAll('.notif-item.is-expanded').forEach(function (el) {
                    if (el !== item) {
                        el.classList.remove('is-expanded');
                        el.setAttribute('aria-expanded', 'false');
                    }
                });

                if (open) {
                    item.classList.remove('is-expanded');
                    item.setAttribute('aria-expanded', 'false');
                    return;
                }

                item.classList.add('is-expanded');
                item.setAttribute('aria-expanded', 'true');
                markRead(notif.id);
                item.classList.add('is-read');
            });

            listEl.appendChild(item);
        });
    }

    function loadNotifications() {
        return fetch(CATALOG_URL, { cache: 'no-store' })
            .then(function (response) {
                if (!response.ok) throw new Error('Catalogue introuvable');
                return response.json();
            })
            .then(function (files) {
                if (!Array.isArray(files)) return [];
                return Promise.all(files.map(function (file) {
                    var path = './mes-notifs/' + file + (/\.json$/i.test(file) ? '' : '/message.json');
                    return fetch(path, { cache: 'no-store' })
                        .then(function (response) {
                            if (!response.ok) throw new Error('Notif introuvable: ' + file);
                            return response.json();
                        });
                }));
            });
    }

    function syncReadsThen(done) {
        if (Reads && Reads.sync) {
            Reads.sync().then(done).catch(done);
            return;
        }
        done();
    }

    function bootNotifications() {
        syncReadsThen(function () {
            loadNotifications().then(function (items) {
                notifications = items || [];
                var validIds = notifications.map(function (n) { return n.id; });
                if (Reads && Reads.prune) Reads.prune(validIds);
                if (window.NolimiMenuSidebar && typeof NolimiMenuSidebar.setNotifTotal === 'function') {
                    NolimiMenuSidebar.setNotifTotal(notifications.length);
                }
                render();
                refreshBadge();
            }).catch(function () {
                notifications = [];
                render();
            });
        });
    }

    function resolveUserThenBoot() {
        function done(user) {
            if (Reads && Reads.setUser) Reads.setUser(user || null);
            if (window.NolimiMenuSidebar && typeof NolimiMenuSidebar.setNotifUser === 'function') {
                NolimiMenuSidebar.setNotifUser(user || null);
            }
            bootNotifications();
        }

        if (!Auth || !Auth.getClient) {
            done(null);
            return;
        }
        var sb = Auth.getClient();
        if (!sb) {
            done(null);
            return;
        }
        sb.auth.getSession().then(function (result) {
            var user = result && result.data && result.data.session
                ? result.data.session.user
                : null;
            done(user);
        }).catch(function () {
            done(null);
        });
    }

    if (markAllBtn) {
        markAllBtn.addEventListener('click', markAllRead);
    }

    if (Auth && Auth.requireLicenseAccount) {
        Auth.requireLicenseAccount().then(resolveUserThenBoot).catch(function () {});
    } else if (Auth && Auth.requireAccountSession) {
        Auth.requireAccountSession().then(resolveUserThenBoot).catch(function () {});
    } else {
        resolveUserThenBoot();
    }
})();
