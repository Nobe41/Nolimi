// 02-menu/components/resume-project/ — panneau « reprendre le projet en cours ».

(function (global) {
    var STORAGE_KEY = 'nolimi-in-progress-v1';
    var PANEL_ID = 'menu-resume-project';

    function loadEntry() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (!data || !data.payload) return null;
            return data;
        } catch (e) {
            return null;
        }
    }

    function clearEntry() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
    }

    function buildResumeUrl(entry) {
        var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;
        var href;
        if (Auth && Auth.getAppUrl) {
            href = Auth.getAppUrl(null, entry.projectId || null);
        } else {
            href = '../../../01-saas/app.html?start=1';
            if (entry.projectId) {
                href += '&project=' + encodeURIComponent(entry.projectId);
            }
        }
        try {
            var u = new URL(href, window.location.href);
            u.searchParams.set('resume', '1');
            return u.href;
        } catch (e) {
            return href + (href.indexOf('?') === -1 ? '?' : '&') + 'resume=1';
        }
    }

    function hidePanel() {
        var el = document.getElementById(PANEL_ID);
        if (el) el.hidden = true;
    }

    function render(entry) {
        var existing = document.getElementById(PANEL_ID);
        if (!entry) {
            if (existing) existing.remove();
            return;
        }

        var name = String(entry.projectName || 'Projet en cours').trim() || 'Projet en cours';
        var panel = existing;
        if (!panel) {
            panel = document.createElement('aside');
            panel.id = PANEL_ID;
            panel.className = 'menu-resume';
            panel.setAttribute('aria-label', 'Projet en cours');
            document.body.appendChild(panel);
        }

        panel.hidden = false;
        panel.innerHTML =
            '<div class="menu-resume__top">' +
                '<p class="menu-resume__name"></p>' +
                '<button type="button" class="menu-resume__close" aria-label="Fermer">×</button>' +
            '</div>' +
            '<p class="menu-resume__hint">Non enregistré — reprenez là où vous vous êtes arrêté.</p>' +
            '<button type="button" class="menu-resume__cta">Reprendre</button>';

        panel.querySelector('.menu-resume__name').textContent = name;

        panel.querySelector('.menu-resume__close').addEventListener('click', function () {
            clearEntry();
            hidePanel();
        });

        panel.querySelector('.menu-resume__cta').addEventListener('click', function () {
            window.location.href = buildResumeUrl(entry);
        });
    }

    function mount() {
        render(loadEntry());
    }

    function clearAndHide() {
        clearEntry();
        hidePanel();
    }

    global.NolimiResumeProject = {
        mount: mount,
        clear: clearAndHide,
        hasEntry: function () { return !!loadEntry(); }
    };
})(window);
