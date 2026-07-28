// menu/pages/equipe/ — affiche admin + licences de l’abonnement.

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;

    var statusEl = document.getElementById('equipe-status');
    var fieldsEl = document.getElementById('equipe-fields');
    var adminEl = document.getElementById('equipe-admin');
    var licensesEl = document.getElementById('equipe-licenses');
    var planEl = document.getElementById('equipe-plan');

    function setStatus(text, isError) {
        if (!statusEl) return;
        statusEl.textContent = text || '';
        statusEl.classList.toggle('equipe-status--error', !!isError);
        statusEl.hidden = !text;
    }

    function renderTeam(data) {
        if (planEl) {
            planEl.textContent = data.plan
                ? ('Abonnement : ' + data.plan)
                : '';
        }
        if (adminEl) adminEl.textContent = data.adminEmail || '—';

        if (licensesEl) {
            licensesEl.innerHTML = '';
            var licenses = data.licenses || [];
            if (!licenses.length) {
                var empty = document.createElement('li');
                empty.className = 'equipe-list__empty';
                empty.textContent = 'Aucun compte licence pour le moment.';
                licensesEl.appendChild(empty);
            } else {
                for (var i = 0; i < licenses.length; i++) {
                    var li = document.createElement('li');
                    li.className = 'equipe-list__item';
                    li.textContent = licenses[i];
                    licensesEl.appendChild(li);
                }
            }
        }

        if (fieldsEl) fieldsEl.hidden = false;
        setStatus('');
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
            if (result.ok && result.data && result.data.adminEmail) {
                renderTeam(result.data);
                return;
            }
            var fallback = fallbackFromUser(session.user);
            if (fallback.adminEmail) {
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
            if (fallback.adminEmail) {
                renderTeam(fallback);
                return;
            }
            setStatus('Erreur réseau. Réessayez.', true);
        });
    }

    if (Auth && Auth.requireAccountSession) {
        Auth.requireAccountSession().then(function (session) {
            loadTeam(session);
        }).catch(function () {});
    }
})();
