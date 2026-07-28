// saas/features/realtime/state.js
// Mémoire vive de la session partagée Supabase (une seule source de vérité locale).
// Stocke : id session, connexion, rôle hôte/invité, nombre de participants.
// Timestamps savedAt : éviter d’écraser le projet avec une version plus ancienne.

var RealtimeState = (function () {
    var sessionId = null;
    var connected = false;
    var isHost = false;
    var isSessionGuest = false;
    var peerCount = 0;
    // Horodatage du dernier payload local / distant (sync projet)
    var lastLocalSavedAt = 0;
    var lastRemoteSavedAt = 0;

    function reset() {
        sessionId = null;
        connected = false;
        isHost = false;
        isSessionGuest = false;
        peerCount = 0;
        lastLocalSavedAt = 0;
        lastRemoteSavedAt = 0;
    }

    return {
        getSessionId: function () { return sessionId; },
        setSessionId: function (id) { sessionId = id; },
        isConnected: function () { return connected; },
        setConnected: function (val) { connected = !!val; },
        isHost: function () { return isHost; },
        setHost: function (val) { isHost = !!val; },
        isSessionGuest: function () { return isSessionGuest; },
        setSessionGuest: function (val) { isSessionGuest = !!val; },
        getPeerCount: function () { return peerCount; },
        setPeerCount: function (n) { peerCount = n; },
        getLastLocalSavedAt: function () { return lastLocalSavedAt; },
        setLastLocalSavedAt: function (n) { lastLocalSavedAt = n; },
        getLastRemoteSavedAt: function () { return lastRemoteSavedAt; },
        setLastRemoteSavedAt: function (n) { lastRemoteSavedAt = n; },
        reset: reset
    };
})();
