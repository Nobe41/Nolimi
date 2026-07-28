// 01-saas/features/render/rules.js
// Constantes du « mode rendu » (toggle dans le panneau gauche).
// Modes matériau : base (édition) ou verre (studio).
// IDs DOM des contrôles étiquettes ; valeurs par défaut hauteur / taille / rotation.
// Pas de scène décorative — bouteille + fond viewport uniquement.

var RenderRules = (function () {
    return {
        MODE_BASE: 'base',
        MODE_GLASS: 'glass',
        IDS: {
            modeToggle: 'render-mode-toggle',
            materialGlass: 'render-material-glass',
            labelCard: 'render-label-card',
            labelImage: 'render-label-image',
            labelList: 'render-label-list',
            labelHeight: 'render-label-height',
            labelHeightNumber: 'render-label-height-number',
            labelSize: 'render-label-size',
            labelSizeNumber: 'render-label-size-number',
            labelRotation: 'render-label-rotation',
            labelRotationNumber: 'render-label-rotation-number',
            labelFlipX: 'render-label-flip-x',
            labelFlipY: 'render-label-flip-y'
        },
        LABEL_HEIGHT_DEFAULT: 40,
        LABEL_SIZE_DEFAULT: 100,
        LABEL_ROTATION_DEFAULT: 0,
        LABEL_HEIGHT_FALLBACK: { min: -120, max: 400 }
    };
})();
