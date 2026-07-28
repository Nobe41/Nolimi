// api/ — ajoute ou supprime une licence depuis la page Équipe (admin uniquement).

const crypto = require('crypto');
const resendMail = require('./send-credentials-email');

const PASSWORD_LENGTH = 14;
const PASSWORD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 12;
var rateBuckets = {};

function checkRateLimit(userId, action) {
    var key = String(userId || 'anon') + ':' + String(action || '');
    var now = Date.now();
    var bucket = (rateBuckets[key] || []).filter(function (t) {
        return now - t < RATE_LIMIT_WINDOW_MS;
    });
    if (bucket.length >= RATE_LIMIT_MAX) return false;
    bucket.push(now);
    rateBuckets[key] = bucket;
    return true;
}

function pushAudit(meta, entry) {
    var next = Object.assign({}, meta || {});
    var log = Array.isArray(next.team_audit_log) ? next.team_audit_log.slice() : [];
    log.unshift(Object.assign({ at: new Date().toISOString() }, entry || {}));
    next.team_audit_log = log.slice(0, 50);
    return next;
}

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

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function generatePassword(length) {
    var bytes = crypto.randomBytes(length);
    var password = '';
    for (var i = 0; i < length; i++) {
        password += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
    }
    return password;
}

function uniqueEmails(list) {
    var out = [];
    var seen = {};
    (list || []).forEach(function (email) {
        var e = String(email || '').trim().toLowerCase();
        if (!e || seen[e]) return;
        seen[e] = true;
        out.push(e);
    });
    return out;
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

async function findAuthUserByEmail(supabaseUrl, secretKey, email) {
    var target = String(email || '').trim().toLowerCase();
    if (!target) return null;

    var base = supabaseUrl.replace(/\/$/, '') + '/auth/v1/admin/users';
    var headers = {
        Authorization: 'Bearer ' + secretKey,
        apikey: secretKey
    };

    try {
        var filtered = await fetch(base + '?email=' + encodeURIComponent(target), {
            method: 'GET',
            headers: headers
        });
        var filteredData = await filtered.json();
        var filteredUsers = (filteredData && filteredData.users) || [];
        for (var i = 0; i < filteredUsers.length; i++) {
            if (String(filteredUsers[i].email || '').trim().toLowerCase() === target) {
                return filteredUsers[i];
            }
        }
    } catch (e) {}

    var page = 1;
    var perPage = 200;
    while (page < 50) {
        var response = await fetch(base + '?page=' + page + '&per_page=' + perPage, {
            method: 'GET',
            headers: headers
        });
        var data = null;
        try {
            data = await response.json();
        } catch (e) {
            data = null;
        }
        if (!response.ok) return null;
        var batch = (data && data.users) || [];
        for (var j = 0; j < batch.length; j++) {
            if (String(batch[j].email || '').trim().toLowerCase() === target) {
                return batch[j];
            }
        }
        if (batch.length < perPage) break;
        page += 1;
    }
    return null;
}

async function listTeamLicenses(supabaseUrl, secretKey, managerEmail) {
    var licenses = [];
    var adminUser = null;
    var page = 1;
    var perPage = 200;
    var base = supabaseUrl.replace(/\/$/, '') + '/auth/v1/admin/users';

    while (page < 50) {
        var response = await fetch(base + '?page=' + page + '&per_page=' + perPage, {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + secretKey,
                apikey: secretKey
            }
        });
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
        for (var i = 0; i < batch.length; i++) {
            var user = batch[i];
            var email = String(user.email || '').trim().toLowerCase();
            var um = user.user_metadata || {};
            var role = um.account_role || '';
            var userManager = String(um.license_manager_email || '').trim().toLowerCase();

            if (email === managerEmail && role === 'admin') {
                adminUser = user;
            }
            if (userManager === managerEmail && role === 'license' && email !== managerEmail) {
                licenses.push({ email: email, id: user.id });
            }
        }
        if (batch.length < perPage) break;
        page += 1;
    }

    if (!adminUser) {
        adminUser = await findAuthUserByEmail(supabaseUrl, secretKey, managerEmail);
    }

    return { adminUser: adminUser, licenses: licenses };
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
            body: JSON.stringify({ user_metadata: userMetadata || {} })
        }
    );
    var data = null;
    try {
        data = await response.json();
    } catch (e) {
        data = null;
    }
    if (!response.ok) {
        var message = (data && (data.msg || data.message || data.error)) ||
            'Impossible de mettre à jour le compte.';
        return { ok: false, error: String(message) };
    }
    return { ok: true, user: data };
}

