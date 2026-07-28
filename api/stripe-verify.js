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

// Email + ids Stripe utiles après un paiement (admin / portal).
function extractCheckoutBuyerInfo(session) {
    session = session || {};
    var email = (
        (session.customer_details && session.customer_details.email) ||
        session.customer_email ||
        ''
    ).trim().toLowerCase();

    var customerId = null;
    if (typeof session.customer === 'string' && session.customer) {
        customerId = session.customer;
    } else if (session.customer && session.customer.id) {
        customerId = session.customer.id;
    }

    var subscriptionId = null;
    if (typeof session.subscription === 'string' && session.subscription) {
        subscriptionId = session.subscription;
    } else if (session.subscription && session.subscription.id) {
        subscriptionId = session.subscription.id;
    }

    var licenseCount = session.metadata ? parseInt(session.metadata.licences, 10) : NaN;

    return {
        email: email,
        customerId: customerId,
        subscriptionId: subscriptionId,
        licenseCount: ALLOWED_COUNTS.indexOf(licenseCount) === -1 ? null : licenseCount
    };
}

/** Recherche des customers Stripe pour un email (réutilisation / détection doublons). */
async function findCustomersByEmail(stripeSecretKey, email) {
    var target = String(email || '').trim().toLowerCase();
    if (!target || !stripeSecretKey) return [];
    var result = await stripeRequest(
        stripeSecretKey,
        'GET',
        '/customers?email=' + encodeURIComponent(target) + '&limit=10'
    );
    if (!result.ok || !result.data || !Array.isArray(result.data.data)) return [];
    return result.data.data.filter(function (c) {
        return c && c.id && !c.deleted;
    });
}

module.exports = {
    ALLOWED_COUNTS: ALLOWED_COUNTS,
    retrieveCheckoutSession: retrieveCheckoutSession,
    verifyPaidCheckoutSession: verifyPaidCheckoutSession,
    markCheckoutSessionUsed: markCheckoutSessionUsed,
    extractCheckoutBuyerInfo: extractCheckoutBuyerInfo,
    findCustomersByEmail: findCustomersByEmail,
    stripeRequest: stripeRequest
};
