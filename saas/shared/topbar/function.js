var TopbarShared = (function () {
    function init() {
        var btnFichierMenu = document.getElementById('btn-fichier-menu');
        var fichierDropdown = document.getElementById('fichier-dropdown');
        var btnAffichageMenu = document.getElementById('btn-affichage-menu');
        var affichageDropdown = document.getElementById('affichage-dropdown');
        var btnRealtimeMenu = document.getElementById('btn-realtime-menu');
        var realtimeDropdown = document.getElementById('realtime-dropdown');

        function hideOtherDropdowns(except) {
            if (except !== 'fichier' && fichierDropdown) fichierDropdown.classList.add('hidden');
            if (except !== 'affichage' && affichageDropdown) affichageDropdown.classList.add('hidden');
            if (except !== 'realtime' && realtimeDropdown) realtimeDropdown.classList.add('hidden');
        }

        if (btnFichierMenu && fichierDropdown) {
            btnFichierMenu.addEventListener('click', function (e) {
                e.stopPropagation();
                hideOtherDropdowns('fichier');
                fichierDropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', function (e) {
                if (!fichierDropdown.contains(e.target) && !btnFichierMenu.contains(e.target)) {
                    fichierDropdown.classList.add('hidden');
                }
                if (affichageDropdown && btnAffichageMenu && !affichageDropdown.contains(e.target) && !btnAffichageMenu.contains(e.target)) {
                    affichageDropdown.classList.add('hidden');
                }
                if (realtimeDropdown && btnRealtimeMenu && !realtimeDropdown.contains(e.target) && !btnRealtimeMenu.contains(e.target)) {
                    realtimeDropdown.classList.add('hidden');
                }
            });
        }

        if (btnAffichageMenu && affichageDropdown) {
            btnAffichageMenu.addEventListener('click', function (e) {
                e.stopPropagation();
                hideOtherDropdowns('affichage');
                affichageDropdown.classList.toggle('hidden');
            });
        }

        if (btnRealtimeMenu && realtimeDropdown) {
            btnRealtimeMenu.addEventListener('click', function (e) {
                e.stopPropagation();
                hideOtherDropdowns('realtime');
                realtimeDropdown.classList.toggle('hidden');
            });
        }

    }

    return {
        init: init
    };
})();
