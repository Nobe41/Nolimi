// 02-menu/components/soft-nav/ — navigation entre pages menu sans rechargement.

(function (global) {
    var PAGE_ROOT_ID = 'menu-page-root';
    var navigating = false;
    var cache = {};

    var SHARED_SCRIPT_RE = /supabase|supabase\.config|auth\.js|cloud-projects|sidebar\.js|soft-nav/i;
    var PAGE_SCRIPT_RE = /\/(accueil|fichiers|equipe|notifications|mon-compte|abonnement)\.js(\?|$)/i;
    var PAGE_STYLE_RE = /\/(accueil|fichiers|equipe|notifications|mon-compte|abonnement)\.css(\?|$)/i;

    function isMenuPageUrl(url) {
        try {
            var u = new URL(url, window.location.href);
            if (u.origin !== window.location.origin) return false;
            return /\/02-menu\/pages\/[^/]+\/index\.html$/i.test(u.pathname);
        } catch (e) {
            return false;
        }
    }

    function pageKey(url) {
        return new URL(url, window.location.href).pathname;
    }

    function ensurePageRoot() {
        var existing = document.getElementById(PAGE_ROOT_ID);
        if (existing) return existing;

        var root = document.createElement('div');
        root.id = PAGE_ROOT_ID;

        var main = document.querySelector('main.menu-main');
        if (!main) {
            document.body.appendChild(root);
            return root;
        }

        var nodes = [];
        var el = main;
        while (el) {
            var next = el.nextElementSibling;
            if (el.tagName === 'SCRIPT') break;
            if (el.id === 'menu-sidebar' || el.classList.contains('menu-sidebar')) break;
            if (el.classList.contains('menu-mobile-bar') || el.classList.contains('menu-sidebar-backdrop')) break;
            nodes.push(el);
            el = next;
        }

        main.parentNode.insertBefore(root, main);
        nodes.forEach(function (node) { root.appendChild(node); });
        return root;
    }

    function cleanupCurrentPage() {
        if (typeof global.__nolimiPageCleanup === 'function') {
            try { global.__nolimiPageCleanup(); } catch (e) {}
            global.__nolimiPageCleanup = null;
        }
        document.querySelectorAll('script[data-soft-page-script]').forEach(function (s) {
            s.remove();
        });
    }

    function collectPageStyleHrefs(doc, pageUrl) {
        var hrefs = [];
        var seen = {};
        doc.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
            var href = link.getAttribute('href');
            if (!href) return;
            var abs = new URL(href, pageUrl).href;
            if (!PAGE_STYLE_RE.test(abs) && !/^\.\/[^/]+\.css$/i.test(href)) return;
            if (/main\.css|tokens\.css|sidebar\.css|resume-project\.css/i.test(abs)) return;
            if (seen[abs]) return;
            seen[abs] = true;
            hrefs.push(abs);
        });
        return hrefs;
    }

    function preloadStylesheet(href) {
        return new Promise(function (resolve) {
            var same = null;
            document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
                if (link.href === href) same = link;
            });
            if (same) {
                same.dataset.softPageStyle = '1';
                resolve(same);
                return;
            }

            var l = document.createElement('link');
            l.rel = 'stylesheet';
            l.href = href;
            l.dataset.softPageStyle = '1';
            var done = false;
            function finish() {
                if (done) return;
                done = true;
                resolve(l);
            }
            l.onload = finish;
            l.onerror = finish;
            document.head.appendChild(l);
            setTimeout(finish, 1200);
        });
    }

    function preparePageStyles(doc, pageUrl) {
        var hrefs = collectPageStyleHrefs(doc, pageUrl);
        return Promise.all(hrefs.map(preloadStylesheet)).then(function (links) {
            var keep = {};
            links.forEach(function (l) {
                if (l && l.href) keep[l.href] = true;
            });
            document.querySelectorAll('link[data-soft-page-style]').forEach(function (l) {
                if (!keep[l.href]) l.remove();
            });
        });
    }

    function markInitialPageStyle() {
        document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
            var href = link.href || '';
            if (PAGE_STYLE_RE.test(href)) link.dataset.softPageStyle = '1';
        });
    }

    function neededSharedScripts(doc, pageUrl) {
        var list = [];
        doc.querySelectorAll('script[src]').forEach(function (s) {
            var src = s.getAttribute('src');
            if (!src) return;
            var abs = new URL(src, pageUrl).href;
            if (!/cloud-projects\.js/i.test(abs)) return;
            if (global.CloudProjects) return;
            list.push(abs);
        });
        return list;
    }

    function pageScripts(doc, pageUrl) {
        var list = [];
        doc.querySelectorAll('script[src]').forEach(function (s) {
            var src = s.getAttribute('src');
            if (!src) return;
            if (SHARED_SCRIPT_RE.test(src)) return;
            var abs = new URL(src, pageUrl).href;
            if (PAGE_SCRIPT_RE.test(abs) || /^\.\//.test(src)) list.push(abs);
        });
        return list;
    }

    function loadScript(src, pageScript) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            if (pageScript) {
                s.dataset.softPageScript = '1';
                s.src = src + (src.indexOf('?') >= 0 ? '&' : '?') + '_soft=' + Date.now();
            }
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error('Script: ' + src)); };
            document.body.appendChild(s);
        });
    }

    function loadScriptsSequential(urls, pageScript) {
        return urls.reduce(function (chain, url) {
            return chain.then(function () { return loadScript(url, pageScript); });
        }, Promise.resolve());
    }

    function updateSidebarActive(url) {
        var path = new URL(url, window.location.href).pathname;
        document.querySelectorAll('.menu-sidebar__link').forEach(function (a) {
            var href = a.getAttribute('href');
            if (!href) return;
            var linkPath = new URL(href, window.location.href).pathname;
            var active = linkPath === path;
            a.classList.toggle('menu-sidebar__link--current', active);
            if (active) a.setAttribute('aria-current', 'page');
            else a.removeAttribute('aria-current');
        });
        document.body.classList.remove('menu-nav-open');
        var backdrop = document.getElementById('menu-sidebar-backdrop');
        if (backdrop) backdrop.hidden = true;
        var toggle = document.getElementById('menu-mobile-toggle');
        if (toggle) {
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', 'Ouvrir le menu');
        }
    }

    function extractPageContent(doc) {
        var frag = document.createDocumentFragment();
        var main = doc.querySelector('main.menu-main');
        if (main) frag.appendChild(document.importNode(main, true));

        var el = main ? main.nextElementSibling : null;
        while (el) {
            var next = el.nextElementSibling;
            if (el.tagName === 'SCRIPT') break;
            if (el.classList && (
                el.classList.contains('menu-sidebar') ||
                el.classList.contains('menu-mobile-bar') ||
                el.classList.contains('menu-sidebar-backdrop')
            )) {
                el = next;
                continue;
            }
            frag.appendChild(document.importNode(el, true));
            el = next;
        }
        return frag;
    }

    function fetchPage(url) {
        var key = pageKey(url);
        if (cache[key]) return Promise.resolve(cache[key]);
        return fetch(url, { credentials: 'same-origin', cache: 'no-cache' })
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.text();
            })
            .then(function (html) {
                var doc = new DOMParser().parseFromString(html, 'text/html');
                var entry = { html: html, doc: doc, url: new URL(url, window.location.href).href };
                cache[key] = entry;
                collectPageStyleHrefs(doc, entry.url).forEach(function (href) {
                    preloadStylesheet(href);
                });
                return entry;
            });
    }

    function applyPage(entry, options) {
        cleanupCurrentPage();

        var root = ensurePageRoot();
        root.classList.add('is-soft-swapping');

        return preparePageStyles(entry.doc, entry.url).then(function () {
            var frag = extractPageContent(entry.doc);
            root.innerHTML = '';
            root.appendChild(frag);

            document.title = entry.doc.title || document.title;
            updateSidebarActive(entry.url);

            if (options.push !== false) {
                history.pushState({ softNav: true }, '', entry.url);
            }

            return new Promise(function (resolve) {
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        root.classList.remove('is-soft-swapping');
                        resolve();
                    });
                });
            });
        }).then(function () {
            var shared = neededSharedScripts(entry.doc, entry.url);
            var pages = pageScripts(entry.doc, entry.url);
            return loadScriptsSequential(shared, false)
                .then(function () { return loadScriptsSequential(pages, true); })
                .then(function () {
                    if (global.NolimiMenuSidebar && typeof NolimiMenuSidebar.refreshNotifBadge === 'function') {
                        NolimiMenuSidebar.refreshNotifBadge();
                    }
                });
        }).catch(function (err) {
            root.classList.remove('is-soft-swapping');
            throw err;
        });
    }

    function navigate(url, options) {
        options = options || {};
        if (!isMenuPageUrl(url)) {
            window.location.href = url;
            return Promise.resolve();
        }

        var abs = new URL(url, window.location.href).href;
        if (pageKey(abs) === pageKey(window.location.href) && !options.force) {
            return Promise.resolve();
        }
        if (navigating) return Promise.resolve();
        navigating = true;

        return fetchPage(abs)
            .then(function (entry) {
                return applyPage(entry, options);
            })
            .catch(function () {
                window.location.href = abs;
            })
            .then(function () {
                navigating = false;
            });
    }

    function onClick(e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target.closest('a[href]');
        if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
        var href = a.getAttribute('href');
        if (!href || href.charAt(0) === '#') return;
        if (!isMenuPageUrl(href)) return;
        e.preventDefault();
        navigate(href);
    }

    function onPopState() {
        if (!isMenuPageUrl(window.location.href)) return;
        navigate(window.location.href, { push: false, force: true });
    }

    function prefetch(url) {
        if (!isMenuPageUrl(url)) return;
        fetchPage(url).catch(function () {});
    }

    function onPointerOver(e) {
        var a = e.target.closest && e.target.closest('a.menu-sidebar__link[href]');
        if (!a) return;
        prefetch(a.href);
    }

    function prefetchSidebarLinks() {
        document.querySelectorAll('.menu-sidebar__link[href], .menu-sidebar__brand[href], .menu-mobile-bar__brand[href]').forEach(function (a) {
            prefetch(a.href);
        });
    }

    function init() {
        if (!document.documentElement.dataset.softNavBound) {
            document.documentElement.dataset.softNavBound = '1';
            ensurePageRoot();
            markInitialPageStyle();
            document.addEventListener('click', onClick);
            document.addEventListener('pointerover', onPointerOver);
            window.addEventListener('popstate', onPopState);
            if (!history.state || !history.state.softNav) {
                history.replaceState({ softNav: true }, '', window.location.href);
            }
        }
        prefetchSidebarLinks();
    }

    global.NolimiSoftNav = {
        init: init,
        navigate: navigate,
        prefetch: prefetch
    };
})(window);
