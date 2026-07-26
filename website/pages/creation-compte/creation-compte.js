// website/pages/creation-compte/ — UI : admin figé + emails licences + envoi après paiement.

(function () {
    var ALLOWED_COUNTS = [1, 5, 10];
    var Api = typeof NolimiLicenseApi !== 'undefined' ? NolimiLicenseApi : null;

    var form = document.getElementById('form-licenses');
    var fieldsEl = document.getElementById('license-fields');
    var adminFieldEl = document.getElementById('admin-field');
    var adminEmailEl = document.getElementById('admin-email');
    var instructionsEl = document.getElementById('license-instructions');
    var errEl = document.getElementById('error-msg');
    var successEl = document.getElementById('success-msg');
    var submitBtn = document.getElementById('btn-submit');
    var loginBtn = document.getElementById('btn-login');
    var paymentSuccessEl = document.querySelector('.payment-success');

    var stripeSessionId = Api ? Api.getStripeSessionId() : '';
    var licenseCount = parseLicenseCount();
    var adminEmail = '';

    function parseLicenseCount() {
        var count = parseInt(new URLSearchParams(window.location.search).get('licences'), 10);
        return ALLOWED_COUNTS.indexOf(count) === -1 ? 1 : count;
    }

    function setAdminDisplay(text) {
        if (adminEmailEl) adminEmailEl.textContent = text || '—';
        if (adminFieldEl) adminFieldEl.hidden = false;
    }

    function updateSubmitState() {
        if (!stripeSessionId || !Api || !adminEmail) {
            submitBtn.disabled = true;
            return;
        }
        submitBtn.disabled = !!Api.collectEmails(licenseCount, adminEmail).error;
    }

    function renderAdminField(email) {
        adminEmail = String(email || '').trim().toLowerCase();
        setAdminDisplay(adminEmail || '—');
    }

    function renderLicenseFields(count) {
        if (instructionsEl) {
            instructionsEl.textContent = count === 1
                ? 'Renseignez l’adresse mail de la licence (différente du compte admin).'
                : 'Renseignez les ' + count + ' adresses mail des licences (différentes du compte admin).';
        }

        fieldsEl.innerHTML = '';

        var mainEl = document.querySelector('.page-main--auth');
        if (mainEl) mainEl.classList.toggle('page-main--licenses-many', count >= 5);

        for (var i = 1; i <= count; i++) {
            var wrap = document.createElement('div');
            wrap.className = 'license-field';

            var label = document.createElement('label');
            label.className = 'license-field__label';
            label.setAttribute('for', 'email-' + i);
            label.textContent = count === 1 ? 'Compte licence' : 'Compte licence ' + i;

            var input = document.createElement('input');
            input.type = 'email';
            input.id = 'email-' + i;
            input.name = 'email-' + i;
            input.required = true;
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

    function showFatal(message, hint) {
        if (paymentSuccessEl) paymentSuccessEl.hidden = true;
        errEl.textContent = message;
        if (hint && instructionsEl) instructionsEl.textContent = hint;
        form.hidden = true;
    }

    // Affiche tout de suite la structure (admin + licences)
    setAdminDisplay('Chargement…');
    renderLicenseFields(licenseCount);
    submitBtn.disabled = true;

    if (!stripeSessionId) {
        setAdminDisplay('Session Stripe manquante');
        showFatal(
            'Paiement reçu, mais la session Stripe est introuvable dans l’URL. Vérifiez que l’URL de redirection Stripe contient bien : session_id={CHECKOUT_SESSION_ID}',
            'Exemple d’URL Stripe : …/creation-compte/index.html?licences=1&session_id={CHECKOUT_SESSION_ID}'
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
            errEl.textContent = '';
            renderAdminField(result.data.email);
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
            submitBtn.disabled = true;
            if (loginBtn) loginBtn.hidden = false;
        });
    });
})();
