// menu/components/sidebar/ — menu latéral + barre mobile (hamburger).
// Ce fichier : HTML de la sidebar + injection dans la page.

(function (global) {
    var LOGO = '../../../assets/brand/nolimi-logo-wordmark.jpg';
    var NOTIF_READ_PREFIX = 'nolimi_notif_read_ids:';
    var NOTIF_CATALOG_URL = '../notifications/mes-notifs/catalog.json';
    var notifTotal = 1;
    var currentNotifUserId = null;

    var ICONS = {
        accueil: '<svg class="menu-sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5"/></svg>',
        fichiers: '<svg class="menu-sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8A2.5 2.5 0 0 1 6 5.5h4l2 2h6A2.5 2.5 0 0 1 20.5 10v7A2.5 2.5 0 0 1 18 19.5H6A2.5 2.5 0 0 1 3.5 17V8Z"/></svg>',
        equipe: '<svg class="menu-sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.4"/><path d="M3.5 18.5c.6-3 2.7-4.5 5.5-4.5s4.9 1.5 5.5 4.5"/><path d="M14.2 14.2c1.7-.4 3.5.2 4.8 2.3"/></svg>',
        notifications: '<svg class="menu-sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 17.5h11"/><path d="M7.5 17.5V11a4.5 4.5 0 0 1 9 0v6.5"/><path d="M10 17.5a2 2 0 0 0 4 0"/><path d="M12 4.5V6"/></svg>',
        'mon-compte': '<svg class="menu-sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5 19c.8-3.4 3.2-5 7-5s6.2 1.6 7 5"/></svg>',
        abonnement: '<svg class="menu-sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M3.5 10h17"/></svg>'
    };

    function notifReadStorageKey() {
        return NOTIF_READ_PREFIX + (currentNotifUserId || 'anon');
    }

    function setNotifUser(user) {
        currentNotifUserId = user && user.id ? String(user.id) : null;
    }

    function loadReadIds() {
        try {
            var raw = localStorage.getItem(notifReadStorageKey());
            if (raw == null) return [];
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function saveReadIds(ids) {
        try {
            localStorage.setItem(notifReadStorageKey(), JSON.stringify(ids || []));
        } catch (e) {}
    }

    function unreadNotifCount(total) {
        var all = typeof total === 'number' ? total : notifTotal;
        try {
            var read = loadReadIds();
            return Math.max(0, all - read.length);
        } catch (e) {
            return all;
        }
    }

    function setNotifTotal(total) {
        notifTotal = Math.max(0, parseInt(total, 10) || 0);
        try {
            localStorage.setItem('nolimi_notif_total', String(notifTotal));
        } catch (e) {}
        refreshNotifBadge(notifTotal);
    }

    function loadNotifTotal() {
        try {
            var stored = localStorage.getItem('nolimi_notif_total');
            if (stored != null) notifTotal = Math.max(0, parseInt(stored, 10) || 0);
        } catch (e) {}

        return fetch(NOTIF_CATALOG_URL, { cache: 'no-store' })
            .then(function (response) {
                if (!response.ok) return [];
                return response.json();
            })
            .then(function (files) {
                if (!Array.isArray(files) || !files.length) {
                    setNotifTotal(0);
                    return 0;
                }
                return Promise.all(files.map(function (file) {
                    var path = '../notifications/mes-notifs/' + file + (/\.json$/i.test(file) ? '' : '/message.json');
                    return fetch(path, { cache: 'no-store' })
                        .then(function (response) {
                            if (!response.ok) return null;
                            return response.json();
                        })
                        .catch(function () { return null; });
                })).then(function (items) {
                    var ids = items.filter(Boolean).map(function (n) { return n.id; });
                    var read = loadReadIds().filter(function (id) { return ids.indexOf(id) !== -1; });
                    saveReadIds(read);
                    setNotifTotal(ids.length);
                    return ids.length;
                });
            })
            .catch(function () {
                refreshNotifBadge(notifTotal);
                return notifTotal;
            });
    }

    function link(current, name, href, label, badgeCount) {
        var isCurrent = current === name;
        var classes = 'menu-sidebar__link';
        if (isCurrent) classes += ' menu-sidebar__link--current';
        var attrs = isCurrent ? ' aria-current="page"' : '';
        var icon = ICONS[name] || '';
        var badge = '';
        if (badgeCount && badgeCount > 0) {
            badge = '<span class="menu-sidebar__badge" data-notif-badge>' + badgeCount + '</span>';
        }
        return '<a href="' + href + '" class="' + classes + '"' + attrs + '>' +
            icon +
            '<span class="menu-sidebar__label">' + label + '</span>' +
            badge +
            '</a>';
    }

    function homeHref(role) {
        return role === 'admin' ? '../abonnement/index.html' : '../accueil/index.html';
    }

    function navHtml(current, role) {
        if (role === 'admin') {
            return [
                '<nav class="menu-sidebar__nav" aria-label="Navigation">',
                '  ' + link(current, 'abonnement', '../abonnement/index.html', 'Abonnement'),
                '  ' + link(current, 'equipe', '../equipe/index.html', 'Équipe'),
                '</nav>'
            ].join('');
        }
        if (role === 'admin-license') {
            return [
                '<nav class="menu-sidebar__nav" aria-label="Navigation">',
                '  ' + link(current, 'accueil', '../accueil/index.html', 'Accueil'),
                '  ' + link(current, 'fichiers', '../fichiers/index.html', 'Fichiers'),
                '  ' + link(current, 'equipe', '../equipe/index.html', 'Équipe'),
                '  ' + link(current, 'notifications', '../notifications/index.html', 'Notifications', unreadNotifCount()),
                '  ' + link(current, 'abonnement', '../abonnement/index.html', 'Abonnement'),
                '  ' + link(current, 'mon-compte', '../mon-compte/index.html', 'Mon compte'),
                '</nav>'
            ].join('');
        }
        return [
            '<nav class="menu-sidebar__nav" aria-label="Navigation">',
            '  ' + link(current, 'accueil', '../accueil/index.html', 'Accueil'),
            '  ' + link(current, 'fichiers', '../fichiers/index.html', 'Fichiers'),
            '  ' + link(current, 'equipe', '../equipe/index.html', 'Équipe'),
            '  ' + link(current, 'notifications', '../notifications/index.html', 'Notifications', unreadNotifCount()),
            '  ' + link(current, 'mon-compte', '../mon-compte/index.html', 'Mon compte'),
            '</nav>'
        ].join('');
    }

    // current : 'accueil' | 'fichiers' | 'mon-compte' | 'notifications' | 'abonnement' | 'equipe'
    // role : 'license' | 'admin' | 'admin-license'
    function buildHtml(current, role) {
        var home = homeHref(role);
        return [
            '<header class="menu-mobile-bar">',
            '  <button type="button" class="menu-mobile-toggle" id="menu-mobile-toggle" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="menu-sidebar">',
            '    <span class="menu-mobile-toggle__bar" aria-hidden="true"></span>',
            '    <span class="menu-mobile-toggle__bar" aria-hidden="true"></span>',
            '    <span class="menu-mobile-toggle__bar" aria-hidden="true"></span>',
            '  </button>',
            '  <a href="' + home + '" class="menu-mobile-bar__brand" aria-label="Nolimi — accueil">',
            '    <img src="' + LOGO + '" alt="" class="menu-mobile-bar__logo" width="1024" height="300" decoding="async">',
            '  </a>',
            '</header>',
            '<div class="menu-sidebar-backdrop" id="menu-sidebar-backdrop" hidden></div>',
            '<aside class="menu-sidebar" id="menu-sidebar" aria-label="Menu principal">',
            '  <a href="' + home + '" class="menu-sidebar__brand" aria-label="Nolimi — accueil">',
            '    <img src="' + LOGO + '" alt="" class="menu-sidebar__logo" width="1024" height="300" decoding="async">',
            '  </a>',
            '  ' + navHtml(current, role),
            '</aside>'
        ].join('');
    }

    function bindMobileMenu() {
        var toggle = document.getElementById('menu-mobile-toggle');
        var sidebar = document.getElementById('menu-sidebar');
        var backdrop = document.getElementById('menu-sidebar-backdrop');
        if (!toggle || !sidebar) return;

        function setOpen(open) {
            document.body.classList.toggle('menu-nav-open', open);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
            if (backdrop) backdrop.hidden = !open;
        }

        function close() {
            setOpen(false);
        }

        function toggleOpen() {
            setOpen(!document.body.classList.contains('menu-nav-open'));
        }

        if (!toggle.dataset.bound) {
            toggle.dataset.bound = '1';
            toggle.addEventListener('click', function (e) {
                e.stopPropagation();
                toggleOpen();
            });
        }

        if (backdrop && !backdrop.dataset.bound) {
            backdrop.dataset.bound = '1';
            backdrop.addEventListener('click', close);
        }

        if (!document.documentElement.dataset.menuNavEscBound) {
            document.documentElement.dataset.menuNavEscBound = '1';
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') close();
            });
        }
    }

    function refreshNotifBadge(total) {
        var count = unreadNotifCount(total);
        var badge = document.querySelector('[data-notif-badge]');
        var linkEl = document.querySelector('.menu-sidebar__link[href*="notifications"]');
        if (!linkEl) return;

        if (count <= 0) {
            if (badge) badge.remove();
            return;
        }

        if (badge) {
            badge.textContent = String(count);
            return;
        }

        badge = document.createElement('span');
        badge.className = 'menu-sidebar__badge';
        badge.setAttribute('data-notif-badge', '');
        badge.textContent = String(count);
        linkEl.appendChild(badge);
    }

    function inject(current, role) {
        var html = buildHtml(current || 'accueil', role || 'license');
        var existingSidebar = document.querySelector('aside.menu-sidebar');
        var existingBar = document.querySelector('header.menu-mobile-bar');
        var existingBackdrop = document.querySelector('.menu-sidebar-backdrop');

        if (existingSidebar) existingSidebar.remove();
        if (existingBar) existingBar.remove();
        if (existingBackdrop) existingBackdrop.remove();

        document.body.insertAdjacentHTML('afterbegin', html);
        bindMobileMenu();
        loadNotifTotal();
        ensureSoftNav();
        ensureResumeProject();
    }

    function ensureResumeProject() {
        function start() {
            if (global.NolimiResumeProject && typeof global.NolimiResumeProject.mount === 'function') {
                global.NolimiResumeProject.mount();
            }
        }
        if (global.NolimiResumeProject) {
            start();
            return;
        }
        if (document.documentElement.dataset.resumeProjectLoading) {
            var wait = setInterval(function () {
                if (!global.NolimiResumeProject) return;
                clearInterval(wait);
                start();
            }, 30);
            return;
        }
        document.documentElement.dataset.resumeProjectLoading = '1';
        var src = '../../components/resume-project/resume-project.js';
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            var s = scripts[i].src || '';
            if (s.indexOf('/sidebar/sidebar.js') !== -1) {
                src = s.replace('/sidebar/sidebar.js', '/resume-project/resume-project.js');
                break;
            }
        }
        var el = document.createElement('script');
        el.src = src;
        el.onload = start;
        document.body.appendChild(el);
    }

    function ensureSoftNav() {
        function start() {
            if (global.NolimiSoftNav && typeof NolimiSoftNav.init === 'function') {
                NolimiSoftNav.init();
            }
        }
        if (global.NolimiSoftNav) {
            start();
            return;
        }
        if (document.documentElement.dataset.softNavLoading) {
            var wait = setInterval(function () {
                if (!global.NolimiSoftNav) return;
                clearInterval(wait);
                start();
            }, 30);
            return;
        }
        document.documentElement.dataset.softNavLoading = '1';
        var src = '../../components/soft-nav/soft-nav.js';
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            var s = scripts[i].src || '';
            if (s.indexOf('/sidebar/sidebar.js') !== -1) {
                src = s.replace('/sidebar/sidebar.js', '/soft-nav/soft-nav.js');
                break;
            }
        }
        var el = document.createElement('script');
        el.src = src;
        el.onload = start;
        document.body.appendChild(el);
    }

    function mount(options) {
        options = options || {};
        var current = options.current || 'accueil';
        var role = options.role || null;

        function applyWithUser(user, resolvedRole) {
            setNotifUser(user);
            inject(current, resolvedRole || 'license');
        }

        var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;
        if (!Auth || !Auth.getClient) {
            applyWithUser(null, role || 'license');
            return;
        }
        var sb = Auth.getClient();
        if (!sb) {
            applyWithUser(null, role || 'license');
            return;
        }

        // Affiche vite, puis recalcule badge / rôle avec le vrai compte
        if (!role) inject(current, 'license');

        sb.auth.getSession().then(function (result) {
            var user = result && result.data && result.data.session
                ? result.data.session.user
                : null;
            var resolved = role || 'license';
            if (!role) {
                if (Auth.getAccountRole) {
                    resolved = Auth.getAccountRole(user) || 'license';
                } else if (Auth.isSubscriptionAdmin && Auth.isSubscriptionAdmin(user)) {
                    resolved = 'admin';
                }
            }
            applyWithUser(user, resolved);
        }).catch(function () {
            applyWithUser(null, role || 'license');
        });
    }

    global.NolimiMenuSidebar = {
        mount: mount,
        refreshNotifBadge: refreshNotifBadge,
        setNotifTotal: setNotifTotal,
        setNotifUser: setNotifUser
    };
})(window);
