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

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID().replace(/[^A-Za-z0-9-]/g,'');
    }
    return 'nl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,18);
  }

  function prepareForm(form) {
    if (!form) return;
    const started = form.querySelector('[name="formStartedAt"]');
    const submission = form.querySelector('[name="submissionId"]');
    if (started) started.value = String(Date.now());
    if (submission) submission.value = uid();
  }

  function setStatus(message, type) {
    if (!mainForm) return;
    const status = mainForm.querySelector('[data-preview-newsletter-status]');
    if (!status) return;
    status.textContent = message;
    status.classList.remove('is-error','is-success');
    if (type) status.classList.add(type);
  }

  function validateMainForm() {
    if (!mainForm) return false;
    const email = mainForm.querySelector('[name="email"]');
    const nick = mainForm.querySelector('[name="preferredNick"]');
    const consent = mainForm.querySelector('[name="consent"]');
    const legal = mainForm.querySelector('[name="legal"]');

    [email,nick].forEach(el => el && el.removeAttribute('aria-invalid'));

    if (!email || !email.checkValidity()) {
      email && email.setAttribute('aria-invalid','true');
      email && email.reportValidity();
      setStatus('Podaj prawidłowy adres e-mail.', 'is-error');
      return false;
    }
    if (nick && nick.value.trim() && !nick.checkValidity()) {
      nick.setAttribute('aria-invalid','true');
      nick.reportValidity();
      setStatus('Nick może mieć 3–24 znaki: litery, cyfry, _, . lub -.', 'is-error');
      return false;
    }
    if (!consent || !consent.checked) {
      consent && consent.focus();
      setStatus('Zaznacz zgodę na otrzymywanie newslettera.', 'is-error');
      return false;
    }
    if (!legal || !legal.checked) {
      legal && legal.focus();
      setStatus('Zaakceptuj Regulamin i potwierdź zapoznanie się z Polityką prywatności.', 'is-error');
      return false;
    }
    return true;
  }

  if (dialogClose) {
    dialogClose.addEventListener('click', () => {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    });
  }

  prepareForm(mainForm);

  // Prefill from the homepage footer (?email=...)
  if (mainForm) {
    const params = new URLSearchParams(window.location.search);
    const fromFooter = params.get('email');
    const email = mainForm.querySelector('[name="email"]');
    if (fromFooter && email) {
      email.value = fromFooter.slice(0,254);
      window.setTimeout(() => {
        email.scrollIntoView({behavior:'smooth',block:'center'});
        email.focus({preventScroll:true});
      }, 180);
    }

    mainForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!validateMainForm()) return;

      const honeypot = mainForm.querySelector('[name="website"]');
      if (honeypot && honeypot.value.trim()) return;

      const button = mainForm.querySelector('.premium-submit');
      const label = mainForm.querySelector('[data-submit-label]');
      button && (button.disabled = true);
      button && button.classList.add('is-loading');
      if (label) label.textContent = 'Przygotowuję zapis…';
      setStatus('Sprawdzam formularz i przygotowuję bezpieczny zapis…');

      window.setTimeout(() => {
        if (button) {
          button.disabled = false;
          button.classList.remove('is-loading');
        }
        if (label) label.textContent = 'Zapisz mnie do newslettera';
        setStatus('Formularz przeszedł walidację. W kolejnym pakiecie podłączymy go do API double opt-in.', 'is-success');
        showDialog(
          'Newsletter FULL MAX PREMIUM',
          'Formularz działa poprawnie w trybie testowym. Żadne dane nie zostały wysłane ani zapisane. Następny etap to podłączenie bezpiecznego API i wiadomości double opt-in.'
        );
        prepareForm(mainForm);
      }, 650);
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
      const target = mainForm && mainForm.querySelector('[name="email"]');
      if (target) {
        target.value = source.value.slice(0,254);
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