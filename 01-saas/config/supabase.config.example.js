// 01-saas/config/ — modèle à copier en supabase.config.js (fichier réellement chargé).
// Remplir url + anonKey : Supabase → Project Settings → API.
// Aucune logique ici ; même forme que supabase.config.js.
//
// Sessions invitées (lien partagé sans compte) :
// 1. Authentication → Providers → Anonymous → Enable Anonymous sign-ins
// 2. Authentication → Providers → Email → Allow new users to sign up
//
// Optionnel : supabase.local.js (gitignoré) peut réassigner window.NOLIMI_SUPABASE_CONFIG
// si vous l’ajoutez dans app.html juste après supabase.config.js.

var NolimiSupabaseConfig = (function () {
    return {
        url: 'https://VOTRE_PROJECT_REF.supabase.co',
        anonKey: 'VOTRE_CLE_ANON_PUBLIQUE'
    };
})();

window.NOLIMI_SUPABASE_CONFIG = NolimiSupabaseConfig;
