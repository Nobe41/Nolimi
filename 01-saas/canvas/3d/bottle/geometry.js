// 01-saas/canvas/3d/bottle/ — façade géométrie (compatibilité API).
// Délègue à : BottleViewEdges, BottleViewSheets, BottleViewAppearance.
// Charger edges.js + sheets.js + appearance.js avant ce fichier.

var BottleViewGeometry = (function () {
    function pick(mod, key, fallback) {
        return (mod && mod[key] !== undefined) ? mod[key] : fallback;
    }

    return {
        MOLD_JOINT_PROFILE_THETA: pick(typeof BottleViewEdges !== 'undefined' ? BottleViewEdges : null, 'MOLD_JOINT_PROFILE_THETA', 0),
        N_SEGMENTS: pick(typeof BottleViewEdges !== 'undefined' ? BottleViewEdges : null, 'N_SEGMENTS',
            pick(typeof BottleViewSheets !== 'undefined' ? BottleViewSheets : null, 'N_SEGMENTS', 128)),
        MERIDIAN_RESOLUTION: pick(typeof BottleViewEdges !== 'undefined' ? BottleViewEdges : null, 'MERIDIAN_RESOLUTION', 64),

        profilePointsFromSectionsData: function () {
            return BottleViewEdges.profilePointsFromSectionsData.apply(BottleViewEdges, arguments);
        },
        buildSectionRingLine: function () { return BottleViewEdges.buildSectionRingLine.apply(BottleViewEdges, arguments); },
        buildMoldJointLine: function () { return BottleViewEdges.buildMoldJointLine.apply(BottleViewEdges, arguments); },
        addSectionRing: function () { return BottleViewEdges.addSectionRing.apply(BottleViewEdges, arguments); },
        syncEdgeLineResolutions: function () { return BottleViewEdges.syncEdgeLineResolutions.apply(BottleViewEdges, arguments); },

        buildLiaisonRevolvedMesh: function () { return BottleViewSheets.buildLiaisonRevolvedMesh.apply(BottleViewSheets, arguments); },
        buildPiqurePiedFeuille: function () { return BottleViewSheets.buildPiqurePiedFeuille.apply(BottleViewSheets, arguments); },
        buildPiqureBasHautFeuille: function () { return BottleViewSheets.buildPiqureBasHautFeuille.apply(BottleViewSheets, arguments); },
        buildNeckToBagueFeuille: function () { return BottleViewSheets.buildNeckToBagueFeuille.apply(BottleViewSheets, arguments); },
        buildPiqureFeuilleVersAxe: function () { return BottleViewSheets.buildPiqureFeuilleVersAxe.apply(BottleViewSheets, arguments); },
        buildRuledSurfaceStrip: function () { return BottleViewSheets.buildRuledSurfaceStrip.apply(BottleViewSheets, arguments); },

        applyViewOpacity: function () { return BottleViewAppearance.applyViewOpacity.apply(BottleViewAppearance, arguments); },
        enhanceInnerPiqureVisibility: function () { return BottleViewAppearance.enhanceInnerPiqureVisibility.apply(BottleViewAppearance, arguments); },
        getInnerShellMaterial: function () { return BottleViewAppearance.getInnerShellMaterial.apply(BottleViewAppearance, arguments); },
        enableMeshShadows: function () { return BottleViewAppearance.enableMeshShadows.apply(BottleViewAppearance, arguments); },
        isGlassRenderMode: function () { return BottleViewAppearance.isGlassRenderMode.apply(BottleViewAppearance, arguments); }
    };
})();
