// 03-website/pages/splash/ — affiche le logo puis redirige vers l’accueil.

(function () {
    var TARGET = '../accueil/index.html';
    var DISPLAY_MS = 1400; // durée d’affichage
    var FADE_MS = 450;     // doit matcher splash-out en CSS

    window.setTimeout(function () {
        document.body.classList.add('splash--exit');
        window.setTimeout(function () {
            window.location.replace(TARGET);
        }, FADE_MS);
    }, DISPLAY_MS);
})();
