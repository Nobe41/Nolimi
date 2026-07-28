// api/_lib/ — synchronise access_suspended selon la capacité active.

const helpers = require('./subscription-helpers');

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
            body: JSON.stringify({ user_metadata: userMetadata || {} })
        }
    );
    return response.ok;
}

/**
 * licenseUsers: [{ id, email, created_at, user_metadata }]
 * Met à jour access_suspended pour coller à la capacité.
 */
async function syncLicenseSuspensions(supabaseUrl, secretKey, adminMeta, licenseUsers) {
    var normalized = helpers.normalizeAdminMeta(adminMeta || {});
    var meta = normalized.meta;
    var capacity = helpers.activeLicenseCapacity(meta.subscription_packs);
    if (!capacity) capacity = parseInt(meta.license_count, 10) || 0;

    var toSuspend = helpers.pickEmailsToSuspend(
        licenseUsers,
        capacity,
        !!meta.has_license_seat
    );
    var suspendSet = {};
    toSuspend.forEach(function (email) {
        suspendSet[email] = true;
    });

    var changed = [];
    for (var i = 0; i < (licenseUsers || []).length; i++) {
        var user = licenseUsers[i];
        if (!user || !user.id) continue;
        var email = String(user.email || '').trim().toLowerCase();
        if (!email) continue;
        var um = user.user_metadata || {};
        var shouldSuspend = !!suspendSet[email];
        var currently = !!um.access_suspended;
        if (shouldSuspend === currently) continue;

        var nextMeta = Object.assign({}, um, {
            access_suspended: shouldSuspend
        });
        if (shouldSuspend) {
            nextMeta.access_suspended_reason = 'over_capacity';
            nextMeta.access_suspended_at = new Date().toISOString();
        } else {
            nextMeta.access_suspended_reason = null;
            nextMeta.access_suspended_at = null;
        }

        var ok = await updateUserMetadata(supabaseUrl, secretKey, user.id, nextMeta);
        if (ok) {
            changed.push({ email: email, suspended: shouldSuspend });
            user.user_metadata = nextMeta;
        }
    }

    return {
        capacity: capacity,
        suspendedEmails: toSuspend,
        changed: changed,
        overCapacity: toSuspend.length > 0
    };
}

module.exports = {
    syncLicenseSuspensions: syncLicenseSuspensions,
    updateUserMetadata: updateUserMetadata
};
