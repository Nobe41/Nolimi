// api/_lib/ — helpers partagés abonnements / sièges (logique pure + utils Stripe).

function planLabelFromCount(count) {
    var n = parseInt(count, 10) || 0;
    if (n === 1) return '1 licence';
    if (n > 1) return n + ' licences';
    return null;
}

function isInactiveStatus(status) {
    var s = String(status || '').toLowerCase();
    return s === 'canceled' || s === 'cancelled' || s === 'unpaid';
}

function activeLicenseCapacity(packs) {
    var total = 0;
    (packs || []).forEach(function (pack) {
        if (!pack || isInactiveStatus(pack.status)) return;
        total += parseInt(pack.licenseCount, 10) || 0;
    });
    return total;
}

function uniqueStrings(values) {
    var out = [];
    var seen = {};
    (values || []).forEach(function (value) {
        var v = String(value || '').trim();
        if (!v || seen[v]) return;
        seen[v] = true;
        out.push(v);
    });
    return out;
}

function buildSubscriptionPack(buyer, licenseCount, sessionId) {
    return {
        id: (buyer && buyer.subscriptionId) || ('pack_' + Date.now()),
        subscriptionId: (buyer && buyer.subscriptionId) || null,
        customerId: (buyer && buyer.customerId) || null,
        licenseCount: parseInt(licenseCount, 10) || 0,
        checkoutSessionId: sessionId || null,
        status: 'active',
        createdAt: new Date().toISOString()
    };
}

function mergeSubscriptionPacks(existingPacks, newPack) {
    var packs = Array.isArray(existingPacks) ? existingPacks.slice() : [];
    if (!newPack) return packs;
    if (newPack.subscriptionId) {
        for (var i = 0; i < packs.length; i++) {
            if (packs[i] && packs[i].subscriptionId === newPack.subscriptionId) {
                packs[i] = Object.assign({}, packs[i], newPack);
                return packs;
            }
        }
    }
    packs.push(newPack);
    return packs;
}

/** Reconstitue des packs depuis les anciens champs scalaires / tableaux. */
function packsFromMeta(meta) {
    meta = meta || {};
    if (Array.isArray(meta.subscription_packs) && meta.subscription_packs.length) {
        return meta.subscription_packs.map(function (p) {
            return Object.assign({}, p);
        });
    }

    var customers = Array.isArray(meta.stripe_customer_ids) ? meta.stripe_customer_ids.slice() : [];
    var subscriptions = Array.isArray(meta.stripe_subscription_ids) ? meta.stripe_subscription_ids.slice() : [];
    if (meta.stripe_customer_id && customers.indexOf(meta.stripe_customer_id) === -1) {
        customers.unshift(meta.stripe_customer_id);
    }
    if (meta.stripe_subscription_id && subscriptions.indexOf(meta.stripe_subscription_id) === -1) {
        subscriptions.unshift(meta.stripe_subscription_id);
    }

    if (!customers.length && !subscriptions.length) return [];

    var max = Math.max(customers.length, subscriptions.length, 1);
    var total = parseInt(meta.license_count, 10) || 0;
    var out = [];

    if (max === 1) {
        out.push({
            id: subscriptions[0] || customers[0] || ('legacy_' + Date.now()),
            subscriptionId: subscriptions[0] || null,
            customerId: customers[0] || null,
            licenseCount: total || 0,
            checkoutSessionId: meta.stripe_checkout_session_id || null,
            status: 'active',
            createdAt: null
        });
        return out;
    }

    // Plusieurs ids legacy sans détail : un pack par subscription, capacité sur le 1er
    for (var i = 0; i < max; i++) {
        out.push({
            id: subscriptions[i] || ('legacy_' + i),
            subscriptionId: subscriptions[i] || null,
            customerId: customers[i] || customers[0] || null,
            licenseCount: i === 0 ? total : 0,
            status: 'active',
            createdAt: null
        });
    }
    return out;
}

/**
 * Normalise les metadata admin (migration lazy des packs).
 * Retourne { meta, migrated } — migrated=true si subscription_packs a été créé.
 */
function normalizeAdminMeta(meta) {
    var next = Object.assign({}, meta || {});
    var hadPacks = Array.isArray(next.subscription_packs) && next.subscription_packs.length > 0;
    var packs = packsFromMeta(next);
    next.subscription_packs = packs;

    var capacity = activeLicenseCapacity(packs);
    if (capacity > 0) {
        next.license_count = capacity;
        next.license_plan = planLabelFromCount(capacity);
    }

    // Customer principal = le plus ancien connu (stabilité portail)
    var customers = uniqueStrings([].concat(
        Array.isArray(next.stripe_customer_ids) ? next.stripe_customer_ids : [],
        next.stripe_customer_id ? [next.stripe_customer_id] : [],
        packs.map(function (p) { return p && p.customerId; })
    ));
    if (customers.length) {
        next.stripe_customer_ids = customers;
        if (!next.stripe_customer_id) next.stripe_customer_id = customers[0];
    }

    var subscriptions = uniqueStrings([].concat(
        Array.isArray(next.stripe_subscription_ids) ? next.stripe_subscription_ids : [],
        next.stripe_subscription_id ? [next.stripe_subscription_id] : [],
        packs.map(function (p) { return p && p.subscriptionId; })
    ));
    if (subscriptions.length) {
        next.stripe_subscription_ids = subscriptions;
        if (!next.stripe_subscription_id) next.stripe_subscription_id = subscriptions[0];
    }

    return {
        meta: next,
        migrated: !hadPacks && packs.length > 0
    };
}

function usedSeatCount(adminMeta, licenseEmails) {
    var hasSelf = !!(adminMeta && adminMeta.has_license_seat);
    return (licenseEmails || []).length + (hasSelf ? 1 : 0);
}

/**
 * Parmi les licences (objets {email,id,created_at?}), lesquelles dépassent la capacité.
 * On suspend les plus récentes d'abord (garde les plus anciennes actives).
 */
function pickEmailsToSuspend(licenseUsers, capacity, adminHasSeat) {
    var seatsForLicenses = Math.max(0, (parseInt(capacity, 10) || 0) - (adminHasSeat ? 1 : 0));
    var sorted = (licenseUsers || []).slice().sort(function (a, b) {
        var ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        var tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return ta - tb; // anciennes d'abord
    });
    if (sorted.length <= seatsForLicenses) return [];
    return sorted.slice(seatsForLicenses).map(function (u) {
        return String(u.email || '').trim().toLowerCase();
    }).filter(Boolean);
}

module.exports = {
    planLabelFromCount: planLabelFromCount,
    isInactiveStatus: isInactiveStatus,
    activeLicenseCapacity: activeLicenseCapacity,
    uniqueStrings: uniqueStrings,
    buildSubscriptionPack: buildSubscriptionPack,
    mergeSubscriptionPacks: mergeSubscriptionPacks,
    packsFromMeta: packsFromMeta,
    normalizeAdminMeta: normalizeAdminMeta,
    usedSeatCount: usedSeatCount,
    pickEmailsToSuspend: pickEmailsToSuspend
};
