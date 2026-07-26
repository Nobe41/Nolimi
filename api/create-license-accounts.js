// api/ — Endpoints serveur (licences, Stripe, emails).
// Ce fichier : après un paiement Stripe validé, crée le compte admin + les licences et envoie les identifiants.

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

// Contrôle : bon nombre de licences, emails valides, différents, ≠ admin.
function validatePayload(emails, licenseCount, adminEmail) {
    if (ALLOWED_COUNTS.indexOf(licenseCount) === -1) {
        return 'Nombre de licences invalide.';
    }
    if (emails.length !== licenseCount) {
        return 'Le nombre d\'adresses mail ne correspond pas au nombre de licences.';
    }
    if (!adminEmail || !isValidEmail(adminEmail)) {
        return 'Email du compte admin introuvable.';
    }

    var seen = {};
    for (var i = 0; i < emails.length; i++) {
        var email = emails[i];
        if (!isValidEmail(email)) {
            return 'Adresse mail invalide : ' + email;
        }
        if (email === adminEmail) {
            return 'Les licences doivent utiliser des adresses différentes du compte admin.';
        }
        if (seen[email]) {
            return 'Chaque licence doit avoir une adresse mail différente.';
        }
        seen[email] = true;
    }
    return null; // null = tout est ok
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
            return { ok: false, email: email, error: 'Cette adresse mail est déjà utilisée : ' + email };
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
        return { ok: false, error: result.error };
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

    var planLabel = licenseCount === 1 ? '1 licence' : licenseCount + ' licences';
    var sharedMeta = {
        license_manager_email: managerEmail,
        license_count: licenseCount,
        license_plan: planLabel,
        team_license_emails: emails.slice()
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

    // 1) Compte admin (payeur Stripe)
    var adminResult = await createAndMailUser({
        email: managerEmail,
        accountType: 'admin',
        metadata: Object.assign({}, sharedMeta, {
            account_role: 'admin',
            stripe_customer_id: buyer.customerId || null,
            stripe_subscription_id: buyer.subscriptionId || null,
            stripe_checkout_session_id: sessionId
        }),
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
        emailSent: adminResult.emailSent,
        role: 'admin'
    });
    if (adminResult.warning) errors.push(adminResult.warning);

    // 2) Comptes licences
    for (var i = 0; i < emails.length; i++) {
        var email = emails[i];
        var result = await createAndMailUser({
            email: email,
            accountType: 'license',
            metadata: Object.assign({}, sharedMeta, {
                account_role: 'license'
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

    if (errors.length && created.length <= 1 && created[0] && created[0].role === 'admin' && emails.length) {
        // Admin ok mais aucune licence → partiel
        return json(res, 207, {
            created: created.length,
            errors: errors,
            partial: true,
            adminCreated: true
        });
    }

    if (errors.length) {
        return json(res, 207, {
            created: created.length,
            errors: errors,
            partial: true,
            adminCreated: true
        });
    }

    return json(res, 200, {
        created: created.length,
        success: true,
        adminCreated: true
    });
};
