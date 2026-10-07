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
    status.innerHTML = '<strong>' + escapeHtml(type === 'is-error' ? 'Sprawdź formularz.' : type === 'is-success' ? 'Gotowe.' : 'Bezpieczny double opt-in.') + '</strong> ' + escapeHtml(message);
    status.classList.remove('is-error','is-success','is-info');
    if (type) status.classList.add(type);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
    });
  }

  function fieldError(name, message) {
    if (!mainForm) return;
    const input = mainForm.querySelector('[name="' + name + '"]');
    const box = mainForm.querySelector('[data-error-for="' + name + '"]');
    const group = input && input.closest('.field-group');

    if (input) {
      input.setAttribute('aria-invalid','true');
      input.classList.add('is-invalid');
    }
    if (group) group.classList.remove('is-valid');
    if (box) {
      const text = box.querySelector('.field-error__text');
      if (text) text.textContent = message;
      box.hidden = false;
    }
  }

  function clearFieldError(name, markValid) {
    if (!mainForm) return;
    const input = mainForm.querySelector('[name="' + name + '"]');
    const box = mainForm.querySelector('[data-error-for="' + name + '"]');
    const group = input && input.closest('.field-group');

    if (input) {
      input.removeAttribute('aria-invalid');
      input.classList.remove('is-invalid');
    }
    if (box) {
      box.hidden = true;
      const text = box.querySelector('.field-error__text');
      if (text) text.textContent = '';
    }
    if (group) group.classList.toggle('is-valid', !!markValid);
  }

  function focusInvalid(element) {
    if (!element) return;
    element.focus({preventScroll:true});
    element.scrollIntoView({behavior:'smooth',block:'center'});
  }

  function validEmail(value) {
    const normalized = String(value || '').trim();
    return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized);
  }

  function validNick(value) {
    const normalized = String(value || '').trim();
    return !normalized || /^[A-Za-z0-9_.-]{3,24}$/.test(normalized);
  }

  function clearConsentState() {
    if (!mainForm) return;
    mainForm.querySelectorAll('.consent-row').forEach(row => row.classList.remove('is-invalid'));
  }

  function validateMainForm() {
    if (!mainForm) return false;

    const email = mainForm.querySelector('[name="email"]');
    const nick = mainForm.querySelector('[name="preferredNick"]');
    const consent = mainForm.querySelector('[name="consent"]');
    const legal = mainForm.querySelector('[name="legal"]');

    clearFieldError('email', false);
    clearFieldError('preferredNick', false);
    clearConsentState();

    if (!email || !String(email.value || '').trim()) {
      fieldError('email','Podaj adres e-mail.');
      setStatus('Uzupełnij wymagany adres e-mail.', 'is-error');
      focusInvalid(email);
      return false;
    }

    if (!validEmail(email.value)) {
      fieldError('email','Wpisz poprawny adres e-mail, np. gracz@example.com.');
      setStatus('Adres e-mail ma nieprawidłowy format.', 'is-error');
      focusInvalid(email);
      return false;
    }
    clearFieldError('email', true);

    if (nick && !validNick(nick.value)) {
      fieldError('preferredNick','Nick może mieć 3–24 znaki: litery, cyfry, _, . lub -.');
      setStatus('Popraw pole nick.', 'is-error');
      focusInvalid(nick);
      return false;
    }
    clearFieldError('preferredNick', !!(nick && nick.value.trim()));

    if (!consent || !consent.checked) {
      const row = consent && consent.closest('.consent-row');
      if (row) row.classList.add('is-invalid');
      setStatus('Zaznacz zgodę na otrzymywanie newslettera.', 'is-error');
      focusInvalid(consent);
      return false;
    }

    if (!legal || !legal.checked) {
      const row = legal && legal.closest('.consent-row');
      if (row) row.classList.add('is-invalid');
      setStatus('Potwierdź zapoznanie się z Polityką prywatności i Regulaminem.', 'is-error');
      focusInvalid(legal);
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

  if (mainForm) {
    const params = new URLSearchParams(window.location.search);
    const fromFooter = params.get('email');
    const email = mainForm.querySelector('[name="email"]');
    const nick = mainForm.querySelector('[name="preferredNick"]');

    if (fromFooter && email) {
      email.value = fromFooter.slice(0,254);
      window.setTimeout(() => {
        email.scrollIntoView({behavior:'smooth',block:'center'});
        email.focus({preventScroll:true});
      }, 180);
    }

    if (email) {
      email.addEventListener('input', () => {
        if (!email.value.trim()) {
          clearFieldError('email', false);
          return;
        }
        if (validEmail(email.value)) clearFieldError('email', true);
        else clearFieldError('email', false);
      });
      email.addEventListener('blur', () => {
        if (!email.value.trim()) {
          fieldError('email','Podaj adres e-mail.');
        } else if (!validEmail(email.value)) {
          fieldError('email','Wpisz poprawny adres e-mail, np. gracz@example.com.');
        } else {
          clearFieldError('email', true);
        }
      });
    }

    if (nick) {
      nick.addEventListener('input', () => {
        if (validNick(nick.value)) clearFieldError('preferredNick', !!nick.value.trim());
        else clearFieldError('preferredNick', false);
      });
      nick.addEventListener('blur', () => {
        if (!validNick(nick.value)) fieldError('preferredNick','Nick może mieć 3–24 znaki: litery, cyfry, _, . lub -.');
        else clearFieldError('preferredNick', !!nick.value.trim());
      });
    }

    mainForm.querySelectorAll('.consent-row input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const row = checkbox.closest('.consent-row');
        if (row && checkbox.checked) row.classList.remove('is-invalid');
      });
    });

    mainForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!validateMainForm()) return;

      const honeypot = mainForm.querySelector('[name="website"]');
      if (honeypot && honeypot.value.trim()) return;

      const button = mainForm.querySelector('.premium-submit');
      button && (button.disabled = true);
      button && button.classList.add('is-loading');
      setStatus('Sprawdzam formularz i przygotowuję bezpieczny zapis…', 'is-info');

      window.setTimeout(() => {
        if (button) {
          button.disabled = false;
          button.classList.remove('is-loading');
        }
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
    const source = footerForm.querySelector('input[type="email"]');
    const footerStatus = document.querySelector('[data-footer-newsletter-status]');

    function setFooterStatus(message, type) {
      if (!footerStatus) return;
      footerStatus.textContent = message;
      footerStatus.classList.remove('is-error','is-success');
      if (type) footerStatus.classList.add(type);
    }

    if (source) {
      source.addEventListener('input', () => {
        source.removeAttribute('aria-invalid');
        if (footerStatus) footerStatus.classList.remove('is-error');
      });
    }

    footerForm.addEventListener('submit', (event) => {
      event.preventDefault();

      if (!source || !String(source.value || '').trim()) {
        if (source) source.setAttribute('aria-invalid','true');
        setFooterStatus('Podaj adres e-mail, aby przejść do bezpiecznego formularza.', 'is-error');
        source && source.focus();
        return;
      }

      if (!validEmail(source.value)) {
        source.setAttribute('aria-invalid','true');
        setFooterStatus('Wpisz poprawny adres e-mail.', 'is-error');
        source.focus();
        return;
      }

      source.removeAttribute('aria-invalid');
      setFooterStatus('Adres poprawny — przenoszę do formularza zapisu.', 'is-success');

      const target = mainForm && mainForm.querySelector('[name="email"]');
      if (target) {
        target.value = source.value.slice(0,254);
        clearFieldError('email', true);
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