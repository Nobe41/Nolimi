// api/ — webhook Stripe : synchronise annulation / impayé sur le compte admin.
// Vérifie l’événement en le rechargeant depuis l’API Stripe (pas besoin du body brut).

const stripeVerify = require('./stripe-verify');

function json(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body || { received: true }));
}

function planLabelFromCount(count) {
    var n = parseInt(count, 10) || 0;
    if (n === 1) return '1 licence';
    if (n > 1) return n + ' licences';
    return null;
}

function activeCapacity(packs) {
    var total = 0;
    (packs || []).forEach(function (pack) {
        if (!pack || pack.status === 'canceled' || pack.status === 'cancelled' || pack.status === 'unpaid') return;
        total += parseInt(pack.licenseCount, 10) || 0;
    });
    return total;
}

async function listAllAuthUsers(supabaseUrl, secretKey) {
    var users = [];
    var page = 1;
    var perPage = 200;
    while (page < 50) {
        var response = await fetch(
            supabaseUrl.replace(/\/$/, '') + '/auth/v1/admin/users?page=' + page + '&per_page=' + perPage,
            {
                method: 'GET',
                headers: {
                    Authorization: 'Bearer ' + secretKey,
                    apikey: secretKey
                }
            }
        );
        var data = null;
        try {
            data = await response.json();
        } catch (e) {
            data = null;
        }
        if (!response.ok) {
            throw new Error((data && (data.msg || data.message)) || 'list users failed');
        }
        var batch = (data && data.users) || [];
        users = users.concat(batch);
        if (batch.length < perPage) break;
        page += 1;
    }
    return users;
}

function findAdminForSubscription(users, subscriptionId, customerId) {
    for (var i = 0; i < users.length; i++) {
        var user = users[i];
        var meta = user.user_metadata || {};
        if (meta.account_role !== 'admin') continue;

        if (subscriptionId) {
            if (meta.stripe_subscription_id === subscriptionId) return user;
            if (Array.isArray(meta.stripe_subscription_ids) &&
                meta.stripe_subscription_ids.indexOf(subscriptionId) !== -1) return user;
            if (Array.isArray(meta.subscription_packs)) {
                for (var p = 0; p < meta.subscription_packs.length; p++) {
                    if (meta.subscription_packs[p] &&
                        meta.subscription_packs[p].subscriptionId === subscriptionId) {
                        return user;
                    }
                }
            }
        }

        if (customerId) {
            if (meta.stripe_customer_id === customerId) return user;
            if (Array.isArray(meta.stripe_customer_ids) &&
                meta.stripe_customer_ids.indexOf(customerId) !== -1) return user;
        }
    }
    return null;
}

async function updateUserMetadata(supabaseUrl, secretKey, userId, userMetadata) {
    var response = await fetch(
        supabaseUrl.replace(/\/$/, '') + '/auth/v1/admin/users/' + encodeURIComponent(userId),
        {
            method: 'PUT',
            headers: {
                Authorization: 'Bearer ' + secretKey,
                apikey: secretKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_metadata: userMetadata })
        }
    );
    return response.ok;
}

