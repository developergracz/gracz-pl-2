(() => {
  const account = document.querySelector('#account-box nav');
  if (account) {
    for (const link of account.querySelectorAll('a')) {
      const label = link.textContent.trim().toLowerCase();
      if (label === 'ustawienia') {
        link.href = '/settings.html';
        link.setAttribute('aria-label', 'Otwórz ustawienia konta');
      }
      if (label === 'wiadomości' && !link.getAttribute('href')) link.href = '/messages.html';
    }
  }

  const mainNav = document.querySelector('.main-nav');
  if (mainNav && !mainNav.querySelector('[data-global-chat-link]')) {
    const link = document.createElement('a');
    link.href = '/global-chat.html';
    link.dataset.globalChatLink = 'true';
    link.textContent = 'CHAT OGÓLNY';
    link.title = 'Chat ogólny społeczności Gracz.pl';
    const help = [...mainNav.querySelectorAll('a')].find((item) => item.textContent.trim().toUpperCase() === 'POMOC');
    if (help) mainNav.insertBefore(link, help);
    else mainNav.append(link);
  }
})();
