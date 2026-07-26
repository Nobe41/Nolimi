// api/ — crée un workspace collaboratif + ajoute les membres (même abonnement).

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
            throw new Error((data && (data.msg || data.message)) || 'Liste utilisateurs impossible.');
        }
        var batch = (data && data.users) || [];
        users = users.concat(batch);
        if (batch.length < perPage) break;
        page += 1;
    }
    return users;
}

async function supabaseRest(supabaseUrl, secretKey, method, path, body) {
    var options = {
        method: method,
        headers: {
            Authorization: 'Bearer ' + secretKey,
            apikey: secretKey,
            'Content-Type': 'application/json',
            Prefer: method === 'POST' ? 'return=representation' : 'return=minimal'
        }
    };
    if (body) options.body = JSON.stringify(body);
    var response = await fetch(supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + path, options);
    var data = null;
    try {
        data = await response.json();
    } catch (e) {
        data = null;
    }
    return { ok: response.ok, status: response.status, data: data };
}

function managerOf(user) {
    var meta = (user && user.user_metadata) || {};
    return String(
        meta.license_manager_email ||
        (meta.account_role === 'admin' ? user.email : '') ||
        ''
    ).trim().toLowerCase();
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
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

    var body = req.body || {};
    var name = String(body.name || '').trim() || 'Projet collaboratif';
    var memberEmails = Array.isArray(body.memberEmails)
        ? body.memberEmails.map(function (e) { return String(e || '').trim().toLowerCase(); }).filter(Boolean)
        : [];

    var myManager = managerOf(currentUser);
    if (!myManager) {
        return json(res, 422, { error: 'Aucun abonnement lié à ce compte.' });
    }

    var allUsers;
    try {
        allUsers = await listAllAuthUsers(supabaseUrl, supabaseSecretKey);
    } catch (err) {
        return json(res, 500, { error: err.message || 'Erreur serveur.' });
    }

    var byEmail = {};
    allUsers.forEach(function (u) {
        var email = String(u.email || '').trim().toLowerCase();
        if (email) byEmail[email] = u;
    });

    var myEmail = String(currentUser.email || '').trim().toLowerCase();
    var members = [{ id: currentUser.id, email: myEmail }];
    var seen = {};
    seen[myEmail] = true;

    for (var i = 0; i < memberEmails.length; i++) {
        var email = memberEmails[i];
        if (seen[email]) continue;
        var u = byEmail[email];
        if (!u) {
            return json(res, 400, { error: 'Compte introuvable dans l’équipe : ' + email });
        }
        if (managerOf(u) !== myManager) {
            return json(res, 403, {
                error: 'Vous ne pouvez inviter que des personnes de votre abonnement : ' + email
            });
        }
        seen[email] = true;
        members.push({ id: u.id, email: email });
    }

    if (members.length < 2) {
        return json(res, 400, {
            error: 'Choisissez au moins une autre personne de votre équipe.'
        });
    }

    // Insert via service role (bypass RLS) pour créer workspace + tous les membres
    var wsResult = await supabaseRest(
        supabaseUrl,
        supabaseSecretKey,
        'POST',
        'collab_workspaces',
        { name: name, owner_id: currentUser.id }
    );

    if (!wsResult.ok || !wsResult.data || !wsResult.data[0] || !wsResult.data[0].id) {
        var msg = (wsResult.data && (wsResult.data.message || wsResult.data.error)) ||
            'Impossible de créer le dossier collaboratif. Avez-vous exécuté schema-collab.sql ?';
        return json(res, 500, { error: String(msg) });
    }

    var workspace = wsResult.data[0];
    var memberRows = members.map(function (m) {
        return {
            workspace_id: workspace.id,
            user_id: m.id,
            email: m.email
        };
    });

    var memResult = await supabaseRest(
        supabaseUrl,
        supabaseSecretKey,
        'POST',
        'collab_workspace_members',
        memberRows
    );

    if (!memResult.ok) {
        await supabaseRest(
            supabaseUrl,
            supabaseSecretKey,
            'DELETE',
            'collab_workspaces?id=eq.' + encodeURIComponent(workspace.id),
            null
        );
        var memMsg = (memResult.data && (memResult.data.message || memResult.data.error)) ||
            'Impossible d’ajouter les membres.';
        return json(res, 500, { error: String(memMsg) });
    }

    return json(res, 200, {
        workspace: {
            id: workspace.id,
            name: workspace.name,
            owner_id: workspace.owner_id,
            created_at: workspace.created_at,
            members: members.map(function (m) { return m.email; })
        }
    });
};
