// menu/pages/abonnement/ — infos abo + portail Stripe (admin uniquement).

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;

    function setText(id, value) {
        var el = document.getElementById(id);
        if (!el) return;
        el.textContent = value || 'Non renseigné';
    }

    function planLabel(meta) {
        if (!meta) return null;
        if (meta.license_plan) return String(meta.license_plan);
        var count = parseInt(meta.license_count, 10);
        if (count === 1) return '1 licence';
        if (count > 1) return count + ' licences';
        return null;
    }

    function fillInfo(session) {
        var user = session && session.user ? session.user : null;
        if (!user) return;
        var meta = user.user_metadata || {};
        setText('abo-email', user.email || null);
        setText('abo-plan', planLabel(meta));

        var btn = document.getElementById('btn-manage-subscription');
        if (btn && !meta.stripe_customer_id) {
            var status = document.getElementById('abo-status');
            if (status) {
                status.textContent = 'Portail Stripe indisponible : aucun client Stripe lié à ce compte.';
            }
        }
    }

    function openBillingPortal() {
        var status = document.getElementById('abo-status');
        var btn = document.getElementById('btn-manage-subscription');
        if (status) status.textContent = '';
        if (!Auth || !Auth.getClient) {
            if (status) status.textContent = 'Service indisponible.';
            return;
        }
        var sb = Auth.getClient();
        if (!sb) {
            if (status) status.textContent = 'Configuration Supabase manquante.';
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Ouverture…';
        }

        sb.auth.getSession().then(function (result) {
            var session = result && result.data ? result.data.session : null;
            if (!session || !session.access_token) {
                if (status) status.textContent = 'Session expirée. Reconnectez-vous.';
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Gérer mon abonnement';
                }
                return;
            }

            return fetch(new URL('/api/create-billing-portal-session', window.location.origin).href, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + session.access_token
                },
                body: '{}'
            }).then(function (response) {
                return response.json().then(function (data) {
                    return { ok: response.ok, data: data };
                });
            }).then(function (res) {
                if (!res.ok || !res.data || !res.data.url) {
                    if (status) {
                        status.textContent = (res.data && res.data.error) ||
                            'Impossible d’ouvrir le portail d’abonnement.';
                    }
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Gérer mon abonnement';
                    }
                    return;
                }
                window.location.href = res.data.url;
            });
        }).catch(function () {
            if (status) status.textContent = 'Erreur réseau. Réessayez.';
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Gérer mon abonnement';
            }
        });
    }

    if (Auth && Auth.requireAdminAccount) {
        Auth.requireAdminAccount().then(function (session) {
            fillInfo(session);
        }).catch(function () {});
    }

    if (Auth && Auth.bindLogoutButton) {
        Auth.bindLogoutButton('btn-logout');
    }

    var manageBtn = document.getElementById('btn-manage-subscription');
    if (manageBtn) {
        manageBtn.addEventListener('click', openBillingPortal);
    }
})();
