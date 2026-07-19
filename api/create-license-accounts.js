// api/ — Endpoints serveur (licences, Stripe, emails).
// Ce fichier : après un paiement Stripe validé, crée les comptes Supabase et envoie les identifiants par mail.

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

// Contrôle : bon nombre de licences, emails valides et tous différents.
function validatePayload(emails, licenseCount) {
    if (ALLOWED_COUNTS.indexOf(licenseCount) === -1) {
        return 'Nombre de licences invalide.';
    }
    if (emails.length !== licenseCount) {
        return 'Le nombre d\'adresses mail ne correspond pas au nombre de licences.';
    }

    var seen = {};
    for (var i = 0; i < emails.length; i++) {
        var email = emails[i];
        if (!isValidEmail(email)) {
            return 'Adresse mail invalide : ' + email;
        }
        if (seen[email]) {
            return 'Chaque licence doit avoir une adresse mail différente.';
        }
        seen[email] = true;
    }
    return null; // null = tout est ok
}

// Crée un utilisateur dans Supabase Auth (API admin).
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
            email_confirm: true // compte déjà confirmé, pas besoin de lien de validation
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
        // Message plus clair si l’email existe déjà
        if (/already registered|already been registered|user already exists/i.test(String(message))) {
            return { ok: false, email: email, error: 'Cette adresse mail est déjà utilisée : ' + email };
        }
        return { ok: false, email: email, error: String(message) };
    }

    return { ok: true, email: email, userId: data && data.id ? data.id : null };
}

// --- Point d’entrée de l’API (appelé en POST) ---
module.exports = async function handler(req, res) {
    // 1) Méthode HTTP
    if (req.method !== 'POST') {
        return json(res, 405, { error: 'Méthode non autorisée.' });
    }

    // 2) Variables d’environnement nécessaires
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

    // 3) Données reçues du front
    var body = req.body || {};
    var emails = normalizeEmails(body.emails);
    var licenseCount = parseInt(body.licenseCount, 10);
    var sessionId = String(body.sessionId || '').trim();

    // Si licenseCount n’est pas 1/5/10, on prend le nombre d’emails
    if (ALLOWED_COUNTS.indexOf(licenseCount) === -1) {
        licenseCount = emails.length;
    }

    // 4) Vérification du paiement Stripe
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

    // 5) Validation des emails / licences
    var validationError = validatePayload(emails, licenseCount);
    if (validationError) {
        return json(res, 400, { error: validationError });
    }

    // 6) Création des comptes + envoi des mails
    var created = [];
    var errors = [];

    for (var i = 0; i < emails.length; i++) {
        var email = emails[i];
        var password = generatePassword(PASSWORD_LENGTH);
        var result = await createSupabaseUser(supabaseUrl, supabaseSecretKey, email, password);

        if (!result.ok) {
            errors.push(result.error);
            continue;
        }

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
    }

    // 7) Réponses selon le résultat
    // Aucun compte créé → erreur
    if (errors.length && !created.length) {
        return json(res, 422, { error: errors[0], errors: errors });
    }

    // Au moins un compte créé → on marque la session Stripe comme utilisée
    if (created.length) {
        await stripeVerify.markCheckoutSessionUsed(stripeSecretKey, sessionId);
    }

    // Succès partiel (certains ok, certains ko)
    if (errors.length) {
        return json(res, 207, {
            created: created.length,
            errors: errors,
            partial: true
        });
    }

    // Tout ok
    return json(res, 200, { created: created.length, success: true });
};
