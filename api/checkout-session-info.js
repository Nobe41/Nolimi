// api/ — lit l’email acheteur d’une session Checkout Stripe (page création-compte).

const stripeVerify = require('./stripe-verify');

function json(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        return json(res, 405, { error: 'Méthode non autorisée.' });
    }

    var stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
        return json(res, 500, { error: 'Configuration serveur Stripe manquante (STRIPE_SECRET_KEY).' });
    }

    var body = req.body || {};
    var sessionId = String(
        body.sessionId ||
        (req.query && (req.query.sessionId || req.query.session_id)) ||
        ''
    ).trim();

    if (!sessionId || !/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
        return json(res, 400, { error: 'Session de paiement invalide.' });
    }

    var result = await stripeVerify.retrieveCheckoutSession(stripeSecretKey, sessionId);
    if (!result.ok || !result.data) {
        return json(res, 404, { error: 'Paiement introuvable ou invalide.' });
    }

    var session = result.data;
    if (session.payment_status !== 'paid') {
        return json(res, 403, { error: 'Le paiement n\'est pas confirmé.' });
    }

    var info = stripeVerify.extractCheckoutBuyerInfo(session);
    if (!info.email) {
        return json(res, 422, {
            error: 'Email de paiement introuvable sur la session Stripe.'
        });
    }

    return json(res, 200, {
        email: info.email,
        licenseCount: info.licenseCount,
        hasCustomer: !!info.customerId
    });
};