async function createLicenseUser(supabaseUrl, secretKey, email, metadata) {
    var password = generatePassword(PASSWORD_LENGTH);
    var response = await fetch(supabaseUrl.replace(/\/$/, '') + '/auth/v1/admin/users', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + secretKey,
            apikey: secretKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: metadata || {}
        })
    });
    var data = null;
    try {
        data = await response.json();
    } catch (e) {
        data = null;
    }
    if (!response.ok) {
        var message = (data && (data.msg || data.message || data.error_description || data.error)) ||
            'Erreur Supabase';
        if (/already registered|already been registered|user already exists/i.test(String(message))) {
            return { ok: false, error: 'Cette adresse mail est déjà utilisée : ' + email };
        }
        return { ok: false, error: String(message) };
    }
    return { ok: true, userId: data && data.id ? data.id : null, password: password };
}

async function deleteAuthUser(supabaseUrl, secretKey, userId) {
    var response = await fetch(
        supabaseUrl.replace(/\/$/, '') + '/auth/v1/admin/users/' + encodeURIComponent(userId),
        {
            method: 'DELETE',
            headers: {
                Authorization: 'Bearer ' + secretKey,
                apikey: secretKey
            }
        }
    );
    if (!response.ok && response.status !== 404) {
        var data = null;
        try {
            data = await response.json();
        } catch (e) {
            data = null;
        }
        var message = (data && (data.msg || data.message || data.error)) ||
            'Impossible de supprimer le compte.';
        return { ok: false, error: String(message) };
    }
    return { ok: true };
}

function seatUsage(adminMeta, licenseEmails) {
    var capacity = parseInt(adminMeta && adminMeta.license_count, 10) || 0;
    var hasSelf = !!(adminMeta && adminMeta.has_license_seat);
    var used = (licenseEmails || []).length + (hasSelf ? 1 : 0);
    return {
        capacity: capacity,
        used: used,
        remaining: Math.max(0, capacity - used),
        hasSelf: hasSelf
    };
}

async function addLicense(ctx) {
    var email = String(ctx.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
        return { status: 400, body: { error: 'Adresse mail invalide.' } };
    }

    var team = await listTeamLicenses(ctx.supabaseUrl, ctx.supabaseSecretKey, ctx.managerEmail);
    var adminUser = team.adminUser;
    if (!adminUser || !adminUser.id) {
        return { status: 422, body: { error: 'Compte admin introuvable.' } };
    }

    var adminMeta = adminUser.user_metadata || {};
    var licenseEmails = team.licenses.map(function (l) { return l.email; });
    var usage = seatUsage(adminMeta, licenseEmails);

    if (usage.capacity <= 0) {
        return { status: 422, body: { error: 'Aucune capacité de licence sur cet abonnement.' } };
    }
    if (usage.remaining <= 0) {
        return { status: 422, body: { error: 'Plus de place disponible. Toutes les licences sont attribuées.' } };
    }

    if (email === ctx.managerEmail) {
        if (adminMeta.has_license_seat) {
            return { status: 422, body: { error: 'Votre adresse admin occupe déjà un siège licence.' } };
        }
        var selfMeta = pushAudit(Object.assign({}, adminMeta, {
            account_role: 'admin',
            has_license_seat: true,
            team_license_emails: uniqueEmails(
                (adminMeta.team_license_emails || []).concat([email]).concat(licenseEmails)
            )
        }), { action: 'add_self_seat', email: email, by: ctx.managerEmail });
        var selfUpdate = await updateUserMetadata(
            ctx.supabaseUrl,
            ctx.supabaseSecretKey,
            adminUser.id,
            selfMeta
        );
        if (!selfUpdate.ok) {
            return { status: 502, body: { error: selfUpdate.error } };
        }
        return {
            status: 200,
            body: {
                success: true,
                email: email,
                seatOnAdmin: true,
                emailSent: false,
                remainingSlots: usage.remaining - 1
            }
        };
    }

    if (licenseEmails.indexOf(email) !== -1) {
        return { status: 422, body: { error: 'Cette adresse fait déjà partie de l’équipe.' } };
    }

    var existing = await findAuthUserByEmail(ctx.supabaseUrl, ctx.supabaseSecretKey, email);
    if (existing) {
        return { status: 422, body: { error: 'Cette adresse mail est déjà utilisée : ' + email } };
    }

    var capacity = usage.capacity;
    var planLabel = capacity === 1 ? '1 licence' : capacity + ' licences';
    var createResult = await createLicenseUser(ctx.supabaseUrl, ctx.supabaseSecretKey, email, {
        account_role: 'license',
        license_manager_email: ctx.managerEmail,
        license_count: capacity,
        license_plan: planLabel,
        has_license_seat: false
    });
    if (!createResult.ok) {
        return { status: 422, body: { error: createResult.error } };
    }

    var mailResult = await resendMail.sendCredentialsEmail({
        apiKey: ctx.resendApiKey,
        from: ctx.resendFrom,
        to: email,
        password: createResult.password,
        siteUrl: ctx.loginUrl,
        accountType: 'license'
    });

    var nextEmails = uniqueEmails(licenseEmails.concat([email]));
    if (adminMeta.has_license_seat) {
        nextEmails = uniqueEmails(nextEmails.concat([ctx.managerEmail]));
    }
    var adminUpdate = await updateUserMetadata(
        ctx.supabaseUrl,
        ctx.supabaseSecretKey,
        adminUser.id,
        pushAudit(Object.assign({}, adminMeta, {
            account_role: 'admin',
            team_license_emails: nextEmails,
            license_count: capacity,
            license_plan: planLabel
        }), { action: 'add_license', email: email, by: ctx.managerEmail })
    );
    if (!adminUpdate.ok) {
        return { status: 502, body: { error: adminUpdate.error } };
    }

    return {
        status: mailResult.ok ? 200 : 207,
        body: {
            success: true,
            email: email,
            emailSent: !!mailResult.ok,
            warning: mailResult.ok ? null : ('Compte créé, mais l’envoi du mail a échoué : ' + mailResult.error),
            remainingSlots: usage.remaining - 1
        }
    };
}

