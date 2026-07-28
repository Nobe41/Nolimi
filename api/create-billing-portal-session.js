// api/ — crée une session Stripe Billing Portal pour un customer lié à l’admin.

const stripeVerify = require('./stripe-verify');

function json(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
}

function getBearerToken(req) {
    var header = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '');
    var match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : '';
}

async function getSupabaseUser(supabaseUrl, anonOrSecretKey, accessToken) {
    var response = await fetch(supabaseUrl.replace(/\/$/, '') + '/auth/v1/user', {
        method: 'GET',
        headers: {
            Authorization: 'Bearer ' + accessToken,
            apikey: anonOrSecretKey
        }
    });
    var data = null;
    try {
        data = await response.json();
    } catch (e) {
        data = null;
    }
    if (!response.ok || !data || !data.id) {
        return null;
    }
    return data;
}

function allowedCustomerIds(meta) {
    var ids = [];
    var seen = {};
    function add(id) {
        var v = String(id || '').trim();
        if (!v || seen[v]) return;
        seen[v] = true;
        ids.push(v);
    }
    if (Array.isArray(meta.stripe_customer_ids)) {
        meta.stripe_customer_ids.forEach(add);
    }
    add(meta.stripe_customer_id);
    if (Array.isArray(meta.subscription_packs)) {
        meta.subscription_packs.forEach(function (pack) {
            if (pack) add(pack.customerId);
        });
    }
    return ids;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return json(res, 405, { error: 'Méthode non autorisée.' });
    }

    var stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    var supabaseUrl = process.env.SUPABASE_URL;
    var supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY;
    var siteUrl = process.env.NOLIMI_SITE_URL || 'https://nolimi.net';

    if (!stripeSecretKey) {
        return json(res, 500, { error: 'Configuration serveur Stripe manquante (STRIPE_SECRET_KEY).' });
    }
    if (!supabaseUrl || !supabaseKey) {
        return json(res, 500, { error: 'Configuration serveur Supabase manquante.' });
    }

    var accessToken = getBearerToken(req);
    if (!accessToken) {
        return json(res, 401, { error: 'Connexion requise.' });
    }

    var user = await getSupabaseUser(supabaseUrl, supabaseKey, accessToken);
    if (!user) {
        return json(res, 401, { error: 'Session invalide.' });
    }

    var meta = user.user_metadata || {};
    if (meta.account_role !== 'admin') {
        return json(res, 403, { error: 'Réservé au compte administrateur de l’abonnement.' });
    }

    var allowed = allowedCustomerIds(meta);
    var body = req.body || {};
    var requested = String(body.customerId || '').trim();
    var customerId = requested || allowed[0] || null;

    if (!customerId) {
        return json(res, 422, {
            error: 'Aucun client Stripe lié à ce compte. Vérifiez que le Payment Link crée bien un customer Stripe.'
        });
    }

    if (allowed.length && allowed.indexOf(customerId) === -1) {
        return json(res, 403, { error: 'Ce client Stripe n’est pas lié à votre compte.' });
    }

    var returnUrl = siteUrl.replace(/\/$/, '') + '/02-menu/pages/abonnement/index.html';
    var portal = await stripeVerify.stripeRequest(
        stripeSecretKey,
        'POST',
        '/billing_portal/sessions',
        'customer=' + encodeURIComponent(customerId) +
            '&return_url=' + encodeURIComponent(returnUrl)
    );

    if (!portal.ok || !portal.data || !portal.data.url) {
        var message = (portal.data && (portal.data.error && portal.data.error.message || portal.data.message)) ||
            'Impossible d’ouvrir le portail Stripe.';
        return json(res, 502, { error: String(message) });
    }

    return json(res, 200, { url: portal.data.url, customerId: customerId });
};
