// api/ — Endpoints serveur (licences, Stripe, emails).
// Ce fichier : après un paiement Stripe validé, crée le compte admin + les licences et envoie les identifiants.
// Si l’admin a déjà un compte (nouveau paiement), on le réutilise et on ajoute les nouvelles licences.

const crypto = require('crypto');
const stripeVerify = require('./stripe-verify');
const resendMail = require('./send-credentials-email');

// --- Réglages ---
const ALLOWED_COUNTS = stripeVerify.ALLOWED_COUNTS; // packs 1 / 5 / 10
const PASSWORD_LENGTH = 14;
const PASSWORD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// Envoie une réponse JSON au client (status + contenu).
function json(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
}

// Génère un mot de passe aléatoire sécurisé.
function generatePassword(length) {
    var bytes = crypto.randomBytes(length);
    var password = '';
    for (var i = 0; i < length; i++) {
        password += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
    }
    return password;
}

// Vérifie le format d’une adresse mail.
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

// Nettoie la liste d’emails (trim, minuscules, vides retirés).
function normalizeEmails(emails) {
    if (!Array.isArray(emails)) return [];
    return emails.map(function (email) {
        return String(email || '').trim().toLowerCase();
    }).filter(Boolean);
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

function planLabelFromCount(count) {
    var n = parseInt(count, 10) || 0;
    if (n === 1) return '1 licence';
    if (n > 1) return n + ' licences';
    return null;
}

// Contrôle : emails valides et uniques, au plus licenseCount (les champs vides sont ignorés).
// L’email admin est autorisé une fois (siège licence sur le compte admin).
function validatePayload(emails, licenseCount, adminEmail) {
    if (ALLOWED_COUNTS.indexOf(licenseCount) === -1) {
        return 'Nombre de licences invalide.';
    }
    if (emails.length > licenseCount) {
        return 'Trop d\'adresses mail pour le nombre de licences achetées.';
    }
    if (!adminEmail || !isValidEmail(adminEmail)) {
        return 'Email du compte admin introuvable.';
    }

    var seen = {};
    var adminSeatCount = 0;
    for (var i = 0; i < emails.length; i++) {
        var email = emails[i];
        if (!isValidEmail(email)) {
            return 'Adresse mail invalide : ' + email;
        }
        if (email === adminEmail) {
            adminSeatCount += 1;
            if (adminSeatCount > 1) {
                return 'L’adresse admin ne peut être utilisée qu’une seule fois comme licence.';
            }
        }
        if (seen[email]) {
            return 'Chaque licence doit avoir une adresse mail différente.';
        }
        seen[email] = true;
    }
    return null; // null = tout est ok
}

async function findAuthUserByEmail(supabaseUrl, secretKey, email) {
    var target = String(email || '').trim().toLowerCase();
    if (!target) return null;

    var base = supabaseUrl.replace(/\/$/, '') + '/auth/v1/admin/users';
    var headers = {
        Authorization: 'Bearer ' + secretKey,
        apikey: secretKey
    };

    // Filtre email (GoTrue) puis secours par pagination.
    var filtered = await fetch(base + '?email=' + encodeURIComponent(target), {
        method: 'GET',
        headers: headers
    });
    try {
        var filteredData = await filtered.json();
        var filteredUsers = (filteredData && filteredData.users) || [];
        for (var i = 0; i < filteredUsers.length; i++) {
            var u = filteredUsers[i];
            if (String(u.email || '').trim().toLowerCase() === target) return u;
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

async function updateSupabaseUserMetadata(supabaseUrl, secretKey, userId, userMetadata) {
    var response = await fetch(
        supabaseUrl.replace(/\/$/, '') + '/auth/v1/admin/users/' + encodeURIComponent(userId),
        {
            method: 'PUT',
            headers: {
                Authorization: 'Bearer ' + secretKey,
                apikey: secretKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_metadata: userMetadata || {}
            })
        }
    );

    var data = null;
    try {
        data = await response.json();
    } catch (e) {
        data = null;
    }

    if (!response.ok) {
        var message = (data && (data.msg || data.message || data.error_description || data.error)) ||
            'Impossible de mettre à jour le compte admin.';
        return { ok: false, error: String(message) };
    }

    return { ok: true, userId: userId, user: data };
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

function activeLicenseCapacity(packs) {
    var total = 0;
    (packs || []).forEach(function (pack) {
        if (!pack || pack.status === 'canceled' || pack.status === 'unpaid') return;
        total += parseInt(pack.licenseCount, 10) || 0;
    });
    return total;
}

function mergeAdminMetadata(existingMeta, packMeta, buyer, sessionId) {
    var existing = existingMeta || {};
    var pack = packMeta || {};

    var prevEmails = Array.isArray(existing.team_license_emails)
        ? existing.team_license_emails
        : [];
    var packEmails = Array.isArray(pack.team_license_emails)
        ? pack.team_license_emails
        : [];
    var mergedEmails = uniqueStrings(
        prevEmails.map(function (e) { return String(e || '').trim().toLowerCase(); })
            .concat(packEmails.map(function (e) { return String(e || '').trim().toLowerCase(); }))
    );

    var addCount = parseInt(pack.license_count, 10) || packEmails.length || 0;
    var newPack = buildSubscriptionPack(buyer, addCount, sessionId);
    var packs = Array.isArray(existing.subscription_packs) ? existing.subscription_packs.slice() : [];

    // Reconstituer un pack legacy si besoin
    if (!packs.length && (existing.stripe_subscription_id || existing.stripe_customer_id)) {
        var legacyCount = parseInt(existing.license_count, 10) || 0;
        var legacyOnly = Math.max(0, legacyCount - addCount);
        packs.push({
            id: existing.stripe_subscription_id || ('legacy_' + Date.now()),
            subscriptionId: existing.stripe_subscription_id || null,
            customerId: existing.stripe_customer_id || null,
            licenseCount: legacyOnly > 0 ? legacyOnly : legacyCount,
            checkoutSessionId: existing.stripe_checkout_session_id || null,
            status: 'active',
            createdAt: new Date().toISOString()
        });
    }

    packs = mergeSubscriptionPacks(packs, newPack);
    var totalCount = activeLicenseCapacity(packs);
    if (!totalCount) {
        var prevCount = parseInt(existing.license_count, 10);
        if (!prevCount || prevCount < 0) prevCount = prevEmails.length || 0;
        totalCount = prevCount + addCount;
    }
    if (mergedEmails.length > totalCount) totalCount = mergedEmails.length;

    var customers = uniqueStrings([].concat(
        Array.isArray(existing.stripe_customer_ids) ? existing.stripe_customer_ids : [],
        existing.stripe_customer_id ? [existing.stripe_customer_id] : [],
        buyer && buyer.customerId ? [buyer.customerId] : []
    ));

    var subscriptions = uniqueStrings([].concat(
        Array.isArray(existing.stripe_subscription_ids) ? existing.stripe_subscription_ids : [],
        existing.stripe_subscription_id ? [existing.stripe_subscription_id] : [],
        buyer && buyer.subscriptionId ? [buyer.subscriptionId] : []
    ));

    var sessions = uniqueStrings([].concat(
        Array.isArray(existing.stripe_checkout_session_ids) ? existing.stripe_checkout_session_ids : [],
        existing.stripe_checkout_session_id ? [existing.stripe_checkout_session_id] : [],
        sessionId ? [sessionId] : []
    ));

    // Customer principal = le premier connu (évite de basculer le portail à chaque paiement)
    var primaryCustomer = existing.stripe_customer_id || customers[0] || (buyer && buyer.customerId) || null;

    return {
        account_role: 'admin',
        license_manager_email: pack.license_manager_email || existing.license_manager_email,
        license_count: totalCount,
        license_plan: planLabelFromCount(totalCount),
        team_license_emails: mergedEmails,
        has_license_seat: !!(existing.has_license_seat || pack.has_license_seat),
        subscription_packs: packs,
        stripe_customer_id: primaryCustomer,
        stripe_subscription_id: (buyer && buyer.subscriptionId) || existing.stripe_subscription_id || subscriptions[0] || null,
        stripe_checkout_session_id: sessionId || existing.stripe_checkout_session_id || null,
        stripe_customer_ids: customers,
        stripe_subscription_ids: subscriptions,
        stripe_checkout_session_ids: sessions,
        multiple_stripe_customers: customers.length > 1
    };
}

// Crée un utilisateur dans Supabase Auth (API admin).
async function createSupabaseUser(supabaseUrl, secretKey, email, password, userMetadata) {
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
            user_metadata: userMetadata || {}
        })
    });

    var data = null;
    try {
        data = await response.json();
    } catch (e) {
        data = null;
    }

    if (!response.ok) {
        var message = (data && (data.msg || data.message || data.error_description || data.error)) || 'Erreur Supabase';
        if (/already registered|already been registered|user already exists/i.test(String(message))) {
            return { ok: false, email: email, error: 'Cette adresse mail est déjà utilisée : ' + email, alreadyExists: true };
        }
        return { ok: false, email: email, error: String(message) };
    }

    return { ok: true, email: email, userId: data && data.id ? data.id : null };
}

