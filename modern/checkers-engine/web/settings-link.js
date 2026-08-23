(() => {
  const navStyle = document.createElement('style');
  navStyle.textContent = `
    .main-nav a {
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      font-size: 12.5px;
      font-weight: 700;
      letter-spacing: .035em;
      text-transform: none;
      line-height: 1;
      transition: color .18s ease, border-color .18s ease, transform .18s ease, opacity .18s ease;
    }
    .main-nav a:hover { color: #55ec97; transform: translateY(-1px); }
    .main-nav a.active { font-weight: 750; }

    /* Panel konta: wszystkie pozycje bez poziomych linii/podkreśleń. */
    #account-box a,
    #account-box a:link,
    #account-box a:visited,
    #account-box a:hover,
    #account-box a:active,
    .account-box a,
    .account-box a:link,
    .account-box a:visited,
    .account-box a:hover,
    .account-box a:active {
      text-decoration: none !important;
      text-decoration-line: none !important;
      border-bottom: 0 !important;
      box-shadow: none !important;
    }
  `;
  document.head.appendChild(navStyle);

  const account = document.querySelector('#account-box nav');
  if (account) {
    for (const link of account.querySelectorAll('a')) {
      const label = link.textContent.trim().toLowerCase();
      if (label === 'ustawienia') { link.href = '/settings.html'; link.setAttribute('aria-label', 'Otwórz ustawienia konta'); }
      if (label === 'wiadomości' && !link.getAttribute('href')) link.href = '/messages.html';
    }
  }

  const mainNav = document.querySelector('.main-nav');
  if (mainNav) {
    for (const link of mainNav.querySelectorAll('a')) {
      const rawLabel = link.textContent.trim();
      const cleanLabel = rawLabel.replace(/⌄/g, '').trim();
      if (cleanLabel !== rawLabel) link.textContent = cleanLabel;
      const label = cleanLabel.toUpperCase();
      if (label === 'TURNIEJE') { link.href='/tournaments.html'; link.title='Centrum turniejowe Gracz.pl'; link.setAttribute('aria-label','Otwórz centrum turniejowe'); }
      if (label === 'RANKING') { link.href='/ranking.html'; link.title='Ranking Gracz.pl'; link.setAttribute('aria-label','Otwórz ranking graczy'); }
      if (label === 'SPOŁECZNOŚĆ') { link.href='/community.html'; link.title='Społeczność Gracz.pl'; link.setAttribute('aria-label','Otwórz społeczność Gracz.pl'); }
    }

    if (!mainNav.querySelector('[data-global-chat-link]')) {
      const link=document.createElement('a'); link.href='/global-chat.html'; link.dataset.globalChatLink='true'; link.textContent='CHAT OGÓLNY'; link.title='Chat ogólny społeczności Gracz.pl';
      const help=[...mainNav.querySelectorAll('a')].find(item=>item.textContent.trim().toUpperCase()==='POMOC'); if(help)mainNav.insertBefore(link,help);else mainNav.append(link);
    }
  }

  const tournamentSection=document.querySelector('.tournament');
  if(tournamentSection){const button=tournamentSection.querySelector('.primary');if(button){button.type='button';button.addEventListener('click',()=>{location.href='/tournaments.html'});button.setAttribute('aria-label','Zobacz turnieje Gracz.pl')}const rankingButton=tournamentSection.querySelector('.ranking button');if(rankingButton){rankingButton.type='button';rankingButton.addEventListener('click',()=>{location.href='/ranking.html'});rankingButton.setAttribute('aria-label','Zobacz ranking Gracz.pl')}}

  /* Bezpieczne wylogowanie: unieważnia sesję na serwerze i blokuje odtworzenie
     zalogowanego widoku po użyciu przycisku Wstecz (bfcache). */
  const restoreLoggedOutView = () => {
    const auth = document.querySelector('#auth');
    const lobby = document.querySelector('#lobby');
    if (lobby) lobby.hidden = true;
    if (auth) auth.hidden = false;
    const note = document.querySelector('#logged-out-note');
    if (note) note.textContent = 'Zaloguj się, aby rozpocząć grę';
  };

  const logoutButton = document.querySelector('#logout');
  if (logoutButton) {
    logoutButton.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      logoutButton.disabled = true;
      try {
        await fetch('/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
      } catch (_) {
        /* Nawet przy chwilowym błędzie sieci usuwamy lokalny stan logowania. */
      }
      sessionStorage.removeItem('gracz-session');
      sessionStorage.removeItem('gracz-auth-token');
      localStorage.removeItem('gracz-auth-token');
      restoreLoggedOutView();
      history.replaceState({ loggedOut: true }, '', '/');
      location.replace('/');
    }, true);
  }

  window.addEventListener('pageshow', async (event) => {
    const backForward = event.persisted || performance.getEntriesByType('navigation').some((entry) => entry.type === 'back_forward');
    if (!backForward) return;

    if (!sessionStorage.getItem('gracz-session')) restoreLoggedOutView();

    try {
      const response = await fetch('/auth/me', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!response.ok) {
        sessionStorage.removeItem('gracz-session');
        sessionStorage.removeItem('gracz-auth-token');
        localStorage.removeItem('gracz-auth-token');
        restoreLoggedOutView();
        if (location.pathname !== '/') location.replace('/');
      }
    } catch (_) {
      if (!sessionStorage.getItem('gracz-session')) restoreLoggedOutView();
    }
  });
})();
