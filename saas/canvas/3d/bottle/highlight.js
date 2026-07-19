// saas/canvas/3d/bottle/ — surbrillance (sélection / survol section & liaison).
// Anneaux / joints = overlays ; liaisons = teinte rouge de la feuille (coupe pile aux H).

var BottleViewHighlight = (function () {
    var liaisonHighlightRules = (typeof Canvas3DRules !== 'undefined' && Canvas3DRules.LIAISON_HIGHLIGHT) ? Canvas3DRules.LIAISON_HIGHLIGHT : {};
    var LIAISON_HIGHLIGHT_COLOR = liaisonHighlightRules.COLOR || 0xff0040;
    var LIAISON_TINT_MIX = typeof liaisonHighlightRules.TINT_MIX === 'number' ? liaisonHighlightRules.TINT_MIX : 0.42;
    var LIAISON_PANEL_PREFIX = {
        'panel-content-sections': 'r',
        'panel-content-piqure': 'rp',
        'panel-content-bague': 'rb'
    };

    var disposeThreeHierarchyFn = null;
    var tintedMeshes = [];

    function setDisposeHierarchy(fn) {
        disposeThreeHierarchyFn = fn;
    }

    function isSectionRingHighlighted(panelId, index) {
        if (typeof window === 'undefined') return false;
        var active = window.sectionHighlightActive;
        var hover = window.sectionHighlightHover;
        if (active && active.panelId === panelId && active.index === index) return true;
        if (hover && hover.panelId === panelId && hover.index === index) return true;
        if (panelId === 'panel-content-sections') {
            var activeSection = typeof window.activeSectionIndex !== 'undefined' ? window.activeSectionIndex : 0;
            var hoveredSection = typeof window.hoveredSectionIndex !== 'undefined' ? window.hoveredSectionIndex : 0;
            return activeSection === index || hoveredSection === index;
        }
        return false;
    }

    function isLiaisonHighlighted(panelId, index) {
        if (typeof window === 'undefined' || !index) return false;
        var active = window.liaisonHighlightActive;
        var hover = window.liaisonHighlightHover;
        return (active && active.panelId === panelId && active.index === index)
            || (hover && hover.panelId === panelId && hover.index === index);
    }

    function getLiaisonYRange(sections, liaisonIndex) {
        var i = liaisonIndex - 1;
        if (!sections || i < 0 || i >= sections.length - 1) return null;
        return {
            yMin: Math.min(sections[i].H, sections[i + 1].H),
            yMax: Math.max(sections[i].H, sections[i + 1].H)
        };
    }

    function clearLiaisonSurfaceTints() {
        for (var i = 0; i < tintedMeshes.length; i++) {
            var entry = tintedMeshes[i];
            var mesh = entry.mesh;
            if (!mesh || !mesh.material) continue;
            // Restaure le matériau d’origine (sans shader de teinte)
            if (entry.originalMaterial) {
                if (mesh.material && mesh.material !== entry.originalMaterial && mesh.material.dispose) {
                    mesh.material.dispose();
                }
                mesh.material = entry.originalMaterial;
            }
        }
        tintedMeshes = [];
    }

    function findTintEntry(mesh) {
        for (var i = 0; i < tintedMeshes.length; i++) {
            if (tintedMeshes[i].mesh === mesh) return tintedMeshes[i];
        }
        return null;
    }

    // Teinte fragmentaire : coupe exactement à yMin / yMax (même hauteur que les traits)
    function ensureTintMaterial(mesh, tintColor, mix) {
        var entry = findTintEntry(mesh);
        if (!entry) {
            entry = {
                mesh: mesh,
                originalMaterial: mesh.material,
                bands: []
            };
            var baseMat = mesh.material;
            if (!baseMat) return null;
            var tintMat = baseMat.clone();
            tintMat.userData = tintMat.userData || {};
            tintMat.userData.liaisonTint = true;
            tintMat.userData.liaisonTintColor = tintColor.clone();
            tintMat.userData.liaisonTintMix = mix;
            tintMat.userData.liaisonBands = [];
            tintMat.onBeforeCompile = function (shader) {
                var bands = tintMat.userData.liaisonBands || [];
                var n = Math.min(bands.length, 8);
                shader.uniforms.liaisonTintColor = { value: tintMat.userData.liaisonTintColor };
                shader.uniforms.liaisonTintMix = { value: tintMat.userData.liaisonTintMix };
                shader.uniforms.liaisonBandCount = { value: n };
                var yMins = [0, 0, 0, 0, 0, 0, 0, 0];
                var yMaxs = [0, 0, 0, 0, 0, 0, 0, 0];
                for (var b = 0; b < n; b++) {
                    yMins[b] = bands[b].yMin;
                    yMaxs[b] = bands[b].yMax;
                }
                shader.uniforms.liaisonYMin = { value: yMins };
                shader.uniforms.liaisonYMax = { value: yMaxs };
                tintMat.userData.liaisonShader = shader;

                shader.vertexShader = shader.vertexShader
                    .replace(
                        '#include <common>',
                        '#include <common>\nvarying float vLiaisonY;'
                    )
                    .replace(
                        '#include <begin_vertex>',
                        '#include <begin_vertex>\nvLiaisonY = position.y;'
                    );

                shader.fragmentShader = shader.fragmentShader
                    .replace(
                        '#include <common>',
                        [
                            '#include <common>',
                            'varying float vLiaisonY;',
                            'uniform vec3 liaisonTintColor;',
                            'uniform float liaisonTintMix;',
                            'uniform int liaisonBandCount;',
                            'uniform float liaisonYMin[8];',
                            'uniform float liaisonYMax[8];'
                        ].join('\n')
                    )
                    .replace(
                        '#include <color_fragment>',
                        [
                            '#include <color_fragment>',
                            'float liaisonMask = 0.0;',
                            'for (int i = 0; i < 8; i++) {',
                            '  if (i >= liaisonBandCount) break;',
                            '  // Coupe pile aux traits (H des sections)',
                            '  float inside = step(liaisonYMin[i], vLiaisonY) * step(vLiaisonY, liaisonYMax[i]);',
                            '  liaisonMask = max(liaisonMask, inside);',
                            '}',
                            'diffuseColor.rgb = mix(diffuseColor.rgb, liaisonTintColor, liaisonMask * liaisonTintMix);'
                        ].join('\n')
                    );
            };
            tintMat.needsUpdate = true;
            mesh.material = tintMat;
            entry.tintMaterial = tintMat;
            tintedMeshes.push(entry);
        }
        return entry;
    }

    function syncBandUniforms(entry) {
        var tintMat = entry.tintMaterial;
        if (!tintMat || !tintMat.userData) return;
        tintMat.userData.liaisonBands = entry.bands.slice();
        var shader = tintMat.userData.liaisonShader;
        if (!shader || !shader.uniforms) {
            tintMat.needsUpdate = true;
            return;
        }
        var bands = entry.bands;
        var n = Math.min(bands.length, 8);
        shader.uniforms.liaisonBandCount.value = n;
        for (var b = 0; b < 8; b++) {
            shader.uniforms.liaisonYMin.value[b] = b < n ? bands[b].yMin : 0;
            shader.uniforms.liaisonYMax.value[b] = b < n ? bands[b].yMax : 0;
        }
    }

    function addBandToMesh(mesh, yMin, yMax, tintColor, mix) {
        if (!mesh || !mesh.isMesh || !mesh.material || typeof THREE === 'undefined') return;
        if (mesh.userData && (mesh.userData.isInterior || mesh.userData.isLabel || mesh.userData.isOverlay)) return;
        if (!mesh.geometry || !mesh.geometry.attributes || !mesh.geometry.attributes.position) return;

        var lo = Math.min(yMin, yMax);
        var hi = Math.max(yMin, yMax);
        if (!(hi > lo)) return;

        // Ne teinte que si le mesh intersecte vraiment la bande
        var pos = mesh.geometry.attributes.position;
        var hits = false;
        for (var vi = 0; vi < pos.count; vi++) {
            var y = pos.getY(vi);
            if (y >= lo && y <= hi) { hits = true; break; }
        }
        if (!hits) return;

        var entry = ensureTintMaterial(mesh, tintColor, mix);
        if (!entry) return;
        entry.bands.push({ yMin: lo, yMax: hi });
        syncBandUniforms(entry);
    }

    function applyLiaisonSurfaceTints(group, sections, panelId) {
        if (!group || !sections || sections.length < 2 || typeof THREE === 'undefined') return;
        if (!LIAISON_PANEL_PREFIX[panelId]) return;
        var tint = new THREE.Color(LIAISON_HIGHLIGHT_COLOR);
        for (var li = 1; li < sections.length; li++) {
            if (!isLiaisonHighlighted(panelId, li)) continue;
            var range = getLiaisonYRange(sections, li);
            if (!range) continue;
            group.traverse(function (obj) {
                addBandToMesh(obj, range.yMin, range.yMax, tint, LIAISON_TINT_MIX);
            });
        }
    }

    function removeOverlayChildren(sectionRingGroup) {
        clearLiaisonSurfaceTints();
        if (!sectionRingGroup) return;
        for (var i = sectionRingGroup.children.length - 1; i >= 0; i--) {
            var child = sectionRingGroup.children[i];
            if (child.userData && child.userData.isOverlay) {
                sectionRingGroup.remove(child);
                if (disposeThreeHierarchyFn) disposeThreeHierarchyFn(child);
            }
        }
    }

    function buildOverlayContent(group, sectionsData, sections, piqSections, bagueSections) {
        if (!group) return;
        clearLiaisonSurfaceTints();
        for (var i = 0; i < sections.length; i++) {
            BottleViewGeometry.addSectionRing(group, sections[i], isSectionRingHighlighted('panel-content-sections', i + 1), false);
        }
        var showMoldJoint = !(typeof window !== 'undefined' && window.displayOptions && window.displayOptions.showMoldJoint === false);
        if (showMoldJoint) {
            var moldLineA = BottleViewGeometry.buildMoldJointLine(BottleViewGeometry.MOLD_JOINT_PROFILE_THETA, sectionsData);
            var moldLineB = BottleViewGeometry.buildMoldJointLine(BottleViewGeometry.MOLD_JOINT_PROFILE_THETA + Math.PI, sectionsData);
            if (moldLineA) {
                moldLineA.userData.isOverlay = true;
                group.add(moldLineA);
            }
            if (moldLineB) {
                moldLineB.userData.isOverlay = true;
                group.add(moldLineB);
            }
        }
        if (piqSections.length) {
            BottleViewGeometry.addSectionRing(group, piqSections[0], isSectionRingHighlighted('panel-content-piqure', 1), true);
            for (var pri = 1; pri < piqSections.length; pri++) {
                BottleViewGeometry.addSectionRing(group, piqSections[pri], isSectionRingHighlighted('panel-content-piqure', pri + 1), true);
            }
        }
        for (var bri = 0; bri < bagueSections.length; bri++) {
            BottleViewGeometry.addSectionRing(group, bagueSections[bri], isSectionRingHighlighted('panel-content-bague', bri + 1), false);
        }
        applyLiaisonSurfaceTints(group, sections, 'panel-content-sections');
        applyLiaisonSurfaceTints(group, piqSections, 'panel-content-piqure');
        applyLiaisonSurfaceTints(group, bagueSections, 'panel-content-bague');
    }

    return {
        setDisposeHierarchy: setDisposeHierarchy,
        removeOverlayChildren: removeOverlayChildren,
        buildOverlayContent: buildOverlayContent
    };
})();
