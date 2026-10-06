(() => {
  'use strict';

  const mainForm = document.querySelector('[data-preview-newsletter-form]');
  const footerForm = document.querySelector('[data-footer-newsletter]');
  const dialog = document.querySelector('[data-preview-dialog]');
  const dialogTitle = document.querySelector('[data-preview-dialog-title]');
  const dialogText = document.querySelector('[data-preview-dialog-text]');
  const dialogClose = document.querySelector('[data-preview-dialog-close]');

  function showDialog(title, text) {
    if (!dialog) return;
    dialogTitle.textContent = title;
    dialogText.textContent = text;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open','');
  }

  if (dialogClose) {
    dialogClose.addEventListener('click', () => {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    });
  }

  if (mainForm) {
    mainForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = mainForm.querySelector('input[type="email"]');
      const status = mainForm.querySelector('[data-preview-newsletter-status]');
      if (!input || !input.checkValidity()) {
        input && input.reportValidity();
        return;
      }
      if (status) status.textContent = 'Podgląd działa poprawnie. Adres nie został wysłany ani zapisany.';
      showDialog('Newsletter — podgląd', 'Formularz jest aktywny wizualnie. Na tej bocznej gałęzi żadne dane nie są wysyłane ani zapisywane.');
    });
  }

  if (footerForm) {
    footerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const source = footerForm.querySelector('input[type="email"]');
      if (!source || !source.checkValidity()) {
        source && source.reportValidity();
        return;
      }
      const target = mainForm && mainForm.querySelector('input[type="email"]');
      if (target) {
        target.value = source.value;
        target.scrollIntoView({behavior:'smooth', block:'center'});
        window.setTimeout(() => target.focus(), 450);
      }
    });
  }

  document.querySelectorAll('[data-social-preview]').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.getAttribute('data-social-preview');
      showDialog('gracz.pl na ' + name, 'Ikona jest aktywna. Kanał ' + name + ' zostanie podłączony po uruchomieniu oficjalnego profilu gracz.pl.');
    });
  });
})();