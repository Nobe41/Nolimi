// 01-saas/canvas/3d/bottle/ — met à jour la bouteille 3D (cache + orchestration).
// API publique : BottleView3D.
// Étiquettes 3D → features/render (RenderLabels), pas ici.
// Invalidation fine : géométrie / highlight / opacité / gravure.
// Reconstruction complète → BottleViewBuild.populate.

var BottleView3D = (function () {
    var sectionRingGroup = null;
    var bottleInnerGlassMesh = null;
    var lastGeometrySignature = '';
    var lastHighlightSignature = '';
    var lastOpacitySignature = '';
    var lastInvertedPunchSignature = '';
    var invertedPunchMeshEntries = [];

    function disposeThreeHierarchy(root) {
        if (!root) return;
        root.traverse(function (node) {
            if (node.geometry) node.geometry.dispose();
            if (!node.material) return;
            var mats = Array.isArray(node.material) ? node.material : [node.material];
            for (var mi = 0; mi < mats.length; mi++) {
                var mat = mats[mi];
                if (!mat) continue;
                if (mat.map && mat.map.dispose) mat.map.dispose();
                if (mat.dispose) mat.dispose();
            }
        });
    }

    function detachPersistedFromSectionRing() {
        if (!sectionRingGroup) return;
        if (bottleGroup && bottleGroup.parent === sectionRingGroup) sectionRingGroup.remove(bottleGroup);
        if (typeof RenderLabels !== 'undefined' && RenderLabels.detachFromGroup) RenderLabels.detachFromGroup(sectionRingGroup);
    }

    function replaceSectionRingGroup() {
        if (sectionRingGroup) {
            if (scene) scene.remove(sectionRingGroup);
            detachPersistedFromSectionRing();
            // Les matériaux gravure sont disposés avec le groupe : invalider le cache sinon poche invisible
            if (typeof Gravure3D !== 'undefined' && Gravure3D.invalidateScene) Gravure3D.invalidateScene();
            disposeThreeHierarchy(sectionRingGroup);
            sectionRingGroup = null;
        }
        sectionRingGroup = new THREE.Group();
        sectionRingGroup.userData.isBottleExportRoot = true;
        if (typeof RenderLabels !== 'undefined' && RenderLabels.setRootGroup) RenderLabels.setRootGroup(sectionRingGroup);
    }

    function sectionSigPart(s) {
        return [
            Math.round((s.H || 0) * 100) / 100,
            Math.round((s.a || 0) * 100) / 100,
            Math.round((s.b || 0) * 100) / 100,
            s.shape || '',
            Math.round((s.carreNiveau || 0) * 100) / 100
        ].join(',');
    }

    function buildBottleBodySignature(sectionsData) {
        if (!sectionsData || !sectionsData.sections) return '';
        var parts = [];
        for (var i = 0; i < sectionsData.sections.length; i++) {
            parts.push(sectionSigPart(sectionsData.sections[i]));
        }
        if (sectionsData.edgeTypes && sectionsData.edgeTypes.length) parts.push('e:' + sectionsData.edgeTypes.join(','));
        if (sectionsData.rhos && sectionsData.rhos.length) {
            var rr = [];
            for (var r = 0; r < sectionsData.rhos.length; r++) rr.push(Math.round((sectionsData.rhos[r] || 0) * 100) / 100);
            parts.push('r:' + rr.join(','));
        }
        return parts.join('|');
    }

    function buildSectionsSliceSignature(sections) {
        if (!sections || !sections.length) return '';
        var parts = [];
        for (var i = 0; i < sections.length; i++) {
            parts.push(sectionSigPart(sections[i]));
        }
        return parts.join('|');
    }

    function buildGeometrySignature(sectionsData, piqSections, bagueSections, thicknessNow, bottleTessOverride) {
        var piqData = BottleViewPanel.buildSectionsDataBundle(piqSections.slice(), 'rp');
        var bagueData = BottleViewPanel.buildSectionsDataBundle(bagueSections.slice(), 'rb');
        return [
            buildBottleBodySignature(sectionsData),
            'piq:' + buildSectionsSliceSignature(piqSections),
            'bag:' + buildSectionsSliceSignature(bagueSections),
            'rpd:' + buildBottleBodySignature(piqData),
            'rbd:' + buildBottleBodySignature(bagueData),
            'rcb:' + (function () {
                var sList = sectionsData && sectionsData.sections ? sectionsData.sections : [];
                var b0 = bagueSections && bagueSections[0];
                if (!sList.length || !b0 || !BottleViewPanel.buildColToBagueBridgeData) return '';
                var sPrevB = sList.length >= 2 ? sList[sList.length - 2] : null;
                var b1 = bagueSections.length >= 2 ? bagueSections[1] : null;
                return buildBottleBodySignature(BottleViewPanel.buildColToBagueBridgeData(sList[sList.length - 1], b0, sPrevB, b1));
            })(),
            'rp3:' + Math.round(BottleViewPanel.getPanelValue('rp3-h', 30) * 100) / 100,
            'th:' + Math.round(thicknessNow * 100) / 100,
            'rm:' + ((typeof RenderMaterials !== 'undefined' && RenderMaterials.getMaterialMode) ? RenderMaterials.getMaterialMode() : ((typeof BottleMaterials !== 'undefined' && BottleMaterials.getRenderMaterialMode) ? BottleMaterials.getRenderMaterialMode() : 'base')),
            'tess:' + (bottleTessOverride ? (bottleTessOverride.nTheta + 'x' + bottleTessOverride.meridianRes) : 'def')
        ].join('||');
    }

    function buildHighlightSignature() {
        var w = typeof window !== 'undefined' ? window : {};
        var sh = w.sectionHighlightActive || {};
        var sa = w.sectionHighlightHover || {};
        var la = w.liaisonHighlightActive || {};
        var lh = w.liaisonHighlightHover || {};
        var d = w.displayOptions || {};
        return [
            'sa:', sh.panelId || '', '|', sh.index || 0,
            'sh:', sa.panelId || '', '|', sa.index || 0,
            'la:', la.panelId || '', '|', la.index || 0,
            'lh:', lh.panelId || '', '|', lh.index || 0,
            'asi:', typeof w.activeSectionIndex !== 'undefined' ? w.activeSectionIndex : 0,
            'hsi:', typeof w.hoveredSectionIndex !== 'undefined' ? w.hoveredSectionIndex : 0,
            'rings:', d.showSectionRings !== false,
            'mold:', d.showMoldJoint !== false
        ].join('');
    }

    function buildVisualOpacitySignature() {
        return (typeof Bottle3DData !== 'undefined' && Bottle3DData.isPiqureViewActive && Bottle3DData.isPiqureViewActive())
            ? 'piq'
            : 'main';
    }

    function clearInvertedPunchMeshEntries() {
        invertedPunchMeshEntries = [];
    }

    function trackInvertedPunchMesh(mesh, rebuildFn) {
        if (!mesh || typeof rebuildFn !== 'function') return;
        invertedPunchMeshEntries.push({ mesh: mesh, rebuild: rebuildFn });
    }

    function swapMeshGeometry(mesh, freshMesh, sectionsData, shouldPunch) {
        if (!mesh || !freshMesh || !freshMesh.geometry) {
            if (freshMesh) disposeThreeHierarchy(freshMesh);
            return;
        }
        if (mesh.geometry) mesh.geometry.dispose();
        mesh.geometry = freshMesh.geometry;
        freshMesh.geometry = new THREE.BufferGeometry();
        disposeThreeHierarchy(freshMesh);
        if (shouldPunch) punchInvertedEngravingsOnMesh(mesh, sectionsData);
    }

    function reapplyInvertedEngravingPunches(sectionsData, thicknessNow, bottleTessOverride) {
        if (typeof Gravure3D === 'undefined' || typeof BottleMesh3D === 'undefined') return;
        var hasInverted = Gravure3D.hasInvertedEngravings && Gravure3D.hasInvertedEngravings(sectionsData);

        if (bottleGroup) {
            BottleMesh3D.updateBottleMesh(bottleGroup, sectionsData, bottleTessOverride);
            if (hasInverted && Gravure3D.applyInvertedEngravingsToBottleMesh) {
                Gravure3D.applyInvertedEngravingsToBottleMesh(bottleGroup, sectionsData);
            }
        }

        if (bottleInnerGlassMesh && typeof THREE !== 'undefined') {
            var innerSectionsData = (typeof InterieurMath !== 'undefined' && InterieurMath.buildInteriorSectionsDataFromThickness)
                ? InterieurMath.buildInteriorSectionsDataFromThickness(sectionsData, thicknessNow, thicknessNow)
                : sectionsData;
            var freshInner = BottleMesh3D.createBottleMesh(innerSectionsData, bottleInnerGlassMesh.material, bottleTessOverride);
            if (freshInner) {
                swapMeshGeometry(bottleInnerGlassMesh, freshInner, sectionsData, hasInverted);
            }
        }

        for (var pi = 0; pi < invertedPunchMeshEntries.length; pi++) {
            var entry = invertedPunchMeshEntries[pi];
            if (!entry.mesh || !entry.mesh.parent) continue;
            var fresh = entry.rebuild();
            swapMeshGeometry(entry.mesh, fresh, sectionsData, hasInverted);
        }
    }

    function getInvertedPunchSignature(sectionsData) {
        return (typeof Gravure3D !== 'undefined' && Gravure3D.buildInvertedEngravingPunchSignature)
            ? Gravure3D.buildInvertedEngravingPunchSignature(sectionsData)
            : '';
    }

    function punchInvertedEngravingsOnMesh(mesh, sectionsData) {
        if (!mesh || typeof Gravure3D === 'undefined' || !Gravure3D.punchHolesForInvertedEngravings) return;
        Gravure3D.punchHolesForInvertedEngravings(mesh, sectionsData);
    }

    function refreshGravureScene(sectionsData) {
        if (typeof Gravure3D !== 'undefined' && Gravure3D.updateScene && scene && sectionsData) {
            Gravure3D.updateScene(scene, sectionsData, sectionRingGroup);
        }
    }

    function updateView() {
        if (!scene || typeof BottleMesh3D === 'undefined') return;

        var sectionsData = BottleViewPanel.getSectionsDataFromPanel();
        var sections = sectionsData.sections;
        var piqSections = BottleViewPanel.collectPiqureSectionsFromPanel();
        var bagueSections = BottleViewPanel.collectBagueSectionsFromPanel();
        var thicknessNow = (typeof InterieurMath !== 'undefined' && InterieurMath.getThicknessMm)
            ? InterieurMath.getThicknessMm()
            : 3.5;

        var bottleTessOverride = (typeof Gravure3D !== 'undefined' && Gravure3D.getBottleTessellationOverrides)
            ? Gravure3D.getBottleTessellationOverrides(sectionsData)
            : null;

        var geomSig = buildGeometrySignature(sectionsData, piqSections, bagueSections, thicknessNow, bottleTessOverride);
        var highlightSig = buildHighlightSignature();
        var opacitySig = buildVisualOpacitySignature();
        var invertedPunchSig = getInvertedPunchSignature(sectionsData);

        if (sectionRingGroup
            && geomSig === lastGeometrySignature
            && highlightSig === lastHighlightSignature
            && opacitySig === lastOpacitySignature) {
            if (invertedPunchSig !== lastInvertedPunchSignature) {
                reapplyInvertedEngravingPunches(sectionsData, thicknessNow, bottleTessOverride);
                lastInvertedPunchSignature = invertedPunchSig;
            }
            refreshGravureScene(sectionsData);
            return;
        }

        if (sectionRingGroup && geomSig === lastGeometrySignature && highlightSig !== lastHighlightSignature) {
            BottleViewHighlight.removeOverlayChildren(sectionRingGroup);
            BottleViewHighlight.buildOverlayContent(sectionRingGroup, sectionsData, sections, piqSections, bagueSections);
            BottleViewGeometry.applyViewOpacity(sectionRingGroup);
            refreshGravureScene(sectionsData);
            lastHighlightSignature = highlightSig;
            lastOpacitySignature = opacitySig;
            return;
        }

        if (sectionRingGroup && geomSig === lastGeometrySignature && opacitySig !== lastOpacitySignature) {
            BottleViewGeometry.applyViewOpacity(sectionRingGroup);
            if (typeof Gravure3D !== 'undefined' && Gravure3D.refreshEngravingOpacity) {
                Gravure3D.refreshEngravingOpacity();
            }
            lastOpacitySignature = opacitySig;
            return;
        }

        if (typeof Validator !== 'undefined' && Validator.applyAllUserConstraints) Validator.applyAllUserConstraints();

        replaceSectionRingGroup();
        clearInvertedPunchMeshEntries();
        lastGeometrySignature = geomSig;
        lastHighlightSignature = highlightSig;
        lastOpacitySignature = opacitySig;
        lastInvertedPunchSignature = invertedPunchSig;

        var built = BottleViewBuild.populate(sectionRingGroup, {
            sectionsData: sectionsData,
            sections: sections,
            piqSections: piqSections,
            bagueSections: bagueSections,
            thicknessNow: thicknessNow,
            bottleTessOverride: bottleTessOverride,
            bottleGroup: bottleGroup,
            bottleInnerGlassMesh: bottleInnerGlassMesh,
            punchInvertedEngravingsOnMesh: punchInvertedEngravingsOnMesh,
            trackInvertedPunchMesh: trackInvertedPunchMesh
        });
        bottleGroup = built.bottleGroup;
        bottleInnerGlassMesh = built.bottleInnerGlassMesh;

        if (typeof RenderLabels !== 'undefined' && RenderLabels.updateLabelMeshes) RenderLabels.updateLabelMeshes(sectionsData);

        if (typeof RenderFeature !== 'undefined' && RenderFeature.updateLabelHeightLimits) {
            RenderFeature.updateLabelHeightLimits({
                clampValues: false,
                skipSliderResync: typeof window !== 'undefined' && !!window._renderLabelSliderDragging
            });
        }

        BottleViewHighlight.buildOverlayContent(sectionRingGroup, sectionsData, sections, piqSections, bagueSections);
        BottleViewGeometry.applyViewOpacity(sectionRingGroup);
        scene.add(sectionRingGroup);

        if (typeof CalculeVolumeFeature !== 'undefined' && CalculeVolumeFeature && CalculeVolumeFeature.updateFromSectionsData) {
            CalculeVolumeFeature.updateFromSectionsData(sectionsData);
        }

        refreshGravureScene(sectionsData);
    }

    function dispose() {
        if (sectionRingGroup && scene) scene.remove(sectionRingGroup);
        detachPersistedFromSectionRing();
        if (typeof Gravure3D !== 'undefined' && Gravure3D.invalidateScene) Gravure3D.invalidateScene();
        disposeThreeHierarchy(sectionRingGroup);
        if (bottleGroup) {
            disposeThreeHierarchy(bottleGroup);
            bottleGroup = null;
        }
        if (bottleInnerGlassMesh) {
            disposeThreeHierarchy(bottleInnerGlassMesh);
            bottleInnerGlassMesh = null;
        }
        if (typeof RenderLabels !== 'undefined' && RenderLabels.disposeAllLabelMeshes) RenderLabels.disposeAllLabelMeshes();
        sectionRingGroup = null;
        if (typeof RenderLabels !== 'undefined' && RenderLabels.setRootGroup) RenderLabels.setRootGroup(null);
        clearInvertedPunchMeshEntries();
        lastGeometrySignature = '';
        lastHighlightSignature = '';
        lastOpacitySignature = '';
        lastInvertedPunchSignature = '';
    }

    BottleViewHighlight.setDisposeHierarchy(disposeThreeHierarchy);
    if (typeof RenderLabels !== 'undefined' && RenderLabels.setBodySignatureBuilder) RenderLabels.setBodySignatureBuilder(buildBottleBodySignature);

    return {
        updateView: updateView,
        getProfilePointsFor2D: BottleViewExport.getProfilePointsFor2D,
        getPiqureProfilePointsFor2D: BottleViewExport.getPiqureProfilePointsFor2D,
        getBagueProfilePointsFor2D: BottleViewExport.getBagueProfilePointsFor2D,
        MOLD_JOINT_PROFILE_THETA: BottleViewGeometry.MOLD_JOINT_PROFILE_THETA,
        applyViewOpacity: BottleViewGeometry.applyViewOpacity,
        buildStlExportMesh: function () { return BottleViewExport.buildStlExportMesh(sectionRingGroup); },
        dispose: dispose
    };
})();

window.getBottleProfileFromData = function () {
    return (typeof BottleView3D !== 'undefined' && BottleView3D.getProfilePointsFor2D)
        ? BottleView3D.getProfilePointsFor2D()
        : [];
};
