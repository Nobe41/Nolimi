// 01-saas/features/render/math.js
// Petits helpers sans effet de bord pour le mode rendu.
// Convertit l’état du toggle « mode rendu » en mode matériau (base ou verre).

var RenderMath = (function () {
    var RULES = (typeof RenderRules !== 'undefined') ? RenderRules : {};
    var MODE_BASE = RULES.MODE_BASE || 'base';
    var MODE_GLASS = RULES.MODE_GLASS || 'glass';

    function materialModeFromToggle(enabled) {
        return enabled ? MODE_GLASS : MODE_BASE;
    }

    return {
        materialModeFromToggle: materialModeFromToggle
    };
})();
