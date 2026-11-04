// Shared lightweight profile subnavigation inside the existing player panel.
export function enhanceProfileHtml(html){
 const start='<div class="profile-layout">';
 if(!html.includes(start))throw Error('PROFILE_LAYOUT_MISSING');
 const nav=String.raw`
<nav class="premium-profile-tabs" role="tablist" aria-label="Opcje profilu gracza">
 <button type="button" role="tab" aria-selected="true" class="is-active" data-profile-tab="main">♙ <span>Mój profil</span></button>
 <button type="button" role="tab" aria-selected="false" data-profile-tab="custom">✦ <span>Personalizacja</span></button>
 <button type="button" role="tab" aria-selected="false" data-profile-tab="stats">▥ <span>Statystyki</span></button>
 <button type="button" role="tab" aria-selected="false" data-profile-tab="awards">♛ <span>Osiągnięcia</span></button>
 <button type="button" role="tab" aria-selected="false" data-profile-tab="mygames">♟ <span>Moje gry</span></button>
 <button type="button" role="tab" aria-selected="false" data-profile-tab="prefs">⚙ <span>Preferencje</span></button>
</nav>
<div data-profile-tab-panel="main" class="premium-profile-tab-panel">`;
 html=html.replace(start,nav+start);
 const end='</aside></div>\n</section>\n<section class="view" data-panel="friends">';
 if(!html.includes(end))throw Error('PROFILE_SECTION_END_MISSING');
 const extra=String.raw`</aside></div></div>
<section class="premium-profile-tab-panel" data-profile-tab-panel="custom" hidden>
 <div class="card premium-profile-workspace">
  <div class="card-heading"><div><p class="card-kicker">STUDIO GRACZA · FULL MAX PREMIUM</p><h2>Kreator profilu</h2><p>Zbuduj własną wizytówkę bez zmiany danych logowania.</p></div></div>
  <div class="premium-profile-two">
   <form id="premium-custom-form" class="premium-profile-form">
    <label for="premium-avatar">Awatar — motyw graficzny</label><select id="premium-avatar"><option value="initial">Inicjał nicku</option><option value="crown">Złota korona</option><option value="knight">Skoczek szachowy</option><option value="diamond">Diament</option><option value="rook">Wieża</option><option value="star">Gwiazda</option></select>
    <label for="premium-cover">Tło wizytówki</label><select id="premium-cover"><option value="wave">Turkusowa fala</option><option value="aurora">Zorza premium</option><option value="minimal">Minimalistyczne</option><option value="chess">Szachowe</option></select>
    <label for="premium-accent">Kolorystyka</label><select id="premium-accent"><option value="turquoise">Turkus i granat</option><option value="midnight">Nocny granat</option><option value="royal">Szlachetny złoty</option><option value="light">Jasny premium</option></select>
    <label for="premium-motto">Motto gracza (do 80 znaków)</label><input id="premium-motto" maxlength="80" placeholder="Graj, ucz się, rywalizuj">
    <label for="premium-city">Miasto (opcjonalnie, do 60 znaków)</label><input id="premium-city" maxlength="60" placeholder="Twoje miasto">
    <button class="primary" type="submit">Zapisz personalizację</button><p role="status" id="premium-custom-status" aria-live="polite"></p>
   </form>
   <div class="premium-profile-showcase" id="premium-showcase" data-cover="wave" data-accent="turquoise">
    <span class="premium-showcase-eyebrow">GRACZ.PL · FULL MAX PREMIUM</span><span class="premium-showcase-avatar" id="premium-showcase-avatar">G</span>
    <strong id="premium-showcase-name">Twój profil</strong><span id="premium-showcase-motto">Twoja gra. Twoje zasady.</span><span id="premium-showcase-city"></span>
    <p>Podgląd osobistej wizytówki. Zmiany są zapisywane dopiero po kliknięciu „Zapisz”.</p>
   </div>
  </div>
 </div>
 <div class="card premium-profile-workspace"><p class="card-kicker">WIDOCZNOŚĆ I UDOSTĘPNIANIE</p><h2>Profil publiczny</h2>
  <p>Domyślnie prywatny. To Ty decydujesz, czy inni gracze zobaczą wizytówkę i jej szczegóły. E-mail pozostaje niewidoczny.</p>
  <div class="premium-profile-switches">
   <label><input id="premium-public" type="checkbox"> Włącz profil publiczny</label>
   <label><input id="premium-public-stats" type="checkbox"> Pokazuj statystyki</label>
   <label><input id="premium-public-country" type="checkbox"> Pokazuj kraj i miasto</label>
   <label><input id="premium-public-badges" type="checkbox"> Pokazuj zdobyte odznaki</label>
  </div>
  <div class="form-actions"><button id="premium-privacy-save" type="button" class="primary">Zapisz widoczność</button><a id="premium-public-link" href="#" class="secondary link-button" hidden target="_blank" rel="noopener">Otwórz profil publiczny</a><span id="premium-privacy-status" role="status"></span></div>
 </div>
</section>
<section class="premium-profile-tab-panel" data-profile-tab-panel="stats" hidden>
 <div class="card premium-profile-workspace"><div class="card-heading"><div><p class="card-kicker">TWOJE PRAWDZIWE WYNIKI</p><h2>Statystyki gracza</h2><p>Wyniki pochodzą wyłącznie z zakończonych i zapisanych partii online w PostgreSQL.</p></div><button id="premium-refresh-stats" class="secondary" type="button">Odśwież wyniki</button></div>
 <div class="premium-stats-grid"><div><small>PARTIE</small><strong id="stat-played">—</strong></div><div><small>WYGRANE</small><strong id="stat-wins">—</strong></div><div><small>REMISY</small><strong id="stat-draws">—</strong></div><div><small>SKUTECZNOŚĆ</small><strong id="stat-rate">—</strong></div></div>
 <div class="premium-profile-two"><div class="premium-stat-breakdown"><h3>Gomoku</h3><p id="stat-gomoku">Brak odczytu</p></div><div class="premium-stat-breakdown"><h3>Warcaby</h3><p id="stat-warcaby">Brak odczytu</p></div></div>
 <p class="premium-profile-note">Ranking turniejowy będzie widoczny dopiero po uruchomieniu serwerowego systemu rankingowego; nie pokazujemy fikcyjnych punktów.</p>
 <p id="premium-stats-status" role="status" aria-live="polite">Otwórz zakładkę, aby wczytać wyniki.</p>
 </div>
</section>
<section class="premium-profile-tab-panel" data-profile-tab-panel="awards" hidden>
 <div class="card premium-profile-workspace"><p class="card-kicker">SALA TROFEÓW</p><h2>Osiągnięcia i odznaki</h2><p>Odznaki naliczane automatycznie z faktycznych zwycięstw i zakończonych partii. Nie wymagają osobnego serwera.</p><div class="premium-awards-grid" id="premium-awards-list"></div><p id="premium-awards-status" role="status"></p></div>
</section>
<section class="premium-profile-tab-panel" data-profile-tab-panel="mygames" hidden>
 <div class="card premium-profile-workspace"><p class="card-kicker">BIBLIOTEKA I HISTORIA</p><h2>Moje gry</h2><div class="premium-profile-game-links"><a href="/konto/gomoku/">◉ Gomoku — graj</a><a href="/konto/warcaby/">♟ Warcaby — graj</a><button type="button" id="premium-manage-favorites">★ Zarządzaj ulubionymi</button></div><h3>Ostatnie partie online</h3><div id="premium-recent-games" class="premium-recent-games"><p>Wybierz zakładkę, aby wczytać historię.</p></div></div>
</section>
<section class="premium-profile-tab-panel" data-profile-tab-panel="prefs" hidden>
 <div class="card premium-profile-workspace"><p class="card-kicker">TWOJE USTAWIENIA</p><h2>Preferencje konta</h2><p>Preferencje zapisują się na istniejącym koncie użytkownika.</p>
 <form id="premium-prefs-form" class="premium-profile-form">
  <label for="premium-timezone">Strefa czasowa</label><select id="premium-timezone"><option value="Europe/Warsaw">Polska — Warszawa</option><option value="Europe/Berlin">Niemcy — Berlin</option><option value="UTC">UTC</option><option value="America/New_York">USA — Nowy Jork</option></select>
  <label for="premium-dateformat">Format daty</label><select id="premium-dateformat"><option value="pl">Polski — dzień, miesiąc, rok</option><option value="iso">ISO — rok-miesiąc-dzień</option></select>
  <label class="premium-checkbox-line"><input id="premium-sounds" type="checkbox"> Delikatne sygnały potwierdzenia zmian w panelu</label>
  <button type="submit" class="primary">Zapisz preferencje</button><p id="premium-prefs-status" role="status" aria-live="polite"></p>
 </form>
 <div class="premium-profile-shortcuts"><button type="button" id="premium-go-appearance" class="secondary">Wygląd i dostępność</button><button type="button" id="premium-go-security" class="secondary">Bezpieczeństwo</button><button type="button" id="premium-go-data" class="secondary">Dane i konto</button></div>
 </div>
</section>
</section>
<section class="view" data-panel="friends">`;
 return html.replace(end,extra);
}
export const premiumProfileStyles=String.raw`
/* Full Max Premium account workspace: extends, never replaces, the existing profile. */
.premium-profile-tabs{position:sticky;top:0;z-index:3;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:18px 0;padding:10px;border:1px solid #237c80;border-radius:18px;background:linear-gradient(140deg,#041d29f5,#06343af5);backdrop-filter:blur(14px)}
.premium-profile-tabs button{border:1px solid #286c71;border-radius:12px;background:#082a34;color:#dcecf0;font-weight:800;font-size:clamp(11px,1vw,14px);min-height:48px;padding:7px;cursor:pointer}
.premium-profile-tabs button.is-active,.premium-profile-tabs button:hover{border-color:#28e6d3;background:linear-gradient(120deg,#076a67,#07414a);color:#fff;box-shadow:inset 0 1px 10px #3ffff02a,0 0 13px #0de3c52c}
.premium-profile-tab-panel[hidden]{display:none!important}.premium-profile-workspace{margin:13px 0;padding:clamp(15px,2vw,29px)!important}
.premium-profile-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:start}
.premium-profile-form{display:grid;gap:9px;max-width:750px}
.premium-profile-form>label{color:#e7d7a5;font-weight:740;font-size:13px;margin-top:7px}
.premium-profile-form select,.premium-profile-form input:not([type="checkbox"]){min-height:43px;width:100%;border:1px solid #348c90;border-radius:11px;background:#062632;color:#f0f9fb;padding:9px 12px}
.premium-profile-form button{margin-top:13px;justify-self:start}
.premium-profile-showcase{position:relative;display:flex;align-items:center;flex-direction:column;justify-content:center;gap:9px;min-height:320px;border-radius:19px;border:1px solid #34cabb;padding:28px;text-align:center;overflow:hidden;background:radial-gradient(ellipse at 75% 12%,#08bdbb75,transparent 65%),linear-gradient(140deg,#073948,#041724);box-shadow:inset 0 0 32px #08e6d41c,0 12px 30px #0004}
.premium-profile-showcase[data-cover="aurora"]{background:radial-gradient(ellipse at 20% 15%,#06b4ba8a,transparent 66%),radial-gradient(ellipse at 85% 80%,#956cd76b,transparent 55%),#031a2a}
.premium-profile-showcase[data-cover="minimal"]{background:linear-gradient(130deg,#071b25,#183b48)}
.premium-profile-showcase[data-cover="chess"]{background:repeating-conic-gradient(#034750 0 25%,#082831 0 50%) 50%/70px 70px}
.premium-profile-showcase[data-accent="midnight"]{border-color:#7796c6}
.premium-profile-showcase[data-accent="royal"]{border-color:#e5b75e;box-shadow:0 0 30px #ccab5d25}
.premium-profile-showcase[data-accent="light"]{background:#e5f3f3;color:#102c37;border-color:#3e8a8f}
.premium-showcase-eyebrow{font-size:11px;letter-spacing:.14em;color:#ffe2a1;font-weight:800}
.premium-showcase-avatar{display:grid;place-items:center;width:103px;height:103px;border-radius:50%;border:3px solid #e4c66f;background:linear-gradient(140deg,#064d52,#00202e);box-shadow:0 0 29px #26d9c88a;color:#ffdb86;font:900 51px Georgia,serif}
.premium-profile-showcase strong{font-size:clamp(23px,3vw,34px)}.premium-profile-showcase p{font-size:12px;max-width:320px;opacity:.8}
.premium-showcase-motto{color:#ffe6ae;font-style:italic}.premium-showcase-city{font-size:12px}
.premium-profile-switches{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:18px 0}
.premium-profile-switches label,.premium-checkbox-line{border:1px solid #287e80;border-radius:12px;padding:12px;background:#082c37;display:flex;gap:10px;align-items:center;color:#e8f6f6}
.premium-profile-switches input,.premium-checkbox-line input{accent-color:#23c7b9;width:17px;height:17px}
.premium-stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:21px 0}
.premium-stats-grid>div{border:1px solid #1eacaa;border-radius:15px;padding:15px 10px;background:linear-gradient(140deg,#084850,#05222f);text-align:center}
.premium-stats-grid small{display:block;color:#f3cb78;font-size:11px;letter-spacing:.09em}.premium-stats-grid strong{display:block;font-size:clamp(28px,3vw,44px);padding-top:7px}
.premium-stat-breakdown{border:1px solid #2c8e90;border-radius:13px;padding:13px 18px;background:#082b34}.premium-profile-note{color:#91bfc1;font-size:12px;margin-top:17px}
.premium-awards-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;padding:12px 0}
.premium-award{border:1px solid #b39152;border-radius:15px;padding:17px;background:#0b3c41;display:grid;justify-items:start;gap:5px}.premium-award.locked{filter:saturate(.3);opacity:.7;border-color:#35696b}
.premium-award-icon{font-size:31px;color:#f4ca78}.premium-award strong{font-size:15px}.premium-award small{font-size:11px;color:#b7cdd0}
.premium-recent-games{display:grid;gap:9px;margin:12px 0}.premium-recent-games a{display:flex;justify-content:space-between;gap:10px;border:1px solid #267c80;border-radius:12px;padding:12px;color:#f3fafb;text-decoration:none;background:#082b35}
.premium-profile-game-links,.premium-profile-shortcuts{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 24px}.premium-profile-game-links a,.premium-profile-game-links button{border:1px solid #c69c5a;border-radius:11px;padding:11px 14px;color:#fee1ac;background:#0b3a42;text-decoration:none;font-weight:700}
.public-profile-page{min-height:100dvh;display:grid;place-items:center;padding:20px;background:radial-gradient(ellipse at 45% 0%,#0b5657,#021522 65%);color:#f2f8f9;font:16px Inter,'Segoe UI',sans-serif}
.public-profile-card{width:min(610px,100%);padding:35px;border-radius:22px;border:1px solid #10aea8;background:#062a37;box-shadow:0 26px 60px #0008}
.public-profile-card h1{font-size:32px;margin:5px 0}.public-profile-card a{color:#ffe2a3}.public-profile-card p{line-height:1.6}
.public-profile-card .premium-profile-showcase{margin:15px 0}
@media(max-width:1100px){.premium-profile-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:700px){.premium-profile-tabs{position:static;grid-template-columns:repeat(2,minmax(0,1fr))}.premium-profile-two{grid-template-columns:1fr}.premium-profile-switches{grid-template-columns:1fr}.premium-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
export const premiumProfileScript=String.raw`
;(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const buttons=[...document.querySelectorAll('[data-profile-tab]')];
 const panels=[...document.querySelectorAll('[data-profile-tab-panel]')];
 const glyph={initial:null,crown:'♛',knight:'♞',diamond:'◆',rook:'♜',star:'★'};
 let stored=null,stats=null,publicUrl=null,activeTab='main';
 function status(id,text){$(id).textContent=text}
 function switchTab(name){
  activeTab=name;
  for(const b of buttons){const on=b.dataset.profileTab===name;b.classList.toggle('is-active',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1}
  for(const p of panels)p.hidden=p.dataset.profileTabPanel!==name;
  if(['stats','awards','mygames'].includes(name))void loadStats();
 }
 for(const b of buttons)b.addEventListener('click',()=>switchTab(b.dataset.profileTab));
 function view(){
  const accent=$('premium-accent').value,cover=$('premium-cover').value,avatar=$('premium-avatar').value;
  const name=$('profile-heading').textContent||'Gracz';
  const frame=$('premium-showcase');frame.dataset.accent=accent;frame.dataset.cover=cover;
  $('premium-showcase-avatar').textContent=glyph[avatar]||name.slice(0,1).toUpperCase()||'G';
  $('premium-showcase-name').textContent=name;
  $('premium-showcase-motto').textContent=$('premium-motto').value||'Twoja gra. Twoje zasady.';
  $('premium-showcase-city').textContent=$('premium-city').value;
 }
 ['premium-accent','premium-cover','premium-avatar','premium-motto','premium-city'].forEach(id=>$(id).addEventListener('input',view));
 const bool=['publicProfile','showStats','showCountry','showBadges','sounds'];
 const ids={publicProfile:'premium-public',showStats:'premium-public-stats',
  showCountry:'premium-public-country',showBadges:'premium-public-badges',sounds:'premium-sounds'};
 function values(){
  return {avatar:$('premium-avatar').value,cover:$('premium-cover').value,accent:$('premium-accent').value,
   motto:$('premium-motto').value.trim(),city:$('premium-city').value.trim(),
   timeZone:$('premium-timezone').value,dateFormat:$('premium-dateformat').value,
   ...Object.fromEntries(bool.map(key=>[key,$(ids[key]).checked]))};
 }
 async function call(path,options={}){
  const response=await fetch('/auth/'+path,{credentials:'same-origin',cache:'no-store',...options});
  let data;try{data=await response.json()}catch{throw Error('Brak odpowiedzi serwera')}
  if(!response.ok||!data.ok)throw Error(data?.error||'Nie udało się wczytać danych');
  return data;
 }
 async function loadPrefs(){
  try{
   const d=await call('profile/premium');stored=d.preferences;publicUrl=d.publicUrl;
   for(const key of ['avatar','cover','accent','motto','city'])
    $('premium-'+key).value=stored[key];
   $('premium-timezone').value=stored.timeZone;$('premium-dateformat').value=stored.dateFormat;
   for(const key of bool)$(ids[key]).checked=stored[key];
   paintLink();view();
  }catch(e){status('premium-custom-status','Nie udało się wczytać ustawień: '+e.message)}
 }
 function paintLink(){const link=$('premium-public-link');
  link.hidden=!(stored?.publicProfile&&publicUrl);if(!link.hidden)link.href=publicUrl;
 }
 function confirmationSound(){
  if(!$('premium-sounds').checked)return;
  try{
   const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
   const ctx=new Ctx(),osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type='sine';osc.frequency.value=660;gain.gain.value=.015;
   osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.08);
   osc.onended=()=>void ctx.close();
  }catch{}
 }
 async function savePrefs(statusId){
  const forms=[$('premium-custom-form'),$('premium-prefs-form')];
  const buttons=forms.flatMap(f=>[...f.querySelectorAll('button[type="submit"]')]);
  buttons.push($('premium-privacy-save'));buttons.forEach(b=>b.disabled=true);status(statusId,'Zapisywanie…');
  try{
   const d=await call('profile/premium',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(values())});
   stored=d.preferences;publicUrl=d.publicUrl;paintLink();view();confirmationSound();status(statusId,'Zapisano na Twoim koncie.');
  }catch(e){status(statusId,'Nie zapisano: '+e.message)}
  finally{buttons.forEach(b=>b.disabled=false)}
 }
 $('premium-custom-form').addEventListener('submit',e=>{e.preventDefault();void savePrefs('premium-custom-status')});
 $('premium-prefs-form').addEventListener('submit',e=>{e.preventDefault();void savePrefs('premium-prefs-status')});
 $('premium-privacy-save').addEventListener('click',()=>void savePrefs('premium-privacy-status'));
 async function loadStats(force=false){
  if(stats&&!force){paintStats();return}
  status('premium-stats-status','Wczytywanie wyników z serwera…');
  try{
   stats=(await call('profile/stats')).stats;paintStats();
   status('premium-stats-status','Dane aktualne — tylko zapisane rozgrywki online.');
  }catch(e){status('premium-stats-status','Nie udało się pobrać wyników: '+e.message);status('premium-awards-status','Nie można wczytać odznak.')}
 }
 function paintStats(){
  if(!stats)return;
  const t=stats.totals;
  $('stat-played').textContent=t.played;$('stat-wins').textContent=t.wins;
  $('stat-draws').textContent=t.draws;$('stat-rate').textContent=t.winRate+'%';
  for(const game of ['gomoku','warcaby']){
   const g=stats.byGame[game]||{played:0,wins:0,losses:0,draws:0,active:0};
   $('stat-'+game).textContent='Partie: '+g.played+' · Wygrane: '+g.wins+' · Porażki: '+g.losses+' · Remisy: '+g.draws+' · W toku: '+g.active;
  }
  const awards=$('premium-awards-list');awards.replaceChildren();
  for(const a of stats.achievements){
   const card=document.createElement('div');card.className='premium-award'+(a.unlocked?'':' locked');
   const icon=document.createElement('span');icon.className='premium-award-icon';icon.textContent=a.icon;
   const heading=document.createElement('strong');heading.textContent=a.name;
   const detail=document.createElement('small');detail.textContent=a.unlocked?'Zdobyto · warunek spełniony':'Postęp: '+a.progress+' / '+a.need;
   card.append(icon,heading,detail);awards.append(card);
  }
  status('premium-awards-status','Odznaki są naliczane według zakończonych partii, bez ręcznego przypisywania.');
  const recent=$('premium-recent-games');recent.replaceChildren();
  if(!stats.latest.length){const p=document.createElement('p');p.textContent='Nie ma jeszcze zapisanych partii online.';recent.append(p)}
  for(const m of stats.latest){
   const a=document.createElement('a');a.href=m.game==='warcaby'?'/konto/warcaby/?match='+encodeURIComponent(m.id):'/konto/gomoku/?match='+encodeURIComponent(m.id);
   const label=document.createElement('strong');label.textContent=(m.game==='warcaby'?'♟ Warcaby':'◉ Gomoku')+' · '+m.opponent;
   const res=document.createElement('span');res.textContent=({win:'Wygrana',loss:'Porażka',draw:'Remis',active:'W toku'})[m.result]||'Partia';
   a.append(label,res);recent.append(a);
  }
 }
 $('premium-refresh-stats').addEventListener('click',()=>void loadStats(true));
 $('premium-manage-favorites').addEventListener('click',()=>document.querySelector('[data-section="games"]').click());
 for(const [id,section] of [['premium-go-appearance','appearance'],['premium-go-security','security'],['premium-go-data','data']])
  $(id).addEventListener('click',()=>document.querySelector('[data-section="'+section+'"]').click());
 window.addEventListener('gracz:profile-ready',view);
 void loadPrefs();
})();`;
const publicHtml=String.raw`<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="#031b25"><title>Profil gracza — GRACZ.PL</title><link rel="stylesheet" href="/konto/panel/styl.css"><script defer src="/konto/profil/public.js"></script></head><body class="public-profile-page"><main class="public-profile-card"><a href="https://gracz.pl/">gracz.pl · Polskie Centrum Gracza</a><h1 id="pub-title">Profil gracza</h1><p id="pub-status" role="status">Wczytywanie publicznej wizytówki…</p><section id="pub-card" class="premium-profile-showcase" hidden><span class="premium-showcase-eyebrow">FULL MAX PREMIUM</span><span class="premium-showcase-avatar" id="pub-avatar">G</span><strong id="pub-name"></strong><span id="pub-motto"></span><p id="pub-bio"></p><span id="pub-location"></span></section><div id="pub-stats"></div><div id="pub-badges"></div><a href="/konto/panel/">Panel gracza</a></main></body></html>`;
const publicJs=String.raw`'use strict';(async()=>{
 const $=id=>document.getElementById(id),nick=decodeURIComponent(location.pathname.split('/').filter(Boolean).pop()||'');
 const glyph={initial:null,crown:'♛',knight:'♞',diamond:'◆',rook:'♜',star:'★'};
 if(!/^[a-z][a-z0-9._-]{2,31}$/i.test(nick)){$('pub-status').textContent='Nieprawidłowy adres profilu.';return}
 try{
  const r=await fetch('/auth/public-profile?nick='+encodeURIComponent(nick),{cache:'no-store'});
  const d=await r.json();if(!r.ok||!d.ok)throw Error('Ten profil jest prywatny lub nie istnieje.');
  const p=d.profile;
  $('pub-title').textContent=p.displayName+' · GRACZ.PL';$('pub-name').textContent=p.displayName;
  $('pub-avatar').textContent=glyph[p.avatar]||p.displayName.slice(0,1).toUpperCase();
  $('pub-motto').textContent=p.motto||'';$('pub-bio').textContent=p.bio||'';
  $('pub-location').textContent=[p.city,p.country].filter(Boolean).join(' · ');
  $('pub-card').dataset.cover=p.cover;$('pub-card').dataset.accent=p.accent;
  if(p.stats){const t=p.stats.totals;const h=document.createElement('h2');h.textContent='Statystyki online';const v=document.createElement('p');v.textContent='Partie: '+t.played+' · Zwycięstwa: '+t.wins+' · Remisy: '+t.draws; $('pub-stats').append(h,v)}
  if(p.badges?.length){const h=document.createElement('h2');h.textContent='Odznaki';$('pub-badges').append(h);
   for(const badge of p.badges){const span=document.createElement('span');span.textContent=badge.icon+' '+badge.name+' · ';$('pub-badges').append(span)}}
  $('pub-status').textContent='Publiczna wizytówka gracza';$('pub-card').hidden=false;
 }catch(e){$('pub-status').textContent=e.message}
})();`;
export function servePublicProfile(req,res,url,panelCss,headers){
 if(req.method!=='GET')return false;
 const path=url.pathname.replace(/\/+$/,'')||'/';
 let output;
 if(path==='/konto/profil/public.js')output=['application/javascript; charset=utf-8',publicJs];
 else if(/^\/konto\/profil\/[a-z][a-z0-9._-]{2,31}$/i.test(path))output=['text/html; charset=utf-8',publicHtml];
 if(!output)return false;
 res.writeHead(200,{...headers,'Content-Type':output[0],'Content-Length':Buffer.byteLength(output[1])});
 res.end(output[1]);return true;
}