async function createAndMailUser(options) {
    var password = generatePassword(PASSWORD_LENGTH);
    var result = await createSupabaseUser(
        options.supabaseUrl,
        options.supabaseSecretKey,
        options.email,
        password,
        options.metadata
    );
    if (!result.ok) {
        return { ok: false, error: result.error, alreadyExists: !!result.alreadyExists };
    }

    var mailResult = await resendMail.sendCredentialsEmail({
        apiKey: options.resendApiKey,
        from: options.resendFrom,
        to: options.email,
        password: password,
        siteUrl: options.loginUrl,
        accountType: options.accountType || 'license'
    });

    if (!mailResult.ok) {
        return {
            ok: true,
            email: result.email,
            userId: result.userId,
            emailSent: false,
            warning: 'Compte créé pour ' + options.email + ', mais l\'envoi du mail a échoué : ' + mailResult.error
        };
    }

    return {
        ok: true,
        email: result.email,
        userId: result.userId,
        emailSent: true
    };
}

async function ensureAdminAccount(options) {
    var existing = await findAuthUserByEmail(
        options.supabaseUrl,
        options.supabaseSecretKey,
        options.email
    );

    if (!existing) {
        var created = await createAndMailUser(options);
        if (!created.ok) return created;
        return {
            ok: true,
            reused: false,
            email: created.email,
            userId: created.userId,
            emailSent: created.emailSent,
            warning: created.warning
        };
    }

    var existingMeta = existing.user_metadata || {};
    var role = String(existingMeta.account_role || '').trim().toLowerCase();
    if (role === 'license') {
        return {
            ok: false,
            error: 'Cette adresse mail est déjà utilisée comme compte licence. Utilisez une autre adresse pour l’admin, ou contactez le support.'
        };
    }

    var merged = mergeAdminMetadata(
        existingMeta,
        options.metadata,
        options.buyer,
        options.sessionId
    );

    var updated = await updateSupabaseUserMetadata(
        options.supabaseUrl,
        options.supabaseSecretKey,
        existing.id,
        merged
    );
    if (!updated.ok) {
        return { ok: false, error: updated.error };
    }

    return {
        ok: true,
        reused: true,
        email: options.email,
        userId: existing.id,
        emailSent: false
    };
}

