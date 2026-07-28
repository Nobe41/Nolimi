// 01-saas/config/ — credentials Supabase (navigateur).
// Clé anon = publique ; la sécurité vient du RLS. Aucune logique ici.
// Consommé par : lib/auth.js (NolimiAuth). Ne pas y mettre de secret service_role.

var NolimiSupabaseConfig = (function () {
    return {
        url: 'https://vdvziuzlpnkmmnesonht.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkdnppdXpscG5rbW1uZXNvbmh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMjgyODcsImV4cCI6MjA5MDYwNDI4N30.Rmin5jeXEqriPaIldpgJAbzMBKo17qugVIQSPCyhihE'
    };
})();

// Contrat historique (auth + pages connexion)
window.NOLIMI_SUPABASE_CONFIG = NolimiSupabaseConfig;
