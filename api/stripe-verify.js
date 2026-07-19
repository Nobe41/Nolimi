// api/ — Endpoints serveur (licences, Stripe, emails).
// Ce fichier : vérifie qu’une session Stripe est payée et pas déjà utilisée (rien d’autre).

// Packs de licences autorisés (partagé avec create-license-accounts.js).
const ALLOWED_COUNTS = [1, 5, 10];

// Appel générique à l’API Stripe.
async function stripeRequest(stripeSecretKey, method, path, body) {
    var options = {
        method: method,
        headers: {
            Authorization: 'Bearer ' + stripeSecretKey
        }
    };

    if (body) {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.body = body;
    }

    var response = await fetch('https://api.stripe.com/v1' + path, options);
    var data = null;
    try {
        data = await response.json();
    } catch (e) {
        data = null;
    }

    return { ok: response.ok, status: response.status, data: data };
}

// Récupère une session Checkout Stripe.
async function retrieveCheckoutSession(stripeSecretKey, sessionId) {
    return stripeRequest(
        stripeSecretKey,
        'GET',
        '/checkout/sessions/' + encodeURIComponent(sessionId)
    );
}

// Marque la session comme déjà utilisée (évite de recréer les comptes).
async function markCheckoutSessionUsed(stripeSecretKey, sessionId) {
    return stripeRequest(
        stripeSecretKey,
        'POST',
        '/checkout/sessions/' + encodeURIComponent(sessionId),
        'metadata[accounts_created]=true'
    );
}

// Vérifie : session valide, payée, pas déjà activée, bon nombre de licences.
async function verifyPaidCheckoutSession(stripeSecretKey, sessionId, licenseCount) {
    // Format de l’id de session Stripe (cs_...)
    if (!sessionId || !/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
        return { ok: false, error: 'Session de paiement invalide.' };
    }

    if (ALLOWED_COUNTS.indexOf(licenseCount) === -1) {
        return { ok: false, error: 'Nombre de licences invalide.' };
    }

    var result = await retrieveCheckoutSession(stripeSecretKey, sessionId);
    if (!result.ok || !result.data) {
        return { ok: false, error: 'Paiement introuvable ou invalide.' };
    }

    var session = result.data;

    // Paiement bien confirmé ?
    if (session.payment_status !== 'paid') {
        return { ok: false, error: 'Le paiement n\'est pas confirmé.' };
    }

    // Déjà utilisé pour créer des comptes ?
    if (session.metadata && session.metadata.accounts_created === 'true') {
        return { ok: false, error: 'Ces licences ont déjà été activées pour ce paiement.' };
    }

    // Metadata « licences » sur le lien de paiement Stripe (1, 5 ou 10)
    var paidLicenses = session.metadata ? parseInt(session.metadata.licences, 10) : NaN;
    if (ALLOWED_COUNTS.indexOf(paidLicenses) === -1) {
        return {
            ok: false,
            error: 'Configuration Stripe incomplète : ajoutez la metadata « licences » (1, 5 ou 10) sur le lien de paiement.'
        };
    }

    if (paidLicenses !== licenseCount) {
        return { ok: false, error: 'Le nombre de licences ne correspond pas à votre achat.' };
    }

    return { ok: true, session: session };
}

module.exports = {
    ALLOWED_COUNTS: ALLOWED_COUNTS,
    verifyPaidCheckoutSession: verifyPaidCheckoutSession,
    markCheckoutSessionUsed: markCheckoutSessionUsed
};
