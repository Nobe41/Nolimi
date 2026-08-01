// 01-saas/canvas/3d/bottle/ — reconstruction meshes (corps, piqûre, bague, intérieur).
// Appelé uniquement par BottleView3D quand la géométrie change.
// Globals persistés : bottleGroup (corps), ctx.bottleInnerGlassMesh.

var BottleViewBuild = (function () {
    // Remplit sectionRingGroup ; ctx porte sections + callbacks punch/track + meshes persistés.
    function populate(sectionRingGroup, ctx) {
        var sectionsData = ctx.sectionsData;
        var sections = ctx.sections;
        var piqSections = ctx.piqSections;
        var bagueSections = ctx.bagueSections;
        var thicknessNow = ctx.thicknessNow;
        var bottleTessOverride = ctx.bottleTessOverride;
        var bottleGroup = ctx.bottleGroup;
        var bottleInnerGlassMesh = ctx.bottleInnerGlassMesh;
        var punchInvertedEngravingsOnMesh = ctx.punchInvertedEngravingsOnMesh;
        var trackInvertedPunchMesh = ctx.trackInvertedPunchMesh;

        // --- Corps ---
        if (!bottleGroup) {
            var baseMat = (typeof BottleMaterials !== 'undefined' && BottleMaterials.getBottleBodyMaterial)
                ? BottleMaterials.getBottleBodyMaterial()
                : null;
            bottleGroup = BottleMesh3D.createBottleMesh(sectionsData, baseMat, bottleTessOverride);
            if (bottleGroup) {
                bottleGroup.userData = bottleGroup.userData || {};
                bottleGroup.userData.materialMode = (typeof BottleMaterials !== 'undefined' && BottleMaterials.getRenderMaterialMode)
                    ? BottleMaterials.getRenderMaterialMode()
                    : 'base';
            }
        } else {
            if (typeof BottleMaterials !== 'undefined' && BottleMaterials.getRenderMaterialMode && BottleMaterials.getBottleBodyMaterial) {
                var targetMode = BottleMaterials.getRenderMaterialMode();
                if (!bottleGroup.userData || bottleGroup.userData.materialMode !== targetMode) {
                    if (bottleGroup.material && bottleGroup.material.dispose) bottleGroup.material.dispose();
                    bottleGroup.material = BottleMaterials.getBottleBodyMaterial();
                    bottleGroup.userData = bottleGroup.userData || {};
                    bottleGroup.userData.materialMode = targetMode;
                }
            }
            BottleMesh3D.updateBottleMesh(bottleGroup, sectionsData, bottleTessOverride);
        }
        if (bottleGroup && typeof Gravure3D !== 'undefined' && Gravure3D.applyInvertedEngravingsToBottleMesh) {
            Gravure3D.applyInvertedEngravingsToBottleMesh(bottleGroup, sectionsData);
        }
        if (bottleGroup) {
            bottleGroup.userData.isPiqure = false;
            if (BottleViewGeometry.isGlassRenderMode()) bottleGroup.renderOrder = 1;
            BottleViewGeometry.enableMeshShadows(bottleGroup);
            sectionRingGroup.add(bottleGroup);
        }

        // Peau intérieure (épaisseur visible)
        if (bottleInnerGlassMesh) {
            if (bottleInnerGlassMesh.geometry) bottleInnerGlassMesh.geometry.dispose();
            if (bottleInnerGlassMesh.material && bottleInnerGlassMesh.material.dispose) bottleInnerGlassMesh.material.dispose();
            bottleInnerGlassMesh = null;
        }
        if (bottleGroup && bottleGroup.geometry && typeof THREE !== 'undefined') {
            var thicknessMm = thicknessNow;
            var innerSectionsData = (typeof InterieurMath !== 'undefined' && InterieurMath.buildInteriorSectionsDataFromThickness)
                ? InterieurMath.buildInteriorSectionsDataFromThickness(sectionsData, thicknessMm, thicknessMm)
                : sectionsData;
            var renderModeNow = (typeof BottleMaterials !== 'undefined' && BottleMaterials.getRenderMaterialMode)
                ? BottleMaterials.getRenderMaterialMode()
                : 'base';
            var innerMat;
            if (renderModeNow === 'glass') {
                innerMat = (typeof BottleMaterials !== 'undefined' && BottleMaterials.getInnerGlassMaterial)
                    ? BottleMaterials.getInnerGlassMaterial(BottleMaterials.DEFAULT_GLASS_COLOR)
                    : BottleMaterials.getGlassMaterial(BottleMaterials.DEFAULT_GLASS_COLOR);
            } else {
                innerMat = new THREE.MeshPhongMaterial({
                    color: 0x6f8ead,
                    side: THREE.BackSide,
                    shininess: 20
                });
            }
            bottleInnerGlassMesh = (typeof BottleMesh3D !== 'undefined' && BottleMesh3D.createBottleMesh)
                ? BottleMesh3D.createBottleMesh(innerSectionsData, innerMat)
                : null;
            if (!bottleInnerGlassMesh) {
                var fallbackGeom = bottleGroup.geometry.clone();
                bottleInnerGlassMesh = new THREE.Mesh(fallbackGeom, innerMat);
            }
            bottleInnerGlassMesh.position.copy(bottleGroup.position);
            bottleInnerGlassMesh.rotation.copy(bottleGroup.rotation);
            bottleInnerGlassMesh.userData.isPiqure = false;
            bottleInnerGlassMesh.userData.isInterior = true;
            bottleInnerGlassMesh.castShadow = false;
            bottleInnerGlassMesh.receiveShadow = true;
            bottleInnerGlassMesh.renderOrder = 2;
            if (typeof Gravure3D !== 'undefined' && Gravure3D.punchHolesForInvertedEngravings) {
                Gravure3D.punchHolesForInvertedEngravings(bottleInnerGlassMesh, sectionsData);
            }
            sectionRingGroup.add(bottleInnerGlassMesh);
        }

        // --- Piqûre ---
        var s1 = sections[0];
        var feuille = BottleViewGeometry.buildPiqurePiedFeuille(s1, piqSections[0], piqSections[0].H);
        feuille.userData.isPiqure = true;
        BottleViewGeometry.enhanceInnerPiqureVisibility(feuille);
        BottleViewGeometry.enableMeshShadows(feuille);
        sectionRingGroup.add(feuille);
        var piqureInnerMat = BottleViewGeometry.getInnerShellMaterial();
        var s1Inner = InterieurMath.insetSection(s1, thicknessNow);
        s1Inner.H = s1.H + thicknessNow;
        var piqSectionsInner = [];
        for (var psi = 0; psi < piqSections.length; psi++) {
            // Exception : la piqûre se décale vers l’extérieur
            var outerAtH = InterieurMath.getOuterSectionAtHeight(sections, piqSections[psi].H || 0);
            var maxTa = outerAtH ? Math.max(0, (outerAtH.a || 0) - (piqSections[psi].a || 0) - 0.2) : thicknessNow;
            var maxTb = outerAtH ? Math.max(0, (outerAtH.b || 0) - (piqSections[psi].b || 0) - 0.2) : thicknessNow;
            var tPiq = Math.min(thicknessNow, maxTa, maxTb);
            var innerP = InterieurMath.outsetSection(piqSections[psi], tPiq);
            innerP.H = (piqSections[psi].H || 0) + thicknessNow;
            piqSectionsInner.push(innerP);
        }
        var feuilleInner = BottleViewGeometry.buildPiqurePiedFeuille(s1Inner, piqSectionsInner[0], piqSectionsInner[0].H);
        if (feuilleInner) {
            feuilleInner.userData.isPiqure = true;
            feuilleInner.userData.isInterior = true;
            sectionRingGroup.add(feuilleInner);
        }
        var piqSectionsData = BottleViewPanel.buildSectionsDataBundle(piqSections.slice(), 'rp');
        var feuillePiqureStrip = BottleViewGeometry.buildLiaisonRevolvedMesh(piqSectionsData, BottleMaterials.DEFAULT_GLASS_COLOR);
        if (feuillePiqureStrip) {
            feuillePiqureStrip.userData.isPiqure = true;
            BottleViewGeometry.enhanceInnerPiqureVisibility(feuillePiqureStrip);
            BottleViewGeometry.enableMeshShadows(feuillePiqureStrip);
            sectionRingGroup.add(feuillePiqureStrip);
            var piqInnerSectionsData = BottleViewPanel.buildSectionsDataBundle(piqSectionsInner.slice(), 'rp');
            var piqStripInner = BottleViewGeometry.buildLiaisonRevolvedMesh(piqInnerSectionsData, 0x6f8ead, { inner: true });
            if (piqStripInner) {
                piqStripInner.userData.isPiqure = true;
                piqStripInner.userData.isInterior = true;
                if (piqStripInner.material && !BottleViewGeometry.isGlassRenderMode()) {
                    piqStripInner.material.side = THREE.BackSide;
                    if (piqStripInner.material.shininess !== undefined) piqStripInner.material.shininess = 20;
                }
                sectionRingGroup.add(piqStripInner);
            }
        }
        var lastP = piqSections[piqSections.length - 1];
        var rp3H = BottleViewPanel.getPanelValue('rp3-h', 30);
        if (lastP && rp3H > lastP.H) {
            var feuilleVersAxe = BottleViewGeometry.buildPiqureFeuilleVersAxe(lastP, rp3H);
            feuilleVersAxe.userData.isPiqure = true;
            BottleViewGeometry.enhanceInnerPiqureVisibility(feuilleVersAxe);
            BottleViewGeometry.enableMeshShadows(feuilleVersAxe);
            sectionRingGroup.add(feuilleVersAxe);
            var lastPInner = piqSectionsInner[piqSectionsInner.length - 1];
            var rp3HInner = Math.max(lastPInner.H, rp3H + thicknessNow);
            var piqApexInner = BottleViewGeometry.buildPiqureFeuilleVersAxe(lastPInner, rp3HInner);
            if (piqApexInner) {
                piqApexInner.userData.isPiqure = true;
                piqApexInner.userData.isInterior = true;
                if (piqApexInner.material) {
                    piqApexInner.material = piqureInnerMat;
                }
                sectionRingGroup.add(piqApexInner);
            }
        }

        // --- Bague ---
        var bague1 = bagueSections[0];
        var sTop = sections && sections.length ? sections[sections.length - 1] : null;
        var sPrev = sections && sections.length >= 2 ? sections[sections.length - 2] : null;
        if (sTop) {
            var feuilleColBague = BottleViewGeometry.buildNeckToBagueFeuille(sPrev, sTop, bague1, sectionsData, BottleMaterials.DEFAULT_GLASS_COLOR);
            punchInvertedEngravingsOnMesh(feuilleColBague, sectionsData);
            trackInvertedPunchMesh(feuilleColBague, function () {
                var secs = BottleViewPanel.getSectionsDataFromPanel();
                var secList = secs.sections || [];
                var bagueList = BottleViewPanel.collectBagueSectionsFromPanel();
                if (!secList.length || !bagueList.length) return null;
                var sTopNow = secList[secList.length - 1];
                var sPrevNow = secList.length >= 2 ? secList[secList.length - 2] : null;
                return BottleViewGeometry.buildNeckToBagueFeuille(sPrevNow, sTopNow, bagueList[0], secs, BottleMaterials.DEFAULT_GLASS_COLOR);
            });
            feuilleColBague.userData.isPiqure = false;
            BottleViewGeometry.enableMeshShadows(feuilleColBague);
            sectionRingGroup.add(feuilleColBague);
            var bagueInnerMat = BottleViewGeometry.getInnerShellMaterial();
            var feuilleColBagueInner = InterieurMath.createInsetMeshFromMesh(feuilleColBague, thicknessNow, bagueInnerMat);
            if (feuilleColBagueInner) {
                punchInvertedEngravingsOnMesh(feuilleColBagueInner, sectionsData);
                trackInvertedPunchMesh(feuilleColBagueInner, function () {
                    var secs = BottleViewPanel.getSectionsDataFromPanel();
                    var secList = secs.sections || [];
                    var bagueList = BottleViewPanel.collectBagueSectionsFromPanel();
                    if (!secList.length || !bagueList.length) return null;
                    var sTopNow = secList[secList.length - 1];
                    var sPrevNow = secList.length >= 2 ? secList[secList.length - 2] : null;
                    var outer = BottleViewGeometry.buildNeckToBagueFeuille(sPrevNow, sTopNow, bagueList[0], secs, BottleMaterials.DEFAULT_GLASS_COLOR);
                    var tNow = (typeof InterieurMath !== 'undefined' && InterieurMath.getThicknessMm)
                        ? InterieurMath.getThicknessMm()
                        : thicknessNow;
                    return InterieurMath.createInsetMeshFromMesh(outer, tNow, BottleViewGeometry.getInnerShellMaterial());
                });
                feuilleColBagueInner.userData.isPiqure = false;
                feuilleColBagueInner.userData.isInterior = true;
                sectionRingGroup.add(feuilleColBagueInner);
            }
        }
        var bagueSectionsData = BottleViewPanel.buildSectionsDataBundle(bagueSections.slice(), 'rb');
        var feuilleBagueStrip = BottleViewGeometry.buildLiaisonRevolvedMesh(bagueSectionsData, BottleMaterials.DEFAULT_GLASS_COLOR);
        if (feuilleBagueStrip) {
            punchInvertedEngravingsOnMesh(feuilleBagueStrip, sectionsData);
            trackInvertedPunchMesh(feuilleBagueStrip, function () {
                var bagueList = BottleViewPanel.collectBagueSectionsFromPanel();
                if (!bagueList.length) return null;
                var bsd = BottleViewPanel.buildSectionsDataBundle(bagueList.slice(), 'rb');
                return BottleViewGeometry.buildLiaisonRevolvedMesh(bsd, BottleMaterials.DEFAULT_GLASS_COLOR);
            });
            feuilleBagueStrip.userData.isPiqure = false;
            BottleViewGeometry.enableMeshShadows(feuilleBagueStrip);
            sectionRingGroup.add(feuilleBagueStrip);
            var bagueInnerSections = [];
            for (var bis = 0; bis < bagueSections.length; bis++) bagueInnerSections.push(InterieurMath.insetSection(bagueSections[bis], thicknessNow));
            // Exception : « 2 - Haut bague » reprend les cotes de « 3 - Haut bague »
            if (bagueInnerSections.length >= 3) {
                bagueInnerSections[1].a = bagueInnerSections[2].a;
                bagueInnerSections[1].b = bagueInnerSections[2].b;
                bagueInnerSections[1].shape = bagueInnerSections[2].shape;
                bagueInnerSections[1].carreNiveau = bagueInnerSections[2].carreNiveau;
            }
            var bagueInnerSectionsData = BottleViewPanel.buildSectionsDataBundle(bagueInnerSections.slice(), 'rb');
            var bagueStripInner = BottleViewGeometry.buildLiaisonRevolvedMesh(bagueInnerSectionsData, 0x6f8ead, { inner: true });
            if (bagueStripInner) {
                punchInvertedEngravingsOnMesh(bagueStripInner, sectionsData);
                trackInvertedPunchMesh(bagueStripInner, function () {
                    var bagueList = BottleViewPanel.collectBagueSectionsFromPanel();
                    if (!bagueList.length) return null;
                    var tNow = (typeof InterieurMath !== 'undefined' && InterieurMath.getThicknessMm)
                        ? InterieurMath.getThicknessMm()
                        : thicknessNow;
                    var innerSecs = [];
                    for (var bi = 0; bi < bagueList.length; bi++) innerSecs.push(InterieurMath.insetSection(bagueList[bi], tNow));
                    if (innerSecs.length >= 3) {
                        innerSecs[1].a = innerSecs[2].a;
                        innerSecs[1].b = innerSecs[2].b;
                        innerSecs[1].shape = innerSecs[2].shape;
                        innerSecs[1].carreNiveau = innerSecs[2].carreNiveau;
                    }
                    var innerData = BottleViewPanel.buildSectionsDataBundle(innerSecs.slice(), 'rb');
                    return BottleViewGeometry.buildLiaisonRevolvedMesh(innerData, 0x6f8ead, { inner: true });
                });
                bagueStripInner.userData.isPiqure = false;
                bagueStripInner.userData.isInterior = true;
                if (bagueStripInner.material && !BottleViewGeometry.isGlassRenderMode()) {
                    bagueStripInner.material.side = THREE.BackSide;
                    if (bagueStripInner.material.shininess !== undefined) bagueStripInner.material.shininess = 20;
                }
                sectionRingGroup.add(bagueStripInner);
            }
        }

        // Fermeture du haut de bague (épaisseur lisible au col)
        if (bagueSections.length) {
            var bagueTop = bagueSections[bagueSections.length - 1];
            var bagueTopInner = InterieurMath.insetSection(bagueTop, thicknessNow);
            bagueTopInner.H = bagueTop.H;
            var lipSheet = BottleViewGeometry.buildPiqureBasHautFeuille(bagueTop, bagueTopInner);
            if (lipSheet) {
                punchInvertedEngravingsOnMesh(lipSheet, sectionsData);
                trackInvertedPunchMesh(lipSheet, function () {
                    var bagueList = BottleViewPanel.collectBagueSectionsFromPanel();
                    if (!bagueList.length) return null;
                    var tNow = (typeof InterieurMath !== 'undefined' && InterieurMath.getThicknessMm)
                        ? InterieurMath.getThicknessMm()
                        : thicknessNow;
                    var top = bagueList[bagueList.length - 1];
                    var topInner = InterieurMath.insetSection(top, tNow);
                    topInner.H = top.H;
                    return BottleViewGeometry.buildPiqureBasHautFeuille(top, topInner);
                });
                lipSheet.userData.isPiqure = false;
                lipSheet.userData.isInterior = true;
                BottleViewGeometry.enableMeshShadows(lipSheet);
                sectionRingGroup.add(lipSheet);
            }
        }


        return { bottleGroup: bottleGroup, bottleInnerGlassMesh: bottleInnerGlassMesh };
    }

    return { populate: populate };
})();
