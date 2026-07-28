// 03-website/pages/creation-compte/ — UI : admin figé + emails licences + envoi après paiement.

(function () {
    var ALLOWED_COUNTS = [1, 5, 10];
    var Api = typeof NolimiLicenseApi !== 'undefined' ? NolimiLicenseApi : null;

    var form = document.getElementById('form-licenses');
    var fieldsEl = document.getElementById('license-fields');
    var adminFieldEl = document.getElementById('admin-field');
    var adminEmailEl = document.getElementById('admin-email');
    var errEl = document.getElementById('error-msg');
    var successEl = document.getElementById('success-msg');
    var submitBtn = document.getElementById('btn-submit');
    var loginBtn = document.getElementById('btn-login');
    var legalEl = document.getElementById('login-legal');
    var paymentSuccessEl = document.querySelector('.payment-success');

    var stripeSessionId = Api ? Api.getStripeSessionId() : '';
    // Fallback URL (?licences=) ; la vraie valeur vient de la session Stripe (metadata licences).
    var licenseCount = parseLicenseCountFromUrl();
    var adminEmail = '';

    function parseLicenseCountFromUrl() {
        var count = parseInt(new URLSearchParams(window.location.search).get('licences'), 10);
        return ALLOWED_COUNTS.indexOf(count) === -1 ? null : count;
    }

    function normalizeLicenseCount(value) {
        var count = parseInt(value, 10);
        return ALLOWED_COUNTS.indexOf(count) === -1 ? null : count;
    }

    function setAdminDisplay(text) {
        if (adminEmailEl) adminEmailEl.textContent = text || '—';
        if (adminFieldEl) adminFieldEl.hidden = false;
    }

    function updateSubmitState() {
        if (!stripeSessionId || !Api || !adminEmail || !licenseCount) {
            submitBtn.disabled = true;
            return;
        }
        // Les champs licences sont facultatifs : on peut valider même sans en remplir
        var collected = Api.collectEmails(licenseCount, adminEmail);
        submitBtn.disabled = !!collected.error;
    }

    function renderAdminField(email) {
        adminEmail = String(email || '').trim().toLowerCase();
        setAdminDisplay(adminEmail || '—');
    }

    function renderLicenseFields(count) {
        fieldsEl.innerHTML = '';

        var mainEl = document.querySelector('.page-main--auth');
        if (mainEl) mainEl.classList.toggle('page-main--licenses-many', count >= 5);

        var hint = document.createElement('p');
        hint.className = 'license-fields-hint';
        hint.textContent = 'Facultatif — vous pouvez en remplir une partie seulement. Les places restantes se gèrent ensuite dans Équipe. Pas de doublon.';
        fieldsEl.appendChild(hint);

        for (var i = 1; i <= count; i++) {
            var wrap = document.createElement('div');
            wrap.className = 'license-field';

            var label = document.createElement('label');
            label.className = 'license-field__label';
            label.setAttribute('for', 'email-' + i);
            label.textContent = (count === 1 ? 'Compte licence' : 'Compte licence ' + i) + ' (facultatif)';

            var input = document.createElement('input');
            input.type = 'email';
            input.id = 'email-' + i;
            input.name = 'email-' + i;
            input.required = false;
            input.autocomplete = 'email';
            input.placeholder = 'Adresse mail';
            input.setAttribute('aria-label', label.textContent);
            input.addEventListener('input', updateSubmitState);
            input.addEventListener('blur', updateSubmitState);

            wrap.appendChild(label);
            wrap.appendChild(input);
            fieldsEl.appendChild(wrap);
        }

        updateSubmitState();
    }

    function showFatal(message) {
        if (paymentSuccessEl) paymentSuccessEl.hidden = true;
        errEl.textContent = message;
        form.hidden = true;
    }

    // Affiche tout de suite admin + un état de chargement pour les champs licences
    setAdminDisplay('Chargement…');
    fieldsEl.innerHTML = '<p class="license-fields-hint">Chargement du nombre de licences…</p>';
    submitBtn.disabled = true;

    if (!stripeSessionId) {
        setAdminDisplay('Session Stripe manquante');
        showFatal(
            'Paiement reçu, mais la session Stripe est introuvable dans l’URL. Vérifiez que l’URL de redirection Stripe contient bien : session_id={CHECKOUT_SESSION_ID}'
        );
    } else if (!Api || !Api.fetchCheckoutSessionInfo) {
        setAdminDisplay('Service indisponible');
        showFatal('Service de création de comptes indisponible.');
    } else {
        Api.fetchCheckoutSessionInfo(stripeSessionId).then(function (result) {
            if (!result.ok || !result.data || !result.data.email) {
                var msg = (result.data && result.data.error) ||
                    'Impossible de récupérer l’email du payeur Stripe.';
                setAdminDisplay('Non récupéré');
                errEl.textContent = msg;
                adminEmail = '';
                updateSubmitState();
                return;
            }

            var fromStripe = normalizeLicenseCount(result.data.licenseCount);
            var resolvedCount = fromStripe || licenseCount;
            if (!resolvedCount) {
                setAdminDisplay(result.data.email);
                showFatal(
                    'Nombre de licences introuvable sur ce paiement. Dans Stripe, ajoutez la metadata « licences » (1, 5 ou 10) sur chaque Payment Link.'
                );
                return;
            }

            licenseCount = resolvedCount;
            errEl.textContent = '';
            renderAdminField(result.data.email);
            renderLicenseFields(licenseCount);
            updateSubmitState();
        }).catch(function () {
            setAdminDisplay('Erreur réseau');
            errEl.textContent = 'Impossible de contacter le serveur pour récupérer le compte admin.';
            adminEmail = '';
            updateSubmitState();
        });
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (submitBtn.disabled || !form.checkValidity()) return;

        errEl.textContent = '';
        successEl.textContent = '';
        if (loginBtn) loginBtn.hidden = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Envoi…';

        if (!Api || !Api.submitLicenseAccounts) {
            errEl.textContent = 'Service de création de comptes indisponible.';
            submitBtn.textContent = 'Valider';
            updateSubmitState();
            return;
        }

        Api.submitLicenseAccounts(licenseCount, adminEmail).then(function (result) {
            submitBtn.textContent = 'Valider';

            if (!result.ok) {
                errEl.textContent = result.error || 'Impossible de créer les comptes.';
                updateSubmitState();
                return;
            }

            successEl.textContent = result.message ||
                'Le compte admin et les licences ont été créés. Chaque adresse recevra ses identifiants par mail.';
            submitBtn.hidden = true;
            if (legalEl) legalEl.hidden = true;
            if (loginBtn) loginBtn.hidden = false;
        });
    });
})();
