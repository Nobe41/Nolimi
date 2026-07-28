// api/ — liste les abonnements Stripe liés au compte admin (+ migration packs).

const stripeVerify = require('./stripe-verify');
const helpers = require('./_lib/subscription-helpers');
const syncSuspensions = require('./_lib/sync-suspensions');

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

async function getSupabaseUser(supabaseUrl, key, accessToken) {
    var response = await fetch(supabaseUrl.replace(/\/$/, '') + '/auth/v1/user', {
        method: 'GET',
        headers: {
            Authorization: 'Bearer ' + accessToken,
            apikey: key
        }
    });
    var data = null;
    try {
        data = await response.json();
    } catch (e) {
        data = null;
    }
    if (!response.ok || !data || !data.id) return null;
    return data;
}

function statusLabel(status) {
    var s = String(status || 'active').toLowerCase();
    if (s === 'active' || s === 'trialing') return 'Actif';
    if (s === 'past_due') return 'Paiement en retard';
    if (s === 'unpaid') return 'Impayé';
    if (s === 'canceled' || s === 'cancelled') return 'Résilié';
    if (s === 'incomplete') return 'Incomplet';
    return status || 'Inconnu';
}

async function enrichPack(stripeSecretKey, pack, index) {
    var item = {
        id: pack.id || pack.subscriptionId || ('pack_' + index),
        subscriptionId: pack.subscriptionId || null,
        customerId: pack.customerId || null,
        licenseCount: parseInt(pack.licenseCount, 10) || 0,
        plan: helpers.planLabelFromCount(pack.licenseCount) || 'Abonnement',
        status: pack.status || 'active',
        statusLabel: statusLabel(pack.status || 'active'),
        createdAt: pack.createdAt || null,
        canManage: !!(pack.customerId)
    };

    if (!stripeSecretKey || !pack.subscriptionId) return item;

    var result = await stripeVerify.stripeRequest(
        stripeSecretKey,
        'GET',
        '/subscriptions/' + encodeURIComponent(pack.subscriptionId)
    );
    if (!result.ok || !result.data) return item;

    var sub = result.data;
    item.status = sub.status || item.status;
    item.statusLabel = statusLabel(item.status);
    if (sub.customer) {
        item.customerId = typeof sub.customer === 'string' ? sub.customer : (sub.customer.id || item.customerId);
    }
    item.canManage = !!item.customerId;
    if (sub.created) {
        item.createdAt = new Date(sub.created * 1000).toISOString();
    }
    try {
        var qty = sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].quantity;
        if (qty && !item.licenseCount) item.licenseCount = qty;
    } catch (e) {}
    item.plan = helpers.planLabelFromCount(item.licenseCount) || item.plan;
    return item;
}

async function listLicenseUsers(supabaseUrl, secretKey, managerEmail) {
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
        if (!response.ok) break;
        var batch = (data && data.users) || [];
        for (var i = 0; i < batch.length; i++) {
            var u = batch[i];
            var um = u.user_metadata || {};
            var email = String(u.email || '').trim().toLowerCase();
            if (um.account_role === 'license' &&
                String(um.license_manager_email || '').trim().toLowerCase() === managerEmail &&
                email !== managerEmail) {
                users.push({
                    id: u.id,
                    email: email,
                    created_at: u.created_at,
                    user_metadata: um
                });
            }
        }
        if (batch.length < perPage) break;
        page += 1;
    }
    return users;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return json(res, 405, { error: 'Méthode non autorisée.' });
    }

    var stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    var supabaseUrl = process.env.SUPABASE_URL;
    var supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
    var supabaseKey = supabaseSecretKey || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return json(res, 500, { error: 'Configuration Supabase manquante.' });
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
        return json(res, 403, { error: 'Réservé au compte administrateur.' });
    }

    var normalized = helpers.normalizeAdminMeta(meta);
    meta = normalized.meta;

    // Migration lazy : persister subscription_packs si absent
    if (normalized.migrated && supabaseSecretKey && user.id) {
        await syncSuspensions.updateUserMetadata(supabaseUrl, supabaseSecretKey, user.id, meta);
    }

    var packs = meta.subscription_packs || [];
    var enriched = [];
    for (var i = 0; i < packs.length; i++) {
        enriched.push(await enrichPack(stripeSecretKey, packs[i], i));
    }

    // Aligner status packs depuis Stripe si possible
    var packsUpdated = false;
    for (var j = 0; j < enriched.length; j++) {
        if (packs[j] && enriched[j].status && packs[j].status !== enriched[j].status) {
            packs[j].status = enriched[j].status;
            if (enriched[j].customerId) packs[j].customerId = enriched[j].customerId;
            packsUpdated = true;
        }
    }
    if (packsUpdated) {
        meta.subscription_packs = packs;
        meta.license_count = helpers.activeLicenseCapacity(packs);
        meta.license_plan = helpers.planLabelFromCount(meta.license_count);
        if (supabaseSecretKey && user.id) {
            await syncSuspensions.updateUserMetadata(supabaseUrl, supabaseSecretKey, user.id, meta);
        }
    }

    var activeCount = helpers.activeLicenseCapacity(packs);
    var managerEmail = String(meta.license_manager_email || user.email || '').trim().toLowerCase();
    var overCapacity = false;
    var suspendedEmails = [];

    if (supabaseSecretKey && managerEmail) {
        try {
            var licenseUsers = await listLicenseUsers(supabaseUrl, supabaseSecretKey, managerEmail);
            var syncResult = await syncSuspensions.syncLicenseSuspensions(
                supabaseUrl,
                supabaseSecretKey,
                meta,
                licenseUsers
            );
            overCapacity = !!syncResult.overCapacity;
            suspendedEmails = syncResult.suspendedEmails || [];
        } catch (e) {}
    }

    var customers = Array.isArray(meta.stripe_customer_ids) ? meta.stripe_customer_ids : [];
    var multipleCustomers = customers.length > 1 || !!meta.multiple_stripe_customers;

    return json(res, 200, {
        email: user.email || null,
        totalLicenses: activeCount || parseInt(meta.license_count, 10) || 0,
        plan: meta.license_plan || helpers.planLabelFromCount(activeCount),
        subscriptions: enriched,
        multipleStripeCustomers: multipleCustomers,
        overCapacity: overCapacity,
        suspendedEmails: suspendedEmails,
        migrated: !!normalized.migrated
    });
};
