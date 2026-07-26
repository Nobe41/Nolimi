// menu/components/sidebar/ — menu latéral + barre mobile (hamburger).
// Ce fichier : HTML de la sidebar + injection dans la page.

(function (global) {
    var LOGO = '../../../assets/brand/nolimi-logo-wordmark.jpg';

    function link(current, name, href, label) {
        var isCurrent = current === name;
        var classes = 'menu-sidebar__link';
        if (isCurrent) classes += ' menu-sidebar__link--current';
        var attrs = isCurrent ? ' aria-current="page"' : '';
        return '<a href="' + href + '" class="' + classes + '"' + attrs + '>' + label + '</a>';
    }

    function homeHref(role) {
        return role === 'admin' ? '../abonnement/index.html' : '../accueil/index.html';
    }

    function navHtml(current, role) {
        if (role === 'admin') {
            return [
                '<nav class="menu-sidebar__nav" aria-label="Navigation">',
                '  ' + link(current, 'abonnement', '../abonnement/index.html', 'Abonnement'),
                '</nav>'
            ].join('');
        }
        return [
            '<nav class="menu-sidebar__nav" aria-label="Navigation">',
            '  ' + link(current, 'accueil', '../accueil/index.html', 'Accueil'),
            '  ' + link(current, 'fichiers', '../fichiers/index.html', 'Fichiers'),
            '  ' + link(current, 'mon-compte', '../mon-compte/index.html', 'Mon compte'),
            '  ' + link(current, 'parametres', '../parametres/index.html', 'Paramètres'),
            '</nav>'
        ].join('');
    }

    // current : 'accueil' | 'fichiers' | 'mon-compte' | 'parametres' | 'abonnement'
    // role : 'license' | 'admin'
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
    }

    function mount(options) {
        options = options || {};
        var current = options.current || 'accueil';
        var role = options.role || null;

        if (role) {
            inject(current, role);
            return;
        }

        // Détection auto du rôle (admin vs licence)
        inject(current, 'license');
        var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;
        if (!Auth || !Auth.getClient) return;
        var sb = Auth.getClient();
        if (!sb) return;
        sb.auth.getSession().then(function (result) {
            var user = result && result.data && result.data.session
                ? result.data.session.user
                : null;
            if (Auth.isSubscriptionAdmin && Auth.isSubscriptionAdmin(user)) {
                inject(current, 'admin');
            }
        }).catch(function () {});
    }

    global.NolimiMenuSidebar = { mount: mount };
})(window);