async function removeLicense(ctx) {
    var email = String(ctx.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
        return { status: 400, body: { error: 'Adresse mail invalide.' } };
    }

    var team = await listTeamLicenses(ctx.supabaseUrl, ctx.supabaseSecretKey, ctx.managerEmail);
    var adminUser = team.adminUser;
    if (!adminUser || !adminUser.id) {
        return { status: 422, body: { error: 'Compte admin introuvable.' } };
    }

    var adminMeta = adminUser.user_metadata || {};

    if (email === ctx.managerEmail) {
        if (!adminMeta.has_license_seat) {
            return { status: 422, body: { error: 'Aucun siège licence à retirer sur le compte admin.' } };
        }
        var cleared = uniqueEmails(adminMeta.team_license_emails || []).filter(function (e) {
            return e !== ctx.managerEmail;
        });
        var selfUpdate = await updateUserMetadata(
            ctx.supabaseUrl,
            ctx.supabaseSecretKey,
            adminUser.id,
            pushAudit(Object.assign({}, adminMeta, {
                account_role: 'admin',
                has_license_seat: false,
                team_license_emails: cleared
            }), { action: 'remove_self_seat', email: email, by: ctx.managerEmail })
        );
        if (!selfUpdate.ok) {
            return { status: 502, body: { error: selfUpdate.error } };
        }
        return { status: 200, body: { success: true, email: email, removedSelfSeat: true } };
    }

    var target = null;
    for (var i = 0; i < team.licenses.length; i++) {
        if (team.licenses[i].email === email) {
            target = team.licenses[i];
            break;
        }
    }
    if (!target) {
        // Fallback: user exists with this manager
        var found = await findAuthUserByEmail(ctx.supabaseUrl, ctx.supabaseSecretKey, email);
        if (found && found.user_metadata &&
            String(found.user_metadata.license_manager_email || '').toLowerCase() === ctx.managerEmail &&
            found.user_metadata.account_role === 'license') {
            target = { email: email, id: found.id };
        }
    }
    if (!target || !target.id) {
        return { status: 404, body: { error: 'Aucun compte licence trouvé pour cette adresse.' } };
    }

    var deleted = await deleteAuthUser(ctx.supabaseUrl, ctx.supabaseSecretKey, target.id);
    if (!deleted.ok) {
        return { status: 502, body: { error: deleted.error } };
    }

    var nextEmails = uniqueEmails(adminMeta.team_license_emails || []).filter(function (e) {
        return e !== email;
    });
    if (adminMeta.has_license_seat && nextEmails.indexOf(ctx.managerEmail) === -1) {
        nextEmails.push(ctx.managerEmail);
    }

    var adminUpdate = await updateUserMetadata(
        ctx.supabaseUrl,
        ctx.supabaseSecretKey,
        adminUser.id,
        pushAudit(Object.assign({}, adminMeta, {
            account_role: 'admin',
            team_license_emails: nextEmails
        }), { action: 'remove_license', email: email, by: ctx.managerEmail })
    );
    if (!adminUpdate.ok) {
        return { status: 502, body: { error: adminUpdate.error } };
    }

    return { status: 200, body: { success: true, email: email, deleted: true } };
}

