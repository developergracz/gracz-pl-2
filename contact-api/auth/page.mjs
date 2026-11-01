import { readFile } from 'node:fs/promises';
const ownerReference=Buffer.concat(await Promise.all(Array.from({length:9},(_,index)=>readFile(new URL('./reference/part-'+String(index).padStart(2,'0')+'.bin',import.meta.url)))));
if(ownerReference.byteLength!==4968 || ownerReference.subarray(0,4).toString()!=='RIFF' || ownerReference.subarray(8,12).toString()!=='WEBP' || ownerReference.readUInt32LE(4)+8!==ownerReference.byteLength)throw Error('OWNER_REFERENCE_INTEGRITY_FAILURE');
const headers={
  'Content-Type':'text/html; charset=utf-8',
  'Content-Security-Policy':"default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' https://gracz.pl; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'Cache-Control':'no-store','X-Frame-Options':'DENY'
};
const html=String.raw`<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Załóż konto lub zaloguj się — gracz.pl</title><meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="/konto/styl.css"><script src="/konto/app.js" defer></script></head><body>
<header class="top"><a class="brand" href="https://gracz.pl/">gracz<span>.pl</span></a><nav aria-label="Nawigacja"><a href="https://gracz.pl/gry/">Gry</a><a href="https://gracz.pl/poradniki/">Poradniki</a><a href="https://gracz.pl/">Forum</a><a href="https://gracz.pl/">Aktualności</a><a href="https://gracz.pl/#spolecznosc">Społeczność</a><a href="https://gracz.pl/#gracz-next">Gracz Next</a></nav><span class="nav-icons" aria-hidden="true">⌕　☼</span><div class="actions"><button type="button" data-view="login" class="top-login">Zaloguj się</button><button type="button" data-view="register" class="top-register">♙ Zarejestruj się</button></div></header>
<main class="scene">
<aside class="left"><div class="left-copy"><em>Dołącz do społeczności</em><div class="hero-brand">gracz<span>.pl</span></div><div class="eyebrow">POLSKIE CENTRUM GRACZA</div><ul class="benefits"><li><b>♟</b><span><strong>Graj online</strong><small>Warcaby, Szachy, Tysiąc, Poker i inne gry</small></span></li><li><b>♧</b><span><strong>Ucz się i rozwijaj</strong><small>Poradniki, strategie, analizy</small></span></li><li><b>🏆</b><span><strong>Rywalizuj</strong><small>Turnieje, rankingi, kluby graczy</small></span></li><li><b>♧</b><span><strong>Twórz społeczność</strong><small>Forum, znajomi, wspólne pasje</small></span></li></ul></div><div class="cards" aria-hidden="true"><div class="stack">♠<br><span>gracz.pl</span></div><div class="chip">gracz<span>.pl</span></div></div></aside>
<section class="panel" aria-label="Panel konta gracza"><div class="panel-heading"><div class="round"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="15" r="8" fill="currentColor"/><path d="M9 37c0-8 5-14 15-14s15 6 15 14v2H9z" fill="currentColor"/></svg></div><div><h1 id="page-title">Załóż konto w <span class="form-logo">gracz<span>.pl</span></span></h1><p>Graj, ucz się, rywalizuj – w jednym miejscu.</p></div></div>
<div id="notice" role="status" aria-live="polite"></div>
<form id="register-form" autocomplete="on"><label for="nickname">Nick gracza</label><div class="field nickname-field"><span class="field-icon" aria-hidden="true">♧</span><input name="nickname" id="nickname" maxlength="32" minlength="3" pattern="[A-Za-z][A-Za-z0-9._-]{2,31}" required placeholder="Wpisz swój nick" autocomplete="username"><output id="nick-status" aria-live="polite"></output></div><p class="hint">3–32 znaki, zaczyna się literą. Litery, cyfry, _ – .</p>
<label for="email">Adres e-mail</label><div class="field"><span class="field-icon">✉</span><input name="email" id="email" maxlength="254" required type="email" placeholder="Wpisz swój adres e-mail" autocomplete="email"></div>
<label for="password">Hasło</label><div class="field"><span class="field-icon">♙</span><input name="password" id="password" minlength="15" maxlength="256" required type="password" placeholder="Utwórz hasło" autocomplete="new-password"><button class="eye" type="button" data-show="password" aria-label="Pokaż hasło"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg></button></div><p class="hint">Co najmniej 15 znaków — najlepiej długa, unikalna fraza.</p>
<label for="repeatPassword">Powtórz hasło</label><div class="field"><span class="field-icon">♙</span><input name="repeatPassword" id="repeatPassword" minlength="15" maxlength="256" required type="password" placeholder="Wpisz ponownie hasło" autocomplete="new-password"><button class="eye" type="button" data-show="repeatPassword" aria-label="Pokaż powtórzone hasło"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg></button></div>
<div class="checks"><label><input name="terms" type="checkbox" required>Akceptuję <a href="https://gracz.pl/regulamin/" target="_blank" rel="noopener">Regulamin serwisu gracz.pl</a></label><label><input name="privacy" type="checkbox" required>Akceptuję <a href="https://gracz.pl/polityka-prywatnosci/" target="_blank" rel="noopener">Politykę prywatności</a></label><label class="muted"><input type="checkbox" disabled>Chcę otrzymywać newsletter <small>(dostępne wkrótce)</small></label></div>
<button class="submit" type="submit">♙　 Zarejestruj się　 →</button><p class="oauth-separator">lub zarejestruj się przez</p><div class="oauth-buttons"><button disabled title="Rejestracja Google nie jest jeszcze dostępna"><span class="google-logo">G</span> Google</button><button disabled title="Rejestracja Microsoft nie jest jeszcze dostępna"><span class="microsoft-logo">▦</span> Microsoft</button><button disabled title="Rejestracja Discord nie jest jeszcze dostępna"><span class="discord-logo">●</span> Discord</button></div><p class="switch">Masz już konto? <button type="button" data-view="login">Zaloguj się</button></p></form>
<form id="login-form" hidden><label for="login">E-mail lub nick gracza</label><div class="field"><span class="field-icon">✉</span><input id="login" name="login" autocomplete="username" placeholder="Wpisz e-mail lub nick" required></div><label for="loginPassword">Hasło</label><div class="field"><span class="field-icon">♙</span><input id="loginPassword" name="password" type="password" autocomplete="current-password" required placeholder="Wpisz hasło"><button class="eye" type="button" data-show="loginPassword" aria-label="Pokaż hasło">◉</button></div><button class="submit" type="submit">Zaloguj się →</button><p class="switch">Nie masz konta? <button type="button" data-view="register">Zarejestruj się</button></p></form>
<section id="account" hidden><h2>Twoje konto</h2><p>Zalogowano jako <strong id="user-nick"></strong></p><button id="logout" class="submit">Wyloguj się</button></section>
<section id="verified" hidden><h2>Potwierdzenie adresu e-mail</h2><p>Twoje konto jest gotowe. Możesz się zalogować.</p><button type="button" class="submit" data-view="login">Przejdź do logowania</button></section>
<div class="oauth-note">Bezpieczne konta przez e-mail. Logowania Google, Microsoft i Discord zostaną udostępnione po konfiguracji dostawców.</div></section>
<aside class="right"><div class="info"><h2>♢　Twoje dane są bezpieczne</h2><p>✓　Szyfrowane połączenie (HTTPS)</p><p>✓　Hasła nie są zapisywane jawnie</p><p>✓　Potwierdzenie adresu e-mail</p><p>✓　Bezpieczne sesje logowania</p></div><div class="info"><h2>♟　Dołącz do tysięcy graczy</h2><div class="avatars" aria-hidden="true">♟　♙　♟　♙　♟　♙</div><p>Wspólna pasja. Prawdziwi ludzie.</p><p>Gry, wiedza, turnieje i dobra zabawa.</p></div></aside>
</main><footer><a href="https://gracz.pl/">gracz.pl</a> · Polskie Centrum Gracza</footer></body></html>`;
const css=String.raw`*{box-sizing:border-box}html{font-family:Inter,"Segoe UI",Arial,sans-serif;background:#05111d;color:#f5f8fc}body{margin:0;min-height:100vh;background:radial-gradient(circle at 8% 70%,#7c411b55,transparent 29%),radial-gradient(circle at 85% 85%,#bc692933,transparent 28%),linear-gradient(110deg,#06101d,#061c2b 50%,#040b14)}button,input{font:inherit}button{cursor:pointer}.top{height:73px;padding:0 max(24px,5.8vw);display:flex;align-items:center;gap:60px;background:#031321ed;border-bottom:1px solid #48617c80}.brand,.hero-brand{font-weight:900;letter-spacing:-3px;color:#fff;text-decoration:none}.brand{font-size:41px;white-space:nowrap}.brand span,.hero-brand span,.panel-heading h1 span,.chip span{color:#ed2c49}.top nav{display:flex;gap:32px;flex:1}.top nav a{color:#fff;text-decoration:none;font-size:15px}.actions{display:flex;gap:18px;align-items:center}.actions button{white-space:nowrap;background:transparent;color:#d8ebfa;border:0;padding:11px}.actions .top-register{color:#ffd278;border:1px solid #ffba43;border-radius:8px;font-weight:700;padding:13px 20px}.scene{max-width:1590px;margin:auto;min-height:calc(100vh - 117px);display:grid;grid-template-columns:minmax(255px,1fr) minmax(410px,605px) minmax(180px,285px);gap:16px;align-items:center;padding:25px 28px;background:linear-gradient(90deg,#020b15ac,transparent 42%,#020b15a4),url('https://gracz.pl/assets/gracz-hero-approved-r14.webp') center/cover no-repeat}.left{align-self:stretch;display:flex;justify-content:space-around;flex-direction:column;padding:38px 8px 10px 5vw;text-shadow:0 2px 12px #000}.left-copy em{font-family:Georgia,serif;font-size:clamp(24px,2.5vw,40px);color:#ffd17e}.hero-brand{font-size:clamp(50px,5vw,82px);line-height:1.05}.eyebrow{font-size:clamp(12px,1.4vw,21px);color:#ffc56d;letter-spacing:3px;font-weight:700;margin:12px 0 28px}.benefits{padding:0;margin:0;list-style:none;display:grid;gap:17px}.benefits li{display:flex;align-items:center;gap:14px}.benefits b{display:grid;place-items:center;border:2px solid #f3c05c;color:#ffd487;border-radius:50%;min-width:53px;height:53px;font-size:26px}.benefits strong,.benefits small{display:block}.benefits small{max-width:220px;font-size:13px;margin-top:7px}.cards{position:relative;min-height:230px}.stack{position:absolute;left:20%;top:10%;width:185px;height:225px;display:grid;place-items:center;align-content:center;gap:12px;font-weight:900;font-size:55px;color:#f4c482;text-shadow:0 2px 12px black;border:10px double #deaf60;border-radius:12px;background:repeating-linear-gradient(45deg,#6a101f,#6a101f 8px,#d02b3e 8px,#d02b3e 16px);transform:rotate(-18deg);box-shadow:0 15px 35px black}.stack span{font-size:23px;color:#fff}.chip{position:absolute;bottom:0;left:0;width:120px;height:120px;display:grid;place-items:center;border-radius:50%;border:13px dashed #b42c41;background:#041728;box-shadow:0 0 0 6px #f0b954,0 8px 25px #0009;font-weight:900}.panel{background:linear-gradient(150deg,#071c2df8,#01101eeb);border:2px solid #ffc36e;border-radius:22px;box-shadow:0 0 0 3px #6d3b18 inset,0 0 24px #ffbc5580,0 20px 60px #000b;padding:32px 34px;min-width:0}.panel-heading{display:flex;gap:22px;align-items:center;margin-bottom:26px}.round{display:grid;place-items:center;flex:none;width:64px;height:64px;border:2px solid #ffd377;border-radius:50%;font-size:34px;color:#ffce72}.panel h1{font-size:clamp(23px,2.2vw,35px);color:#ffd07c;line-height:1.12;margin:0 0 7px}.panel-heading p{font-weight:600;font-size:15px;margin:0}form{display:grid}form label:not(.checks label){font-size:14px;font-weight:750;margin:14px 0 7px}.field{position:relative}.field input{width:100%;height:49px;background:#102537eb;border:1px solid #45627d;border-radius:7px;padding:11px 44px 11px 44px;color:#fff;outline-offset:2px}.field input:focus{outline:2px solid #efbd5a}.field-icon{position:absolute;top:12px;left:14px;font-size:20px;color:#e8c27d}.eye{position:absolute;right:6px;top:4px;border:0;background:transparent;color:white;font-size:22px;padding:5px 12px}.hint{font-size:12px;color:#acbdca;margin:6px 0 10px}.checks{display:grid;gap:12px;margin:22px 0}.checks label{display:flex;gap:12px;font-size:13px;align-items:center}.checks input{width:23px;height:23px;flex:none;accent-color:#ffd071}.checks a,.switch button{color:#4ed8f3}.checks .muted{color:#aabcc8}.checks small{font-size:12px}.submit{width:100%;background:linear-gradient(#ffdc86,#efa92e);border:1px solid #ffe0a0;border-radius:9px;box-shadow:0 6px 25px #f5b63a42;color:#100e09;font-size:19px;font-weight:800;padding:17px 12px;margin-top:12px}.submit:disabled{opacity:.65;cursor:wait}.switch{text-align:center;color:#a8bacb;font-size:14px;margin:22px 0 2px}.switch button{border:0;background:transparent;text-decoration:underline;padding:3px;font-weight:700}.oauth-note{font-size:11px;color:#9eb3c3;text-align:center;border-top:1px solid #47617a;margin-top:22px;padding-top:15px}.right{display:grid;gap:14px;align-self:center}.info{background:#061727e8;border:1px solid #dda747;border-radius:12px;padding:19px 16px;box-shadow:0 8px 20px #0008}.info h2{color:#f7c069;font-size:14px}.info p{font-size:12px;color:#d0dce7;line-height:1.6}#notice{min-height:0;color:#ffe2a2;font-size:14px;line-height:1.4}#notice:not(:empty){padding:11px;border:1px solid #a67438;border-radius:6px;margin-bottom:8px}#account,#verified{text-align:center}#account h2,#verified h2{color:#f9ca76}footer{text-align:center;padding:14px;font-size:12px;color:#9eb3c3}footer a{color:#d5ddec}[hidden]{display:none!important}@media(max-width:1180px){.top nav{display:none}.top{justify-content:space-between;gap:12px}.scene{grid-template-columns:minmax(200px,1fr) minmax(400px,605px)}.right{display:none}.left{padding-left:12px}.cards{display:none}}@media(max-width:780px){.top{padding:0 16px}.brand{font-size:32px}.top-register{display:none}.scene{display:block;min-height:0;padding:16px;background-size:cover}.left{padding:10px 4px 20px}.left-copy em{font-size:24px}.hero-brand{font-size:48px}.eyebrow{font-size:12px;margin:5px 0}.benefits{display:none}.panel{padding:23px 20px}.round{width:50px;height:50px;font-size:27px}.panel-heading{gap:12px}.panel-heading p{font-size:12px}.panel h1{font-size:25px}}
/* 1:1 desktop geometry matched to Owner's 1536×1024 registration reference. */
.top{height:74px;padding:0 6.2%;gap:62px;background:#021323;border-bottom:1px solid #355066}
.top nav{gap:36px}.top nav a{font-size:16px}.brand{font-size:42px;letter-spacing:-2px}
.actions .top-login{font-size:15px}.actions .top-register{border:2px solid #f4ad32;padding:13px 22px;font-size:15px}
.scene{position:relative;max-width:1536px;min-height:950px;padding:25px 0 43px;gap:0;grid-template-columns:minmax(0,610fr) minmax(0,605fr) minmax(0,321fr);align-items:start;background:#061521}
.left{height:920px;min-height:920px;padding:60px 30px 30px 96px;justify-content:flex-start;background:linear-gradient(100deg,#030b16bc,#020d18b0),url('https://gracz.pl/assets/gry-hero-premium-final.webp') center / cover no-repeat}
.left-copy{position:relative;z-index:1}.left-copy em{font-size:40px;color:#ffce84;line-height:1.2}.hero-brand{font-size:77px;line-height:1.0;margin-top:1px;letter-spacing:-4px}
.eyebrow{font-size:21px;white-space:nowrap;letter-spacing:2.7px;margin:13px 0 28px}
.benefits{gap:12px}.benefits li{gap:14px}.benefits b{width:58px;height:58px;flex:0 0 58px;color:#ffd47d;font-size:30px;border-color:#efbd5d}.benefits strong{font-size:16px}.benefits small{font-size:14px;margin-top:4px;line-height:1.35;color:#fafcff}
.cards{flex:1;min-height:0}.stack{left:19%;top:70px;transform:rotate(-16deg);border-width:8px}.chip{bottom:5px}
.panel{position:relative;z-index:2;width:100%;min-height:880px;padding:27px 34px 24px;border:2px solid #ffd18b;border-radius:22px;background:linear-gradient(120deg,#051928f9,#03111ff9);box-shadow:0 0 0 2px #91602c inset,0 0 15px #f9b04a77,0 14px 35px #000a}
.panel-heading{gap:33px;margin-bottom:7px;align-items:center}.panel-heading .round{width:65px;height:65px;color:#ffcc69;border-color:#ffcb66}.round svg{width:42px;height:42px}
.panel h1{font-size:35px;white-space:nowrap;letter-spacing:-.7px;margin:0 0 5px;color:#f8c579}.panel-heading p{font-size:17px;font-weight:500;color:#fff;white-space:nowrap}
.panel-heading h1 .form-logo{color:#fff}.panel-heading h1 .form-logo span{color:#e52d48}
.panel form:not([hidden]){display:grid}
.panel form>label{margin:19px 0 6px 73px;font-size:14px;font-weight:700}
.field{margin-left:73px}.field input{height:47px;border-radius:7px;background:#11283beb;padding-left:16px;padding-right:53px;border-color:#50677d;color:#fff;font-size:15px}
.field-icon{left:-72px;top:-5px;display:grid;place-items:center;width:58px;height:58px;font-size:25px;line-height:1;border:1px solid #5b7896;border-radius:50%;color:#fff}
.eye{top:5px;right:6px;padding:6px 11px}.eye svg{width:23px;height:23px}
.hint{margin:7px 0 6px 73px;font-size:13px;color:#bac7d6}
.nickname-field input{padding-right:150px}
#nick-status{display:none;position:absolute;top:0;right:0;height:47px;align-items:center;justify-content:center;width:145px;font-size:12px;color:#09f3ac;background:#051b28;border:1px solid #008967;border-radius:7px}
#nick-status[data-state="available"],#nick-status[data-state="taken"],#nick-status[data-state="checking"]{display:flex}
#nick-status[data-state="taken"]{color:#ffb3a7;border-color:#8b4545}
#nick-status[data-state="checking"]{color:#d3dfeb;border-color:#516479}
.checks{gap:9px;margin:20px 0 21px 3px}.checks label{font-size:14px;gap:14px;line-height:1.35}.checks input{width:25px;height:25px;accent-color:#ffd173}.checks .muted{color:#e0e5ee}
.submit{height:59px;margin-top:0;padding:10px 12px;font-size:21px;letter-spacing:.1px;background:linear-gradient(#ffd373,#efa934);box-shadow:0 4px 17px #e7a5334b}
.oauth-separator{color:#aebcc7;font-size:14px;text-align:center;display:flex;align-items:center;gap:12px;margin:14px 0 9px}
.oauth-separator:before,.oauth-separator:after{content:"";height:1px;background:#5b6e80;flex:1}
.oauth-buttons{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.oauth-buttons button{height:51px;border:1px solid #54708d;border-radius:8px;color:#f2f8ff;background:#041727;font-size:15px;cursor:not-allowed;opacity:.8}
.google-logo{font-size:25px;font-weight:900;color:#52a6ee;vertical-align:middle;margin-right:7px}
.microsoft-logo{font-size:24px;font-weight:900;color:#ffcc60;vertical-align:middle;margin-right:6px}
.discord-logo{font-size:24px;color:#8899ff;vertical-align:middle;margin-right:7px}
.switch{font-size:14px;margin:23px 0 4px}.oauth-note{display:none}
.right{height:920px;align-self:start;padding:108px 30px 0 14px;display:flex;flex-direction:column;gap:14px;background:linear-gradient(100deg,#020d18ae,#06122185),url('https://gracz.pl/assets/r4-game-chess.webp') center / cover no-repeat}
.right .info{padding:18px 14px;border-color:#f9b53c;border-radius:13px;min-height:191px;background:#061627ec}
.right .info h2{font-size:14px;color:#ffc56c;margin:4px 0 17px;white-space:nowrap}
.right .info p{font-size:12px;color:#d7deed;margin:10px 0}
.right .info:nth-child(2){min-height:201px}.right .avatars{font-size:28px;color:#ddc5a1;line-height:2}
footer{display:none}
@media(min-width:1181px) and (max-width:1535px){.top{gap:3vw}.scene{grid-template-columns:minmax(0,39.7fr) minmax(0,39.4fr) minmax(0,20.9fr)}.left{padding-left:6.25vw}.left-copy em{font-size:2.6vw}.hero-brand{font-size:5vw}.eyebrow{font-size:1.35vw}.panel h1{font-size:2.25vw}.panel-heading p{font-size:1.09vw}.right{padding-right:2vw}}
@media(min-width:780px) and (max-width:1180px){.scene{display:grid;grid-template-columns:minmax(200px,1fr) minmax(500px,605px);gap:0;padding:25px 14px}.left{padding:75px 14px 20px 22px;min-height:880px}.left-copy em{font-size:27px}.hero-brand{font-size:52px}.eyebrow{font-size:14px;white-space:normal}.panel{min-height:0}.panel h1{font-size:29px}.panel-heading p{font-size:13px}.right{display:none}.cards{display:none}}
@media(max-width:779px){.top{height:67px;padding:0 13px}.brand{font-size:31px}.top .actions{margin-left:auto}.top .actions .top-register{display:none}.top nav{display:none}.scene{display:flex;flex-direction:column;gap:0;padding:0 0 20px;background:#071a27}.left{height:auto;min-height:0;align-self:stretch;padding:27px 18px 16px;background-position:center}.left-copy em{font-size:27px}.hero-brand{font-size:49px}.eyebrow{font-size:12px;margin:4px 0}.benefits,.cards{display:none}.panel{width:calc(100% - 20px);align-self:center;margin-top:8px;min-height:0;padding:20px 14px 22px;border-radius:15px}.panel-heading{gap:12px;margin-bottom:10px}.panel-heading .round{width:47px;height:47px}.round svg{width:29px;height:29px}.panel h1{font-size:clamp(20px,5vw,27px);white-space:normal}.panel-heading p{font-size:12px;white-space:normal}.panel form>label{margin-left:54px}.field{margin-left:54px}.field-icon{left:-53px;width:44px;height:44px;font-size:22px;top:0}.hint{margin-left:54px;font-size:11px}.field input{font-size:14px}.nickname-field input{padding-right:110px}#nick-status{width:110px;font-size:10px}.checks{margin:20px 0}.checks label{font-size:12px}.oauth-buttons{gap:6px}.oauth-buttons button{font-size:12px}.right{display:none}}

/* Owner-provided photographic composition, verified byte-for-byte.
   The real form stays HTML (keyboard, screen-reader and password manager safe). */
.scene{
 background-image:url('/konto/reference.webp');
 background-size:100% auto;
 background-position:center -74px;
 background-repeat:no-repeat;
 background-color:#06121e;
}
.left{background:linear-gradient(180deg,rgba(2,11,20,.66) 0%,rgba(2,11,20,.66) 51%,rgba(2,11,20,.23) 72%,transparent 100%)}
.left-copy{filter:drop-shadow(0 2px 2px #04101a)}
.cards{display:none}
.right{background:transparent}
.right .info{background:#051727ee}
.right .avatars{
 background:url('/konto/reference.webp') -1268px -478px/1536px 1024px no-repeat;
 height:75px;
 margin:5px 0 8px;
 font-size:0;
 color:transparent;
}
.top{gap:47px}
.top nav{gap:29px}
.top .nav-icons{font-size:26px;color:#eef5ff;white-space:nowrap;line-height:1}
.top .actions{gap:12px}
.panel{background:linear-gradient(150deg,#041623fb,#02111ffb)}
#notice{word-break:break-word}
@media(min-width:1181px) and (max-width:1535px){
 .right .avatars{background-size:100vw auto;background-position:calc(-82.55vw) calc(-31.12vw)}
 .top{gap:2.5vw}
 .top nav{gap:1.75vw}
}
@media(max-width:1180px){
 .top .nav-icons{display:none}
 .scene{background-image:url('/konto/reference.webp');background-position:center top;background-size:cover}
 .left{background:linear-gradient(180deg,rgba(2,10,21,.82),rgba(2,10,21,.66))}
}
@media(max-width:779px){
 .scene{background-position:center center;background-size:cover}
 .left{background:rgba(2,12,23,.68)}
 .right{display:none}
 .panel{background:#041727fa}
}
`;
const js=String.raw`(function(){'use strict';
const notice=document.getElementById('notice');
const form=document.getElementById('register-form'),login=document.getElementById('login-form'),account=document.getElementById('account'),verified=document.getElementById('verified'),heading=document.getElementById('page-title');
function msg(s){notice.textContent=s;}
const nickInput=document.getElementById('nickname');
const nickStatus=document.getElementById('nick-status');
let nickDelay=0, nickVersion=0;
nickInput.addEventListener('input',()=>{
 const nick=nickInput.value.trim(),version=++nickVersion;
 clearTimeout(nickDelay);nickStatus.textContent='';nickStatus.removeAttribute('data-state');
 if(!/^[a-z][a-z0-9._-]{2,31}$/i.test(nick))return;
 nickStatus.textContent='Sprawdzanie…';nickStatus.dataset.state='checking';
 nickDelay=setTimeout(async()=>{
  try{
   const response=await fetch('/auth/nick-available?nick='+encodeURIComponent(nick),{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)throw Error('CHECK_FAILED');
   const data=await response.json();if(version!==nickVersion)return;
   nickStatus.textContent=data.available?'✓ Nick jest dostępny':'Nick jest zajęty';
   nickStatus.dataset.state=data.available?'available':'taken';
  }catch{if(version===nickVersion){nickStatus.textContent='Sprawdź po zapisie';nickStatus.dataset.state='checking';}}
 },400);
});

function view(name){form.hidden=name!=='register';login.hidden=name!=='login';account.hidden=name!=='account';verified.hidden=name!=='verified';heading.innerHTML=name==='login'?'Zaloguj się do <span class="form-logo">gracz<span>.pl</span></span>':name==='account'?'Twoje konto w gracz.pl':name==='verified'?'Potwierdzono e-mail':'Załóż konto w <span class="form-logo">gracz<span>.pl</span></span>';msg('');}
async function api(path,data){const r=await fetch('/auth/'+path,{method:data===undefined?'GET':'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});const b=await r.json();if(!r.ok||!b.ok)throw Error(({SYSTEM_NIEDOSTEPNY:'System kont jest chwilowo niedostępny.',BLEDNY_LOGIN_LUB_HASLO:'Nieprawidłowe dane albo konto nie zostało jeszcze potwierdzone.',POPRAW_DANE_FORMULARZA:'Sprawdź poprawność danych i zgody.',ZBYT_WIELE_PROB:'Zbyt wiele prób. Spróbuj później.',LINK_NIEWAZNY_LUB_WYGASL:'Link jest nieważny albo wygasł.',NIE_UDALO_SIE_WYSLAC_EMAIL:'Nie udało się wysłać e-maila.'})[b.error]||'Nie udało się wykonać operacji.');return b;}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>view(button.dataset.view)));
document.querySelectorAll('[data-show]').forEach(button=>button.addEventListener('click',()=>{const el=document.getElementById(button.dataset.show);el.type=el.type==='password'?'text':'password';button.setAttribute('aria-label',el.type==='password'?'Pokaż hasło':'Ukryj hasło');}));
form.addEventListener('submit',async e=>{e.preventDefault();const btn=form.querySelector('[type=submit]');const d=new FormData(form);if(d.get('password')!==d.get('repeatPassword')){msg('Hasła nie są takie same.');return;}btn.disabled=true;try{const b=await api('register',{nickname:d.get('nickname'),email:d.get('email'),password:d.get('password'),repeatPassword:d.get('repeatPassword'),terms:d.get('terms')==='on',privacy:d.get('privacy')==='on'});form.reset();msg(b.message);}catch(err){msg(err.message);}finally{btn.disabled=false;}});
login.addEventListener('submit',async e=>{e.preventDefault();const btn=login.querySelector('[type=submit]'),d=new FormData(login);btn.disabled=true;try{const b=await api('login',{login:d.get('login'),password:d.get('password')});login.reset();document.getElementById('user-nick').textContent=b.nickname;view('account');}catch(err){msg(err.message);}finally{btn.disabled=false;}});
document.getElementById('logout').addEventListener('click',async()=>{try{await api('logout',{});view('login');msg('Wylogowano.');}catch(err){msg(err.message);}});
(async()=>{const hash=new URLSearchParams(location.hash.slice(1));const token=hash.get('potwierdz');if(token){history.replaceState(null,'','/konto/');try{await api('verify',{token});view('verified');}catch(err){view('login');msg(err.message);}return;}try{const s=await api('session');if(s.loggedIn){document.getElementById('user-nick').textContent=s.nickname;view('account');return;}}catch{}view(new URLSearchParams(location.search).get('widok')==='login'?'login':'register');})();
})();`;
export function serveIdentityPage(req,res,url){
 const path=url.pathname.replace(/\/+$/,'')||'/';
 let type,body;
 if(path==='/konto'&&req.method==='GET'){type='text/html; charset=utf-8';body=html;}
 else if(path==='/konto/styl.css'&&req.method==='GET'){type='text/css; charset=utf-8';body=css;}
 else if(path==='/konto/app.js'&&req.method==='GET'){type='application/javascript; charset=utf-8';body=js;}
 else if(path==='/konto/reference.webp'&&req.method==='GET'){type='image/webp';body=ownerReference;}
 else return false;
 res.writeHead(200,{...headers,'Content-Type':type,'Content-Length':Buffer.byteLength(body)});
 res.end(body);
 return true;
}
