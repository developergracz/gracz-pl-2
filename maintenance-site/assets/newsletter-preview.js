(() => {
  'use strict';

  const mainForm = document.querySelector('[data-preview-newsletter-form]');
  const footerForm = document.querySelector('[data-footer-newsletter]');
  const status = document.querySelector('[data-preview-newsletter-status]');
  const submit = document.querySelector('[data-newsletter-submit]');
  const resend = document.querySelector('[data-preview-resend]');
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

  function setStatus(kind, title, message) {
    if (!status) return;
    status.classList.remove('is-success','is-error','is-info');
    if (kind) status.classList.add('is-' + kind);
    status.innerHTML = '<strong>' + title + '</strong><br>' + message;
  }

  function populateFromQuery() {
    if (!mainForm) return;
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');
    if (!email) return;
    const input = mainForm.querySelector('input[name="email"]');
    if (input) {
      input.value = email.slice(0,254);
      window.setTimeout(() => {
        document.getElementById('zapis')?.scrollIntoView({behavior:'smooth',block:'center'});
        input.focus();
      }, 250);
    }
  }

  function validateMainForm() {
    if (!mainForm) return false;
    const email = mainForm.querySelector('input[name="email"]');
    const nick = mainForm.querySelector('input[name="preferredNick"]');
    const consent = mainForm.querySelector('input[name="consent"]');
    const legal = mainForm.querySelector('input[name="legal"]');

    if (!email || !email.checkValidity()) {
      email && email.reportValidity();
      setStatus('error','Sprawdź adres e-mail.','Wpisz prawidłowy adres, na który będzie można wysłać link potwierdzający.');
      return false;
    }
    if (nick && nick.value && !nick.checkValidity()) {
      nick.reportValidity();
      setStatus('error','Sprawdź nick.','Nick może mieć 3–24 znaki: litery, cyfry, _, . lub -.');
      return false;
    }
    if (!consent?.checked || !legal?.checked) {
      setStatus('error','Potrzebne są dwie zgody.','Zaznacz zgodę newsletterową oraz potwierdzenie zapoznania się z dokumentami.');
      (!consent?.checked ? consent : legal)?.focus();
      return false;
    }
    return true;
  }

  if (mainForm) {
    mainForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!validateMainForm()) return;

      const honeypot = mainForm.querySelector('input[name="website"]');
      if (honeypot && honeypot.value.trim()) return;

      submit?.classList.add('is-loading');
      if (submit) submit.disabled = true;

      window.setTimeout(() => {
        submit?.classList.remove('is-loading');
        if (submit) submit.disabled = false;
        setStatus(
          'success',
          'Pakiet 1 działa poprawnie.',
          'Formularz przeszedł walidację. Na tej bocznej gałęzi dane nie są jeszcze wysyłane. W Pakiecie 2 podłączymy istniejące API double opt-in.'
        );
        if (resend) resend.hidden = false;
        document.querySelectorAll('.signup-step')[0]?.classList.add('is-done');
        document.querySelectorAll('.signup-step')[1]?.classList.add('is-active');
      }, 650);
    });
  }

  if (resend) {
    resend.addEventListener('click', () => {
      setStatus('info','Ponowienie potwierdzenia — etap podglądowy.','Przycisk jest gotowy wizualnie. Po podłączeniu API będzie korzystał z bezpiecznego endpointu ponownej wysyłki.');
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
      const target = mainForm && mainForm.querySelector('input[name="email"]');
      if (target) {
        target.value = source.value.slice(0,254);
        document.getElementById('zapis')?.scrollIntoView({behavior:'smooth',block:'center'});
        window.setTimeout(() => target.focus(), 420);
      }
    });
  }

  document.querySelectorAll('[data-social-preview]').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.getAttribute('data-social-preview');
      showDialog('gracz.pl na ' + name, 'Ikona jest aktywna. Kanał ' + name + ' zostanie podłączony po uruchomieniu oficjalnego profilu gracz.pl.');
    });
  });

  populateFromQuery();
})();