function applySubscriptionStatus(meta, subscriptionId, customerId, status, licenseCountHint) {
    var next = Object.assign({}, meta || {});
    var packs = Array.isArray(next.subscription_packs) ? next.subscription_packs.map(function (p) {
        return Object.assign({}, p);
    }) : [];

    var found = false;
    for (var i = 0; i < packs.length; i++) {
        var pack = packs[i];
        if (!pack) continue;
        if ((subscriptionId && pack.subscriptionId === subscriptionId) ||
            (!subscriptionId && customerId && pack.customerId === customerId)) {
            pack.status = status;
            if (licenseCountHint) pack.licenseCount = licenseCountHint;
            found = true;
        }
    }

    if (!found && (subscriptionId || customerId)) {
        packs.push({
            id: subscriptionId || ('pack_' + Date.now()),
            subscriptionId: subscriptionId || null,
            customerId: customerId || null,
            licenseCount: licenseCountHint || 0,
            status: status,
            createdAt: new Date().toISOString()
        });
    }

    next.subscription_packs = packs;
    next.license_count = activeCapacity(packs);
    next.license_plan = planLabelFromCount(next.license_count);
    return next;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return json(res, 405, { error: 'Méthode non autorisée.' });
    }

    var stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    var supabaseUrl = process.env.SUPABASE_URL;
    var supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!stripeSecretKey || !supabaseUrl || !supabaseSecretKey) {
        return json(res, 500, { error: 'Configuration manquante.' });
    }

    var body = req.body || {};
    var eventId = body.id || (body.data && body.data.object && body.data.object.id);
    // Prefer Stripe event id
    var stripeEventId = body.id && String(body.id).indexOf('evt_') === 0 ? body.id : null;
    if (!stripeEventId) {
        // Accept direct payload for local tests, but prefer retrieving events
        if (!body.type || !body.data || !body.data.object) {
            return json(res, 400, { error: 'Événement Stripe invalide.' });
        }
    }

    var event = body;
    if (stripeEventId) {
        var fetched = await stripeVerify.stripeRequest(
            stripeSecretKey,
            'GET',
            '/events/' + encodeURIComponent(stripeEventId)
        );
        if (!fetched.ok || !fetched.data) {
            return json(res, 400, { error: 'Événement Stripe introuvable.' });
        }
        event = fetched.data;
    }

    var type = event.type || '';
    var obj = event.data && event.data.object ? event.data.object : null;
    if (!obj) {
        return json(res, 200, { received: true, ignored: true });
    }

    var handled = [
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.payment_failed'
    ];
    if (handled.indexOf(type) === -1) {
        return json(res, 200, { received: true, ignored: true });
    }

    var subscriptionId = null;
    var customerId = null;
    var status = null;
    var licenseHint = null;

    if (type.indexOf('customer.subscription.') === 0) {
        subscriptionId = obj.id || null;
        customerId = typeof obj.customer === 'string' ? obj.customer : (obj.customer && obj.customer.id) || null;
        status = type === 'customer.subscription.deleted' ? 'canceled' : (obj.status || 'active');
        try {
            licenseHint = obj.items && obj.items.data && obj.items.data[0] && obj.items.data[0].quantity;
        } catch (e) {}
    } else if (type === 'invoice.payment_failed') {
        subscriptionId = typeof obj.subscription === 'string' ? obj.subscription : null;
        customerId = typeof obj.customer === 'string' ? obj.customer : null;
        status = 'past_due';
    }

    if (!subscriptionId && !customerId) {
        return json(res, 200, { received: true, ignored: true });
    }

    var users;
    try {
        users = await listAllAuthUsers(supabaseUrl, supabaseSecretKey);
    } catch (err) {
        return json(res, 500, { error: 'Impossible de lister les utilisateurs.' });
    }

    var admin = findAdminForSubscription(users, subscriptionId, customerId);
    if (!admin) {
        return json(res, 200, { received: true, unmatched: true });
    }

    var nextMeta = applySubscriptionStatus(
        admin.user_metadata || {},
        subscriptionId,
        customerId,
        status,
        licenseHint
    );

    // Petit journal d’audit
    var audit = Array.isArray(nextMeta.team_audit_log) ? nextMeta.team_audit_log.slice() : [];
    audit.unshift({
        at: new Date().toISOString(),
        action: 'stripe_webhook',
        type: type,
        subscriptionId: subscriptionId,
        status: status
    });
    nextMeta.team_audit_log = audit.slice(0, 50);

    var ok = await updateUserMetadata(supabaseUrl, supabaseSecretKey, admin.id, nextMeta);

    // Si capacité réduite : suspendre les licences en trop (sans les supprimer)
    var suspended = [];
    try {
        var syncMod = require('./_lib/sync-suspensions');
        var helpers = require('./_lib/subscription-helpers');
        var normalized = helpers.normalizeAdminMeta(nextMeta);
        var licenseUsers = [];
        var managerEmail = String(
            (normalized.meta.license_manager_email || admin.email || '')
        ).trim().toLowerCase();
        for (var u = 0; u < users.length; u++) {
            var lu = users[u];
            var lum = lu.user_metadata || {};
            var le = String(lu.email || '').trim().toLowerCase();
            if (lum.account_role === 'license' &&
                String(lum.license_manager_email || '').trim().toLowerCase() === managerEmail &&
                le !== managerEmail) {
                licenseUsers.push({
                    id: lu.id,
                    email: le,
                    created_at: lu.created_at,
                    user_metadata: lum
                });
            }
        }
        var syncResult = await syncMod.syncLicenseSuspensions(
            supabaseUrl,
            supabaseSecretKey,
            normalized.meta,
            licenseUsers
        );
        suspended = syncResult.suspendedEmails || [];
    } catch (e) {}

    return json(res, 200, {
        received: true,
        updated: !!ok,
        suspendedCount: suspended.length
    });
};
