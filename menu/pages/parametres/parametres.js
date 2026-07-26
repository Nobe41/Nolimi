// menu/pages/parametres/ — garde auth (contenu à venir).

(function () {
    var Auth = typeof NolimiAuth !== 'undefined' ? NolimiAuth : null;

    if (Auth && Auth.requireLicenseAccount) {
        Auth.requireLicenseAccount().catch(function () {});
    } else if (Auth && Auth.requireAccountSession) {
        Auth.requireAccountSession().catch(function () {});
    }
})();
