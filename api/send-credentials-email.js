// api/ — Endpoints serveur (licences, Stripe, emails).
// Ce fichier : construit et envoie l’email d’identifiants via Resend (rien d’autre).

// Sécurise le texte avant de l’injecter dans le HTML du mail.
function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Contenu HTML du mail d’accès (lien, email, mot de passe).
function buildCredentialsEmailHtml(email, password, siteUrl) {
    var safeEmail = escapeHtml(email);
    var safePassword = escapeHtml(password);
    var safeSiteUrl = escapeHtml(siteUrl);
    var safeSiteHref = escapeHtml(siteUrl.replace(/\/$/, ''));

    return [
        '<div style="font-family:sans-serif;line-height:1.65;color:#333;max-width:560px;">',
        '<h1 style="font-size:1.35rem;font-weight:700;margin:0 0 1.25rem;color:#0a0a0b;">Accès Nolimi</h1>',
        '<p style="margin:0 0 1rem;">Bonjour,</p>',
        '<p style="margin:0 0 1.25rem;">Votre espace de travail sur la plateforme Nolimi est désormais actif. Vous trouverez ci-dessous vos identifiants de connexion personnels :</p>',
        '<ul style="margin:0 0 1.5rem;padding-left:1.25rem;">',
        '<li style="margin-bottom:0.65rem;"><strong>Lien d\'accès :</strong> <a href="', safeSiteHref, '" style="color:#5cb3ff;text-decoration:none;">', safeSiteUrl, '</a></li>',
        '<li style="margin-bottom:0.65rem;"><strong>Identifiant :</strong> <code style="font-family:monospace;background:#f4f4f5;padding:0.15rem 0.35rem;border-radius:4px;">', safeEmail, '</code></li>',
        '<li style="margin-bottom:0.65rem;"><strong>Mot de passe (Clé unique) :</strong> <code style="font-family:monospace;background:#f4f4f5;padding:0.15rem 0.35rem;border-radius:4px;">', safePassword, '</code></li>',
        '</ul>',
        '<p style="margin:0 0 0.5rem;font-weight:700;">⚠️ Sécurité et Confidentialité</p>',
        '<p style="margin:0 0 0.75rem;"><strong>Important :</strong> Ce mot de passe est unique. Veuillez conserver cet e-mail précieusement pour vos prochaines connexions.</p>',
        '<p style="margin:0 0 1.25rem;"><strong>Usage strictement personnel :</strong> Ces accès sont confidentiels, anonymes et rattachés à votre usage exclusif. Ils ne doivent en aucun cas être partagés ou communiqués à des tiers.</p>',
        '<p style="margin:0 0 1.25rem;">Pour tout retour d\'expérience ou besoin d\'assistance technique, vous pouvez nous contacter à l\'adresse suivante : <a href="mailto:hello.nolimi+contact@gmail.com" style="color:#5cb3ff;text-decoration:none;">hello.nolimi+contact@gmail.com</a></p>',
        '<p style="margin:0;">Cordialement,<br><strong>L\'équipe Nolimi</strong></p>',
        '</div>'
    ].join('');
}

// Envoie le mail d’identifiants via l’API Resend.
async function sendCredentialsEmail(options) {
    var apiKey = options.apiKey;
    var from = options.from;
    var to = options.to;
    var password = options.password;
    var siteUrl = options.siteUrl;

    if (!apiKey || !from) {
        return { ok: false, error: 'Configuration Resend manquante (RESEND_API_KEY / RESEND_FROM_EMAIL).' };
    }

    var response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: from,
            to: [to],
            subject: 'Accès Nolimi',
            html: buildCredentialsEmailHtml(to, password, siteUrl)
        })
    });

    var data = null;
    try {
        data = await response.json();
    } catch (e) {
        data = null;
    }

    if (!response.ok) {
        var message = (data && (data.message || data.error)) || 'Erreur Resend';
        return { ok: false, error: String(message) };
    }

    return { ok: true, id: data && data.id ? data.id : null };
}

module.exports = {
    sendCredentialsEmail: sendCredentialsEmail
};
