// 01-saas/features/render/labels.js
// Étiquettes PNG collées sur la surface de la bouteille (mode rendu activé).
// Géométrie conforme via raycast ; cache par signature corps + paramètres.
// État global : window.renderLabelState (créé et piloté par RenderFeature).

var RenderLabels = (function () {
    // Mémoire des meshes d’étiquettes déjà créés
    var bottleLabelMeshes = {};
    var bottleLabelCacheKeys = {};
    var sectionRingGroup = null;
    var buildBodySignatureFn = null;

    function setRootGroup(group) {
        sectionRingGroup = group;
    }

    // Signature du corps : pour savoir s’il faut recalculer l’étiquette
    function setBodySignatureBuilder(fn) {
        buildBodySignatureFn = fn;
    }

    function disposeLabelMeshById(labelId) {
        var mesh = bottleLabelMeshes[labelId];
        if (!mesh) return;
        if (mesh.parent) mesh.parent.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material && mesh.material.dispose) mesh.material.dispose();
        delete bottleLabelMeshes[labelId];
        delete bottleLabelCacheKeys[labelId];
    }

    function disposeAllLabelMeshes() {
        var ids = Object.keys(bottleLabelMeshes);
        for (var i = 0; i < ids.length; i++) disposeLabelMeshById(ids[i]);
    }

    // Retire les étiquettes du groupe sans les détruire
    function detachFromGroup(group) {
        if (!group) return;
        var labelIds = Object.keys(bottleLabelMeshes);
        for (var li = 0; li < labelIds.length; li++) {
            var lm = bottleLabelMeshes[labelIds[li]];
            if (lm && lm.parent === group) group.remove(lm);
        }
    }

    // Surfaces sur lesquelles coller l’étiquette (pas l’intérieur ni une autre étiquette)
    function getLabelRaycastTargets() {
        var targets = [];
        if (sectionRingGroup) {
            sectionRingGroup.traverse(function (obj) {
                if (!obj.isMesh || !obj.geometry) return;
                if (obj.userData.isInterior || obj.userData.isLabel) return;
                targets.push(obj);
            });
        }
        if (!targets.length && bottleGroup) targets.push(bottleGroup);
        return targets;
    }

    // Crée un maillage d’étiquette collé à la bouteille
    function buildConformalLabelMesh(labelState) {
        var targets = getLabelRaycastTargets();
        if (!targets.length || typeof THREE === 'undefined' || !labelState || !labelState.texture) return null;

        var combinedBox = new THREE.Box3();
        var maxR = 0;
        var centerY = (parseFloat(labelState.height) || 0);
        var bandHalf = 12;
        var hasBandSample = false;
        var bandMaxR = 0;
        for (var ti = 0; ti < targets.length; ti++) {
            var mesh = targets[ti];
            mesh.geometry.computeBoundingBox();
            if (mesh.geometry.boundingBox) {
                var meshBox = mesh.geometry.boundingBox.clone();
                meshBox.applyMatrix4(mesh.matrixWorld);
                combinedBox.union(meshBox);
            }
            var pos = mesh.geometry.attributes.position;
            if (!pos || !pos.count) continue;
            for (var pi = 0; pi < pos.count; pi++) {
                var px = pos.getX(pi);
                var py = pos.getY(pi);
                var pz = pos.getZ(pi);
                var pr = Math.sqrt(px * px + pz * pz);
                if (pr > maxR) maxR = pr;
                // Rayon local à la hauteur de l’étiquette
                if (Math.abs(py - centerY) <= bandHalf) {
                    hasBandSample = true;
                    if (pr > bandMaxR) bandMaxR = pr;
                }
            }
        }
        if (combinedBox.isEmpty()) return null;

        var radius = (hasBandSample ? bandMaxR : maxR);
        if (radius <= 0) return null;
        radius *= 1.01;

        var bboxHeight = combinedBox.max.y - combinedBox.min.y;
        var baseHeight = Math.max(6, bboxHeight * 0.14);
        var scale = Math.max(0.2, (parseFloat(labelState.size) || 100) / 100);
        var labelH = baseHeight * scale;

        var texImage = labelState.texture.image || null;
        var texW = (texImage && texImage.width) ? texImage.width : 1;
        var texH = (texImage && texImage.height) ? texImage.height : 1;
        var texAspect = Math.max(0.01, texW / texH);
        var labelW = labelH * texAspect;
        var maxW = (2 * Math.PI * radius) * 0.95;
        if (labelW > maxW) {
            labelW = maxW;
            labelH = labelW / texAspect;
        }

        var thetaLength = Math.max(0.05, Math.min((labelW / radius), Math.PI * 2 * 0.95));
        var thetaOffset = (parseFloat(labelState.rotation) || 0) * Math.PI / 180;
        var segU = 32;
        var segV = 10;
        var vertices = [];
        var uvs = [];
        var indices = [];
        var labelBottom = centerY;
        var labelTop = centerY + labelH;
        var raycaster = new THREE.Raycaster();
        var normalMatrix = new THREE.Matrix3();
        for (var tw = 0; tw < targets.length; tw++) targets[tw].updateMatrixWorld(true);
        var fallbackRadius = radius * 1.015;
        var outOffset = 0.12;

        // Grille de points : raycast vers la bouteille
        for (var iv = 0; iv <= segV; iv++) {
            var v = iv / segV;
            var y = labelBottom + v * (labelTop - labelBottom);
            for (var iu = 0; iu <= segU; iu++) {
                var u = iu / segU;
                var theta = thetaOffset + (u - 0.5) * thetaLength;
                var dx = Math.cos(theta);
                var dz = Math.sin(theta);
                var origin = new THREE.Vector3(dx * maxR * 3.0, y, dz * maxR * 3.0);
                var direction = new THREE.Vector3(-dx, 0, -dz);
                raycaster.set(origin, direction);
                var hits = raycaster.intersectObjects(targets, false);

                var vx = dx * fallbackRadius;
                var vy = y;
                var vz = dz * fallbackRadius;
                if (hits && hits.length) {
                    var hp = hits[0].point;
                    vx = hp.x;
                    vy = hp.y;
                    vz = hp.z;
                    // Léger décalage vers l’extérieur pour éviter le z-fighting
                    if (hits[0].face && hits[0].face.normal) {
                        normalMatrix.getNormalMatrix(hits[0].object.matrixWorld);
                        var n = hits[0].face.normal.clone().applyMatrix3(normalMatrix).normalize();
                        vx += n.x * outOffset;
                        vy += n.y * outOffset;
                        vz += n.z * outOffset;
                    } else {
                        vx += dx * outOffset;
                        vz += dz * outOffset;
                    }
                }
                vertices.push(vx, vy, vz);
                var uMap = (labelState.flipX ? (1 - u) : u);
                var vMap = (labelState.flipY ? v : (1 - v));
                uvs.push(uMap, vMap);
            }
        }

        for (var j = 0; j < segV; j++) {
            for (var k = 0; k < segU; k++) {
                var a = j * (segU + 1) + k;
                var b = a + 1;
                var c = (j + 1) * (segU + 1) + k;
                var d = c + 1;
                indices.push(a, c, b);
                indices.push(b, c, d);
            }
        }

        var geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geom.setIndex(indices);
        geom.computeVertexNormals();

        labelState.texture.wrapS = THREE.ClampToEdgeWrapping;
        labelState.texture.wrapT = THREE.ClampToEdgeWrapping;
        labelState.texture.needsUpdate = true;

        var mat = new THREE.MeshBasicMaterial({
            map: labelState.texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        var mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, 0, 0);
        mesh.userData.isPiqure = false;
        mesh.userData.isLabel = true;
        mesh.renderOrder = 10;
        return mesh;
    }

    // Met à jour toutes les étiquettes (création / cache / suppression)
    function updateLabelMeshes(sectionsData) {
        if (!bottleGroup || !bottleGroup.geometry || typeof THREE === 'undefined' || typeof window === 'undefined' || !window.renderLabelState) {
            disposeAllLabelMeshes();
            return;
        }
        var labelState = window.renderLabelState;
        var labels = Array.isArray(labelState.labels) ? labelState.labels : [];
        var labelEnabled = !!labelState.enabled && labels.length > 0;
        if (!labelEnabled) {
            disposeAllLabelMeshes();
            return;
        }
        var bodySig = buildBodySignatureFn ? buildBodySignatureFn(sectionsData) : '';
        var keep = {};
        for (var li = 0; li < labels.length; li++) {
            var one = labels[li];
            if (!one || !one.id || !one.texture) continue;
            var labelId = one.id;
            keep[labelId] = true;
            var labelKey = [
                bodySig,
                labelId,
                (one.texture && one.texture.id) ? one.texture.id : 'tx',
                Math.round((parseFloat(one.height) || 0) * 100) / 100,
                Math.round((parseFloat(one.size) || 100) * 100) / 100,
                Math.round((parseFloat(one.rotation) || 0) * 100) / 100,
                one.flipX ? 1 : 0,
                one.flipY ? 1 : 0
            ].join('|');
            if (!bottleLabelMeshes[labelId] || bottleLabelCacheKeys[labelId] !== labelKey) {
                disposeLabelMeshById(labelId);
                bottleLabelMeshes[labelId] = buildConformalLabelMesh(one);
                bottleLabelCacheKeys[labelId] = bottleLabelMeshes[labelId] ? labelKey : '';
            }
            if (bottleLabelMeshes[labelId] && sectionRingGroup) sectionRingGroup.add(bottleLabelMeshes[labelId]);
        }
        var existing = Object.keys(bottleLabelMeshes);
        for (var ei = 0; ei < existing.length; ei++) {
            if (!keep[existing[ei]]) disposeLabelMeshById(existing[ei]);
        }
    }

    // Rafraîchit seulement les étiquettes (sans tout reconstruire)
    function refreshLabelsOnly() {
        if (!scene || !sectionRingGroup || typeof THREE === 'undefined') return false;
        updateLabelMeshes(BottleViewPanel.getSectionsDataFromPanel());
        return true;
    }

    return {
        setRootGroup: setRootGroup,
        setBodySignatureBuilder: setBodySignatureBuilder,
        disposeAllLabelMeshes: disposeAllLabelMeshes,
        detachFromGroup: detachFromGroup,
        updateLabelMeshes: updateLabelMeshes,
        refreshLabelsOnly: refreshLabelsOnly
    };
})();
