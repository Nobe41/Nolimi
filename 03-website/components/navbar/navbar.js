// 03-website/components/navbar/ — barre du haut du site.
// Ce fichier : HTML de la navbar + injection dans la page.

(function (global) {
    var LOGO = '../../../assets/brand/nolimi-logo-wordmark.jpg';

    // Bouton : classes + aria selon la page active (current).
    // current : null | 'licences' | 'connexion'
    function cta(current, name, secondary) {
        var isCurrent = current === name;
        var classes = 'panel-cta';
        if (isCurrent) classes += ' panel-cta--current';
        else if (secondary) classes += ' panel-cta--secondary';
        return {
            className: classes,
            attrs: isCurrent ? ' aria-current="page"' : ''
        };
    }

    function buildHtml(current) {
        var licences = cta(current, 'licences', true);
        var connexion = cta(current, 'connexion', false);

        return [
            '<header class="panel">',
            '  <a href="../accueil/index.html" class="panel-logo" aria-label="Nolimi — accueil">',
            '    <img src="' + LOGO + '" alt="" class="panel-logo__img" width="1024" height="300" decoding="async">',
            '  </a>',
            '  <nav class="panel-actions" aria-label="Actions principales">',
            '    <a href="../abonnement/index.html" class="' + licences.className + '"' + licences.attrs + '>Licences</a>',
            '    <a href="../connexion/index.html" class="' + connexion.className + '"' + connexion.attrs + '>Se connecter</a>',
            '  </nav>',
            '</header>'
        ].join('');
    }

    // Insère la navbar en haut du body (ou remplace si déjà présente).
    function mount(options) {
        options = options || {};
        var html = buildHtml(options.current || null);
        var existing = document.querySelector('header.panel');
        if (existing) {
            existing.outerHTML = html;
            return;
        }
        document.body.insertAdjacentHTML('afterbegin', html);
    }

    global.NolimiNavbar = { mount: mount };
})(window);
