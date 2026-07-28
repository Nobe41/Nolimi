// 01-saas/features/3d/data.js
// Source UNIQUE : lit le panneau HTML → données sections pour la bouteille 3D.
// canvas/3d/bottle/panel.js = façade compat (BottleViewPanel → ici).
// Ne pas recopier la lecture DOM ailleurs.
//
// Sortie section : H (hauteur), a/b (demi-axes L/2 et P/2), shape, carreNiveau.

var Bottle3DData = (function () {
    var R = typeof Bottle3DRules !== 'undefined' ? Bottle3DRules : {};

    // --- Lecture champs ---

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

    function defaultShape() {
        return R.DEFAULT_SHAPE || 'cylindrique';
    }

    // --- Helpers sections ---

    // Indices des sections {prefix}{n}-h (s, sp, sb…)
    function collectIndexedSectionKeys(prefix) {
        var inputs = document.querySelectorAll('input[id^="' + prefix + '"][id$="-h"]');
        var idxs = [];
        for (var i = 0; i < inputs.length; i++) {
            var m = (inputs[i].id || '').match(new RegExp('^' + prefix + '(\\d+)-h$'));
            if (!m) continue;
            var k = parseInt(m[1], 10);
            if (isFinite(k)) idxs.push(k);
        }
        idxs.sort(function (a, b) { return a - b; });
        var clean = [];
        for (var j = 0; j < idxs.length; j++) {
            if (j === 0 || idxs[j] !== idxs[j - 1]) clean.push(idxs[j]);
        }
        return clean;
    }

    // Lit une section depuis cfg (h, L, P, formKey…) → objet { H, a, b, shape, carreNiveau }
    function getSectionFromPanel(cfg) {
        var shape = cfg.shape !== undefined
            ? cfg.shape
            : getPanelSelectValue(cfg.formKey, defaultShape());
        var L = getPanelValue(cfg.L, cfg.defaultL);
        var P = getPanelValue(cfg.P, cfg.defaultP);
        if (typeof SectionsRules !== 'undefined' && SectionsRules.resolveSectionDimensions) {
            var resolved = SectionsRules.resolveSectionDimensions(shape, L, P);
            shape = resolved.shape;
            L = resolved.L;
            P = resolved.P;
        }
        var carreNiveau = cfg.carreNiveau !== undefined
            ? cfg.carreNiveau
            : Math.max(0, Math.min(100, getPanelValue(cfg.carreKey, 0)));
        return {
            H: getPanelValue(cfg.h, 0),
            a: Math.max(0, L / 2),
            b: Math.max(0, P / 2),
            shape: shape,
            carreNiveau: carreNiveau
        };
    }

    // Hauteurs strictement croissantes (évite profil invalide)
    function enforceAscendingHeights(sections) {
        for (var j = 1; j < sections.length; j++) {
            if (sections[j].H < sections[j - 1].H) sections[j].H = sections[j - 1].H;
        }
    }

    // Types et rayons des liaisons : prefix ex. rp, rb, ou r12 pour le corps
    function collectLiaisonsFromDom(prefix, expectedCount, rhoDefault) {
        var edgeTypes = [];
        var rhos = [];
        var rhoDef = rhoDefault != null ? rhoDefault : (R.SUB_LIAISON_RHO_DEFAULT || 5);
        if (expectedCount > 0) {
            for (var i = 1; i <= expectedCount; i++) {
                var id = prefix + i;
                edgeTypes.push(getPanelSelectValue(id + '-type', 'ligne'));
                rhos.push(getPanelValueSigned(id + '-rho', rhoDef));
            }
            return { edgeTypes: edgeTypes, rhos: rhos };
        }
        var selects = document.querySelectorAll('select[id^="' + prefix + '"][id$="-type"]');
        for (var j = 0; j < selects.length; j++) {
            var sid = (selects[j].id || '').replace(/-type$/, '');
            edgeTypes.push(getPanelSelectValue(sid + '-type', 'ligne'));
            rhos.push(getPanelValueSigned(sid + '-rho', rhoDef));
        }
        return { edgeTypes: edgeTypes, rhos: rhos };
    }

    // Paquet sections + edgeTypes + rhos (piqûre / bague)
    function buildSectionsDataBundle(sections, liaisonPrefix) {
        if (!sections || sections.length < 2) return null;
        enforceAscendingHeights(sections);
        var n = sections.length - 1;
        var liaisons = collectLiaisonsFromDom(liaisonPrefix, n, R.SUB_LIAISON_RHO_DEFAULT);
        while (liaisons.edgeTypes.length < n) {
            liaisons.edgeTypes.push('ligne');
            liaisons.rhos.push(R.SUB_LIAISON_RHO_DEFAULT || 5);
        }
        return {
            sections: sections,
            edgeTypes: liaisons.edgeTypes.slice(0, n),
            rhos: liaisons.rhos.slice(0, n)
        };
    }

    // --- Corps ---

    // Diamètres par défaut corps si input absent (s1=71, s2-s3=85, reste=32)
    function defaultMainL(k) {
        if (k === 1) return 71;
        if (k <= 3) return 85;
        return 32;
    }

    // Corps : s1-h…sN-h + liaisons r12, r23… (consommé par canvas/3d/bottle)
    function getSectionsData() {
        var idxs = collectIndexedSectionKeys('s');
        if (!idxs || idxs.length < 2) {
            idxs = (R.MAIN_SECTION_FALLBACK_INDICES || [1, 2, 3, 4, 5]).slice();
        }

        var sections = [];
        for (var ii = 0; ii < idxs.length; ii++) {
            var k = idxs[ii];
            var defaultL = defaultMainL(k);
            var shape = getPanelSelectValue('s' + k + '-forme', defaultShape());
            var L = getPanelValue('s' + k + '-L', defaultL);
            var P = getPanelValue('s' + k + '-P', defaultL);
            if (typeof SectionsRules !== 'undefined' && SectionsRules.resolveSectionDimensions) {
                var resolved = SectionsRules.resolveSectionDimensions(shape, L, P);
                shape = resolved.shape;
                L = resolved.L;
                P = resolved.P;
            }
            sections.push({
                H: getPanelValue('s' + k + '-h', 0),
                a: Math.max(0, L / 2),
                b: Math.max(0, P / 2),
                shape: shape,
                carreNiveau: Math.max(0, Math.min(100, getPanelValue('s' + k + '-carre-niveau', 0)))
            });
        }
        enforceAscendingHeights(sections);

        var edgeTypes = [];
        var rhos = [];
        var rhoDef = R.MAIN_LIAISON_RHO_DEFAULT != null ? R.MAIN_LIAISON_RHO_DEFAULT : 10;
        for (var e = 0; e < sections.length - 1; e++) {
            var rid = 'r' + (e + 1) + (e + 2);
            edgeTypes.push(getPanelSelectValue(rid + '-type', 'ligne'));
            rhos.push(getPanelValueSigned(rid + '-rho', rhoDef));
        }
        return { sections: sections, edgeTypes: edgeTypes, rhos: rhos };
    }

    // --- Piqûre ---

    // Piqûre : pied sp (PIQURE_FOOT) + sections sp2, sp3… du panneau piqûre
    function collectPiqureSectionsFromPanel() {
        var foot = R.PIQURE_FOOT || {
            h: 's1-h', L: 'sp-L', P: 'sp-P', formKey: 'sp-forme', carreKey: 'sp-carre-niveau',
            defaultL: 55, defaultP: 55
        };
        var piqSections = [getSectionFromPanel(foot)];
        var panelId = R.IDS && R.IDS.piqurePanel;
        var panel = panelId ? document.getElementById(panelId) : null;
        var heightInputs = panel
            ? panel.querySelectorAll('input[id^="sp"][id$="-h"]')
            : document.querySelectorAll('input[id^="sp"][id$="-h"]');
        var defL = R.PIQURE_SECTION_DEFAULT_L != null ? R.PIQURE_SECTION_DEFAULT_L : 45;
        for (var ssi = 0; ssi < heightInputs.length; ssi++) {
            var m = (heightInputs[ssi].id || '').match(/^sp(\d+)-h$/);
            if (!m) continue;
            var ksp = parseInt(m[1], 10);
            piqSections.push(getSectionFromPanel({
                h: 'sp' + ksp + '-h',
                L: 'sp' + ksp + '-L',
                P: 'sp' + ksp + '-P',
                formKey: 'sp' + ksp + '-forme',
                carreKey: 'sp' + ksp + '-carre-niveau',
                defaultL: defL,
                defaultP: defL
            }));
        }
        return piqSections;
    }

    // --- Bague ---

    // Bague : sb1-h… ou BAGUE_DEFAULTS si panneau vide
    function collectBagueSectionsFromPanel() {
        var panelId = R.IDS && R.IDS.baguePanel;
        var panel = panelId ? document.getElementById(panelId) : null;
        var heightInputs = panel
            ? panel.querySelectorAll('input[id^="sb"][id$="-h"]')
            : document.querySelectorAll('input[id^="sb"][id$="-h"]');
        var bagueSections = [];
        var defL = R.BAGUE_SECTION_DEFAULT_L != null ? R.BAGUE_SECTION_DEFAULT_L : 35;
        for (var bsi = 0; bsi < heightInputs.length; bsi++) {
            var m = (heightInputs[bsi].id || '').match(/^sb(\d+)-h$/);
            if (!m) continue;
            var ksb = parseInt(m[1], 10);
            bagueSections.push(getSectionFromPanel({
                h: 'sb' + ksb + '-h',
                L: 'sb' + ksb + '-L',
                P: 'sb' + ksb + '-P',
                formKey: 'sb' + ksb + '-forme',
                carreKey: 'sb' + ksb + '-carre-niveau',
                defaultL: defL,
                defaultP: defL
            }));
        }
        if (!bagueSections.length && R.BAGUE_DEFAULTS) {
            for (var i = 0; i < R.BAGUE_DEFAULTS.length; i++) {
                bagueSections.push(getSectionFromPanel(R.BAGUE_DEFAULTS[i]));
            }
        }
        return bagueSections;
    }

    // Vue piqûre active → affichage 3D orienté piqûre
    function isPiqureViewActive() {
        var panelId = (R.IDS && R.IDS.piqurePanel) || 'panel-content-piqure';
        var panel = document.getElementById(panelId);
        return !!(panel && !panel.classList.contains('hidden'));
    }

    // API publique (+ alias noms BottleViewPanel pour compat canvas)
    return {
        getPanelValue: getPanelValue,
        getPanelValueSigned: getPanelValueSigned,
        getPanelSelectValue: getPanelSelectValue,
        getSectionsData: getSectionsData,
        getSectionsDataFromPanel: getSectionsData,
        buildSectionsDataBundle: buildSectionsDataBundle,
        collectPiqureSectionsFromPanel: collectPiqureSectionsFromPanel,
        collectBagueSectionsFromPanel: collectBagueSectionsFromPanel,
        isPiqureViewActive: isPiqureViewActive
    };
})();
