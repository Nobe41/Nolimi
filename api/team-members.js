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
    var managerEmail = String(
        meta.license_manager_email ||
        (meta.account_role === 'admin' ? currentUser.email : '') ||
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
    var plan = planLabelFromMeta(meta);
    var licenseCount = parseInt(meta.license_count, 10) || null;

    for (var i = 0; i < users.length; i++) {
        var user = users[i];
        var email = String(user.email || '').trim().toLowerCase();
        if (!email) continue;
        var um = user.user_metadata || {};
        var role = um.account_role || '';
        var userManager = String(um.license_manager_email || '').trim().toLowerCase();

        if (email === managerEmail || (role === 'admin' && userManager === managerEmail)) {
            adminEmail = email;
            if (!plan) plan = planLabelFromMeta(um);
            if (!licenseCount) licenseCount = parseInt(um.license_count, 10) || null;
            continue;
        }

        if (userManager === managerEmail && role !== 'admin') {
            licenses.push(email);
            if (!plan) plan = planLabelFromMeta(um);
            if (!licenseCount) licenseCount = parseInt(um.license_count, 10) || null;
        }
    }

    // Fallback metadata (comptes créés avec team_license_emails)
    if (!licenses.length && Array.isArray(meta.team_license_emails)) {
        licenses = meta.team_license_emails.map(function (e) {
            return String(e || '').trim().toLowerCase();
        }).filter(Boolean);
    }

    licenses.sort();

    return json(res, 200, {
        adminEmail: adminEmail,
        licenses: licenses,
        plan: plan,
        licenseCount: licenseCount,
        seats: 1 + licenses.length
    });
};
