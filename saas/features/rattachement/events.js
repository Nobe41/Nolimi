// Evénements dédiés aux contrôles de rattachement.
var RattachementEvents = (function () {
    function bindRhoSync(inputId, sliderId, onChange) {
        var input = document.getElementById(inputId);
        var slider = document.getElementById(sliderId);
        if (!input || !slider) return;

        function syncFromInput() {
            slider.value = input.value;
            if (typeof onChange === 'function') onChange(parseFloat(input.value));
        }
        function syncFromSlider() {
            input.value = slider.value;
            if (typeof onChange === 'function') onChange(parseFloat(slider.value));
        }

        if (!input.dataset.bound) {
            input.dataset.bound = '1';
            if (typeof UIControls !== 'undefined' && UIControls.bindApplyOnEnter) {
                UIControls.bindApplyOnEnter(input, syncFromInput);
            } else {
                input.addEventListener('keydown', function (e) {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    syncFromInput();
                    input.blur();
                });
            }
        }
        if (!slider.dataset.bound) {
            slider.dataset.bound = '1';
            slider.addEventListener('input', syncFromSlider);
            slider.addEventListener('change', syncFromSlider);
        }
    }

    return {
        bindRhoSync: bindRhoSync
    };
})();