async function resendLicense(ctx) {
    var email = String(ctx.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
        return { status: 400, body: { error: 'Adresse mail invalide.' } };
    }
    if (email === ctx.managerEmail) {
        return { status: 422, body: { error: 'Utilisez la connexion admin existante pour ce compte.' } };
    }

    var team = await listTeamLicenses(ctx.supabaseUrl, ctx.supabaseSecretKey, ctx.managerEmail);
    var target = null;
    for (var i = 0; i < team.licenses.length; i++) {
        if (team.licenses[i].email === email) {
            target = team.licenses[i];
            break;
        }
    }
    if (!target || !target.id) {
        return { status: 404, body: { error: 'Aucun compte licence trouvé pour cette adresse.' } };
    }

    var password = generatePassword(PASSWORD_LENGTH);
    var response = await fetch(
        ctx.supabaseUrl.replace(/\/$/, '') + '/auth/v1/admin/users/' + encodeURIComponent(target.id),
        {
            method: 'PUT',
            headers: {
                Authorization: 'Bearer ' + ctx.supabaseSecretKey,
                apikey: ctx.supabaseSecretKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: password })
        }
    );
    if (!response.ok) {
        return { status: 502, body: { error: 'Impossible de régénérer le mot de passe.' } };
    }

    var mailResult = await resendMail.sendCredentialsEmail({
        apiKey: ctx.resendApiKey,
        from: ctx.resendFrom,
        to: email,
        password: password,
        siteUrl: ctx.loginUrl,
        accountType: 'license'
    });
    if (!mailResult.ok) {
        return { status: 502, body: { error: 'Mot de passe régénéré, mais l’envoi du mail a échoué : ' + mailResult.error } };
    }

    if (team.adminUser && team.adminUser.id) {
        await updateUserMetadata(
            ctx.supabaseUrl,
            ctx.supabaseSecretKey,
            team.adminUser.id,
            pushAudit(team.adminUser.user_metadata || {}, {
                action: 'resend_credentials',
                email: email,
                by: ctx.managerEmail
            })
        );
    }

    return { status: 200, body: { success: true, email: email, emailSent: true } };
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return json(res, 405, { error: 'Méthode non autorisée.' });
    }

    var supabaseUrl = process.env.SUPABASE_URL;
    var supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
    var supabaseAnonKey = process.env.SUPABASE_ANON_KEY || supabaseSecretKey;
    var resendApiKey = process.env.RESEND_API_KEY;
    var resendFrom = process.env.RESEND_FROM_EMAIL;
    var loginUrl = process.env.NOLIMI_SITE_URL || 'https://nolimi.net';

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
    if (meta.account_role !== 'admin') {
        return json(res, 403, { error: 'Réservé au compte administrateur.' });
    }

    var managerEmail = String(
        meta.license_manager_email || currentUser.email || ''
    ).trim().toLowerCase();
    if (!managerEmail) {
        return json(res, 422, { error: 'Aucun abonnement lié à ce compte.' });
    }

    var body = req.body || {};
    var action = String(body.action || '').trim().toLowerCase();
    var email = body.email;

    if (!checkRateLimit(currentUser.id, action)) {
        return json(res, 429, { error: 'Trop de requêtes. Réessayez dans une minute.' });
    }

    var ctx = {
        supabaseUrl: supabaseUrl,
        supabaseSecretKey: supabaseSecretKey,
        resendApiKey: resendApiKey,
        resendFrom: resendFrom,
        loginUrl: loginUrl,
        managerEmail: managerEmail,
        email: email
    };

    try {
        var result;
        if (action === 'add') {
            var emailForAdd = String(email || '').trim().toLowerCase();
            var needsMail = emailForAdd && emailForAdd !== managerEmail;
            if (needsMail && (!resendApiKey || !resendFrom)) {
                return json(res, 500, {
                    error: 'Configuration Resend manquante (RESEND_API_KEY / RESEND_FROM_EMAIL).'
                });
            }
            result = await addLicense(ctx);
        } else if (action === 'remove') {
            result = await removeLicense(ctx);
        } else if (action === 'resend') {
            if (!resendApiKey || !resendFrom) {
                return json(res, 500, {
                    error: 'Configuration Resend manquante (RESEND_API_KEY / RESEND_FROM_EMAIL).'
                });
            }
            result = await resendLicense(ctx);
        } else {
            return json(res, 400, { error: 'Action invalide (add | remove | resend).' });
        }
        return json(res, result.status, result.body);
    } catch (err) {
        return json(res, 500, {
            error: err && err.message ? err.message : 'Erreur serveur.'
        });
    }
};
