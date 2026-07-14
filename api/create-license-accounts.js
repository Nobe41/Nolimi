const crypto = require('crypto');
const stripeVerify = require('./stripe-verify');
const resendMail = require('./send-credentials-email');

const ALLOWED_COUNTS = [1, 5, 10];
const PASSWORD_LENGTH = 14;
const PASSWORD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generatePassword(length) {
    var bytes = crypto.randomBytes(length);
    var password = '';
    for (var i = 0; i < length; i++) {
        password += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
    }
    return password;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function normalizeEmails(emails) {
    if (!Array.isArray(emails)) return [];
    return emails.map(function (email) {
        return String(email || '').trim().toLowerCase();
    }).filter(Boolean);
}

function validatePayload(emails, licenseCount) {
    if (ALLOWED_COUNTS.indexOf(licenseCount) === -1) {
        return 'Nombre de licences invalide.';
    }
    if (emails.length !== licenseCount) {
        return 'Le nombre d\'adresses mail ne correspond pas au nombre de licences.';
    }
    for (var i = 0; i < emails.length; i++) {
        if (!isValidEmail(emails[i])) {
            return 'Adresse mail invalide : ' + emails[i];
        }
    }
    var unique = {};
    for (var j = 0; j < emails.length; j++) {
        if (unique[emails[j]]) {
            return 'Chaque licence doit avoir une adresse mail différente.';
        }
        unique[emails[j]] = true;
    }
    return null;
}

async function createSupabaseUser(supabaseUrl, secretKey, email, password) {
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
            email_confirm: true
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

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Méthode non autorisée.' }));
        return;
    }

    var supabaseUrl = process.env.SUPABASE_URL;
    var supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
    var stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    var resendApiKey = process.env.RESEND_API_KEY;
    var resendFrom = process.env.RESEND_FROM_EMAIL;
    var loginUrl = process.env.NOLIMI_SITE_URL || 'https://nolimi.net';

    if (!supabaseUrl || !supabaseSecretKey) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            error: 'Configuration serveur Supabase manquante (SUPABASE_URL / SUPABASE_SECRET_KEY).'
        }));
        return;
    }

    if (!stripeSecretKey) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            error: 'Configuration serveur Stripe manquante (STRIPE_SECRET_KEY).'
        }));
        return;
    }

    if (!resendApiKey || !resendFrom) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            error: 'Configuration Resend manquante (RESEND_API_KEY / RESEND_FROM_EMAIL).'
        }));
        return;
    }

    var body = req.body || {};
    var emails = normalizeEmails(body.emails);
    var licenseCount = parseInt(body.licenseCount, 10);
    var sessionId = String(body.sessionId || '').trim();

    if (ALLOWED_COUNTS.indexOf(licenseCount) === -1) {
        licenseCount = emails.length;
    }

    if (!sessionId) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Session de paiement requise.' }));
        return;
    }

    var paymentCheck = await stripeVerify.verifyPaidCheckoutSession(
        stripeSecretKey,
        sessionId,
        licenseCount
    );

    if (!paymentCheck.ok) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: paymentCheck.error }));
        return;
    }

    var validationError = validatePayload(emails, licenseCount);
    if (validationError) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: validationError }));
        return;
    }

    var created = [];
    var errors = [];

    for (var i = 0; i < emails.length; i++) {
        var email = emails[i];
        var password = generatePassword(PASSWORD_LENGTH);
        var result = await createSupabaseUser(supabaseUrl, supabaseSecretKey, email, password);

        if (result.ok) {
            var mailResult = await resendMail.sendCredentialsEmail({
                apiKey: resendApiKey,
                from: resendFrom,
                to: email,
                password: password,
                siteUrl: loginUrl
            });

            if (!mailResult.ok) {
                errors.push('Compte créé pour ' + email + ', mais l\'envoi du mail a échoué : ' + mailResult.error);
            }

            created.push({ email: result.email, userId: result.userId, emailSent: mailResult.ok });
        } else {
            errors.push(result.error);
        }
    }

    if (errors.length && !created.length) {
        res.statusCode = 422;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: errors[0], errors: errors }));
        return;
    }

    if (created.length) {
        await stripeVerify.markCheckoutSessionUsed(stripeSecretKey, sessionId);
    }

    if (errors.length) {
        res.statusCode = 207;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            created: created.length,
            errors: errors,
            partial: true
        }));
        return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ created: created.length, success: true }));
};
