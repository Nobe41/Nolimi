// 03-website/pages/creation-compte/ — appel API création de comptes (Stripe vérifié côté serveur).

var NolimiLicenseApi = (function () {
    function getStripeSessionId() {
        var params = new URLSearchParams(window.location.search);
        return params.get('session_id')
            || params.get('checkout_session_id')
            || '';
    }

    function fetchCheckoutSessionInfo(sessionId) {
        return fetch(new URL('/api/checkout-session-info', window.location.origin).href, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sessionId })
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

    // Lit les champs email-1…email-N : vides ignorés, pas de doublons, admin autorisé 1 fois.
    function collectEmails(licenseCount, adminEmail) {
        var emails = [];
        var admin = String(adminEmail || '').trim().toLowerCase();

        for (var i = 1; i <= licenseCount; i++) {
            var field = document.getElementById('email-' + i);
            if (!field) {
                return { error: 'Champs de formulaire introuvables.' };
            }
            var value = field.value.trim().toLowerCase();
            if (!value) continue;
            if (!field.checkValidity()) {
                return { error: 'Adresse mail invalide : ' + field.value.trim() };
            }
            emails.push(value);
        }

        if (emails.length > licenseCount) {
            return { error: 'Trop d’adresses pour le nombre de licences achetées.' };
        }

        var seen = {};
        var adminSeatCount = 0;
        for (var j = 0; j < emails.length; j++) {
            if (admin && emails[j] === admin) {
                adminSeatCount += 1;
                if (adminSeatCount > 1) {
                    return { error: 'L’adresse admin ne peut être utilisée qu’une seule fois comme licence.' };
                }
            }
            if (seen[emails[j]]) {
                return { error: 'Chaque licence doit avoir une adresse mail différente.' };
            }
            seen[emails[j]] = true;
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

    function successMessage(result, filledCount) {
        var reused = !!(result.data && result.data.adminReused);
        if (filledCount <= 0) {
            return reused
                ? 'Votre compte admin est prêt. Vous pourrez ajouter les licences plus tard depuis la page Équipe.'
                : 'Le compte admin a été créé. Vous pourrez ajouter les licences plus tard depuis la page Équipe.';
        }
        if (reused) {
            return 'Les licences renseignées ont été ajoutées à votre compte admin. Chaque nouvelle adresse a reçu ses identifiants par mail. Les places restantes se gèrent dans Équipe.';
        }
        return 'Le compte admin et les licences renseignées ont été créés. Chaque adresse a reçu ses identifiants par mail. Les places restantes se gèrent dans Équipe.';
    }

    // Point d’entrée : valide les mails puis appelle l’API.
    function submitLicenseAccounts(licenseCount, adminEmail) {
        var sessionId = getStripeSessionId();
        if (!sessionId) {
            return Promise.resolve({
                ok: false,
                error: 'Accès réservé après un paiement validé. Repassez par la page abonnement.'
            });
        }

        var collected = collectEmails(licenseCount, adminEmail);
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

            var reused = !!(result.data && result.data.adminReused);
            return {
                ok: true,
                created: result.data.created || 0,
                adminReused: reused,
                message: successMessage(result, collected.emails.length)
            };
        });
    }

    return {
        getStripeSessionId: getStripeSessionId,
        fetchCheckoutSessionInfo: fetchCheckoutSessionInfo,
        collectEmails: collectEmails,
        submitLicenseAccounts: submitLicenseAccounts
    };
})();
