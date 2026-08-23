const form = document.querySelector('#newsletter-form');
const message = document.querySelector('#newsletter-message');

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.className = 'message';
  message.textContent = '';

  const data = new FormData(form);
  if (data.get('terms') !== 'on') {
    message.classList.add('error');
    message.textContent = 'Zaakceptuj regulamin i zapoznaj się z polityką prywatności.';
    return;
  }
  if (data.get('consent') !== 'on') {
    message.classList.add('error');
    message.textContent = 'Zaznacz zgodę, aby zapisać się na listę.';
    return;
  }

  const email = String(data.get('email') || '').trim();
  const preferredNick = String(data.get('preferredNick') || '').trim();

  if (!email) {
    message.classList.add('error');
    message.textContent = 'Podaj adres e-mail.';
    return;
  }

  if (preferredNick && !/^[\p{L}\p{N}_.-]{3,32}$/u.test(preferredNick)) {
    message.classList.add('error');
    message.textContent = 'Nick może mieć 3–32 znaki: litery (także polskie), cyfry, kropkę, _ lub -.';
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'ZAPISUJĘ…';

  try {
    const response = await fetch('/newsletter/subscribe', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify({ email, preferredNick, consent: true, acceptedTerms: true, termsVersion: 'newsletter-v1', privacyVersion: 'privacy-v1' })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'Nie udało się zapisać.');

    message.classList.add('ok');
    message.textContent = result.message || 'Dziękujemy! Jesteś na liście startowej Gracz.pl.';
    form.reset();
  } catch (error) {
    message.classList.add('error');
    message.textContent = error.message || 'Spróbuj ponownie za chwilę.';
  } finally {
    button.disabled = false;
    button.textContent = 'ZAPISZ MNIE NA START →';
  }
});
