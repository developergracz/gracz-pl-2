(() => {
  const account = document.querySelector('#account-box nav');
  if (!account) return;
  for (const link of account.querySelectorAll('a')) {
    const label = link.textContent.trim().toLowerCase();
    if (label === 'ustawienia') {
      link.href = '/settings.html';
      link.setAttribute('aria-label', 'Otwórz ustawienia konta');
    }
    if (label === 'wiadomości' && !link.getAttribute('href')) link.href = '/messages.html';
  }
})();
