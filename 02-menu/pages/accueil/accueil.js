// 02-menu/pages/accueil/ — salut + Nouveau projet + 3 projets récents.

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;
    var Cloud = typeof CloudProjects !== 'undefined' ? CloudProjects : null;
    var statusEl = document.getElementById('accueil-recent-status');
    var listEl = document.getElementById('accueil-recent-list');

    window.__nolimiPageCleanup = function () {
        window.__nolimiPageCleanup = null;
    };

    function pad2(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function formatModifiedDate(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
        } catch (e) {
            return '';
        }
    }

    function setStatus(text, isError) {
        if (!statusEl) return;
        statusEl.textContent = text || '';
        statusEl.classList.toggle('accueil-recent__status--error', !!isError);
        statusEl.hidden = !text;
    }

    function openProject(projectId) {
        if (!Auth || !Auth.getAppUrl) return;
        if (typeof NolimiResumeProject !== 'undefined' && NolimiResumeProject.clear) {
            NolimiResumeProject.clear();
        }
        window.location.href = Auth.getAppUrl(null, projectId);
    }

    function renderRecent(projects) {
        if (!listEl) return;
        listEl.innerHTML = '';

        if (!projects || !projects.length) {
            listEl.hidden = true;
            setStatus('Aucun projet récent.');
            return;
        }

        setStatus('');
        listEl.hidden = false;

        projects.forEach(function (row) {
            var li = document.createElement('li');
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'accueil-recent__item';

            var name = document.createElement('span');
            name.className = 'accueil-recent__name';
            name.textContent = row.name || 'Sans titre';

            var date = document.createElement('span');
            date.className = 'accueil-recent__date';
            date.textContent = formatModifiedDate(row.updated_at);

            btn.appendChild(name);
            btn.appendChild(date);
            btn.addEventListener('click', function () { openProject(row.id); });

            li.appendChild(btn);
            listEl.appendChild(li);
        });
    }

    function loadRecent() {
        if (!Cloud || !Cloud.listRecent) {
            setStatus('Projets indisponibles.', true);
            return;
        }
        setStatus('Chargement…');
        Cloud.listRecent(3).then(renderRecent).catch(function (err) {
            setStatus(Cloud.mapError ? Cloud.mapError(err) : 'Impossible de charger les projets.', true);
            if (listEl) listEl.hidden = true;
        });
    }

    function fillGreeting() {
        var greetingEl = document.getElementById('accueil-greeting');
        if (!greetingEl || !Auth || !Auth.getClient) return;
        var sb = Auth.getClient();
        if (!sb) return;

        sb.auth.getSession().then(function (result) {
            var user = result && result.data && result.data.session
                ? result.data.session.user
                : null;
            var email = user && user.email ? String(user.email) : '';
            greetingEl.textContent = email ? ('Bonjour, ' + email + ' 👋') : 'Bonjour 👋';
        }).catch(function () {});
    }

    function boot() {
        fillGreeting();
        loadRecent();
    }

    if (Auth && Auth.requireLicenseAccount) {
        Auth.requireLicenseAccount().then(boot).catch(function () {});
    } else if (Auth && Auth.requireAccountSession) {
        Auth.requireAccountSession().then(boot).catch(function () {});
    } else {
        boot();
    }

    var btn = document.getElementById('btn-nouveau');
    if (btn) {
        btn.addEventListener('click', function () {
            if (!Auth || !Auth.getAppUrl) return;
            if (typeof NolimiResumeProject !== 'undefined' && NolimiResumeProject.clear) {
                NolimiResumeProject.clear();
            }
            window.location.href = Auth.getAppUrl();
        });
    }
})();
