// saas/features/rattachement/function.js
// LiaisonsFeature = façade des raccords entre sections (ligne / rayon / courbeS / spline).
// Délègue à RattachementMath ; consommé par ProfileMath.buildExteriorProfile.
// Alias RattachementsFeature pour compatibilité. UI des cartes → features/sections.

var RattachementsFeature = (function () {
    function buildProfileCurves(profilePoints, data) {
        if (typeof RattachementMath === 'undefined' || !RattachementMath.buildProfileCurves) return [];
        var points = Array.isArray(profilePoints) ? profilePoints : [];
        var payload = data || {};
        if (!Array.isArray(payload.edgeTypes)) payload.edgeTypes = [];
        if (!Array.isArray(payload.rhos)) payload.rhos = [];
        return RattachementMath.buildProfileCurves(points, payload);
    }

    return {
        buildProfileCurves: buildProfileCurves
    };
})();

// Nom public utilisé par ProfileMath et le reste du code
var LiaisonsFeature = RattachementsFeature;
