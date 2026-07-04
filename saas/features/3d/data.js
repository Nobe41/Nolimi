var Bottle3DData = (function () {
    var PIQURE_CONFIG = [
        { h: 's1-h', L: 'sp-L', P: 'sp-P', formKey: 'sp-forme', carreKey: 'sp-carre-niveau', defaultL: 55, defaultP: 55 },
        { h: 'sp2-h', L: 'sp2-L', P: 'sp2-P', formKey: 'sp2-forme', carreKey: 'sp2-carre-niveau', defaultL: 45, defaultP: 45 },
        { h: 'sp3-h', L: 'sp3-L', P: 'sp3-P', formKey: 'sp3-forme', carreKey: 'sp3-carre-niveau', defaultL: 28, defaultP: 28 }
    ];

    function getPanelValue(id, def) {
        var el = document.getElementById(id);
        if (!el) return def;
        var v = parseFloat(el.value);
        return isNaN(v) ? def : Math.max(0, v);
    }
    function getPanelValueSigned(id, def) {
        var el = document.getElementById(id);
        if (!el) return def;
        var v = parseFloat(el.value);
        return isNaN(v) ? def : v;
    }
    function getPanelSelectValue(id, def) {
        var el = document.getElementById(id);
        if (!el || !el.value) return def;
        return el.value;
    }

    function getMainSectionIndicesFromDOM() {
        var inputs = document.querySelectorAll('input[id^="s"][id$="-h"]');
        var idxs = [];
        for (var i = 0; i < inputs.length; i++) {
            var m = (inputs[i].id || '').match(/^s(\d+)-h$/);
            if (!m) continue;
            var k = parseInt(m[1], 10);
            if (isFinite(k)) idxs.push(k);
        }
        idxs.sort(function (a, b) { return a - b; });
        var out = [];
        for (var j = 0; j < idxs.length; j++) if (j === 0 || idxs[j] !== idxs[j - 1]) out.push(idxs[j]);
        return out;
    }

    function getSectionsData() {
        var idxs = getMainSectionIndicesFromDOM();
        if (!idxs || idxs.length < 2) idxs = [1, 2, 3, 4, 5];
        var sections = [];
        for (var ii = 0; ii < idxs.length; ii++) {
            var k = idxs[ii];
            var defaultL = (k === 1) ? 71 : (k <= 3 ? 85 : 32);
            var Hraw = getPanelValue('s' + k + '-h', 0);
            var shape = getPanelSelectValue('s' + k + '-forme', 'cylindrique');
            var L = getPanelValue('s' + k + '-L', defaultL);
            var P = getPanelValue('s' + k + '-P', defaultL);
            if (typeof SectionsRules !== 'undefined' && SectionsRules.resolveSectionDimensions) {
                var resolved = SectionsRules.resolveSectionDimensions(shape, L, P);
                shape = resolved.shape;
                L = resolved.L;
                P = resolved.P;
            }
            var carreNiveau = Math.max(0, Math.min(100, getPanelValue('s' + k + '-carre-niveau', 0)));
            sections.push({ H: Hraw, a: Math.max(0, L / 2), b: Math.max(0, P / 2), shape: shape, carreNiveau: carreNiveau });
        }
        for (var m = 1; m < sections.length; m++) {
            if (sections[m].H < sections[m - 1].H) sections[m].H = sections[m - 1].H;
        }
        var edgeTypes = [];
        var rhos = [];
        for (var e = 0; e < sections.length - 1; e++) {
            var rid = 'r' + (e + 1) + (e + 2);
            edgeTypes.push(getPanelSelectValue(rid + '-type', 'ligne'));
            rhos.push(getPanelValueSigned(rid + '-rho', 10));
        }
        return { sections: sections, edgeTypes: edgeTypes, rhos: rhos };
    }

    function getPiqureSections() {
        var out = [];
        for (var i = 0; i < PIQURE_CONFIG.length; i++) {
            var cfg = PIQURE_CONFIG[i];
            var shape = getPanelSelectValue(cfg.formKey, 'cylindrique');
            var L = getPanelValue(cfg.L, cfg.defaultL);
            var P = getPanelValue(cfg.P, cfg.defaultP);
            if (typeof SectionsRules !== 'undefined' && SectionsRules.resolveSectionDimensions) {
                var resolved = SectionsRules.resolveSectionDimensions(shape, L, P);
                shape = resolved.shape;
                L = resolved.L;
                P = resolved.P;
            }
            out.push({
                H: getPanelValue(cfg.h, 0),
                a: Math.max(0, L / 2),
                b: Math.max(0, P / 2),
                shape: shape,
                carreNiveau: Math.max(0, Math.min(100, getPanelValue(cfg.carreKey, 0)))
            });
        }
        return out;
    }

    function isPiqureViewActive() {
        var panel = document.getElementById('panel-content-piqure');
        return !!(panel && !panel.classList.contains('hidden'));
    }

    return {
        getSectionsData: getSectionsData,
        getPiqureSections: getPiqureSections,
        isPiqureViewActive: isPiqureViewActive
    };
})();
