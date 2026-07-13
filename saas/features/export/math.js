var ExportMath = (function () {
    function safeFileName(name, fallback) {
        var base = (name || '').trim();
        if (!base) return fallback;
        return base.replace(/[\\/:*?"<>|]/g, '_');
    }

    function resolvePaperInfo(formatVal, paperFormats, rules) {
        var selected = formatVal || rules.DEFAULTS.paperFormat;
        var dims = (paperFormats && paperFormats[selected]) ? paperFormats[selected] : { w: 210, h: 297 };
        var map = (rules.PAPER_MAP && rules.PAPER_MAP[selected]) ? rules.PAPER_MAP[selected] : { orientation: 'p', format: 'a4' };
        return { w: dims.w, h: dims.h, orientation: map.orientation, format: map.format };
    }

    function prepareMeshGeometryForExport(mesh) {
        if (!mesh || !mesh.geometry || typeof THREE === 'undefined') return null;
        var geo = mesh.geometry;
        if (!geo.attributes || !geo.attributes.position || !geo.index || !geo.index.count) return null;

        mesh.updateMatrixWorld(true);
        var prepared = geo.clone();
        prepared.applyMatrix4(mesh.matrixWorld);

        var idx = prepared.index.array;
        var newIdx = new idx.constructor(idx.length);
        for (var i = 0; i < idx.length; i += 3) {
            newIdx[i] = idx[i];
            newIdx[i + 1] = idx[i + 2];
            newIdx[i + 2] = idx[i + 1];
        }
        prepared.setIndex(new THREE.BufferAttribute(newIdx, 1));
        prepared.computeVertexNormals();
        return prepared;
    }

    function mergeBufferGeometries(geometries) {
        if (!geometries || !geometries.length || typeof THREE === 'undefined') return null;

        var valid = [];
        for (var g = 0; g < geometries.length; g++) {
            if (geometries[g] && geometries[g].attributes && geometries[g].attributes.position && geometries[g].index) {
                valid.push(geometries[g]);
            }
        }
        if (!valid.length) return null;
        if (valid.length === 1) return valid[0].clone();

        var totalVerts = 0;
        var totalIdx = 0;
        for (var vi = 0; vi < valid.length; vi++) {
            totalVerts += valid[vi].attributes.position.count;
            totalIdx += valid[vi].index.count;
        }

        var positions = new Float32Array(totalVerts * 3);
        var IndexArray = totalVerts > 65535 ? Uint32Array : Uint16Array;
        var indices = new IndexArray(totalIdx);
        var vertOffset = 0;
        var idxOffset = 0;

        for (var mi = 0; mi < valid.length; mi++) {
            var geo = valid[mi];
            positions.set(geo.attributes.position.array, vertOffset * 3);
            var srcIdx = geo.index.array;
            for (var ii = 0; ii < srcIdx.length; ii++) {
                indices[idxOffset + ii] = srcIdx[ii] + vertOffset;
            }
            idxOffset += srcIdx.length;
            vertOffset += geo.attributes.position.count;
        }

        var merged = new THREE.BufferGeometry();
        merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        merged.setIndex(new THREE.BufferAttribute(indices, 1));
        merged.computeVertexNormals();
        return merged;
    }

    return {
        safeFileName: safeFileName,
        resolvePaperInfo: resolvePaperInfo,
        prepareMeshGeometryForExport: prepareMeshGeometryForExport,
        mergeBufferGeometries: mergeBufferGeometries
    };
})();
