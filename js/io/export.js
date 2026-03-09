// ==========================================
// EXPORT — Export 3D (STL) et 2D (PDF)
// ==========================================

var btnExport3D = document.getElementById('btn-export-3d');
var btnExport2D = document.getElementById('btn-export-2d');
var fichierDropdownEl = document.getElementById('fichier-dropdown');
var canvas2DEl = document.getElementById('canvas-2d');

function hideFichierDropdownExport() {
    if (fichierDropdownEl) fichierDropdownEl.classList.add('hidden');
}

if (btnExport3D) {
    btnExport3D.addEventListener('click', async function () {
        hideFichierDropdownExport();
        if (typeof THREE === 'undefined' || typeof THREE.STLExporter === 'undefined') {
            alert("La librairie d'exportation STL n'est pas chargée.");
            return;
        }
        var targetScene = typeof scene !== 'undefined' ? scene : window.scene;
        if (!targetScene) {
            alert("La scène 3D n'a pas pu être trouvée.");
            return;
        }
        try {
            var tempGroup = new THREE.Group();
            targetScene.traverse(function (obj) {
                if (obj.isMesh && obj.geometry && obj.geometry.index) {
                    var geo = obj.geometry;
                    var idx = geo.index.array;
                    var len = idx.length;
                    var newIdx = new idx.constructor(len);
                    for (var i = 0; i < len; i += 3) {
                        newIdx[i] = idx[i];
                        newIdx[i + 1] = idx[i + 2];
                        newIdx[i + 2] = idx[i + 1];
                    }
                    var geoFlipped = geo.clone();
                    geoFlipped.setIndex(new THREE.BufferAttribute(newIdx, 1));
                    geoFlipped.computeVertexNormals();
                    var meshFlipped = new THREE.Mesh(geoFlipped, obj.material.clone());
                    meshFlipped.applyMatrix4(obj.matrixWorld);
                    tempGroup.add(meshFlipped);
                }
            });
            targetScene.add(tempGroup);
            var exporter = new THREE.STLExporter();
            var stlData = exporter.parse(targetScene, { binary: true });
            targetScene.remove(tempGroup);
            var blob = new Blob([stlData], { type: 'application/octet-stream' });
            var titleInput = document.getElementById('cartouche-title');
            var fileName = (titleInput && titleInput.value.trim() !== "") ? titleInput.value.trim() : "Bouteille";
            if ('showSaveFilePicker' in window) {
                try {
                    var fileHandle = await window.showSaveFilePicker({
                        suggestedName: fileName + '.stl',
                        types: [{ description: 'Fichier 3D STL', accept: { 'model/stl': ['.stl'] } }]
                    });
                    var writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                } catch (err) {
                    console.log("Export 3D annulé", err);
                }
            } else {
                var link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName + '.stl';
                link.click();
                URL.revokeObjectURL(link.href);
            }
        } catch (error) {
            console.error("Erreur lors de l'exportation 3D :", error);
            alert("Une erreur est survenue pendant l'export 3D.");
        }
    });
}

if (btnExport2D) {
    btnExport2D.addEventListener('click', async function () {
        hideFichierDropdownExport();
        if (!window.jspdf) {
            alert("La librairie jsPDF n'est pas chargée.");
            return;
        }
        var canvas = canvas2DEl;
        if (!canvas || canvas.width === 0) {
            alert("Le plan 2D n'est pas affiché. Veuillez d'abord cliquer sur l'onglet 2D.");
            return;
        }
        var formatSelect = document.getElementById('paper-format-select');
        var formatVal = formatSelect ? formatSelect.value : 'A4_P';
        var paper = typeof paperFormats !== 'undefined' ? paperFormats[formatVal] : { w: 210, h: 297 };
        var orientation = 'p';
        var formatArgs = 'a4';
        var w = paper.w, h = paper.h;
        if (formatVal === 'A4_L') { orientation = 'l'; formatArgs = 'a4'; }
        if (formatVal === 'A3_P') { orientation = 'p'; formatArgs = 'a3'; }
        if (formatVal === 'A3_L') { orientation = 'l'; formatArgs = 'a3'; }
        try {
            var savedW = canvas.width;
            var savedH = canvas.height;
            if (typeof cam2D === 'undefined' || typeof draw2D !== 'function') {
                alert("Le moteur 2D n'est pas disponible pour l'export.");
                return;
            }
            var savedCam = { x: cam2D.x, y: cam2D.y, zoom: cam2D.zoom };
            var scaleFactor = 8;
            canvas.width = w * scaleFactor;
            canvas.height = h * scaleFactor;
            cam2D.x = canvas.width / 2;
            cam2D.y = canvas.height / 2;
            cam2D.zoom = scaleFactor;
            draw2D();
            var imgData = canvas.toDataURL('image/jpeg', 1.0);
            canvas.width = savedW;
            canvas.height = savedH;
            cam2D.x = savedCam.x;
            cam2D.y = savedCam.y;
            cam2D.zoom = savedCam.zoom;
            draw2D();
            var JsPDFClass = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jspdf;
            var pdf = new JsPDFClass({ orientation: orientation, unit: 'mm', format: formatArgs });
            pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
            var titleInput2 = document.getElementById('cartouche-title');
            var fileName = (titleInput2 && titleInput2.value.trim() !== "") ? titleInput2.value.trim() : "Plan_Bouteille";
            var pdfBlob = pdf.output('blob');
            if ('showSaveFilePicker' in window) {
                try {
                    var fileHandle = await window.showSaveFilePicker({
                        suggestedName: fileName + '.pdf',
                        types: [{ description: 'Plan 2D PDF', accept: { 'application/pdf': ['.pdf'] } }]
                    });
                    var writable = await fileHandle.createWritable();
                    await writable.write(pdfBlob);
                    await writable.close();
                } catch (err) {
                    console.log("Export 2D annulé", err);
                }
            } else {
                pdf.save(fileName + '.pdf');
            }
        } catch (error) {
            console.error("Erreur lors de l'exportation 2D :", error);
            alert("Une erreur est survenue pendant l'export PDF.");
        }
    });
}
