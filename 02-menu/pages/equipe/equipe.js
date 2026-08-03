// 02-menu/pages/equipe/ — grille de membres + gestion des sièges (admin).

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;

    var openMenuWrap = null;

    function closeOpenMenu() {
        if (!openMenuWrap) return;
        var dropdown = openMenuWrap.querySelector('.equipe-card__menu-dropdown');
        var btn = openMenuWrap.querySelector('.equipe-card__menu-btn');
        if (dropdown) dropdown.hidden = true;
        if (btn) btn.setAttribute('aria-expanded', 'false');
        openMenuWrap.classList.remove('is-open');
        openMenuWrap = null;
    }

    window.__nolimiPageCleanup = function () {
        closeOpenMenu();
        document.removeEventListener('click', onDocumentClickCloseMenu);
        window.__nolimiPageCleanup = null;
    };

    function onDocumentClickCloseMenu(e) {
        if (!openMenuWrap) return;
        if (openMenuWrap.contains(e.target)) return;
        closeOpenMenu();
    }

    document.addEventListener('click', onDocumentClickCloseMenu);

    var statusEl = document.getElementById('equipe-status');
    var gridEl = document.getElementById('equipe-grid');
    var slotsEl = document.getElementById('equipe-slots');
    var addBtn = document.getElementById('equipe-btn-add');
    var filterAllBtn = document.getElementById('filter-all');
    var filterAdminBtn = document.getElementById('filter-admin');
    var filterCollabBtn = document.getElementById('filter-collab');
    var searchEl = document.getElementById('equipe-search');
    var modal = document.getElementById('equipe-modal');
    var modalEmail = document.getElementById('equipe-modal-email');
    var modalError = document.getElementById('equipe-modal-error');
    var modalCancel = document.getElementById('equipe-modal-cancel');
    var modalSubmit = document.getElementById('equipe-modal-submit');

    var members = [];
    var teamData = null;
    var accessToken = '';
    var currentUserEmail = '';
    var searchQuery = '';
    var activeFilter = 'all';
    var canManage = false;

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

    function updateSlotsBar(data) {
        if (!slotsEl) return;
        var capacity = parseInt(data.licenseCount, 10) || 0;
        var used = typeof data.usedSeats === 'number'
            ? data.usedSeats
            : ((data.licenses || []).length + (data.adminHasLicenseSeat ? 1 : 0));
        var remaining = typeof data.remainingSlots === 'number'
            ? data.remainingSlots
            : Math.max(0, capacity - used);

        if (!capacity) {
            slotsEl.hidden = true;
            slotsEl.textContent = '';
            return;
        }

        slotsEl.hidden = false;
        var text = used + ' / ' + capacity + ' licence' + (capacity > 1 ? 's' : '') +
            ' utilisées · ' + remaining + ' place' + (remaining > 1 ? 's' : '') + ' restante' + (remaining > 1 ? 's' : '');
        if (data.overCapacity) {
            text += ' — trop de comptes actifs : les plus récents sont suspendus.';
        }
        slotsEl.textContent = text;
        slotsEl.classList.toggle('equipe-slots--warn', !!data.overCapacity);
    }

    function updateAddButton(data) {
        canManage = !!data.canManage;
        if (!addBtn) return;
        addBtn.hidden = true;
    }

    function setActiveFilter(filter) {
        activeFilter = filter;
        document.querySelectorAll('.equipe-filter').forEach(function (btn) {
            btn.classList.toggle('is-active', btn.getAttribute('data-filter') === filter);
        });
        renderGrid();
    }

    function apiTeamLicense(action, email) {
        return fetch(new URL('/api/team-license', window.location.origin).href, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + accessToken
            },
            body: JSON.stringify({ action: action, email: email })
        }).then(function (response) {
            return response.json().then(function (data) {
                return { ok: response.ok || response.status === 207, status: response.status, data: data };
            });
        });
    }

    function refreshSessionThen(cb) {
        if (!Auth || !Auth.getClient) {
            if (cb) cb();
            return;
        }
        var sb = Auth.getClient();
        if (!sb || !sb.auth.refreshSession) {
            if (cb) cb();
            return;
        }
        sb.auth.refreshSession().then(function (result) {
            var session = result && result.data ? result.data.session : null;
            if (session && session.access_token) {
                accessToken = session.access_token;
                if (session.user && session.user.email) {
                    currentUserEmail = String(session.user.email).trim().toLowerCase();
                }
            }
            if (cb) cb();
        }).catch(function () {
            if (cb) cb();
        });
    }

    function removeMember(email) {
        if (!canManage) return;
        var isSelf = email.toLowerCase() === currentUserEmail;
        var label = isSelf
            ? 'Retirer votre siège licence ?\n\nVotre compte admin sera conservé, mais vous perdrez l’accès collaborateur (Fichiers, Accueil…).'
            : 'Supprimer définitivement le compte « ' + email + ' » ?\n\n• La personne ne pourra plus se connecter\n• Une place licence se libérera';
        if (!confirm(label)) return;

        setStatus('Suppression…');
        apiTeamLicense('remove', email).then(function (result) {
            if (!result.ok) {
                setStatus((result.data && result.data.error) || 'Impossible de supprimer.', true);
                return;
            }
            refreshSessionThen(reloadTeam);
        }).catch(function () {
            setStatus('Erreur réseau. Réessayez.', true);
        });
    }

    function resendCredentials(email) {
        if (!canManage) return;
        if (!confirm('Renvoyer un nouvel email d’accès à « ' + email + ' » ?\n\nUn nouveau mot de passe sera généré (l’ancien ne fonctionnera plus).')) {
            return;
        }
        setStatus('Envoi du mail…');
        apiTeamLicense('resend', email).then(function (result) {
            if (!result.ok) {
                setStatus((result.data && result.data.error) || 'Impossible de renvoyer le mail.', true);
                return;
            }
            setStatus('Nouvel email d’accès envoyé à ' + email + '.');
        }).catch(function () {
            setStatus('Erreur réseau. Réessayez.', true);
        });
    }

    function renderGrid() {
        if (!gridEl) return;
        closeOpenMenu();
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
            var canRemove = canManage && (
                (!isAdmin) ||
                (isAdmin && teamData && teamData.adminHasLicenseSeat && isYou)
            );

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

            var suspended = false;
            if (teamData && Array.isArray(teamData.licenseDetails)) {
                for (var d = 0; d < teamData.licenseDetails.length; d++) {
                    if (teamData.licenseDetails[d].email === email.toLowerCase() &&
                        teamData.licenseDetails[d].suspended) {
                        suspended = true;
                        break;
                    }
                }
            }
            if (suspended) {
                var sus = document.createElement('span');
                sus.className = 'equipe-card__suspended';
                sus.textContent = 'Suspendu';
                emailRow.appendChild(sus);
            }

            var sub = document.createElement('div');
            sub.className = 'equipe-card__sub';
            if (isAdmin && teamData && teamData.adminHasLicenseSeat) {
                sub.textContent = 'Admin + accès collaborateur';
            } else if (isAdmin) {
                sub.textContent = 'Gestion de l’abonnement et de l’équipe';
            } else {
                sub.textContent = 'Accès aux projets partagés';
            }

            info.appendChild(emailRow);
            info.appendChild(sub);
            top.appendChild(avatar);
            top.appendChild(info);

            var footer = document.createElement('div');
            footer.className = 'equipe-card__footer';

            var badge = document.createElement('span');
            badge.className = 'equipe-card__badge' + (isAdmin ? ' equipe-card__badge--admin' : '');
            badge.textContent = isAdmin ? 'Admin' : 'Collaborateur';
            footer.appendChild(badge);

            if (canRemove) {
                var menuWrap = document.createElement('div');
                menuWrap.className = 'equipe-card__menu';

                var menuBtn = document.createElement('button');
                menuBtn.type = 'button';
                menuBtn.className = 'equipe-card__menu-btn';
                menuBtn.setAttribute('aria-haspopup', 'true');
                menuBtn.setAttribute('aria-expanded', 'false');
                menuBtn.setAttribute('aria-label', 'Actions pour ' + email);
                menuBtn.textContent = '⋯';
                menuBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var isOpen = menuWrap.classList.contains('is-open');
                    closeOpenMenu();
                    if (isOpen) return;
                    menuWrap.classList.add('is-open');
                    dropdown.hidden = false;
                    menuBtn.setAttribute('aria-expanded', 'true');
                    openMenuWrap = menuWrap;
                });

                var dropdown = document.createElement('div');
                dropdown.className = 'equipe-card__menu-dropdown';
                dropdown.hidden = true;
                dropdown.setAttribute('role', 'menu');

                if (!isAdmin) {
                    var resendBtn = document.createElement('button');
                    resendBtn.type = 'button';
                    resendBtn.className = 'equipe-card__menu-item';
                    resendBtn.setAttribute('role', 'menuitem');
                    resendBtn.textContent = 'Renvoyer accès';
                    resendBtn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        closeOpenMenu();
                        resendCredentials(email);
                    });
                    dropdown.appendChild(resendBtn);
                }

                var removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'equipe-card__menu-item equipe-card__menu-item--danger';
                removeBtn.setAttribute('role', 'menuitem');
                removeBtn.textContent = isAdmin ? 'Retirer le siège' : 'Supprimer';
                removeBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    closeOpenMenu();
                    removeMember(email);
                });
                dropdown.appendChild(removeBtn);

                menuWrap.appendChild(menuBtn);
                menuWrap.appendChild(dropdown);
                footer.appendChild(menuWrap);
            }

            card.appendChild(top);
            card.appendChild(footer);
            gridEl.appendChild(card);
        });

        // Cartes « place libre » pour l’admin
        if (canManage && teamData && activeFilter !== 'admin' && !searchQuery.trim()) {
            var remaining = parseInt(teamData.remainingSlots, 10) || 0;
            for (var s = 0; s < remaining; s++) {
                var slot = document.createElement('button');
                slot.type = 'button';
                slot.className = 'equipe-card equipe-card--slot';
                slot.innerHTML =
                    '<span class="equipe-card--slot__plus" aria-hidden="true">+</span>' +
                    '<span class="equipe-card--slot__label">Place disponible</span>';
                slot.addEventListener('click', openAddModal);
                gridEl.appendChild(slot);
            }
        }
    }

    function renderTeam(data) {
        teamData = data || {};
        members = buildMembers(teamData);
        updateFilterCounts();
        updateSlotsBar(teamData);
        updateAddButton(teamData);
        renderGrid();
    }

    function fallbackFromUser(user) {
        var meta = (user && user.user_metadata) || {};
        var adminEmail = meta.license_manager_email ||
            (meta.account_role === 'admin' ? user.email : null) ||
            null;
        var licenses = Array.isArray(meta.team_license_emails)
            ? meta.team_license_emails.filter(function (e) {
                return String(e || '').trim().toLowerCase() !== String(adminEmail || '').toLowerCase();
            })
            : [];
        var capacity = parseInt(meta.license_count, 10) || 0;
        var hasSelf = !!meta.has_license_seat;
        var used = licenses.length + (hasSelf ? 1 : 0);
        return {
            adminEmail: adminEmail,
            licenses: licenses,
            plan: meta.license_plan || null,
            licenseCount: capacity,
            usedSeats: used,
            remainingSlots: Math.max(0, capacity - used),
            adminHasLicenseSeat: hasSelf,
            canManage: meta.account_role === 'admin'
        };
    }

    function reloadTeam() {
        if (!accessToken) return;
        fetch(new URL('/api/team-members', window.location.origin).href, {
            method: 'GET',
            headers: { Authorization: 'Bearer ' + accessToken }
        }).then(function (response) {
            return response.json().then(function (data) {
                return { ok: response.ok, data: data };
            });
        }).then(function (result) {
            if (result.ok && result.data) {
                renderTeam(result.data);
                return;
            }
            setStatus((result.data && result.data.error) || 'Impossible de charger l’équipe.', true);
        }).catch(function () {
            setStatus('Erreur réseau. Réessayez.', true);
        });
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

        accessToken = session.access_token;
        if (session.user && session.user.email) {
            currentUserEmail = String(session.user.email).trim().toLowerCase();
        }

        fetch(new URL('/api/team-members', window.location.origin).href, {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + accessToken
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

    function openAddModal() {
        if (!canManage || !teamData || (teamData.remainingSlots || 0) <= 0) return;
        if (modalError) modalError.textContent = '';
        if (modalEmail) modalEmail.value = '';
        if (modal) modal.hidden = false;
        if (modalSubmit) {
            modalSubmit.disabled = false;
            modalSubmit.textContent = 'Valider';
        }
        if (modalEmail) modalEmail.focus();
    }

    function closeAddModal() {
        if (modal) modal.hidden = true;
        if (modalError) modalError.textContent = '';
    }

    function submitAddModal() {
        if (!modalEmail) return;
        var email = modalEmail.value.trim().toLowerCase();
        if (!email || !modalEmail.checkValidity()) {
            if (modalError) modalError.textContent = 'Veuillez saisir une adresse mail valide.';
            return;
        }
        if (modalError) modalError.textContent = '';
        if (modalSubmit) {
            modalSubmit.disabled = true;
            modalSubmit.textContent = 'Envoi…';
        }

        apiTeamLicense('add', email).then(function (result) {
            if (!result.ok) {
                if (modalError) {
                    modalError.textContent = (result.data && result.data.error) ||
                        'Impossible d’ajouter cette licence.';
                }
                if (modalSubmit) {
                    modalSubmit.disabled = false;
                    modalSubmit.textContent = 'Valider';
                }
                return;
            }
            closeAddModal();
            if (result.data && result.data.warning) {
                setStatus(result.data.warning, true);
            }
            refreshSessionThen(reloadTeam);
        }).catch(function () {
            if (modalError) modalError.textContent = 'Erreur réseau. Réessayez.';
            if (modalSubmit) {
                modalSubmit.disabled = false;
                modalSubmit.textContent = 'Valider';
            }
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

    if (addBtn) addBtn.addEventListener('click', openAddModal);
    if (modalCancel) modalCancel.addEventListener('click', closeAddModal);
    if (modalSubmit) modalSubmit.addEventListener('click', submitAddModal);
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeAddModal();
        });
    }
    if (modalEmail) {
        modalEmail.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitAddModal();
            }
        });
    }

    if (Auth && Auth.requireAccountSession) {
        Auth.requireAccountSession().then(function (session) {
            loadTeam(session);
        }).catch(function () {});
    }
})();
