// saas/features/sections/events.js
// Événements sections : sync DOM → state, ajout / suppression.
//
// syncAllFromDom : appelé avant save (store/storage.js)
// Ajout section : insère entre 2 sections + split la liaison, puis remap les IDs DOM
// Suppression : uniquement si userAdded === true
// Modes : main | piqure | bague (selon panneau visible)

var SectionsEvents = (function () {
    var R = typeof SectionsRules !== 'undefined' ? SectionsRules : {};
    var IDS = R.IDS || {};
    var DEF_MAIN = R.DEFAULT_LIAISON_MAIN || { rho: 10, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 };
    var DEF = R.DEFAULT_LIAISON || { rho: 5, rhoMin: 0, rhoMax: 400, rhoStep: 0.5 };

    function getState() {
        return (typeof SectionsState !== 'undefined' && SectionsState.getState)
            ? SectionsState.getState()
            : null;
    }

    // Panneau visible → mode actif (pour savoir quoi sync / où ajouter)
    function getActiveMode(ids) {
        var contentPiqure = document.getElementById(ids.piqure);
        var contentBague = document.getElementById(ids.bague);
        if (contentPiqure && !contentPiqure.classList.contains('hidden')) return 'piqure';
        if (contentBague && !contentBague.classList.contains('hidden')) return 'bague';
        return 'main';
    }

    function getNum(id, fallback) {
        var el = document.getElementById(id);
        if (!el) return fallback;
        var v = parseFloat(el.value);
        return isFinite(v) ? v : fallback;
    }

    // Lit un <select> (ex. type de profil liaison)
    function getSelect(id, fallback) {
        var el = document.getElementById(id);
        if (!el || el.value == null || el.value === '') return fallback;
        return el.value;
    }

    // Copie une liaison en préservant type / id
    function cloneLiaison(base, overrides) {
        var out = {
            rho: base.rho,
            rhoMin: base.rhoMin,
            rhoMax: base.rhoMax,
            rhoStep: base.rhoStep
        };
        if (base.type) out.type = base.type;
        if (base.id) out.id = base.id;
        if (overrides) {
            for (var k in overrides) {
                if (overrides.hasOwnProperty(k)) out[k] = overrides[k];
            }
        }
        return out;
    }

    // Corps : s*-h/L/P + r{from}{to}-rho/type → sectionsMain / liaisonsMain
    function syncMainFromDom(state) {
        var currentCount = 0;
        var hInputs = document.querySelectorAll('input[id^="s"][id$="-h"]');
        for (var hi = 0; hi < hInputs.length; hi++) {
            var m = (hInputs[hi].id || '').match(/^s(\d+)-h$/);
            if (!m) continue;
            var k = parseInt(m[1], 10);
            if (isFinite(k) && k > currentCount) currentCount = k;
        }
        if (!currentCount) currentCount = state.sectionsMain.length;

        var newSections = [];
        for (var k2 = 1; k2 <= currentCount; k2++) {
            var base = state.sectionsMain[k2 - 1] || { label: 'Section', hMin: 0, hMax: 350, LMin: 10, LMax: 120, step: 0.5, hStep: 0.5 };
            newSections.push({
                label: base.label || 'Section',
                h: getNum('s' + k2 + '-h', base.h || 0),
                hMin: base.hMin,
                hMax: base.hMax,
                L: getNum('s' + k2 + '-L', base.L || 0),
                P: getNum('s' + k2 + '-P', base.P || 0),
                LMin: base.LMin,
                LMax: base.LMax,
                step: base.step,
                hStep: base.hStep,
                userAdded: !!base.userAdded
            });
        }
        state.sectionsMain = newSections;

        var newLiaisons = [];
        for (var r = 1; r < currentCount; r++) {
            var rid = 'r' + r + (r + 1);
            var baseR = state.liaisonsMain[r - 1] || DEF_MAIN;
            newLiaisons.push({
                rho: getNum(rid + '-rho', baseR.rho),
                rhoMin: baseR.rhoMin,
                rhoMax: baseR.rhoMax,
                rhoStep: baseR.rhoStep,
                type: getSelect(rid + '-type', baseR.type || 'ligne')
            });
        }
        state.liaisonsMain = newLiaisons;
    }

    // Piqûre : sp*/rp* → piqureSections / piqureLiaisons (rp3-h reste hors state)
    function syncPiqureFromDom(state) {
        var list = [];
        for (var i = 0; i < state.piqureSections.length; i++) {
            var base = state.piqureSections[i];
            var key = base.key;
            var item = {
                key: key,
                label: base.label,
                hasHeight: base.hasHeight,
                hMin: base.hMin,
                hMax: base.hMax,
                hStep: base.hStep,
                LMin: base.LMin,
                LMax: base.LMax,
                step: base.step,
                userAdded: !!base.userAdded
            };
            if (base.hasHeight) item.h = getNum(key + '-h', base.h);
            item.L = getNum(key + '-L', base.L);
            item.P = getNum(key + '-P', base.P);
            list.push(item);
        }
        state.piqureSections = list;

        var liaisons = [];
        for (var j = 0; j < state.piqureLiaisons.length; j++) {
            var rhoObj = state.piqureLiaisons[j];
            liaisons.push({
                id: rhoObj.id,
                rho: getNum(rhoObj.id + '-rho', rhoObj.rho),
                rhoMin: rhoObj.rhoMin,
                rhoMax: rhoObj.rhoMax,
                rhoStep: rhoObj.rhoStep,
                type: getSelect(rhoObj.id + '-type', rhoObj.type || 'ligne')
            });
        }
        state.piqureLiaisons = liaisons;
    }

    // Bague : sb*/rb* → bagueSections / bagueLiaisons
    function syncBagueFromDom(state) {
        var list = [];
        for (var i = 0; i < state.bagueSections.length; i++) {
            var base = state.bagueSections[i];
            var key = base.key;
            list.push({
                key: key,
                label: base.label,
                h: getNum(key + '-h', base.h),
                hMin: base.hMin,
                hMax: base.hMax,
                hStep: base.hStep,
                L: getNum(key + '-L', base.L),
                P: getNum(key + '-P', base.P),
                LMin: base.LMin,
                LMax: base.LMax,
                step: base.step,
                userAdded: !!base.userAdded
            });
        }
        state.bagueSections = list;

        var liaisons = [];
        for (var j = 0; j < state.bagueLiaisons.length; j++) {
            var rhoObj = state.bagueLiaisons[j];
            liaisons.push({
                id: rhoObj.id,
                rho: getNum(rhoObj.id + '-rho', rhoObj.rho),
                rhoMin: rhoObj.rhoMin,
                rhoMax: rhoObj.rhoMax,
                rhoStep: rhoObj.rhoStep,
                type: getSelect(rhoObj.id + '-type', rhoObj.type || 'ligne')
            });
        }
        state.bagueLiaisons = liaisons;
    }

    // Après insert/delete : réattribue sp, sp2… et rp1, rp2…
    function renumberPiqureKeys(state) {
        for (var pi = 0; pi < state.piqureSections.length; pi++) {
            state.piqureSections[pi].key = pi === 0 ? 'sp' : ('sp' + (pi + 1));
        }
        for (var pj = 0; pj < state.piqureLiaisons.length; pj++) {
            state.piqureLiaisons[pj].id = 'rp' + (pj + 1);
        }
    }

    // Idem bague : sb1… / rb1…
    function renumberBagueKeys(state) {
        for (var bi = 0; bi < state.bagueSections.length; bi++) {
            state.bagueSections[bi].key = 'sb' + (bi + 1);
        }
        for (var bj = 0; bj < state.bagueLiaisons.length; bj++) {
            state.bagueLiaisons[bj].id = 'rb' + (bj + 1);
        }
    }

    // Fusionne les 2 liaisons adjacentes en gardant celle de gauche (type inclus)
    function mergeLiaisonsAfterRemove(liaisons, index) {
        if (index > 0 && index < liaisons.length) {
            var left = liaisons[index - 1];
            liaisons.splice(index - 1, 2, cloneLiaison(left));
        } else if (index > 0) {
            liaisons.splice(index - 1, 1);
        } else if (liaisons.length > 0) {
            liaisons.splice(0, 1);
        }
    }

    // Supprime une section userAdded ; refuse les sections d’usine
    function removeSectionAt(mode, index, state) {
        if (mode === 'bague') {
            syncBagueFromDom(state);
            var bSec = state.bagueSections[index];
            if (!bSec || !bSec.userAdded) return false;
            state.bagueSections.splice(index, 1);
            mergeLiaisonsAfterRemove(state.bagueLiaisons, index);
            renumberBagueKeys(state);
            return true;
        }
        if (mode === 'piqure') {
            syncPiqureFromDom(state);
            var pSec = state.piqureSections[index];
            if (!pSec || !pSec.userAdded) return false;
            state.piqureSections.splice(index, 1);
            mergeLiaisonsAfterRemove(state.piqureLiaisons, index);
            renumberPiqureKeys(state);
            return true;
        }
        syncMainFromDom(state);
        var sec = state.sectionsMain[index];
        if (!sec || !sec.userAdded) return false;
        state.sectionsMain.splice(index, 1);
        mergeLiaisonsAfterRemove(state.liaisonsMain, index);
        return true;
    }

    function elId(key, fallback) {
        return IDS[key] || fallback;
    }

    // Délégation clic sur × (.btn-remove-section)
    function wireRemoveSectionButtons(config) {
        var inspector = document.getElementById(elId('inspector', 'inspector'));
        if (!inspector || inspector.dataset.removeSectionBound === '1') return;
        inspector.dataset.removeSectionBound = '1';

        var onRefresh = config && config.onRefresh ? config.onRefresh : function () { };

        inspector.addEventListener('click', function (e) {
            var btn = e.target.closest('.btn-remove-section');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();

            var state = getState();
            if (!state) return;

            var index = parseInt(btn.getAttribute('data-section-index'), 10);
            var mode = btn.getAttribute('data-section-mode') || 'main';
            if (!isFinite(index)) return;

            if (!removeSectionAt(mode, index, state)) return;

            onRefresh();
            if (typeof setupListeners === 'function') setupListeners();
            if (typeof UIControls !== 'undefined' && UIControls.syncAllRangeSliders) UIControls.syncAllRangeSliders();
            if (typeof Validator !== 'undefined' && Validator.applyAllUserConstraints) Validator.applyAllUserConstraints();
            if (typeof updateBouteille === 'function') updateBouteille();
            if (typeof draw2D === 'function') draw2D();
        });
    }

    // Ferme le panneau « + » mobile
    function closeAddSectionPanel() {
        var panel = document.getElementById(elId('addSectionPanel', 'inspector-add-section-panel'));
        var fab = document.getElementById(elId('addSectionFab', 'btn-add-section-fab'));
        if (!panel) return;
        panel.classList.remove('is-open');
        if (fab) fab.setAttribute('aria-expanded', 'false');
    }

    // FAB « + » : ouvre le panneau d’ajout (mobile ≤ 768px)
    function wireAddSectionFab() {
        var fab = document.getElementById(elId('addSectionFab', 'btn-add-section-fab'));
        var panel = document.getElementById(elId('addSectionPanel', 'inspector-add-section-panel'));
        if (!fab || !panel || fab.dataset.fabBound) return;

        fab.dataset.fabBound = '1';
        fab.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!window.matchMedia('(max-width: 768px)').matches) return;
            var open = !panel.classList.contains('is-open');
            panel.classList.toggle('is-open', open);
            fab.setAttribute('aria-expanded', open ? 'true' : 'false');
        });

        if (!document.documentElement.dataset.addSectionFabDismissBound) {
            document.documentElement.dataset.addSectionFabDismissBound = '1';
            document.addEventListener('click', function (e) {
                var p = document.getElementById(elId('addSectionPanel', 'inspector-add-section-panel'));
                var f = document.getElementById(elId('addSectionFab', 'btn-add-section-fab'));
                if (!p || !p.classList.contains('is-open')) return;
                if (p.contains(e.target) || (f && f.contains(e.target))) return;
                closeAddSectionPanel();
            });
        }
    }

    // Bouton « Ajouter une section » : insert + split liaison + remap IDs DOM
    function wireAddSectionButton(config) {
        var ids = config && config.containerIds ? config.containerIds : {};
        var onRefresh = config && config.onRefresh ? config.onRefresh : function () { };

        var btn = document.getElementById(elId('addSectionBtn', 'btn-add-section'));
        var sel = document.getElementById(elId('addSectionBetween', 'add-section-between'));
        if (!btn || !sel || btn.dataset.bound) return;

        btn.dataset.bound = '1';
        btn.addEventListener('click', function () {
            var state = getState();
            if (!state) return;

            var mode = getActiveMode(ids);
            if (mode === 'bague') syncBagueFromDom(state);
            else if (mode === 'piqure') syncPiqureFromDom(state);
            else syncMainFromDom(state);

            var snapshot = {};
            var els = document.querySelectorAll('#Panel-gauche input, #Panel-gauche select');
            for (var si = 0; si < els.length; si++) {
                var el = els[si];
                if (!el.id) continue;
                if (el.type === 'checkbox') snapshot[el.id] = !!el.checked;
                else snapshot[el.id] = el.value;
            }

            var between = parseInt(sel.value, 10);
            if (!isFinite(between) || between < 1) between = 1;

            if (mode === 'bague') {
                if (between > state.bagueSections.length - 1) between = state.bagueSections.length - 1;
                var Ab = state.bagueSections[between - 1];
                var Bb = state.bagueSections[between];
                var newB = {
                    key: '_new',
                    label: 'Bague',
                    h: Math.round(((Ab.h + Bb.h) * 0.5) * 10) / 10,
                    hMin: Math.min(Ab.hMin, Bb.hMin),
                    hMax: Math.max(Ab.hMax, Bb.hMax),
                    hStep: Math.min(Ab.hStep, Bb.hStep),
                    L: Math.round(((Ab.L + Bb.L) * 0.5) * 10) / 10,
                    P: Math.round(((Ab.P + Bb.P) * 0.5) * 10) / 10,
                    LMin: Math.min(Ab.LMin, Bb.LMin),
                    LMax: Math.max(Ab.LMax, Bb.LMax),
                    step: Math.min(Ab.step, Bb.step),
                    userAdded: true
                };
                state.bagueSections.splice(between, 0, newB);
                var baseRb = state.bagueLiaisons[between - 1] || DEF;
                var rbSplit1 = cloneLiaison(baseRb, { id: '_new' });
                var rbSplit2 = cloneLiaison(baseRb, { id: '_new' });
                state.bagueLiaisons.splice(between - 1, 1, rbSplit1, rbSplit2);
                renumberBagueKeys(state);
            } else if (mode === 'piqure') {
                if (between > state.piqureSections.length - 1) between = state.piqureSections.length - 1;
                var Ap = state.piqureSections[between - 1];
                var Bp = state.piqureSections[between];
                var newP = {
                    key: '_new',
                    label: 'Piqûre',
                    hasHeight: true,
                    h: Math.round((((Ap.h || 0) + (Bp.h || 0)) * 0.5) * 10) / 10,
                    hMin: Math.min(Ap.hMin || 0, Bp.hMin || 0),
                    hMax: Math.max(Ap.hMax || 80, Bp.hMax || 80),
                    hStep: Math.min(Ap.hStep || 0.5, Bp.hStep || 0.5),
                    L: Math.round(((Ap.L + Bp.L) * 0.5) * 10) / 10,
                    P: Math.round(((Ap.P + Bp.P) * 0.5) * 10) / 10,
                    LMin: Math.min(Ap.LMin, Bp.LMin),
                    LMax: Math.max(Ap.LMax, Bp.LMax),
                    step: Math.min(Ap.step, Bp.step),
                    userAdded: true
                };
                state.piqureSections.splice(between, 0, newP);
                var baseRp = state.piqureLiaisons[between - 1] || DEF;
                var rpSplit1 = cloneLiaison(baseRp, { id: '_new' });
                var rpSplit2 = cloneLiaison(baseRp, { id: '_new' });
                state.piqureLiaisons.splice(between - 1, 1, rpSplit1, rpSplit2);
                renumberPiqureKeys(state);
            } else {
                if (between > state.sectionsMain.length - 1) between = state.sectionsMain.length - 1;
                var A = state.sectionsMain[between - 1];
                var B = state.sectionsMain[between];
                var newS = {
                    label: 'Section',
                    h: Math.round(((A.h + B.h) * 0.5) * 10) / 10,
                    hMin: Math.min(A.hMin, B.hMin),
                    hMax: Math.max(A.hMax, B.hMax),
                    L: Math.round(((A.L + B.L) * 0.5) * 10) / 10,
                    P: Math.round(((A.P + B.P) * 0.5) * 10) / 10,
                    LMin: Math.min(A.LMin, B.LMin),
                    LMax: Math.max(A.LMax, B.LMax),
                    step: Math.min(A.step, B.step),
                    hStep: Math.min(A.hStep, B.hStep),
                    userAdded: true
                };
                state.sectionsMain.splice(between, 0, newS);
                var baseR = state.liaisonsMain[between - 1] || DEF_MAIN;
                var r1 = cloneLiaison(baseR);
                var r2 = cloneLiaison(baseR);
                state.liaisonsMain.splice(between - 1, 1, r1, r2);
            }

            onRefresh();
            if (typeof setupListeners === 'function') setupListeners();

            // Après re-render : décalage des IDs pour les champs au-dessus de l’insertion
            var tipH = elId('piqureTipHeight', 'rp3-h');
            var tipHs = elId('piqureTipHeightSlider', 'rp3-h-slider');

            function remapId(oldId) {
                if (mode === 'bague') {
                    var msb = oldId.match(/^sb(\d+)-(h|L|P|forme|carre-niveau)(-slider)?$/);
                    if (msb) {
                        var ksb = parseInt(msb[1], 10);
                        var tailSb = '-' + msb[2] + (msb[3] || '');
                        if (ksb > between) ksb = ksb + 1;
                        return 'sb' + ksb + tailSb;
                    }
                    var mrb = oldId.match(/^rb(\d+)-(type|rho)(-slider)?$/);
                    if (mrb) {
                        var irb = parseInt(mrb[1], 10);
                        var tailRb = '-' + mrb[2] + (mrb[3] || '');
                        if (irb === between) {
                            return ['rb' + between + tailRb, 'rb' + (between + 1) + tailRb];
                        }
                        if (irb > between) irb = irb + 1;
                        return 'rb' + irb + tailRb;
                    }
                    return oldId;
                }
                if (mode === 'piqure') {
                    if (oldId === tipH || oldId === tipHs) return oldId;
                    var msp = oldId.match(/^sp(\d+)-(h|L|P|forme|carre-niveau)(-slider)?$/);
                    if (msp) {
                        var ksp = parseInt(msp[1], 10);
                        var tailSp = '-' + msp[2] + (msp[3] || '');
                        if (ksp > between) ksp = ksp + 1;
                        return 'sp' + ksp + tailSp;
                    }
                    var mrp = oldId.match(/^rp(\d+)-(type|rho)(-slider)?$/);
                    if (mrp) {
                        var irp = parseInt(mrp[1], 10);
                        var tailRp = '-' + mrp[2] + (mrp[3] || '');
                        if (irp === between) {
                            return ['rp' + between + tailRp, 'rp' + (between + 1) + tailRp];
                        }
                        if (irp > between) irp = irp + 1;
                        return 'rp' + irp + tailRp;
                    }
                    return oldId;
                }
                var ms = oldId.match(/^s(\d+)-(h|L|P|forme|carre-niveau)(-slider)?$/);
                if (ms) {
                    var k = parseInt(ms[1], 10);
                    var tail = '-' + ms[2] + (ms[3] || '');
                    if (k > between) k = k + 1;
                    return 's' + k + tail;
                }
                var mr = oldId.match(/^r(\d+)(\d+)-(type|rho)(-slider)?$/);
                if (mr) {
                    var a = parseInt(mr[1], 10);
                    var b = parseInt(mr[2], 10);
                    var tailR = '-' + mr[3] + (mr[4] || '');
                    if (a === between && b === between + 1) return ['r' + between + (between + 1) + tailR, 'r' + (between + 1) + (between + 2) + tailR];
                    if (a > between) a = a + 1;
                    if (b > between + 1) b = b + 1;
                    return 'r' + a + b + tailR;
                }
                return oldId;
            }

            for (var key in snapshot) {
                if (!snapshot.hasOwnProperty(key)) continue;
                var mapped = remapId(key);
                if (Array.isArray(mapped)) {
                    for (var mi = 0; mi < mapped.length; mi++) {
                        var el2 = document.getElementById(mapped[mi]);
                        if (!el2) continue;
                        if (el2.type === 'checkbox') el2.checked = !!snapshot[key];
                        else el2.value = snapshot[key];
                    }
                } else {
                    var el3 = document.getElementById(mapped);
                    if (!el3) continue;
                    if (el3.type === 'checkbox') el3.checked = !!snapshot[key];
                    else el3.value = snapshot[key];
                }
            }

            if (typeof Validator !== 'undefined' && Validator.applyAllUserConstraints) Validator.applyAllUserConstraints();
            if (typeof updateBouteille === 'function') updateBouteille();
            if (typeof draw2D === 'function') draw2D();
            closeAddSectionPanel();
        });
    }

    // Sync complète DOM → state (avant persistance)
    function syncAllFromDom() {
        var state = getState();
        if (!state) return;
        syncMainFromDom(state);
        syncPiqureFromDom(state);
        syncBagueFromDom(state);
    }

    return {
        wireAddSectionButton: wireAddSectionButton,
        wireAddSectionFab: wireAddSectionFab,
        wireRemoveSectionButtons: wireRemoveSectionButtons,
        syncAllFromDom: syncAllFromDom
    };
})();
