(() => {
  const session = (() => { try { return JSON.parse(sessionStorage.getItem('gracz-session') || 'null'); } catch { return null; } })();
  if (!session?.token || !session?.user) return;

  const style = document.createElement('style');
  style.textContent = `
  .profile-link{cursor:pointer!important}.gp-overlay{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(2,7,11,.82);backdrop-filter:blur(8px)}.gp-overlay.open{display:flex}.gp-modal{width:min(980px,96vw);max-height:92vh;overflow:auto;border:1px solid #2c3b46;border-radius:18px;background:linear-gradient(180deg,#0e171e,#091016);box-shadow:0 36px 100px #000;color:#edf4f8}.gp-head{display:flex;justify-content:space-between;align-items:center;padding:24px 28px;border-bottom:1px solid #22303a}.gp-head h2{margin:0;font-size:25px}.gp-head p{margin:5px 0 0;color:#8fa2ae;font-size:12px}.gp-close{border:1px solid #33434f;background:#0a1117;color:#d8e3e9;border-radius:8px;width:38px;height:38px;cursor:pointer}.gp-body{display:grid;grid-template-columns:250px 1fr;min-height:520px}.gp-side{padding:28px;border-right:1px solid #22303a;background:#0a1218}.gp-avatar{width:92px;height:92px;border-radius:50%;display:grid;place-items:center;margin-bottom:16px;background:linear-gradient(135deg,#20df77,#0f8e4c);font-size:34px;font-weight:900;color:white;box-shadow:0 10px 30px #13bd5c35}.gp-side strong{display:block;font-size:18px}.gp-side small{display:block;margin-top:4px;color:#8396a2}.gp-badge{display:inline-flex;margin-top:14px;padding:6px 9px;border:1px solid #24503a;border-radius:999px;background:#0b2117;color:#6de7a0;font-size:10px}.gp-menu{display:grid;gap:7px;margin-top:26px}.gp-menu button{padding:11px 12px;text-align:left;border:1px solid transparent;border-radius:8px;background:transparent;color:#93a5b0;cursor:pointer}.gp-menu button.active{background:#11251c;border-color:#1f5238;color:#53e790}.gp-content{padding:28px}.gp-section{display:none}.gp-section.active{display:block}.gp-section h3{margin:0 0 6px;font-size:18px}.gp-section>p{margin:0 0 22px;color:#8396a2;font-size:11px}.gp-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.gp-field{display:grid;gap:7px}.gp-field.full{grid-column:1/-1}.gp-field label{font-size:11px;font-weight:800;color:#c7d3da}.gp-field input,.gp-field select,.gp-field textarea{width:100%;padding:12px;border:1px solid #344550;border-radius:8px;background:#081016;color:#f0f5f8;outline:none}.gp-field textarea{min-height:100px;resize:vertical}.gp-field input:focus,.gp-field select:focus,.gp-field textarea:focus{border-color:#21db73;box-shadow:0 0 0 3px #21db7318}.gp-field input[readonly]{color:#7f929e;background:#0b1217}.gp-help{font-size:9px;color:#71838e}.gp-switches{display:grid;gap:10px}.gp-switch{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:14px 15px;border:1px solid #24313a;border-radius:9px;background:#0a1218}.gp-switch div b{display:block;font-size:12px}.gp-switch div span{display:block;margin-top:3px;color:#7f929e;font-size:10px}.gp-switch input{width:18px;height:18px;accent-color:#1ddc70}.gp-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:24px;padding-top:20px;border-top:1px solid #22303a}.gp-actions button{padding:11px 18px;border-radius:8px;font-weight:800;cursor:pointer}.gp-cancel{border:1px solid #34434d;background:#0b1218;color:#c8d4db}.gp-save{border:0;background:linear-gradient(#20e578,#0fb958);color:white}.gp-status{min-height:18px;margin:12px 0 0;text-align:right;font-size:11px}.gp-status.ok{color:#65eaa0}.gp-status.err{color:#ff7777}.gp-security-card{padding:16px;border:1px solid #244737;border-radius:10px;background:#0a1d14}.gp-security-card b{color:#5ae394}.gp-security-card p{margin:6px 0 0;color:#8fa99a;font-size:10px;line-height:1.5}@media(max-width:760px){.gp-body{grid-template-columns:1fr}.gp-side{border-right:0;border-bottom:1px solid #22303a}.gp-menu{grid-template-columns:repeat(3,1fr)}.gp-grid{grid-template-columns:1fr}.gp-field.full{grid-column:auto}}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'gp-overlay';
  overlay.innerHTML = `
    <div class="gp-modal" role="dialog" aria-modal="true" aria-labelledby="gp-title">
      <header class="gp-head"><div><h2 id="gp-title">Profil gracza</h2><p>Zarządzaj danymi, prywatnością i ustawieniami konta Gracz.pl.</p></div><button class="gp-close" type="button" aria-label="Zamknij">✕</button></header>
      <div class="gp-body">
        <aside class="gp-side"><div class="gp-avatar" id="gp-avatar">G</div><strong id="gp-side-name">Gracz</strong><small id="gp-side-login"></small><span class="gp-badge">● Konto aktywne</span><nav class="gp-menu"><button class="active" data-gp-tab="basic">Dane profilu</button><button data-gp-tab="privacy">Prywatność</button><button data-gp-tab="security">Bezpieczeństwo</button></nav></aside>
        <form class="gp-content" id="gp-form">
          <section class="gp-section active" data-gp-section="basic"><h3>Dane profilu</h3><p>Informacje widoczne na Twoim koncie i używane w serwisie.</p><div class="gp-grid">
            <div class="gp-field"><label>Login</label><input name="userId" readonly><span class="gp-help">Login jest stały i nie może być zmieniony.</span></div>
            <div class="gp-field"><label>Nazwa gracza</label><input name="displayName" minlength="2" maxlength="40" required></div>
            <div class="gp-field"><label>Adres e-mail</label><input name="email" type="email" maxlength="254" placeholder="gracz@example.com"></div>
            <div class="gp-field"><label>E-mail odzyskiwania</label><input name="recoveryEmail" type="email" maxlength="254" placeholder="opcjonalnie"></div>
            <div class="gp-field"><label>Kraj</label><select name="country"><option value="PL">Polska</option><option value="DE">Niemcy</option><option value="GB">Wielka Brytania</option><option value="US">USA</option><option value="OTHER">Inny</option></select></div>
            <div class="gp-field"><label>Miasto</label><input name="city" maxlength="60" placeholder="np. Tychy"></div>
            <div class="gp-field"><label>Język</label><select name="language"><option value="pl">Polski</option><option value="en">English</option><option value="de">Deutsch</option></select></div>
            <div class="gp-field full"><label>O mnie</label><textarea name="bio" maxlength="280" placeholder="Napisz kilka słów o sobie, ulubionych grach lub stylu gry..."></textarea><span class="gp-help">Maksymalnie 280 znaków.</span></div>
          </div></section>
          <section class="gp-section" data-gp-section="privacy"><h3>Prywatność i komunikacja</h3><p>Zdecyduj, w jaki sposób inni gracze mogą się z Tobą kontaktować.</p><div class="gp-switches">
            <label class="gp-switch"><div><b>Pokazuj status online</b><span>Inni gracze zobaczą, kiedy jesteś dostępny.</span></div><input name="showOnline" type="checkbox"></label>
            <label class="gp-switch"><div><b>Zezwalaj na zaproszenia do gry</b><span>Gracze mogą wysyłać Ci zaproszenia do stołów.</span></div><input name="allowInvites" type="checkbox"></label>
            <label class="gp-switch"><div><b>Zezwalaj na wiadomości</b><span>Inni użytkownicy mogą wysyłać prywatne wiadomości.</span></div><input name="allowMessages" type="checkbox"></label>
            <label class="gp-switch"><div><b>Newsletter Gracz.pl</b><span>Informacje o turniejach, nowych grach i funkcjach.</span></div><input name="newsletter" type="checkbox"></label>
          </div></section>
          <section class="gp-section" data-gp-section="security"><h3>Bezpieczeństwo konta</h3><p>Najważniejsze ustawienia ochrony Twojego konta.</p><div class="gp-switches">
            <label class="gp-switch"><div><b>Uwierzytelnianie dwuskładnikowe (2FA)</b><span>Preferencja zostanie zapisana. Aktywacja kodów 2FA wymaga modułu autoryzacji.</span></div><input name="twoFactor" type="checkbox"></label>
            <div class="gp-security-card"><b>🔒 Hasło jest chronione</b><p>Hasła nie są przechowywane w postaci jawnej. System używa bezpiecznego skrótu kryptograficznego i ogranicza wielokrotne nieudane próby logowania.</p></div>
          </div></section>
          <div class="gp-actions"><button class="gp-cancel" type="button">Anuluj</button><button class="gp-save" type="submit">Zapisz zmiany</button></div><p class="gp-status" id="gp-status"></p>
        </form>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const form = overlay.querySelector('#gp-form');
  const status = overlay.querySelector('#gp-status');
  const close = () => overlay.classList.remove('open');
  overlay.querySelector('.gp-close').addEventListener('click', close);
  overlay.querySelector('.gp-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  overlay.querySelectorAll('[data-gp-tab]').forEach(btn => btn.addEventListener('click', () => {
    overlay.querySelectorAll('[data-gp-tab]').forEach(x => x.classList.toggle('active', x === btn));
    overlay.querySelectorAll('[data-gp-section]').forEach(x => x.classList.toggle('active', x.dataset.gpSection === btn.dataset.gpTab));
  }));

  function headers() { return { authorization: `Bearer ${session.token}`, 'content-type': 'application/json', accept: 'application/json' }; }
  function setStatus(text, kind='') { status.textContent=text; status.className=`gp-status ${kind}`; }
  function fill(p) {
    for (const key of ['userId','displayName','email','recoveryEmail','country','city','language','bio']) if (form.elements[key]) form.elements[key].value = p[key] ?? '';
    for (const key of ['showOnline','allowInvites','allowMessages','newsletter','twoFactor']) form.elements[key].checked = p[key] === true;
    overlay.querySelector('#gp-side-name').textContent = p.displayName || p.userId;
    overlay.querySelector('#gp-side-login').textContent = '@' + p.userId;
    overlay.querySelector('#gp-avatar').textContent = String(p.displayName || p.userId || 'G').trim().charAt(0).toUpperCase();
  }
  async function loadProfile() {
    setStatus('Ładowanie profilu…');
    try {
      const r = await fetch('/account/profile', { headers: headers() });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || 'Nie udało się pobrać profilu.');
      fill(data.profile); setStatus('');
    } catch (e) { setStatus(e.message, 'err'); }
  }
  async function openProfile(e) { e?.preventDefault(); overlay.classList.add('open'); await loadProfile(); }
  document.querySelectorAll('.account-box a').forEach(a => {
    const label = a.textContent.trim().toLowerCase();
    if (label === 'profil') { a.classList.add('profile-link'); a.href='#profil'; a.addEventListener('click', openProfile); }
    if (label === 'wiadomości') { a.href='/messages.html'; a.title='Prywatne wiadomości Gracz.pl'; }
  });
  form.addEventListener('submit', async e => {
    e.preventDefault(); setStatus('Zapisywanie…');
    const payload = Object.fromEntries(new FormData(form).entries());
    for (const key of ['showOnline','allowInvites','allowMessages','newsletter','twoFactor']) payload[key] = form.elements[key].checked;
    try {
      const r = await fetch('/account/profile', { method:'PUT', headers:headers(), body:JSON.stringify(payload) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || 'Nie udało się zapisać profilu.');
      if (data.token && data.user) {
        session.token=data.token; session.user=data.user; sessionStorage.setItem('gracz-session', JSON.stringify(session));
        document.querySelectorAll('#user-name').forEach(el => el.textContent=data.user.displayName);
        const box=document.querySelector('#account-box'); if(box?.firstElementChild) box.firstElementChild.textContent=data.user.displayName;
      }
      fill(data.profile); setStatus('Zmiany zostały zapisane w bazie danych.', 'ok');
    } catch (err) { setStatus(err.message, 'err'); }
  });
})();
