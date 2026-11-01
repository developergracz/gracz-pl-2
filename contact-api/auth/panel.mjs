const headers = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};
const html=String.raw`<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Panel Gracza Full Max Premium — gracz.pl</title>
<link rel="stylesheet" href="/konto/panel/styl.css"><script src="/konto/panel/app.js" defer></script></head>
<body><a class="skip" href="#content">Przejdź do treści</a>
<header class="top"><a class="logo" href="https://gracz.pl/" aria-label="gracz.pl — strona główna">gracz<span>.pl</span></a>
<span class="top-tag">POLSKIE CENTRUM GRACZA <b>FULL MAX PREMIUM</b></span>
<a class="top-link" href="https://gracz.pl/gry/">Odkryj gry <span aria-hidden="true">↗</span></a></header>
<div class="shell">
<aside class="sidebar"><div class="identity"><div class="avatar" id="nav-avatar" aria-hidden="true">G</div><p class="small">TWOJE KONTO</p>
<strong id="nav-name">Wczytywanie…</strong><span class="status"><i aria-hidden="true"></i> Zalogowany gracz</span></div>
<nav aria-label="Panel gracza">
<button class="nav active" data-section="profile" type="button"><span aria-hidden="true">♙</span> Konto i profil</button>
<button class="nav" data-section="security" type="button"><span aria-hidden="true">✦</span> Bezpieczeństwo</button>
<button class="nav" data-section="privacy" type="button"><span aria-hidden="true">◈</span> Prywatność</button>
<button class="nav" data-section="notifications" type="button"><span aria-hidden="true">♢</span> Powiadomienia</button>
<button class="nav" data-section="messages" type="button"><span aria-hidden="true">✉</span> Wiadomości i chat</button>
<button class="nav" data-section="games" type="button"><span aria-hidden="true">♜</span> Gry i rozgrywka</button>
<button class="nav" data-section="appearance" type="button"><span aria-hidden="true">☼</span> Wygląd i dostępność</button>
<button class="nav" data-section="sessions" type="button"><span aria-hidden="true">▣</span> Sesje i urządzenia</button>
<button class="nav" data-section="data" type="button"><span aria-hidden="true">▤</span> Dane i konto</button>
</nav><button class="signout" id="side-logout" type="button">Wyloguj się <span aria-hidden="true">↗</span></button></aside>
<main id="content" class="main">
<div class="masthead"><div><p class="eyebrow">CENTRUM GRACZA <span aria-hidden="true">◆</span> FULL MAX PREMIUM</p>
<h1 id="title">Konto i profil</h1><p id="subtitle">Twoje miejsce w Polskim Centrum Gracza.</p></div>
<div class="mark" aria-hidden="true"><span>♠</span><small>GRACZ.PL</small></div></div>
<div id="notice" class="notice" role="status" aria-live="polite">Sprawdzanie bezpiecznej sesji…</div>
<section class="view active" data-panel="profile">
<div class="card hero-card"><div class="player-avatar" id="profile-avatar" aria-hidden="true">G</div><div><p class="card-kicker">PROFIL GRACZA</p><h2 id="profile-heading">Gracz</h2><p id="profile-handle">@gracz</p></div><div class="verified">✓ E-mail potwierdzony</div></div>
<form id="profile-form" class="card" autocomplete="on"><div class="card-heading"><div><p class="card-kicker">PERSONALIZACJA</p><h2>Twoje dane</h2></div><span class="card-note">Pola z konta</span></div>
<div class="form-grid">
<label>Nick gracza<input id="nickname" disabled title="Nick jest identyfikatorem konta"></label>
<label>Adres e-mail<input id="email" type="email" disabled title="Adres potwierdzony podczas rejestracji"></label>
<label>Nazwa wyświetlana<input id="display-name" maxlength="40" minlength="2" autocomplete="nickname" required></label>
<label>Kraj<select id="country"><option value="PL">Polska</option><option value="DE">Niemcy</option><option value="CZ">Czechy</option><option value="SK">Słowacja</option><option value="OTHER">Inny</option></select></label>
<label>Język<select id="language"><option value="pl">Polski</option><option value="en">English</option><option value="de">Deutsch</option></select></label>
<label class="wide">O mnie<textarea id="bio" rows="4" maxlength="300" placeholder="Napisz kilka słów o sobie, ulubionych grach i stylu gry…"></textarea><small>Maksymalnie 300 znaków.</small></label></div>
<div class="form-actions"><span id="saved-state">Dane zapisane bezpiecznie w koncie</span><button class="primary" id="save" type="submit">Zapisz profil</button></div></form></section>
<section class="view" data-panel="security"><div class="card"><p class="card-kicker">BEZPIECZEŃSTWO</p><h2>Ochrona konta</h2><p>Adres e-mail został potwierdzony. Hasło jest przechowywane w formie kryptograficznego skrótu, a sesja jest chroniona ciasteczkiem HttpOnly.</p>
<div class="detail"><span>Sesja</span><strong>Aktywna na tym urządzeniu</strong></div><div class="detail"><span>Zmiana hasła i 2FA</span><strong>W przygotowaniu</strong></div>
<button class="secondary" id="security-logout" type="button">Wyloguj z tego urządzenia</button></div></section>
<section class="view" data-panel="privacy"><div class="card"><p class="card-kicker">PRYWATNOŚĆ</p><h2>Widoczność profilu</h2><p>Ustawienia widoczności, historii rozgrywek i zaproszeń będą dostępne po wdrożeniu społeczności Gracz Next. Żadne niewdrożone ustawienie nie jest tutaj prezentowane jako aktywne.</p></div></section>
<section class="view" data-panel="notifications"><div class="card"><p class="card-kicker">POWIADOMIENIA</p><h2>Informacje o rozgrywkach</h2><p>Powiadomienia o wiadomościach, turniejach i rankingach zostaną dodane po uruchomieniu tych modułów.</p></div></section>
<section class="view" data-panel="messages"><div class="card"><p class="card-kicker">SPOŁECZNOŚĆ</p><h2>Wiadomości i chat</h2><p>Prywatne wiadomości, lista znajomych i chat społeczności będą dostępne po integracji z platformą gier.</p></div></section>
<section class="view" data-panel="games"><div class="card"><p class="card-kicker">GRY</p><h2>Witaj w świecie rozgrywek</h2><p>Odkrywaj gry w serwisie gracz.pl. Historia partii, rankingi i osiągnięcia zostaną połączone z profilem w kolejnych etapach.</p><a class="primary link-button" href="https://gracz.pl/gry/">Przejdź do gier</a></div></section>
<section class="view" data-panel="appearance"><div class="card"><p class="card-kicker">DOSTĘPNOŚĆ</p><h2>Wygoda korzystania</h2><p>Panel automatycznie dopasowuje układ do szerokości ekranu, respektuje ustawienie ograniczenia animacji i wspiera obsługę klawiaturą.</p></div></section>
<section class="view" data-panel="sessions"><div class="card"><p class="card-kicker">URZĄDZENIA</p><h2>Twoja sesja</h2><p>Logowanie na bieżącym urządzeniu jest aktywne. Nie pokazujemy historii innych urządzeń bez serwerowego rejestru sesji.</p><button class="secondary" id="session-logout" type="button">Zakończ bieżącą sesję</button></div></section>
<section class="view" data-panel="data"><div class="card"><p class="card-kicker">TWOJE DANE</p><h2>Zarządzanie kontem</h2><p>W sprawach dostępu do danych lub żądania usunięcia konta skontaktuj się z administracją. Samodzielne usuwanie zostanie udostępnione dopiero po wdrożeniu bezpiecznej procedury weryfikacji i retencji.</p><a class="secondary link-button" href="mailto:kontakt@gracz.pl">Kontakt z administracją</a></div></section>
<footer class="footer">© gracz.pl · Polskie Centrum Gracza · Full Max Premium</footer></main></div></body></html>`;
const css=String.raw`*{box-sizing:border-box}html{background:#03101d;color:#f4f8fc;font-family:Inter,"Segoe UI",Arial,sans-serif}body{margin:0;min-height:100dvh;background:radial-gradient(ellipse at 85% 12%,#073e52b5,transparent 38%),radial-gradient(ellipse at 14% 78%,#1830527d,transparent 38%),linear-gradient(145deg,#03101b,#071927 58%,#020914)}button,input,select,textarea{font:inherit}button,a{touch-action:manipulation}a{color:inherit}.skip{position:absolute;left:-999px;top:0;z-index:5}.skip:focus{left:15px;top:15px;background:#ffd07a;color:#071421;padding:9px}.top{min-height:80px;padding:14px clamp(16px,4.5vw,80px);display:flex;align-items:center;gap:30px;justify-content:space-between;background:#021321d9;border-bottom:1px solid #326073}.logo{font-size:clamp(30px,3vw,43px);font-weight:900;letter-spacing:-2px;text-decoration:none;white-space:nowrap}.logo span{color:#e92c49}.top-tag{font-size:11px;letter-spacing:2px;color:#99c7d8;font-weight:800}.top-tag b{color:#f7cb75;margin-left:13px}.top-link{border:1px solid #e9ba62;border-radius:9px;padding:11px 16px;text-decoration:none;color:#ffdc8c;font-weight:750;white-space:nowrap}.shell{max-width:1700px;margin:auto;display:grid;grid-template-columns:270px minmax(0,1fr);gap:24px;padding:clamp(14px,2.2vw,34px)}.sidebar{min-width:0;align-self:start;border:1px solid #2c5465;border-radius:22px;background:linear-gradient(160deg,#0b2434f5,#061824f5);box-shadow:0 18px 50px #0005;overflow:hidden;position:sticky;top:15px}.identity{padding:26px 23px 19px;border-bottom:1px solid #21475b}.avatar,.player-avatar{display:grid;place-items:center;border-radius:50%;border:2px solid #eac476;color:#ffd67d;background:radial-gradient(circle at 30% 25%,#246078,#041a2b 78%);font-weight:800;box-shadow:0 0 22px #0eb9da44}.avatar{height:64px;width:64px;font-size:31px}.small,.card-kicker,.eyebrow{font-size:11px;letter-spacing:2px;color:#e5bd74;font-weight:900}.identity strong{display:block;font-size:20px;overflow-wrap:anywhere}.identity .small{margin:16px 0 7px}.status{color:#99c9d3;font-size:12px;display:flex;align-items:center;gap:8px;margin-top:12px}.status i{height:8px;width:8px;background:#3ee5ac;border-radius:50%;box-shadow:0 0 10px #3ee5ac}.sidebar nav{display:grid;gap:5px;padding:17px 10px}.nav{display:flex;gap:12px;text-align:left;width:100%;align-items:center;background:transparent;color:#b6cfd9;border:1px solid transparent;border-radius:10px;padding:13px 14px;cursor:pointer;font-weight:700;font-size:13px}.nav span{width:23px;text-align:center;font-size:19px;color:#79c9d6}.nav:hover,.nav:focus-visible{background:#17364a;color:#fff}.nav.active{background:linear-gradient(90deg,#194454,#0b2c41);color:#fff;border-color:#427587}.nav.active span{color:#ffd07a}.signout{width:calc(100% - 24px);margin:2px 12px 16px;padding:13px;border:1px solid #42677a;border-radius:10px;background:#102c3d;color:#fff;font-weight:800;cursor:pointer}.signout span{float:right}.main{min-width:0}.masthead{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:190px;margin-bottom:18px;padding:clamp(22px,3vw,42px);border-radius:22px;border:1px solid #266779;background:linear-gradient(110deg,#0c3249e8,#06162799 65%),radial-gradient(circle at 85% 45%,#0a778a8c,transparent 50%);position:relative;overflow:hidden}.masthead:after{content:"";pointer-events:none;position:absolute;inset:0;border-radius:22px;box-shadow:inset 0 0 65px #05b5ce16}.masthead h1{font-size:clamp(32px,4.4vw,55px);line-height:1.05;margin:12px 0;color:#fff;letter-spacing:-1px}.masthead p:last-child{color:#b4cfdc;margin:0}.mark{height:124px;width:124px;border:8px double #e4b96b;border-radius:50%;display:grid;place-items:center;align-content:center;transform:rotate(8deg);color:#ffd27c;background:#082638;box-shadow:0 0 40px #dcb56632;flex:none}.mark span{font-size:55px;line-height:1}.mark small{font-size:10px;font-weight:900}.notice{padding:12px 17px;background:#112d39;border:1px solid #386578;border-radius:12px;margin-bottom:16px;color:#c8e5ed;font-size:13px}.notice[hidden]{display:none}.notice.error{border-color:#a9505d;color:#ffdadc}.view{display:none}.view.active{display:grid;gap:18px}.card{background:linear-gradient(145deg,#0a2332f6,#061925f8);border:1px solid #2c5667;box-shadow:0 10px 40px #0004;border-radius:18px;padding:clamp(19px,2.5vw,32px)}.card h2{font-size:clamp(21px,2.5vw,30px);margin:5px 0 15px}.card p{line-height:1.7;color:#b7cbd4}.card-kicker{margin:0!important;color:#e8b967!important}.hero-card{display:flex;gap:24px;align-items:center;border-color:#906d3d;background:linear-gradient(100deg,#102b3d,#071d2e)}.player-avatar{width:87px;height:87px;flex:none;font-size:44px}.hero-card h2{margin:6px 0 2px}.hero-card p{margin:0}.verified{margin-left:auto;color:#66e6b9;border:1px solid #247967;background:#0d403d73;padding:9px 14px;border-radius:50px;font-size:12px;font-weight:800;white-space:nowrap}.card-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:10px}.card-note{font-size:12px;color:#95b4c1}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.form-grid label{display:grid;align-content:start;gap:9px;color:#d9e6ed;font-size:13px;font-weight:750}.form-grid .wide{grid-column:1/-1}.form-grid input,.form-grid select,.form-grid textarea{background:#091e2c;border:1px solid #426274;color:#fff;border-radius:9px;min-height:46px;padding:12px 13px;width:100%;min-width:0;outline-offset:3px}.form-grid textarea{resize:vertical;min-height:110px}.form-grid input:disabled{background:#0b2630;color:#a4bfce;cursor:not-allowed}.form-grid small{color:#85a8b9;font-size:11px}.form-actions{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap;padding-top:25px}.form-actions span{color:#8bafbb;font-size:12px}.primary,.secondary{border-radius:10px;padding:14px 20px;font-size:14px;font-weight:850;cursor:pointer}.primary{border:1px solid #ffdd95;background:linear-gradient(180deg,#ffe1a0,#dca94f);color:#101725;box-shadow:0 5px 20px #edb35f35}.primary:disabled{opacity:.65;cursor:wait}.secondary{border:1px solid #5490a2;background:#10374b;color:#f2f9fb}.link-button{display:inline-flex;text-decoration:none;margin-top:12px}.detail{display:flex;justify-content:space-between;gap:14px;border-bottom:1px solid #285062;padding:18px 0;color:#b2cad5}.detail strong{color:#fff;text-align:right}.footer{padding:23px;color:#7194a8;font-size:12px;text-align:center}:focus-visible{outline:3px solid #ffd17c;outline-offset:3px}@media(max-width:900px){.shell{grid-template-columns:1fr}.sidebar{position:static}.sidebar nav{display:flex;overflow-x:auto;gap:8px}.nav{min-width:max-content;width:auto}.identity{display:flex;align-items:center;gap:13px;padding:14px}.identity .small,.identity .status{display:none}.avatar{width:45px;height:45px;font-size:24px}.identity strong{font-size:16px}.signout{width:auto;margin:0 12px 14px}.top-tag{display:none}}@media(max-width:610px){.top{min-height:65px}.top-link{font-size:12px;padding:10px}.shell{padding:12px;gap:14px}.masthead{min-height:155px;padding:20px}.mark{width:67px;height:67px;border-width:4px}.mark span{font-size:29px}.mark small{font-size:7px}.hero-card{flex-wrap:wrap;gap:12px}.player-avatar{height:68px;width:68px;font-size:33px}.verified{margin-left:0}.form-grid{grid-template-columns:1fr}.card-heading{display:block}.card-note{display:none}.form-actions{align-items:stretch}.form-actions button{width:100%}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation:none!important;transition:none!important}}`;
const js=String.raw`(()=>{
'use strict';
const $=id=>document.getElementById(id);
const sectionNames={
 profile:['Konto i profil','Twoje miejsce w Polskim Centrum Gracza.'],
 security:['Bezpieczeństwo','Kontrola bezpieczeństwa Twojego konta.'],
 privacy:['Prywatność','Zarządzanie widocznością danych.'],
 notifications:['Powiadomienia','Informacje o Twoich aktywnościach.'],
 messages:['Wiadomości i chat','Twoja społeczność graczy.'],
 games:['Gry i rozgrywka','Wszystkie gry w jednym miejscu.'],
 appearance:['Wygląd i dostępność','Panel dopasowany do Twojego ekranu.'],
 sessions:['Sesje i urządzenia','Kontrola zalogowanych urządzeń.'],
 data:['Dane i konto','Informacje o zarządzaniu kontem.']
};
function notice(text,error=false){const n=$('notice');n.textContent=text;n.hidden=!text;n.classList.toggle('error',error);}
function switchSection(name){
 if(!sectionNames[name])return;
 document.querySelectorAll('[data-section]').forEach(e=>{e.classList.toggle('active',e.dataset.section===name);e.setAttribute('aria-current',e.dataset.section===name?'page':'false');});
 document.querySelectorAll('[data-panel]').forEach(e=>e.classList.toggle('active',e.dataset.panel===name));
 $('title').textContent=sectionNames[name][0];$('subtitle').textContent=sectionNames[name][1];
}
document.querySelectorAll('[data-section]').forEach(button=>button.addEventListener('click',()=>switchSection(button.dataset.section)));
async function api(path,options={}){
 const response=await fetch('/auth/'+path,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(options.headers||{})},...options});
 let body={};try{body=await response.json();}catch{}
 if(!response.ok||body.ok!==true){const error=new Error(response.status===401?'Sesja wygasła. Zaloguj się ponownie.':'Nie udało się wykonać operacji.');error.status=response.status;throw error;}
 return body;
}
function fill(profile){
 $('nickname').value=profile.nickname;
 $('email').value=profile.email;
 $('display-name').value=profile.displayName;
 $('country').value=profile.country;
 $('language').value=profile.language;
 $('bio').value=profile.bio;
 $('nav-name').textContent=profile.displayName;
 $('profile-heading').textContent=profile.displayName;
 $('profile-handle').textContent='@'+profile.nickname;
 const initial=profile.displayName.slice(0,1).toUpperCase()||'G';
 $('nav-avatar').textContent=initial;$('profile-avatar').textContent=initial;
}
async function load(){
 try{const result=await api('profile');fill(result.profile);notice('');}
 catch(error){notice(error.message,true);if(error.status===401)location.replace('/konto/?widok=login');}
}
$('profile-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const displayName=$('display-name').value.trim(),bio=$('bio').value.trim();
 if(displayName.length<2||displayName.length>40){notice('Nazwa wyświetlana musi mieć 2–40 znaków.',true);$('display-name').focus();return;}
 if(bio.length>300){notice('Opis może mieć najwyżej 300 znaków.',true);return;}
 const save=$('save');save.disabled=true;$('saved-state').textContent='Zapisywanie…';
 try{
  const result=await api('profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName,bio,country:$('country').value,language:$('language').value})});
  fill(result.profile);$('saved-state').textContent='Zmiany zapisane w koncie';notice('Profil został zapisany.');
 }catch(error){$('saved-state').textContent='Nie zapisano zmian';notice(error.message,true);if(error.status===401)location.replace('/konto/?widok=login');}
 finally{save.disabled=false;}
});
async function logout(){
 try{await api('logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});location.replace('/konto/?widok=login');}
 catch(error){notice(error.message,true);}
}
['side-logout','security-logout','session-logout'].forEach(id=>$(id).addEventListener('click',logout));
load();
})();`;
export function servePlayerPanel(req,res,url){
  if(req.method!=='GET')return false;
  const path=url.pathname.replace(/\/+$/,'')||'/';
  const responses={
    '/konto/panel':['text/html; charset=utf-8',html],
    '/konto/panel/styl.css':['text/css; charset=utf-8',css],
    '/konto/panel/app.js':['application/javascript; charset=utf-8',js]
  };
  const response=responses[path];
  if(!response)return false;
  res.writeHead(200,{...headers,'Content-Type':response[0],'Content-Length':Buffer.byteLength(response[1])});
  res.end(response[1]);
  return true;
}
