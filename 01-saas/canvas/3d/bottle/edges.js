// saas/canvas/3d/bottle/ — traits de section / joint de moule (pixels d’écran, Line2).
// Réglages : Canvas3DRules.SECTION_RING. Collés à la feuille, occlus à l’arrière.

var BottleViewEdges = (function () {
    var tess = (typeof Canvas3DRules !== 'undefined' && Canvas3DRules.TESSELLATION) ? Canvas3DRules.TESSELLATION : {};
    var ringRules = (typeof Canvas3DRules !== 'undefined' && Canvas3DRules.SECTION_RING) ? Canvas3DRules.SECTION_RING : {};
    var N_SEGMENTS = tess.N_SEGMENTS || 128;
    var MERIDIAN_RESOLUTION = tess.MERIDIAN_RESOLUTION || 64;
    var MOLD_JOINT_PROFILE_THETA = 0;
    var RING_COLOR_NORMAL = ringRules.COLOR_NORMAL || 0x000000;
    var RING_COLOR_HIGHLIGHT = ringRules.COLOR_HIGHLIGHT || 0xff0040;
    var RING_SURFACE_BIAS = ringRules.SURFACE_BIAS != null ? ringRules.SURFACE_BIAS : 0;
    var RING_HIGHLIGHT_SURFACE_BIAS = ringRules.HIGHLIGHT_SURFACE_BIAS != null ? ringRules.HIGHLIGHT_SURFACE_BIAS : 0;
    var RING_NORMAL_LINE_WIDTH = ringRules.NORMAL_LINE_WIDTH != null ? ringRules.NORMAL_LINE_WIDTH : 0.75;
    var RING_HIGHLIGHT_LINE_WIDTH = ringRules.HIGHLIGHT_LINE_WIDTH != null ? ringRules.HIGHLIGHT_LINE_WIDTH : 2.75;

    function ringPointsOnSurface(H, points, bias) {
        bias = bias || 0;
        return points.map(function (p) {
            var x = p[0], z = p[1];
            var r = Math.sqrt(x * x + z * z);
            if (r > 1e-9 && bias) {
                var k = (r + bias) / r;
                x *= k;
                z *= k;
            }
            return new THREE.Vector3(x, H, z);
        });
    }

    function getEdgeLineResolution() {
        var w = 1;
        var h = 1;
        if (typeof renderer !== 'undefined' && renderer && renderer.domElement) {
            w = renderer.domElement.width || renderer.domElement.clientWidth || 1;
            h = renderer.domElement.height || renderer.domElement.clientHeight || 1;
        } else if (typeof viewport3D !== 'undefined' && viewport3D) {
            w = Math.max(1, viewport3D.clientWidth || 1);
            h = Math.max(1, viewport3D.clientHeight || 1);
        }
        return { x: w, y: h };
    }

    function syncEdgeLineResolutions(root) {
        var target = root || (typeof scene !== 'undefined' ? scene : null);
        if (!target || !target.traverse) return;
        var res = getEdgeLineResolution();
        target.traverse(function (obj) {
            if (obj && obj.material && obj.material.isLineMaterial && obj.material.resolution) {
                obj.material.resolution.set(res.x, res.y);
            }
        });
    }

    function buildScreenSpaceEdge(pts, pixelWidth, color, renderOrder, closed) {
        if (!pts || pts.length < 2) return null;
        closed = !!closed;
        var pathPts = pts.slice();
        if (closed && pathPts.length > 2 && pathPts[0].distanceToSquared(pathPts[pathPts.length - 1]) < 1e-8) {
            pathPts = pathPts.slice(0, -1);
        }
        if (closed && pathPts.length >= 2) {
            pathPts = pathPts.concat([pathPts[0].clone()]);
        }
        if (pathPts.length < 2) return null;

        if (typeof THREE.Line2 !== 'undefined' && typeof THREE.LineGeometry !== 'undefined' && typeof THREE.LineMaterial !== 'undefined') {
            var positions = [];
            for (var i = 0; i < pathPts.length; i++) {
                positions.push(pathPts[i].x, pathPts[i].y, pathPts[i].z);
            }
            var geom = new THREE.LineGeometry();
            geom.setPositions(positions);
            var mat = new THREE.LineMaterial({
                color: color,
                linewidth: pixelWidth,
                transparent: false,
                opacity: 1,
                depthTest: true,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -2,
                polygonOffsetUnits: -2
            });
            // Tire le trait légèrement vers la caméra (évite le z-fight au milieu de l’arc)
            mat.onBeforeCompile = function (shader) {
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <logdepthbuf_vertex>',
                    '#include <logdepthbuf_vertex>\n\t\t\tgl_Position.z -= 2.5e-4 * gl_Position.w;'
                );
            };
            var res = getEdgeLineResolution();
            mat.resolution.set(res.x, res.y);
            var edge = new THREE.Line2(geom, mat);
            if (edge.computeLineDistances) edge.computeLineDistances();
            edge.renderOrder = renderOrder != null ? renderOrder : 30;
            return edge;
        }

        var fallbackGeom = new THREE.BufferGeometry().setFromPoints(pathPts);
        var fallbackMat = new THREE.LineBasicMaterial({
            color: color,
            transparent: false,
            opacity: 1,
            depthTest: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -8,
            polygonOffsetUnits: -8
        });
        var fallback = closed
            ? new THREE.LineLoop(fallbackGeom, fallbackMat)
            : new THREE.Line(fallbackGeom, fallbackMat);
        fallback.renderOrder = renderOrder != null ? renderOrder : 30;
        return fallback;
    }

    function buildSectionRingLine(H, points, isHighlight) {
        var bias = isHighlight ? RING_HIGHLIGHT_SURFACE_BIAS : RING_SURFACE_BIAS;
        var width = isHighlight ? RING_HIGHLIGHT_LINE_WIDTH : RING_NORMAL_LINE_WIDTH;
        var color = isHighlight ? RING_COLOR_HIGHLIGHT : RING_COLOR_NORMAL;
        var pts = ringPointsOnSurface(H, points, bias);
        return buildScreenSpaceEdge(pts, width, color, isHighlight ? 31 : 30, true);
    }

    function buildMoldJointLine(theta, sectionsData) {
        if (typeof THREE === 'undefined' || typeof BottleMaths === 'undefined' || typeof GeomKernel === 'undefined') return null;
        var entities = BottleMaths.buildExteriorProfile(theta, sectionsData);
        if (!entities || !entities.length) return null;
        var pts2d = GeomKernel.tessellateProfile(entities, Math.max(64, MERIDIAN_RESOLUTION));
        if (!pts2d || !pts2d.length) return null;
        var c = Math.cos(theta), s = Math.sin(theta);
        var pts3d = [];
        for (var i = 0; i < pts2d.length; i++) {
            var p = pts2d[i];
            var r = p.x + RING_SURFACE_BIAS;
            pts3d.push(new THREE.Vector3(r * c, p.y, r * s));
        }
        var line = buildScreenSpaceEdge(pts3d, RING_NORMAL_LINE_WIDTH, 0x111111, 30, false);
        if (!line) return null;
        line.userData.isPiqure = false;
        line.userData.isInterior = false;
        return line;
    }

    function addSectionRing(group, section, isHighlight, isPiqure) {
        if (typeof window !== 'undefined' && window.displayOptions && window.displayOptions.showSectionRings === false) return;
        var pts = BottleMaths.getSectionRingPoints(section.a, section.b, section.shape, section.carreNiveau, N_SEGMENTS);
        var ring = buildSectionRingLine(section.H, pts, isHighlight);
        ring.userData.isPiqure = isPiqure;
        ring.userData.isOverlay = true;
        group.add(ring);
    }

    function profilePointsFromSectionsData(sectionsData) {
        if (!sectionsData || !sectionsData.sections || sectionsData.sections.length < 2) return [];
        if (typeof BottleMaths === 'undefined' || typeof GeomKernel === 'undefined') return [];
        if (!sectionsData.edgeTypes || !sectionsData.rhos) return [];
        var entities = BottleMaths.buildExteriorProfile(MOLD_JOINT_PROFILE_THETA, sectionsData);
        if (!entities || !entities.length) return [];
        return GeomKernel.tessellateProfile(entities, Math.max(48, MERIDIAN_RESOLUTION)) || [];
    }

    return {
        MOLD_JOINT_PROFILE_THETA: MOLD_JOINT_PROFILE_THETA,
        N_SEGMENTS: N_SEGMENTS,
        MERIDIAN_RESOLUTION: MERIDIAN_RESOLUTION,
        profilePointsFromSectionsData: profilePointsFromSectionsData,
        buildSectionRingLine: buildSectionRingLine,
        buildMoldJointLine: buildMoldJointLine,
        addSectionRing: addSectionRing,
        syncEdgeLineResolutions: syncEdgeLineResolutions
    };
})();
