// 02-menu/pages/abonnement/ — liste des abonnements + portail Stripe par abo.

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;

    window.__nolimiPageCleanup = function () {
        window.__nolimiPageCleanup = null;
    };

    var accessToken = '';

    function setText(id, value) {
        var el = document.getElementById(id);
        if (!el) return;
        el.textContent = value || 'Non renseigné';
    }

    function setStatus(text) {
        var status = document.getElementById('abo-status');
        if (status) status.textContent = text || '';
    }

    function formatDate(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString('fr-FR');
        } catch (e) {
            return '';
        }
    }

    function openBillingPortal(customerId, btn) {
        setStatus('');
        if (!customerId) {
            setStatus('Aucun client Stripe pour cet abonnement.');
            return;
        }
        if (!accessToken) {
            setStatus('Session expirée. Reconnectez-vous.');
            return;
        }

        var label = btn ? btn.textContent : '';
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Ouverture…';
        }

        fetch(new URL('/api/create-billing-portal-session', window.location.origin).href, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + accessToken
            },
            body: JSON.stringify({ customerId: customerId })
        }).then(function (response) {
            return response.json().then(function (data) {
                return { ok: response.ok, data: data };
            });
        }).then(function (res) {
            if (!res.ok || !res.data || !res.data.url) {
                setStatus((res.data && res.data.error) || 'Impossible d’ouvrir le portail d’abonnement.');
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = label || 'Gérer cet abonnement';
                }
                return;
            }
            window.location.href = res.data.url;
        }).catch(function () {
            setStatus('Erreur réseau. Réessayez.');
            if (btn) {
                btn.disabled = false;
                btn.textContent = label || 'Gérer cet abonnement';
            }
        });
    }

    function renderSubscriptions(list) {
        var root = document.getElementById('abo-subs');
        if (!root) return;
        root.innerHTML = '';

        if (!list || !list.length) {
            root.innerHTML = '<p class="abo-hint">Aucun abonnement Stripe lié pour le moment.</p>';
            return;
        }

        list.forEach(function (sub, index) {
            var card = document.createElement('article');
            card.className = 'abo-sub';

            var top = document.createElement('div');
            top.className = 'abo-sub__top';

            var title = document.createElement('h2');
            title.className = 'abo-sub__title';
            title.textContent = list.length > 1
                ? ('Abonnement ' + (index + 1))
                : 'Abonnement';

            var badge = document.createElement('span');
            badge.className = 'abo-sub__badge';
            if (sub.status === 'canceled' || sub.status === 'cancelled' || sub.status === 'unpaid') {
                badge.className += ' abo-sub__badge--danger';
            } else if (sub.status === 'past_due') {
                badge.className += ' abo-sub__badge--warn';
            } else {
                badge.className += ' abo-sub__badge--ok';
            }
            badge.textContent = sub.statusLabel || sub.status || 'Actif';

            top.appendChild(title);
            top.appendChild(badge);

            var meta = document.createElement('p');
            meta.className = 'abo-sub__meta';
            var parts = [];
            if (sub.plan) parts.push(sub.plan);
            var date = formatDate(sub.createdAt);
            if (date) parts.push('depuis le ' + date);
            meta.textContent = parts.join(' · ') || 'Détails indisponibles';

            card.appendChild(top);
            card.appendChild(meta);

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'abo-btn abo-btn--primary';
            btn.textContent = 'Gérer cet abonnement';
            if (!sub.canManage || !sub.customerId) {
                btn.disabled = true;
                btn.title = 'Client Stripe manquant pour ce pack';
            } else {
                btn.addEventListener('click', function () {
                    openBillingPortal(sub.customerId, btn);
                });
            }
            card.appendChild(btn);
            root.appendChild(card);
        });
    }

    function loadSubscriptions(session) {
        accessToken = session && session.access_token ? session.access_token : '';
        var user = session && session.user ? session.user : null;
        if (user) setText('abo-email', user.email || null);

        fetch(new URL('/api/admin-subscriptions', window.location.origin).href, {
            method: 'GET',
            headers: { Authorization: 'Bearer ' + accessToken }
        }).then(function (response) {
            return response.json().then(function (data) {
                return { ok: response.ok, data: data };
            });
        }).then(function (result) {
            if (!result.ok || !result.data) {
                setStatus((result.data && result.data.error) || 'Impossible de charger les abonnements.');
                renderSubscriptions([]);
                return;
            }
            setText('abo-plan', result.data.plan || (result.data.totalLicenses + ' licences'));
            renderSubscriptions(result.data.subscriptions || []);

            var hints = [];
            if (result.data.multipleStripeCustomers) {
                hints.push('Plusieurs clients Stripe sont liés à ce compte. Chaque abonnement a son propre bouton de gestion.');
            }
            if (result.data.overCapacity) {
                hints.push('Attention : vous avez plus de comptes licence que de places actives. Les accès en trop sont suspendus jusqu’à libération de places ou nouvel abonnement.');
            }
            var hintEl = document.getElementById('abo-hint');
            if (hintEl && hints.length) {
                hintEl.textContent = hints.join(' ');
            }
        }).catch(function () {
            setStatus('Erreur réseau. Réessayez.');
            // Fallback metadata locale
            var meta = (user && user.user_metadata) || {};
            setText('abo-plan', meta.license_plan || null);
            renderSubscriptions([]);
        });
    }

    if (Auth && Auth.requireAdminAccount) {
        Auth.requireAdminAccount().then(function (session) {
            loadSubscriptions(session);
        }).catch(function () {});
    }

    if (Auth && Auth.bindLogoutButton) {
        Auth.bindLogoutButton('btn-logout');
    }
})();