// --- Point d’entrée de l’API (appelé en POST) ---
module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return json(res, 405, { error: 'Méthode non autorisée.' });
    }

    var supabaseUrl = process.env.SUPABASE_URL;
    var supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
    var stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    var resendApiKey = process.env.RESEND_API_KEY;
    var resendFrom = process.env.RESEND_FROM_EMAIL;
    var loginUrl = process.env.NOLIMI_SITE_URL || 'https://nolimi.net';

    if (!supabaseUrl || !supabaseSecretKey) {
        return json(res, 500, {
            error: 'Configuration serveur Supabase manquante (SUPABASE_URL / SUPABASE_SECRET_KEY).'
        });
    }
    if (!stripeSecretKey) {
        return json(res, 500, {
            error: 'Configuration serveur Stripe manquante (STRIPE_SECRET_KEY).'
        });
    }
    if (!resendApiKey || !resendFrom) {
        return json(res, 500, {
            error: 'Configuration Resend manquante (RESEND_API_KEY / RESEND_FROM_EMAIL).'
        });
    }

    var body = req.body || {};
    var emails = normalizeEmails(body.emails);
    var licenseCount = parseInt(body.licenseCount, 10);
    var sessionId = String(body.sessionId || '').trim();

    if (ALLOWED_COUNTS.indexOf(licenseCount) === -1) {
        licenseCount = emails.length;
    }

    if (!sessionId) {
        return json(res, 403, { error: 'Session de paiement requise.' });
    }

    var paymentCheck = await stripeVerify.verifyPaidCheckoutSession(
        stripeSecretKey,
        sessionId,
        licenseCount
    );
    if (!paymentCheck.ok) {
        return json(res, 403, { error: paymentCheck.error });
    }

    var stripeSession = paymentCheck.session || {};
    var buyer = stripeVerify.extractCheckoutBuyerInfo(stripeSession);
    var managerEmail = buyer.email;

    var validationError = validatePayload(emails, licenseCount, managerEmail);
    if (validationError) {
        return json(res, 400, { error: validationError });
    }

    var planLabel = planLabelFromCount(licenseCount);
    var adminTakesLicenseSeat = emails.indexOf(managerEmail) !== -1;
    var sharedMeta = {
        license_manager_email: managerEmail,
        license_count: licenseCount,
        license_plan: planLabel,
        team_license_emails: emails.slice(),
        has_license_seat: adminTakesLicenseSeat
    };

    var mailOpts = {
        supabaseUrl: supabaseUrl,
        supabaseSecretKey: supabaseSecretKey,
        resendApiKey: resendApiKey,
        resendFrom: resendFrom,
        loginUrl: loginUrl
    };

    var created = [];
    var errors = [];

    // 1) Compte admin (payeur Stripe) — créé ou réutilisé si déjà existant
    var adminResult = await ensureAdminAccount({
        email: managerEmail,
        accountType: 'admin',
        metadata: Object.assign({}, sharedMeta, {
            account_role: 'admin',
            has_license_seat: adminTakesLicenseSeat,
            stripe_customer_id: buyer.customerId || null,
            stripe_subscription_id: buyer.subscriptionId || null,
            stripe_checkout_session_id: sessionId,
            subscription_packs: [
                buildSubscriptionPack(buyer, licenseCount, sessionId)
            ],
            stripe_customer_ids: buyer.customerId ? [buyer.customerId] : [],
            stripe_subscription_ids: buyer.subscriptionId ? [buyer.subscriptionId] : [],
            stripe_checkout_session_ids: sessionId ? [sessionId] : []
        }),
        buyer: buyer,
        sessionId: sessionId,
        supabaseUrl: mailOpts.supabaseUrl,
        supabaseSecretKey: mailOpts.supabaseSecretKey,
        resendApiKey: mailOpts.resendApiKey,
        resendFrom: mailOpts.resendFrom,
        loginUrl: mailOpts.loginUrl
    });

    if (!adminResult.ok) {
        return json(res, 422, { error: adminResult.error, errors: [adminResult.error] });
    }
    created.push({
        email: adminResult.email,
        userId: adminResult.userId,
        emailSent: !!adminResult.emailSent,
        role: 'admin',
        reused: !!adminResult.reused,
        hasLicenseSeat: adminTakesLicenseSeat || !!(adminResult.reused && adminTakesLicenseSeat)
    });
    if (adminResult.warning) errors.push(adminResult.warning);

    // 2) Comptes licences (sauf l’email admin déjà couvert par le siège admin)
    for (var i = 0; i < emails.length; i++) {
        var email = emails[i];
        if (email === managerEmail) {
            created.push({
                email: email,
                userId: adminResult.userId,
                emailSent: false,
                role: 'license',
                seatOnAdmin: true
            });
            continue;
        }
        var result = await createAndMailUser({
            email: email,
            accountType: 'license',
            metadata: Object.assign({}, sharedMeta, {
                account_role: 'license',
                has_license_seat: false
            }),
            supabaseUrl: mailOpts.supabaseUrl,
            supabaseSecretKey: mailOpts.supabaseSecretKey,
            resendApiKey: mailOpts.resendApiKey,
            resendFrom: mailOpts.resendFrom,
            loginUrl: mailOpts.loginUrl
        });

        if (!result.ok) {
            errors.push(result.error);
            continue;
        }
        if (result.warning) errors.push(result.warning);
        created.push({
            email: result.email,
            userId: result.userId,
            emailSent: result.emailSent,
            role: 'license'
        });
    }

    if (created.length) {
        await stripeVerify.markCheckoutSessionUsed(stripeSecretKey, sessionId);
    }

    var adminReused = !!adminResult.reused;
    var licenseCreated = created.filter(function (c) { return c.role === 'license'; }).length;

    if (errors.length && licenseCreated === 0 && emails.length) {
        return json(res, 207, {
            created: created.length,
            errors: errors,
            partial: true,
            adminCreated: !adminReused,
            adminReused: adminReused
        });
    }

    if (errors.length) {
        return json(res, 207, {
            created: created.length,
            errors: errors,
            partial: true,
            adminCreated: !adminReused,
            adminReused: adminReused
        });
    }

    return json(res, 200, {
        created: created.length,
        success: true,
        adminCreated: !adminReused,
        adminReused: adminReused
    });
};
