// 02-menu/pages/equipe/ — grille de membres (admin + collaborateurs).

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;

    window.__nolimiPageCleanup = function () {
        window.__nolimiPageCleanup = null;
    };

    var statusEl = document.getElementById('equipe-status');
    var gridEl = document.getElementById('equipe-grid');
    var filterAllBtn = document.getElementById('filter-all');
    var filterAdminBtn = document.getElementById('filter-admin');
    var filterCollabBtn = document.getElementById('filter-collab');
    var searchEl = document.getElementById('equipe-search');

    var members = [];
    var currentUserEmail = '';
    var searchQuery = '';
    var activeFilter = 'all';

    var AVATAR_COLORS = [
        { bg: '#dbeafe', fg: '#1d4ed8' },
        { bg: '#ede9fe', fg: '#6d28d9' },
        { bg: '#dcfce7', fg: '#15803d' },
        { bg: '#fef3c7', fg: '#b45309' },
        { bg: '#fce7f3', fg: '#be185d' },
        { bg: '#e0e7ff', fg: '#4338ca' },
        { bg: '#ccfbf1', fg: '#0f766e' },
        { bg: '#ffedd5', fg: '#c2410c' }
    ];

    function setStatus(text, isError) {
        if (!statusEl) return;
        statusEl.textContent = text || '';
        statusEl.classList.toggle('equipe-status--error', !!isError);
        statusEl.hidden = !text;
    }

    function initialsFromEmail(email) {
        var local = String(email || '').split('@')[0] || '';
        var parts = local.split(/[._+\-]+/).filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
        }
        return local.slice(0, 2).toUpperCase() || '?';
    }

    function colorForEmail(email) {
        var s = String(email || '').toLowerCase();
        var hash = 0;
        for (var i = 0; i < s.length; i++) {
            hash = ((hash << 5) - hash) + s.charCodeAt(i);
            hash |= 0;
        }
        return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
    }

    function buildMembers(data) {
        var list = [];
        var seen = {};
        var adminEmail = String(data.adminEmail || '').trim();

        function add(email, role) {
            var normalized = String(email || '').trim().toLowerCase();
            if (!normalized) return;
            if (seen[normalized]) {
                // Si déjà présent en collab et on ajoute admin, garder admin
                if (role === 'admin') {
                    for (var i = 0; i < list.length; i++) {
                        if (list[i].email.toLowerCase() === normalized) {
                            list[i].role = 'admin';
                            break;
                        }
                    }
                }
                return;
            }
            seen[normalized] = true;
            list.push({
                email: String(email).trim(),
                role: role
            });
        }

        if (adminEmail) add(adminEmail, 'admin');
        (data.licenses || []).forEach(function (email) {
            add(email, 'collab');
        });

        list.sort(function (a, b) {
            if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
            return a.email.localeCompare(b.email, 'fr', { sensitivity: 'base' });
        });
        return list;
    }

    function countByRole(role) {
        var n = 0;
        for (var i = 0; i < members.length; i++) {
            if (members[i].role === role) n++;
        }
        return n;
    }

    function filteredMembers() {
        var list = members.filter(function (m) {
            if (activeFilter === 'admin') return m.role === 'admin';
            if (activeFilter === 'collab') return m.role === 'collab';
            return true;
        });

        var q = searchQuery.trim().toLowerCase();
        if (!q) return list;
        return list.filter(function (m) {
            return m.email.toLowerCase().indexOf(q) !== -1;
        });
    }

    function updateFilterCounts() {
        if (filterAllBtn) filterAllBtn.textContent = 'Tous (' + members.length + ')';
        if (filterAdminBtn) filterAdminBtn.textContent = 'Admin (' + countByRole('admin') + ')';
        if (filterCollabBtn) filterCollabBtn.textContent = 'Collaborateur (' + countByRole('collab') + ')';
    }

    function setActiveFilter(filter) {
        activeFilter = filter;
        document.querySelectorAll('.equipe-filter').forEach(function (btn) {
            btn.classList.toggle('is-active', btn.getAttribute('data-filter') === filter);
        });
        renderGrid();
    }

    function renderGrid() {
        if (!gridEl) return;
        var list = filteredMembers();
        gridEl.innerHTML = '';

        if (!members.length) {
            gridEl.hidden = true;
            setStatus('Aucun membre dans l’équipe pour le moment.');
            return;
        }

        if (!list.length) {
            gridEl.hidden = true;
            setStatus(searchQuery.trim()
                ? 'Aucun résultat pour cette recherche.'
                : 'Aucun membre dans ce filtre.');
            return;
        }

        setStatus('');
        gridEl.hidden = false;

        list.forEach(function (member) {
            var email = member.email;
            var isAdmin = member.role === 'admin';
            var isYou = currentUserEmail && email.toLowerCase() === currentUserEmail;
            var colors = colorForEmail(email);

            var card = document.createElement('article');
            card.className = 'equipe-card';

            var top = document.createElement('div');
            top.className = 'equipe-card__top';

            var avatar = document.createElement('div');
            avatar.className = 'equipe-card__avatar';
            avatar.style.background = colors.bg;
            avatar.style.color = colors.fg;
            avatar.textContent = initialsFromEmail(email);

            var info = document.createElement('div');
            info.className = 'equipe-card__info';

            var emailRow = document.createElement('div');
            emailRow.className = 'equipe-card__email-row';

            var emailEl = document.createElement('div');
            emailEl.className = 'equipe-card__email';
            emailEl.textContent = email;
            emailEl.title = email;
            emailRow.appendChild(emailEl);

            if (isYou) {
                var you = document.createElement('span');
                you.className = 'equipe-card__you';
                you.textContent = 'Vous';
                emailRow.appendChild(you);
            }

            var sub = document.createElement('div');
            sub.className = 'equipe-card__sub';
            sub.textContent = isAdmin
                ? 'Gestion de l’espace et des fichiers'
                : 'Accès aux projets partagés';

            info.appendChild(emailRow);
            info.appendChild(sub);
            top.appendChild(avatar);
            top.appendChild(info);

            var badge = document.createElement('span');
            badge.className = 'equipe-card__badge' + (isAdmin ? ' equipe-card__badge--admin' : '');
            badge.textContent = isAdmin ? 'Admin' : 'Collaborateur';

            card.appendChild(top);
            card.appendChild(badge);
            gridEl.appendChild(card);
        });
    }

    function renderTeam(data) {
        members = buildMembers(data);
        updateFilterCounts();
        renderGrid();
    }

    function fallbackFromUser(user) {
        var meta = (user && user.user_metadata) || {};
        var adminEmail = meta.license_manager_email ||
            (meta.account_role === 'admin' ? user.email : null) ||
            null;
        var licenses = Array.isArray(meta.team_license_emails)
            ? meta.team_license_emails
            : [];
        return {
            adminEmail: adminEmail,
            licenses: licenses,
            plan: meta.license_plan || null
        };
    }

    function loadTeam(session) {
        if (!Auth || !Auth.getClient) {
            setStatus('Service indisponible.', true);
            return;
        }
        var sb = Auth.getClient();
        if (!sb || !session || !session.access_token) {
            setStatus('Session invalide.', true);
            return;
        }

        if (session.user && session.user.email) {
            currentUserEmail = String(session.user.email).trim().toLowerCase();
        }

        fetch(new URL('/api/team-members', window.location.origin).href, {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + session.access_token
            }
        }).then(function (response) {
            return response.json().then(function (data) {
                return { ok: response.ok, data: data };
            });
        }).then(function (result) {
            if (result.ok && result.data && (result.data.adminEmail || (result.data.licenses && result.data.licenses.length))) {
                renderTeam(result.data);
                return;
            }
            var fallback = fallbackFromUser(session.user);
            if (fallback.adminEmail || (fallback.licenses && fallback.licenses.length)) {
                renderTeam(fallback);
                return;
            }
            setStatus(
                (result.data && result.data.error) ||
                'Impossible de charger l’équipe.',
                true
            );
        }).catch(function () {
            var fallback = fallbackFromUser(session.user);
            if (fallback.adminEmail || (fallback.licenses && fallback.licenses.length)) {
                renderTeam(fallback);
                return;
            }
            setStatus('Erreur réseau. Réessayez.', true);
        });
    }

    document.querySelectorAll('.equipe-filter').forEach(function (btn) {
        btn.addEventListener('click', function () {
            setActiveFilter(btn.getAttribute('data-filter') || 'all');
        });
    });

    if (searchEl) {
        searchEl.addEventListener('input', function () {
            searchQuery = searchEl.value || '';
            renderGrid();
        });
    }

    if (Auth && Auth.requireAccountSession) {
        Auth.requireAccountSession().then(function (session) {
            loadTeam(session);
        }).catch(function () {});
    }
})();
