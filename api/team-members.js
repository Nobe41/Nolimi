// api/ — liste les membres d’un abonnement (admin + licences) pour la page Équipe.

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

async function listAllAuthUsers(supabaseUrl, secretKey) {
    var users = [];
    var page = 1;
    var perPage = 200;

    while (page < 50) {
        var response = await fetch(
            supabaseUrl.replace(/\/$/, '') +
                '/auth/v1/admin/users?page=' + page + '&per_page=' + perPage,
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
            throw new Error(
                (data && (data.msg || data.message || data.error)) ||
                'Impossible de lister les utilisateurs.'
            );
        }
        var batch = (data && data.users) || [];
        users = users.concat(batch);
        if (batch.length < perPage) break;
        page += 1;
    }
    return users;
}

function planLabelFromMeta(meta) {
    if (!meta) return null;
    if (meta.license_plan) return String(meta.license_plan);
    var count = parseInt(meta.license_count, 10);
    if (count === 1) return '1 licence';
    if (count > 1) return count + ' licences';
    return null;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return json(res, 405, { error: 'Méthode non autorisée.' });
    }

    var supabaseUrl = process.env.SUPABASE_URL;
    var supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
    var supabaseAnonKey = process.env.SUPABASE_ANON_KEY || supabaseSecretKey;

    if (!supabaseUrl || !supabaseSecretKey) {
        return json(res, 500, { error: 'Configuration Supabase manquante.' });
    }

    var accessToken = getBearerToken(req);
    if (!accessToken) {
        return json(res, 401, { error: 'Connexion requise.' });
    }

    var currentUser = await getSupabaseUser(supabaseUrl, supabaseAnonKey, accessToken);
    if (!currentUser) {
        return json(res, 401, { error: 'Session invalide.' });
    }

    var meta = currentUser.user_metadata || {};
    var isAdmin = meta.account_role === 'admin';
    var managerEmail = String(
        meta.license_manager_email ||
        (isAdmin ? currentUser.email : '') ||
        ''
    ).trim().toLowerCase();

    if (!managerEmail) {
        return json(res, 422, {
            error: 'Aucun abonnement lié à ce compte.'
        });
    }

    var users;
    try {
        users = await listAllAuthUsers(supabaseUrl, supabaseSecretKey);
    } catch (err) {
        return json(res, 500, {
            error: err && err.message ? err.message : 'Erreur serveur.'
        });
    }

    var adminEmail = managerEmail;
    var licenses = [];
    var licenseUsers = [];
    var plan = planLabelFromMeta(meta);
    var licenseCount = parseInt(meta.license_count, 10) || 0;
    var adminHasLicenseSeat = false;
    var adminUserId = null;
    var adminMetaFull = meta;

    for (var i = 0; i < users.length; i++) {
        var user = users[i];
        var email = String(user.email || '').trim().toLowerCase();
        if (!email) continue;
        var um = user.user_metadata || {};
        var role = um.account_role || '';
        var userManager = String(um.license_manager_email || '').trim().toLowerCase();

        if (email === managerEmail || (role === 'admin' && userManager === managerEmail)) {
            adminEmail = email;
            if (role === 'admin' || email === managerEmail) {
                adminUserId = user.id;
                adminMetaFull = um;
                var adminPlan = planLabelFromMeta(um);
                var adminCount = parseInt(um.license_count, 10) || 0;
                if (adminPlan) plan = adminPlan;
                if (adminCount) licenseCount = adminCount;
                adminHasLicenseSeat = !!um.has_license_seat;
            }
            continue;
        }

        if (userManager === managerEmail && role === 'license') {
            licenses.push(email);
            licenseUsers.push({
                id: user.id,
                email: email,
                created_at: user.created_at,
                user_metadata: um,
                suspended: !!um.access_suspended
            });
        }
    }

    // Fallback metadata
    if (!licenses.length && Array.isArray(meta.team_license_emails)) {
        licenses = meta.team_license_emails.map(function (e) {
            return String(e || '').trim().toLowerCase();
        }).filter(function (email) {
            return email && email !== managerEmail;
        });
        if (meta.has_license_seat) adminHasLicenseSeat = true;
    } else {
        licenses = licenses.filter(function (email) {
            return email && email !== managerEmail;
        });
    }

    licenses.sort();

    // Capacité depuis packs actifs si possible
    var helpers = null;
    var syncMod = null;
    try {
        helpers = require('./_lib/subscription-helpers');
        syncMod = require('./_lib/sync-suspensions');
    } catch (e) {}

    var overCapacity = false;
    var suspendedEmails = [];
    if (helpers) {
        var normalized = helpers.normalizeAdminMeta(adminMetaFull);
        adminMetaFull = normalized.meta;
        var capacity = helpers.activeLicenseCapacity(adminMetaFull.subscription_packs);
        if (capacity > 0) licenseCount = capacity;
        if (normalized.migrated && isAdmin && adminUserId && syncMod) {
            await syncMod.updateUserMetadata(supabaseUrl, supabaseSecretKey, adminUserId, adminMetaFull);
        }
        if (isAdmin && syncMod && licenseUsers.length) {
            try {
                var syncResult = await syncMod.syncLicenseSuspensions(
                    supabaseUrl,
                    supabaseSecretKey,
                    adminMetaFull,
                    licenseUsers
                );
                overCapacity = !!syncResult.overCapacity;
                suspendedEmails = syncResult.suspendedEmails || [];
                // refresh suspended flags
                licenseUsers.forEach(function (lu) {
                    lu.suspended = suspendedEmails.indexOf(lu.email) !== -1;
                });
            } catch (e) {}
        } else {
            suspendedEmails = licenseUsers.filter(function (lu) {
                return lu.suspended;
            }).map(function (lu) { return lu.email; });
            overCapacity = suspendedEmails.length > 0 ||
                (licenseCount > 0 && (licenses.length + (adminHasLicenseSeat ? 1 : 0)) > licenseCount);
        }
    }

    if (!plan && licenseCount) {
        plan = licenseCount === 1 ? '1 licence' : licenseCount + ' licences';
    }

    var usedSeats = licenses.length + (adminHasLicenseSeat ? 1 : 0);
    var remainingSlots = Math.max(0, licenseCount - usedSeats);

    return json(res, 200, {
        adminEmail: adminEmail,
        licenses: licenses,
        plan: plan,
        licenseCount: licenseCount,
        usedSeats: usedSeats,
        remainingSlots: remainingSlots,
        seats: 1 + licenses.length,
        adminHasLicenseSeat: adminHasLicenseSeat,
        canManage: isAdmin,
        overCapacity: overCapacity,
        suspendedEmails: suspendedEmails,
        licenseDetails: licenseUsers.map(function (lu) {
            return { email: lu.email, suspended: !!lu.suspended };
        })
    });
};
