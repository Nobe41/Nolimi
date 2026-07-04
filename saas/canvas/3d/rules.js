var Canvas3DRules = (function () {
    return {
        VIEWPORT_ID: 'viewport-3d',
        TESSELLATION: {
            N_SEGMENTS: 128,
            N_FEUILLE_V: 32,
            MERIDIAN_RESOLUTION: 64
        },
        SECTION_RING: {
            COLOR_NORMAL: 0x000000,
            COLOR_HIGHLIGHT: 0xff0040,
            HIGHLIGHT_TUBE_RADIUS: 0.5
        },
        LIAISON_HIGHLIGHT: {
            COLOR: 0xff0040,
            OPACITY: 0.28,
            OUTWARD_OFFSET: 0.45
        },
        SCENE: {
            VIEWPORT_FIT_RATIO: 0.92,
            VIEW_SIZE_BASE: 250,
            VIEW_SIZE: 230,
            NEAR: 1,
            FAR: 2000,
            CAMERA_POSITION: { x: 400, y: 300, z: 400 },
            CONTROLS_TARGET_Y: 150,
            DIRECTIONAL_INTENSITY: 0.45,
            AMBIENT_INTENSITY: 0.5,
            AXES_SIZE: 100,
            GRID_SIZE: 400,
            GRID_DIVISIONS: 20,
            GRID_OPACITY: 0.6
        }
    };
})();
