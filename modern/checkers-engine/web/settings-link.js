(() => {
  const host = location.hostname.toLowerCase();
  const publicLaunchPage = host === 'gracz.pl' || host === 'www.gracz.pl';

  if (publicLaunchPage) {
    document.title = 'Gracz.pl — platforma gier online w budowie';
    document.body.innerHTML = `
      <main class="launch-page">
        <header class="launch-head">
          <a class="launch-logo" href="/" aria-label="Gracz.pl">gracz<span>.PL</span></a>
          <span class="launch-status"><i></i> PLATFORMĘ WŁAŚNIE BUDUJEMY</span>
        </header>
        <section class="launch-hero">
          <div class="launch-copy">
            <span class="launch-eyebrow">WITAMY NA GRACZ.PL</span>
            <h1>Nowa platforma<br><em>gier online multiplayer</em><br>jest w przygotowaniu.</h1>
            <p>Budujemy Gracz.pl — miejsce do rozgrywek online, rywalizacji, rankingów, turniejów i społeczności graczy. Serwis oraz gry są obecnie w fazie tworzenia i testów.</p>
            <div class="launch-points"><span>♟ Gry multiplayer</span><span>🏆 Rankingi i turnieje</span><span>👥 Społeczność graczy</span></div>
          </div>
          <aside class="launch-card">
            <span class="launch-badge">LISTA PIERWSZYCH GRACZY</span>
            <h2>Bądź jednym z pierwszych.</h2>
            <p>Zapisz się do newslettera Gracz.pl. Powiadomimy Cię o starcie serwisu i pierwszych testach.</p>
            <form id="launch-newsletter" novalidate>
              <label>Adres e-mail<input name="email" type="email" maxlength="254" autocomplete="email" placeholder="twoj@email.pl" required></label>
              <label>Twój preferowany nick <small>(opcjonalnie)</small><input name="preferredNick" type="text" minlength="3" maxlength="32" autocomplete="nickname" placeholder="np. Victorio"></label>
              <small class="nick-help">Jeżeli nick jest wolny, zarezerwujemy go dla Twojego adresu e-mail. Dozwolone: litery, cyfry, kropka, _ i -.</small>
              <label class="launch-consent"><input name="consent" type="checkbox" required><span>Chcę otrzymywać na podany adres e-mail informacje o uruchomieniu Gracz.pl, testach oraz najważniejszych nowościach platformy. Zgoda jest dobrowolna i może zostać wycofana.</span></label>
              <button type="submit">ZAPISZ MNIE NA START GRACZ.PL →</button>
              <p id="launch-result" role="status" aria-live="polite"></p>
            </form>
            <div class="launch-privacy">🔒 Podane dane wykorzystujemy wyłącznie do listy startowej Gracz.pl, informacji o uruchomieniu platformy oraz — jeśli podasz nick — jego rezerwacji. Nie zakładamy w ten sposób konta gracza.</div>
          </aside>
        </section>
        <section class="launch-progress">
          <div><strong>01</strong><b>Budowa platformy</b><span>Interfejs, infrastruktura i bezpieczeństwo.</span></div>
          <div><strong>02</strong><b>Testy gier</b><span>Warcaby i kolejne gry multiplayer.</span></div>
          <div><strong>03</strong><b>Testy społeczności</b><span>Profile, wiadomości, rankingi i turnieje.</span></div>
          <div><strong>04</strong><b>Premiera Gracz.pl</b><span>Poinformujemy zapisanych użytkowników jako pierwszych.</span></div>
        </section>
        <footer class="launch-footer"><span>© 2026 Gracz.pl</span><span>Serwis w budowie · publiczna rejestracja kont jest wyłączona</span></footer>
      </main>`;

    const style = document.createElement('style');
    style.textContent = `
      *{box-sizing:border-box}html{background:#030a0f}body{margin:0;min-height:100vh;background:radial-gradient(circle at 72% 18%,#0c2831 0,#06141c 34%,#030a0f 70%);color:#edf5f7;font-family:Inter,"Segoe UI",Arial,sans-serif}.launch-page{width:min(1240px,calc(100vw - 38px));margin:0 auto;min-height:100vh;display:flex;flex-direction:column}.launch-head{height:82px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #15313d}.launch-logo{color:#f5f8fa;text-decoration:none;font-size:31px;font-weight:950;letter-spacing:-2px}.launch-logo span{color:#ff3946;font-size:15px;letter-spacing:-1px}.launch-status{display:flex;align-items:center;gap:9px;color:#87a0aa;font-size:10px;font-weight:900;letter-spacing:.12em}.launch-status i{width:8px;height:8px;border-radius:50%;background:#23e27e;box-shadow:0 0 14px #23e27e}.launch-hero{display:grid;grid-template-columns:1.08fr .92fr;gap:54px;align-items:center;padding:76px 0 54px}.launch-eyebrow{color:#26e789;font-size:11px;font-weight:950;letter-spacing:.16em}.launch-copy h1{margin:16px 0 22px;font-size:56px;line-height:1.02;letter-spacing:-2.8px}.launch-copy h1 em{font-style:normal;color:#2ce487}.launch-copy p{max-width:650px;color:#9bb0ba;font-size:16px;line-height:1.75}.launch-points{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}.launch-points span{padding:9px 12px;border:1px solid #1c3d4a;border-radius:999px;background:#07151d;color:#c6d4da;font-size:11px;font-weight:750}.launch-card{padding:28px;border:1px solid #1f4655;border-top:2px solid #23df7e;border-radius:18px;background:linear-gradient(180deg,#091923,#06131b);box-shadow:0 28px 80px #0009,inset 0 1px 0 #23df7e1f}.launch-badge{display:inline-block;padding:6px 9px;border:1px solid #146d45;border-radius:7px;background:#08281d;color:#69eca4;font-size:9px;font-weight:950;letter-spacing:.09em}.launch-card h2{margin:16px 0 8px;font-size:28px}.launch-card>p{margin:0 0 20px;color:#9eb1ba;line-height:1.6;font-size:13px}.launch-card label:not(.launch-consent){display:block;margin:13px 0 6px;color:#dbe6ea;font-size:11px;font-weight:800}.launch-card label small{color:#7f949e;font-weight:600}.launch-card input[type=email],.launch-card input[type=text]{width:100%;height:48px;margin-top:7px;padding:0 13px;border:1px solid #274957;border-radius:9px;outline:none;background:#040e14;color:#f7fbfc;font-size:14px}.launch-card input:focus{border-color:#22d97b;box-shadow:0 0 0 3px #22d97b18}.nick-help{display:block;color:#718791;font-size:9px;line-height:1.55}.launch-consent{display:grid;grid-template-columns:18px 1fr;gap:9px;align-items:start;margin:18px 0;color:#91a6af;font-size:9px;line-height:1.55}.launch-consent input{margin-top:2px}.launch-card button{width:100%;height:49px;border:0;border-radius:9px;background:linear-gradient(180deg,#24e47e,#0dae54);color:#03140a;font-weight:950;letter-spacing:.04em;cursor:pointer}.launch-card button:disabled{opacity:.55;cursor:wait}.launch-privacy{margin-top:14px;padding:11px;border:1px solid #173641;border-radius:8px;background:#051117;color:#728991;font-size:9px;line-height:1.55}#launch-result{min-height:20px;margin:10px 0 0;text-align:center;font-size:11px;font-weight:800}#launch-result.ok{color:#34e88e}#launch-result.error{color:#ff7880}.launch-progress{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #163542;border-radius:13px;background:#051219;overflow:hidden}.launch-progress div{padding:20px;border-right:1px solid #163542}.launch-progress div:last-child{border-right:0}.launch-progress strong{display:block;color:#2be488;font-size:10px}.launch-progress b{display:block;margin:7px 0 4px;font-size:12px}.launch-progress span{color:#718791;font-size:9px;line-height:1.5}.launch-footer{display:flex;justify-content:space-between;gap:20px;margin-top:auto;padding:25px 0;color:#607680;font-size:9px}@media(max-width:850px){.launch-hero{grid-template-columns:1fr;padding-top:44px}.launch-copy h1{font-size:42px}.launch-progress{grid-template-columns:1fr 1fr}.launch-progress div:nth-child(2){border-right:0}}@media(max-width:520px){.launch-page{width:calc(100vw - 24px)}.launch-head{height:68px}.launch-status{display:none}.launch-copy h1{font-size:34px}.launch-hero{gap:28px}.launch-card{padding:20px}.launch-progress{grid-template-columns:1fr}.launch-progress div{border-right:0;border-bottom:1px solid #163542}.launch-footer{flex-direction:column}}
    `;
    document.head.appendChild(style);

    const form = document.querySelector('#launch-newsletter');
    const result = document.querySelector('#launch-result');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      result.className='';result.textContent='';
      const data = new FormData(form);
      const payload = { email:String(data.get('email')||'').trim(), preferredNick:String(data.get('preferredNick')||'').trim(), consent:data.get('consent')==='on' };
      if (!payload.email || !payload.consent) { result.className='error'; result.textContent='Podaj e-mail i zaznacz zgodę.'; return; }
      const button=form.querySelector('button[type=submit]');button.disabled=true;button.textContent='ZAPISUJĘ…';
      try {
        const response=await fetch('/newsletter/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
        const body=await response.json();
        if(!response.ok) throw new Error(body.error?.message||'Nie udało się zapisać.');
        result.className='ok';result.textContent=body.message||'Dziękujemy za zapis.';form.reset();
      } catch(error) { result.className='error';result.textContent=error.message||'Nie udało się zapisać.'; }
      finally { button.disabled=false;button.textContent='ZAPISZ MNIE NA START GRACZ.PL →'; }
    });
    return;
  }

  const navStyle = document.createElement('style');
  navStyle.textContent = `
    .main-nav a {font-family:Inter,"Segoe UI",Arial,sans-serif;font-size:12.5px;font-weight:700;letter-spacing:.035em;text-transform:none;line-height:1;transition:color .18s ease,border-color .18s ease,transform .18s ease,opacity .18s ease}
    .main-nav a:hover{color:#55ec97;transform:translateY(-1px)}.main-nav a.active{font-weight:750}
    #account-box a,#account-box a:link,#account-box a:visited,#account-box a:hover,#account-box a:active,.account-box a,.account-box a:link,.account-box a:visited,.account-box a:hover,.account-box a:active{text-decoration:none!important;text-decoration-line:none!important;border-bottom:0!important;box-shadow:none!important}
  `;
  document.head.appendChild(navStyle);

  const account=document.querySelector('#account-box nav');if(account){for(const link of account.querySelectorAll('a')){const label=link.textContent.trim().toLowerCase();if(label==='ustawienia'){link.href='/settings.html';link.setAttribute('aria-label','Otwórz ustawienia konta')}if(label==='wiadomości'&&!link.getAttribute('href'))link.href='/messages.html'}}
  const mainNav=document.querySelector('.main-nav');if(mainNav){for(const link of mainNav.querySelectorAll('a')){const rawLabel=link.textContent.trim();const cleanLabel=rawLabel.replace(/⌄/g,'').trim();if(cleanLabel!==rawLabel)link.textContent=cleanLabel;const label=cleanLabel.toUpperCase();if(label==='TURNIEJE'){link.href='/tournaments.html';link.title='Centrum turniejowe Gracz.pl';link.setAttribute('aria-label','Otwórz centrum turniejowe')}if(label==='RANKING'){link.href='/ranking.html';link.title='Ranking Gracz.pl';link.setAttribute('aria-label','Otwórz ranking graczy')}if(label==='SPOŁECZNOŚĆ'){link.href='/community.html';link.title='Społeczność Gracz.pl';link.setAttribute('aria-label','Otwórz społeczność Gracz.pl')}}if(!mainNav.querySelector('[data-global-chat-link]')){const link=document.createElement('a');link.href='/global-chat.html';link.dataset.globalChatLink='true';link.textContent='CHAT OGÓLNY';link.title='Chat ogólny społeczności Gracz.pl';const help=[...mainNav.querySelectorAll('a')].find(item=>item.textContent.trim().toUpperCase()==='POMOC');if(help)mainNav.insertBefore(link,help);else mainNav.append(link)}}
  const tournamentSection=document.querySelector('.tournament');if(tournamentSection){const button=tournamentSection.querySelector('.primary');if(button){button.type='button';button.addEventListener('click',()=>{location.href='/tournaments.html'});button.setAttribute('aria-label','Zobacz turnieje Gracz.pl')}const rankingButton=tournamentSection.querySelector('.ranking button');if(rankingButton){rankingButton.type='button';rankingButton.addEventListener('click',()=>{location.href='/ranking.html'});rankingButton.setAttribute('aria-label','Zobacz ranking Gracz.pl')}}
})();
