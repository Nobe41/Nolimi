// Copier ce fichier en supabase.config.js (ou supabase.local.js) et remplir vos valeurs Supabase.
// Rejoindre une session partagée sans compte (invité via lien) :
// 1. Authentication → Providers → Anonymous → « Enable Anonymous sign-ins »
// 2. Authentication → Providers → Email → « Allow new users to sign up » (requis : l’invité anonyme compte comme inscription)
window.NOLIMI_SUPABASE_CONFIG = {
    url: 'https://VOTRE_PROJECT_REF.supabase.co',
    anonKey: 'VOTRE_CLE_ANON_PUBLIQUE'
};
