// 01-saas/features/realtime/rules.js
// Constantes du module « session partagée » (collaboration en temps réel).
// Délais de debounce, couleurs des curseurs, préfixe canal Supabase, IDs DOM du menu.
// Aucune logique ici — seulement des réglages réutilisés par function / cursor / view.

var RealtimeRules = (function () {
    return {
        DEBOUNCE_MS: 800,
        CURSOR_THROTTLE_MS: 40,
        CURSOR_STALE_MS: 5000,
        HOST_WAIT_MS: 4000,
        VIEW_THROTTLE_MS: 120,
        COPY_FEEDBACK_MS: 1500,
        CHANNEL_PREFIX: 'nolimi-session:',
        URL_PARAM: 'session',
        CURSOR_COLORS: ['#e53935', '#8e24aa', '#1e88e5', '#43a047', '#fb8c00', '#00acc1'],
        IDS: {
            btnMenu: 'btn-realtime-menu',
            dropdown: 'realtime-dropdown',
            idlePanel: 'realtime-idle',
            activePanel: 'realtime-active',
            btnCreate: 'btn-realtime-create',
            joinInput: 'realtime-join-input',
            btnJoin: 'btn-realtime-join',
            linkInput: 'realtime-link-input',
            btnCopy: 'btn-realtime-copy',
            statusText: 'realtime-status-text',
            peersText: 'realtime-peers-text',
            btnLeave: 'btn-realtime-leave'
        }
    };
})();
