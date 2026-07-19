// website/pages/creation-compte/ — appel API création de comptes (Stripe vérifié côté serveur).

var NolimiLicenseApi = (function () {
    function getStripeSessionId() {
        var params = new URLSearchParams(window.location.search);
        return params.get('session_id')
            || params.get('checkout_session_id')
            || '';
    }

    // Lit et valide les champs email-1…email-N du formulaire.
    function collectEmails(licenseCount) {
        var emails = [];

        for (var i = 1; i <= licenseCount; i++) {
            var field = document.getElementById('email-' + i);
            if (!field) {
                return { error: 'Champs de formulaire introuvables.' };
            }
            var value = field.value.trim().toLowerCase();
            if (!value || !field.checkValidity()) {
                return {
                    error: licenseCount === 1
                        ? 'Veuillez renseigner une adresse mail valide.'
                        : 'Veuillez renseigner les ' + licenseCount + ' adresses mail valides.'
                };
            }
            emails.push(value);
        }

        if (licenseCount > 1) {
            var seen = {};
            for (var j = 0; j < emails.length; j++) {
                if (seen[emails[j]]) {
                    return { error: 'Chaque licence doit avoir une adresse mail différente.' };
                }
                seen[emails[j]] = true;
            }
        }

        return { emails: emails };
    }

    function createAccounts(emails, licenseCount, sessionId) {
        return fetch(new URL('/api/create-license-accounts', window.location.origin).href, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emails: emails,
                licenseCount: licenseCount,
                sessionId: sessionId
            })
        }).then(function (response) {
            return response.json().then(function (data) {
                return { ok: response.ok, status: response.status, data: data };
            }).catch(function () {
                return { ok: false, status: response.status, data: { error: 'Réponse serveur invalide.' } };
            });
        }).catch(function () {
            return { ok: false, status: 0, data: { error: 'Impossible de contacter le serveur. Réessayez plus tard.' } };
        });
    }

    function mapApiError(result) {
        if (!result || !result.data) return 'Impossible de créer les comptes.';
        if (result.data.error) return result.data.error;
        if (Array.isArray(result.data.errors) && result.data.errors.length) {
            return result.data.errors.join(' ');
        }
        return 'Impossible de créer les comptes.';
    }

    // Point d’entrée : valide les mails puis appelle l’API.
    function submitLicenseAccounts(licenseCount) {
        var sessionId = getStripeSessionId();
        if (!sessionId) {
            return Promise.resolve({
                ok: false,
                error: 'Accès réservé après un paiement validé. Repassez par la page abonnement.'
            });
        }

        var collected = collectEmails(licenseCount);
        if (collected.error) {
            return Promise.resolve({ ok: false, error: collected.error });
        }

        return createAccounts(collected.emails, licenseCount, sessionId).then(function (result) {
            if (result.status === 207 && result.data && result.data.partial) {
                return {
                    ok: true,
                    partial: true,
                    created: result.data.created || 0,
                    message: (result.data.created || 0) + ' compte(s) créé(s), mais certaines adresses ont échoué : ' + (result.data.errors || []).join(' ')
                };
            }

            if (!result.ok) {
                return { ok: false, error: mapApiError(result) };
            }

            return {
                ok: true,
                created: result.data.created || collected.emails.length,
                message: 'Vos comptes ont été créés. Vous recevrez vos identifiants par mail sous peu.'
            };
        });
    }

    return {
        getStripeSessionId: getStripeSessionId,
        collectEmails: collectEmails,
        submitLicenseAccounts: submitLicenseAccounts
    };
})();
