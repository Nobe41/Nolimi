// website/pages/creation-compte/ — UI : champs emails + envoi après paiement Stripe.

(function () {
    var ALLOWED_COUNTS = [1, 5, 10];
    var Api = typeof NolimiLicenseApi !== 'undefined' ? NolimiLicenseApi : null;

    var form = document.getElementById('form-licenses');
    var fieldsEl = document.getElementById('license-fields');
    var instructionsEl = document.getElementById('license-instructions');
    var errEl = document.getElementById('error-msg');
    var successEl = document.getElementById('success-msg');
    var submitBtn = document.getElementById('btn-submit');
    var loginBtn = document.getElementById('btn-login');
    var paymentSuccessEl = document.querySelector('.payment-success');

    var stripeSessionId = Api ? Api.getStripeSessionId() : '';
    var licenseCount = parseLicenseCount();

    function parseLicenseCount() {
        var count = parseInt(new URLSearchParams(window.location.search).get('licences'), 10);
        return ALLOWED_COUNTS.indexOf(count) === -1 ? 1 : count;
    }

    function updateSubmitState() {
        if (!stripeSessionId || !Api) {
            submitBtn.disabled = true;
            return;
        }
        // Réutilise la même validation que l’API (pas de doublon de règles)
        submitBtn.disabled = !!Api.collectEmails(licenseCount).error;
    }

    function renderFields(count) {
        instructionsEl.textContent = count === 1
            ? 'Veuillez entrer l\'adresse mail de la licence souhaitée.'
            : 'Veuillez entrer les ' + count + ' adresses mail des licences souhaitées.';

        fieldsEl.innerHTML = '';

        var mainEl = document.querySelector('.page-main--auth');
        if (mainEl) mainEl.classList.toggle('page-main--licenses-many', count >= 5);

        for (var i = 1; i <= count; i++) {
            var input = document.createElement('input');
            input.type = 'email';
            input.id = 'email-' + i;
            input.name = 'email-' + i;
            input.required = true;
            input.autocomplete = 'email';
            input.placeholder = count === 1
                ? 'Adresse mail — licence'
                : 'Adresse mail — licence ' + i;
            input.setAttribute('aria-label', count === 1
                ? 'Adresse mail licence'
                : 'Adresse mail licence ' + i);
            input.addEventListener('input', updateSubmitState);
            input.addEventListener('blur', updateSubmitState);
            fieldsEl.appendChild(input);
        }

        updateSubmitState();
    }

    // Pas de session Stripe dans l’URL → message d’erreur
    if (!stripeSessionId) {
        if (paymentSuccessEl) paymentSuccessEl.hidden = true;
        errEl.textContent = 'Paiement reçu, mais la session Stripe est introuvable dans l’URL. Vérifiez que l’URL de redirection Stripe contient bien : session_id={CHECKOUT_SESSION_ID}';
        instructionsEl.textContent = 'Exemple d’URL Stripe : …/creation-compte/index.html?licences=1&session_id={CHECKOUT_SESSION_ID}';
        form.hidden = true;
    } else {
        renderFields(licenseCount);
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

        Api.submitLicenseAccounts(licenseCount).then(function (result) {
            submitBtn.textContent = 'Valider';

            if (!result.ok) {
                errEl.textContent = result.error || 'Impossible de créer les comptes.';
                updateSubmitState();
                return;
            }

            successEl.textContent = result.message || 'Vos comptes ont été créés. Vous recevrez vos identifiants par mail sous peu.';
            submitBtn.disabled = true;
            if (loginBtn) loginBtn.hidden = false;
        });
    });
})();
