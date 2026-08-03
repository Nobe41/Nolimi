// 01-saas/canvas/3d/bottle/ — profils pour le plan 2D + maillage STL.
// Consommé par features/2d et features/export.

var BottleViewExport = (function () {
    // Profil extérieur du corps (vue 2D)
    function getProfilePointsFor2D() {
        var sectionsData = BottleViewPanel.getSectionsDataFromPanel();
        if (!sectionsData || !sectionsData.sections || sectionsData.sections.length < 2) return [];
        var entities = (typeof BottleMaths !== 'undefined' && BottleMaths.buildExteriorProfile)
            ? BottleMaths.buildExteriorProfile(BottleViewGeometry.MOLD_JOINT_PROFILE_THETA, sectionsData)
            : [];
        if (!entities || entities.length === 0) return [];
        return (typeof GeomKernel !== 'undefined' && GeomKernel.tessellateProfile)
            ? GeomKernel.tessellateProfile(entities, 32)
            : [];
    }

    // Profil piqûre (+ pointe optionnelle rp3-h)
    function getPiqureProfilePointsFor2D() {
        var profile = BottleViewGeometry.profilePointsFromSectionsData(BottleViewPanel.buildSectionsDataBundle(BottleViewPanel.collectPiqureSectionsFromPanel(), 'rp'));
        var rp3h = BottleViewPanel.getPanelValue('rp3-h', NaN);
        if (isFinite(rp3h)) {
            var lastP = BottleViewPanel.collectPiqureSectionsFromPanel();
            var lastH = lastP.length ? lastP[lastP.length - 1].H : 0;
            if (rp3h > lastH) profile.push({ x: 0, y: rp3h });
        }
        profile.sort(function (a, b) { return a.y - b.y; });
        return profile;
    }

    function getBagueProfilePointsFor2D() {
        return BottleViewGeometry.profilePointsFromSectionsData(BottleViewPanel.buildSectionsDataBundle(BottleViewPanel.collectBagueSectionsFromPanel(), 'rb'));
    }

    // Résolution plus basse pour un STL plus léger
    function getStlExportTess() {
        var exp = (typeof ExportRules !== 'undefined' && ExportRules.STL_EXPORT) ? ExportRules.STL_EXPORT : {};
        return {
            nSegments: exp.N_SEGMENTS || 48,
            nFeuilleV: exp.N_FEUILLE_V || 8,
            nTheta: exp.N_THETA || 48,
            meridianRes: exp.MERIDIAN_RES || 24
        };
    }

    function disposeExportMeshList(meshes) {
        for (var i = 0; i < meshes.length; i++) {
            var m = meshes[i];
            if (!m) continue;
            if (m.geometry) m.geometry.dispose();
            if (m.material && m.material.dispose) m.material.dispose();
        }
    }

    // Un seul maillage STL : corps + piqûre + bague (+ pièces export)
    function buildStlExportMesh(sectionRingGroup) {
        if (typeof THREE === 'undefined' || typeof BottleMesh3D === 'undefined') return null;
        if (typeof ExportMath === 'undefined' || !ExportMath.mergeBufferGeometries || !ExportMath.prepareMeshGeometryForExport) return null;

        var tess = getStlExportTess();
        var tessOpts = { nSegments: tess.nSegments, nFeuilleV: tess.nFeuilleV };
        var revTess = { nTheta: tess.nTheta, meridianRes: tess.meridianRes };
        var glassColor = (typeof BottleMaterials !== 'undefined' && BottleMaterials.DEFAULT_GLASS_COLOR !== undefined)
            ? BottleMaterials.DEFAULT_GLASS_COLOR
            : 0x99bbdd;

        var sectionsData = BottleViewPanel.getSectionsDataFromPanel();
        if (!sectionsData || !sectionsData.sections || sectionsData.sections.length < 2) return null;

        var sections = sectionsData.sections;
        var piqSections = BottleViewPanel.collectPiqureSectionsFromPanel();
        var bagueSections = BottleViewPanel.collectBagueSectionsFromPanel();
        var tempMeshes = [];
        var geometries = [];

        function track(mesh) {
            if (mesh) tempMeshes.push(mesh);
            return mesh;
        }

        function punch(mesh) {
            if (mesh && typeof Gravure3D !== 'undefined' && Gravure3D.punchHolesForInvertedEngravings) {
                Gravure3D.punchHolesForInvertedEngravings(mesh, sectionsData);
            }
        }

        // Corps
        var body = track(BottleMesh3D.createBottleMesh(sectionsData, null, revTess));
        if (body && typeof Gravure3D !== 'undefined' && Gravure3D.applyInvertedEngravingsToBottleMesh) {
            Gravure3D.applyInvertedEngravingsToBottleMesh(body, sectionsData);
        }

        // Piqûre
        if (piqSections.length) {
            var s1 = sections[0];
            track(BottleViewGeometry.buildPiqurePiedFeuille(s1, piqSections[0], piqSections[0].H, tessOpts));
            var piqSectionsData = BottleViewPanel.buildSectionsDataBundle(piqSections.slice(), 'rp');
            track(BottleViewGeometry.buildLiaisonRevolvedMesh(piqSectionsData, glassColor, { tessOverride: revTess }));
            var lastP = piqSections[piqSections.length - 1];
            var rp3H = BottleViewPanel.getPanelValue('rp3-h', 30);
            if (lastP && rp3H > lastP.H) {
                track(BottleViewGeometry.buildPiqureFeuilleVersAxe(lastP, rp3H, tessOpts));
            }
        }

        // Bague
        if (bagueSections.length) {
            var bague1 = bagueSections[0];
            var sTop = sections[sections.length - 1];
            var sPrev = sections.length >= 2 ? sections[sections.length - 2] : null;
            var bagueNext = bagueSections.length >= 2 ? bagueSections[1] : null;
            if (sTop) {
                var bridgeData = BottleViewPanel.buildColToBagueBridgeData(sTop, bague1, sPrev, bagueNext);
                var feuilleColBague = track(BottleViewGeometry.buildLiaisonRevolvedMesh(bridgeData, glassColor, { tessOverride: revTess }));
                punch(feuilleColBague);
            }
            var bagueSectionsData = BottleViewPanel.buildSectionsDataBundle(bagueSections.slice(), 'rb');
            var feuilleBagueStrip = track(BottleViewGeometry.buildLiaisonRevolvedMesh(bagueSectionsData, glassColor, { tessOverride: revTess }));
            punch(feuilleBagueStrip);
        }

        for (var ti = 0; ti < tempMeshes.length; ti++) {
            var prepared = ExportMath.prepareMeshGeometryForExport(tempMeshes[ti]);
            if (prepared) geometries.push(prepared);
        }

        // Pièces marquées « export » dans la scène (hors structure)
        var targetScene = typeof scene !== 'undefined' ? scene : (typeof window !== 'undefined' ? window.scene : null);
        if (targetScene && sectionRingGroup) {
            targetScene.traverse(function (obj) {
                if (!obj.isMesh || !obj.geometry || !obj.geometry.index) return;
                if (obj.userData && (obj.userData.isInterior || obj.userData.isLabel || obj.userData.isOverlay)) return;
                var inExport = false;
                var inStructural = false;
                var node = obj;
                while (node) {
                    if (node === sectionRingGroup) inStructural = true;
                    if (node.userData && node.userData.isBottleExportRoot) inExport = true;
                    node = node.parent;
                }
                if (!inExport || inStructural) return;
                var geo = ExportMath.prepareMeshGeometryForExport(obj);
                if (geo) geometries.push(geo);
            });
        }

        var merged = ExportMath.mergeBufferGeometries(geometries);
        disposeExportMeshList(tempMeshes);
        if (!merged) return null;
        return new THREE.Mesh(merged);
    }

    return {
        getProfilePointsFor2D: getProfilePointsFor2D,
        getPiqureProfilePointsFor2D: getPiqureProfilePointsFor2D,
        getBagueProfilePointsFor2D: getBagueProfilePointsFor2D,
        buildStlExportMesh: buildStlExportMesh
    };
})();
