// website/components/footer/ — pied de page du site.
// Ce fichier : HTML du footer + injection dans la page.

(function (global) {
    // Contenu du footer (copyright + lien légal)
    var HTML = [
        '<footer class="home-footer">',
        '  <p class="home-footer__copyright">© 2026 Nolimi. Tous droits réservés.</p>',
        '  <a href="../mentions-legales/index.html" class="home-footer__link">Documents légaux</a>',
        '</footer>'
    ].join('');

    // Insère le footer après le <main> (ou remplace s’il existe déjà).
    function mount() {
        var existing = document.querySelector('footer.home-footer');
        if (existing) {
            existing.outerHTML = HTML;
            return;
        }

        var main = document.querySelector('main');
        if (main) {
            main.insertAdjacentHTML('afterend', HTML);
            return;
        }

        document.body.insertAdjacentHTML('beforeend', HTML);
    }

    global.NolimiFooter = { mount: mount };
})(window);
