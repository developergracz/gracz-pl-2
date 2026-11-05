import { readFile } from 'node:fs/promises';
// Full-resolution, text-free artwork from the approved GRACZ.PL casino set (no upscaled thumbnail,
// no screenshot of this page). Native pixels only, no resampling:
//  tlo    1672x847: maintenance-site/approved-maintenance.png outside its notice card,
//                   frosted centre from maintenance-site/assets/img/hero-bg.webp (same scene).
//  szachy  702x505: 1:1 crop of maintenance-site/assets/gracz-hero-approved-r14.webp (chess, checkers, cards).
async function loadArtwork(name,width,height){
 const bytes=await readFile(new URL('./assets/'+name,import.meta.url));
 const riff=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'&&bytes.readUInt32LE(4)+8===bytes.byteLength;
 const vp8=bytes.subarray(12,16).toString()==='VP8 '&&bytes.subarray(23,26).equals(Buffer.from([0x9d,0x01,0x2a]));
 if(!riff||!vp8||(bytes.readUInt16LE(26)&0x3fff)!==width||(bytes.readUInt16LE(28)&0x3fff)!==height)throw Error('ACCOUNT_ARTWORK_INTEGRITY_FAILURE');
 return bytes;
}
// Alpha WebP (VP8X canvas) for cut-out artwork that must sit directly on the teal stage.
async function loadAlphaArtwork(name,width,height){
 const bytes=await readFile(new URL('./assets/'+name,import.meta.url));
 const riff=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'&&bytes.readUInt32LE(4)+8===bytes.byteLength;
 const vp8x=bytes.subarray(12,16).toString()==='VP8X'&&(bytes[20]&0x10)===0x10;
 if(!riff||!vp8x||bytes.readUIntLE(24,3)+1!==width||bytes.readUIntLE(27,3)+1!==height)throw Error('ACCOUNT_ARTWORK_INTEGRITY_FAILURE');
 return bytes;
}
const artwork=new Map([
 ['/konto/tlo.webp',await loadArtwork('konto-tlo.webp',1672,847)],
 ['/konto/szachy.webp',await loadArtwork('konto-szachy.webp',702,505)],
 ['/konto/owner-layout.webp',await loadArtwork('owner-layout.webp',1536,950)],
 // Owner-approved gracz.pl chip + red-back deck, cut out of the Owner registration reference (R2), 2× master.
 ['/konto/zeton-talia.webp',await loadAlphaArtwork('konto-zeton-talia.webp',1186,628)],
]);
// The original gold crown hand-coded for gracz.pl (#646): a byte-identical copy of
// maintenance-site/assets/gracz-crown-premium.svg, kept equal by a test. Served as a vector image.
const crownSvg=await readFile(new URL('./assets/gracz-crown-premium.svg',import.meta.url));
// Montserrat (OFL) from the homepage, so the login top bar uses the same typeface as gracz.pl.
// A missing font only falls back to Arial; it never stops the account service.
async function loadFont(name){
 try{return await readFile(new URL('../../maintenance-site/assets/fonts/'+name,import.meta.url));}catch{return null;}
}
const fonts=new Map([
 ['/konto/fonts/montserrat-latin.woff2',await loadFont('montserrat-latin.woff2')],
 ['/konto/fonts/montserrat-latin-ext.woff2',await loadFont('montserrat-latin-ext.woff2')],
]);
const headers={
  'Content-Type':'text/html; charset=utf-8',
  'Content-Security-Policy':"default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' https://gracz.pl; font-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'Cache-Control':'no-store','X-Frame-Options':'DENY'
};
const html=String.raw`<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Załóż konto lub zaloguj się — gracz.pl</title><meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="/konto/styl.css"><script src="/konto/app.js" defer></script></head><body>
<header class="site-bar" data-account-header><div class="site-bar-inner"><a class="site-bar-logo" href="https://gracz.pl/" aria-label="gracz.pl — strona główna">gracz<span>.pl</span></a>
<button class="site-bar-burger" type="button" aria-expanded="false" aria-controls="site-bar-menu" aria-label="Otwórz menu"><svg class="burger-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><svg class="burger-close" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
<div class="site-bar-menu" id="site-bar-menu"><nav class="site-bar-nav" aria-label="Główna nawigacja"><ul class="site-bar-list">
<li class="has-menu"><a class="bar-link" href="https://gracz.pl/gry/">Gry</a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="bar-menu-gry" aria-label="Rozwiń menu Gry"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button><ul class="dropdown" id="bar-menu-gry"><li><a href="https://gracz.pl/gry/">Wszystkie gry</a></li><li><a href="https://gracz.pl/gry/poker-treningowy/">Poker treningowy</a></li><li><a href="https://gracz.pl/gry/tysiac/">Tysiąc</a></li><li><a href="https://gracz.pl/gry/warcaby/">Warcaby</a></li><li><a href="https://gracz.pl/gry/gomoku/">Gomoku</a></li></ul></li>
<li class="has-menu"><a class="bar-link" href="https://gracz.pl/gry-karciane/">Gry karciane</a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="bar-menu-karciane" aria-label="Rozwiń menu Gry karciane"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button><ul class="dropdown" id="bar-menu-karciane"><li><a href="https://gracz.pl/gry-karciane/">Gry karciane</a></li><li><a href="https://gracz.pl/gry/poker-treningowy/">Poker treningowy</a></li><li><a href="https://gracz.pl/gry-karciane/#poker-academy">Poker Academy</a></li><li><a href="https://gracz.pl/gry/tysiac/">Tysiąc</a></li></ul></li>
<li><a class="bar-link" href="https://gracz.pl/poradniki/">Poradniki</a></li><li><a class="bar-link" href="https://gracz.pl/#aktualnosci">Blog</a></li><li><a class="bar-link" href="https://gracz.pl/#spolecznosc">Społeczność</a></li><li><a class="bar-link bar-newsletter" href="https://gracz.pl/newsletter/">Newsletter</a></li></ul></nav>
<div class="site-bar-actions"><a class="bar-search" href="https://gracz.pl/szukaj/" aria-label="Szukaj w serwisie"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6" fill="none" stroke="currentColor" stroke-width="2.3"/><path d="M15.8 15.8l4.6 4.6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></a><a class="bar-btn bar-btn--outline" href="/konto/?widok=login" data-view="login">Zaloguj się</a><a class="bar-btn bar-btn--gold" href="/konto/" data-view="register">Załóż konto</a></div></div></div></header>
<main class="scene">
<aside class="left"><div class="left-copy"><em>Dołącz do społeczności</em><div class="hero-brand">gracz<span>.pl</span></div><div class="eyebrow">POLSKIE CENTRUM GRACZA</div><ul class="benefits"><li><b aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" focusable="false"><circle cx="12" cy="7.4" r="4.3"/><path d="M3.8 21c.4-5 3.7-8.1 8.2-8.1s7.8 3.1 8.2 8.1z"/></svg></b><span><strong>Graj online</strong><small>Warcaby, Szachy, Tysiąc, Poker i inne gry</small></span></li><li><b aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" focusable="false"><circle cx="12" cy="6.9" r="4.1"/><circle cx="6.9" cy="13.1" r="4.1"/><circle cx="17.1" cy="13.1" r="4.1"/><path d="M9.4 10.6h5.2v4.2H9.4zM12 12.5l2.3 8.7H9.7z"/></svg></b><span><strong>Ucz się i rozwijaj</strong><small>Poradniki, strategie, analizy</small></span></li><li><b aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" focusable="false"><path d="M6.6 3h10.8v1.6h3.6v2.1c0 3-2 5.3-4.8 5.8a5.4 5.4 0 0 1-3 2.7V18h3.4v3H7.4v-3h3.4v-2.8a5.4 5.4 0 0 1-3-2.7C5 12 3 9.7 3 6.7V4.6h3.6zm0 3.4H4.9v.4c0 1.8 1 3.2 2.5 3.8a8.6 8.6 0 0 1-.8-3.9zm10.8 0v.3c0 1.4-.3 2.7-.8 3.9 1.5-.6 2.5-2 2.5-3.8v-.4z" fill-rule="evenodd"/></svg></b><span><strong>Rywalizuj</strong><small>Turnieje, rankingi, kluby graczy</small></span></li><li><b aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" focusable="false"><circle cx="12" cy="7.3" r="3.6"/><path d="M5.8 20c.4-4.2 3-6.6 6.2-6.6s5.8 2.4 6.2 6.6z"/><circle cx="5" cy="9.1" r="2.7"/><path d="M.6 18.4c.3-3.1 2.1-4.9 4.5-4.9 1 0 1.9.3 2.7.9-1.3 1.1-2.1 2.6-2.5 4z"/><circle cx="19" cy="9.1" r="2.7"/><path d="M23.4 18.4c-.3-3.1-2.1-4.9-4.5-4.9-1 0-1.9.3-2.7.9 1.3 1.1 2.1 2.6 2.5 4z"/></svg></b><span><strong>Twórz społeczność</strong><small>Forum, znajomi, wspólne pasje</small></span></li></ul></div><div class="cards" aria-hidden="true"><img class="cards-art" src="/konto/zeton-talia.webp" width="1186" height="628" alt="" decoding="async" fetchpriority="low"></div></aside>
<section class="panel" aria-label="Panel konta gracza"><a class="login-close" href="https://gracz.pl/" aria-label="Zamknij i wróć na gracz.pl">×</a><img class="login-crown" src="/konto/korona.svg" width="60" height="49" alt="" aria-hidden="true"><div class="panel-heading"><div class="round"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="15" r="8" fill="currentColor"/><path d="M9 37c0-8 5-14 15-14s15 6 15 14v2H9z" fill="currentColor"/></svg></div><div><h1 id="page-title">Załóż konto w <span class="form-logo">gracz<span>.pl</span></span></h1><p>Graj, ucz się, rywalizuj – w jednym miejscu.</p></div></div>
<div id="notice" role="status" aria-live="polite"></div>
<form id="register-form" autocomplete="on" novalidate><label for="nickname">Nick gracza</label><div class="field nickname-field"><span class="field-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" focusable="false"><circle cx="12" cy="7.4" r="4.3"/><path d="M3.8 21c.4-5 3.7-8.1 8.2-8.1s7.8 3.1 8.2 8.1z"/></svg></span><input name="nickname" id="nickname" maxlength="32" minlength="3" pattern="[A-Za-z][A-Za-z0-9._-]{2,31}" required placeholder="Wpisz swój nick" autocomplete="username"><output id="nick-status" aria-live="polite"></output></div><p class="hint">3–32 znaki, zaczyna się literą. Litery, cyfry, _ – .</p>
<label for="email">Adres e-mail</label><div class="field"><span class="field-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" focusable="false"><path d="M3.2 5.6h17.6v12.8H3.2z"/><path d="m3.8 6.4 8.2 6.7 8.2-6.7"/></svg></span><input name="email" id="email" maxlength="254" required type="email" placeholder="Wpisz swój adres e-mail" autocomplete="email"></div>
<label for="password">Hasło</label><div class="field"><span class="field-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" focusable="false"><path fill-rule="evenodd" d="M7.2 10V7.6a4.8 4.8 0 0 1 9.6 0V10h1.1c.8 0 1.4.6 1.4 1.4v8.2c0 .8-.6 1.4-1.4 1.4H6.1c-.8 0-1.4-.6-1.4-1.4v-8.2c0-.8.6-1.4 1.4-1.4zm2.5 0h4.6V7.6a2.3 2.3 0 0 0-4.6 0zm3.7 5.1a1.4 1.4 0 1 0-2.3 1.1v2.2h1.8v-2.2c.3-.3.5-.7.5-1.1z"/></svg></span><input name="password" id="password" minlength="15" maxlength="256" required type="password" placeholder="Utwórz hasło" autocomplete="new-password" aria-describedby="password-feedback"><button class="eye" type="button" data-show="password" aria-label="Pokaż hasło"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg></button><div id="password-feedback" class="premium-feedback" role="alert" aria-live="polite" hidden><span class="premium-feedback-icon" aria-hidden="true">!</span><span id="password-feedback-text"></span></div></div><p class="hint">Co najmniej 15 znaków — najlepiej długa, unikalna fraza.</p>
<label for="repeatPassword">Powtórz hasło</label><div class="field"><span class="field-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" focusable="false"><path fill-rule="evenodd" d="M7.2 10V7.6a4.8 4.8 0 0 1 9.6 0V10h1.1c.8 0 1.4.6 1.4 1.4v8.2c0 .8-.6 1.4-1.4 1.4H6.1c-.8 0-1.4-.6-1.4-1.4v-8.2c0-.8.6-1.4 1.4-1.4zm2.5 0h4.6V7.6a2.3 2.3 0 0 0-4.6 0zm3.7 5.1a1.4 1.4 0 1 0-2.3 1.1v2.2h1.8v-2.2c.3-.3.5-.7.5-1.1z"/></svg></span><input name="repeatPassword" id="repeatPassword" minlength="15" maxlength="256" required type="password" placeholder="Wpisz ponownie hasło" autocomplete="new-password"><button class="eye" type="button" data-show="repeatPassword" aria-label="Pokaż powtórzone hasło"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg></button></div>
<div class="checks"><label><input name="terms" type="checkbox" required><span>Akceptuję <a href="https://gracz.pl/regulamin/" target="_blank" rel="noopener">Regulamin serwisu gracz.pl</a></span></label><label><input name="privacy" type="checkbox" required><span>Akceptuję <a href="https://gracz.pl/polityka-prywatnosci/" target="_blank" rel="noopener">Politykę prywatności</a></span></label><label class="muted"><input type="checkbox" disabled><span>Chcę otrzymywać newsletter <small>(dostępne wkrótce)</small></span></label><button type="button" class="register-forgot" data-view="forgot"><svg class="forgot-key" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="15.6" cy="8.4" r="4.6" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12.4 11.6 4.2 19.8M7.2 16.8l2.4 2.4M4.9 19.1l1.7 1.7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg><span>Zapomniałem hasła?</span></button></div>
<button class="submit register-submit" type="submit"><svg class="submit-user" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="7.4" r="4.4" fill="currentColor"/><path d="M3.6 21.2c.4-5.2 3.8-8.2 8.4-8.2s8 3 8.4 8.2z" fill="currentColor"/></svg><span>Zarejestruj się</span></button>
<p class="oauth-separator"><span>lub zarejestruj się przez</span></p>
<div class="oauth-buttons" aria-label="Rejestracja przez dostawców kont">
 <a href="/auth/oauth/google/start" data-oauth-provider="google" aria-disabled="true" tabindex="-1" title="Google — wymaga konfiguracji dostawcy"><svg class="oauth-logo google-logo" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg><span>Google</span></a>
 <a href="/auth/oauth/microsoft/start" data-oauth-provider="microsoft" aria-disabled="true" tabindex="-1" title="Microsoft — wymaga konfiguracji dostawcy"><svg class="oauth-logo microsoft-logo" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#F25022" d="M2 2h9.5v9.5H2z"/><path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z"/><path fill="#00A4EF" d="M2 12.5h9.5V22H2z"/><path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z"/></svg><span>Microsoft</span></a>
 <a href="/auth/oauth/discord/start" data-oauth-provider="discord" aria-disabled="true" tabindex="-1" title="Discord — wymaga konfiguracji dostawcy"><svg class="oauth-logo discord-logo" viewBox="0 0 127.14 96.36" aria-hidden="true" focusable="false"><path fill="#5865F2" d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15zM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69z"/></svg><span>Discord</span></a>
</div><p class="switch register-switch"><svg class="switch-ornament" viewBox="0 0 70 16" aria-hidden="true" focusable="false"><defs><linearGradient id="reg-orn-fade" gradientUnits="userSpaceOnUse" x1="1" x2="41" y1="8" y2="8"><stop offset="0" stop-color="#e9b94e" stop-opacity=".15"/><stop offset="1" stop-color="#f3c862"/></linearGradient></defs><path d="M1 8 39 6.2v3.6z" fill="url(#reg-orn-fade)"/><path d="M37 8c3.2-4.4 8.6-4.4 11.8 0-3.2 4.4-8.6 4.4-11.8 0z" fill="currentColor"/><path d="M40.4 8c1.6-2 3.4-2 5 0-1.6 2-3.4 2-5 0z" fill="#06221f"/><path d="M45.6 4.5c1.9-3.2 5.8-4.4 8.6-2.6-2.8 0-4.7 1.3-5.7 3.3zM45.6 11.5c1.9 3.2 5.8 4.4 8.6 2.6-2.8 0-4.7-1.3-5.7-3.3z" fill="currentColor"/><path d="M48.4 6.2 69 8 48.4 9.8z" fill="currentColor"/></svg><span class="switch-question">Masz już konto?</span> <a class="switch-login" href="/konto/?widok=login" data-view="login">Zaloguj się</a><svg class="switch-ornament switch-ornament--end" viewBox="0 0 70 16" aria-hidden="true" focusable="false"><path d="M1 8 39 6.2v3.6z" fill="url(#reg-orn-fade)"/><path d="M37 8c3.2-4.4 8.6-4.4 11.8 0-3.2 4.4-8.6 4.4-11.8 0z" fill="currentColor"/><path d="M40.4 8c1.6-2 3.4-2 5 0-1.6 2-3.4 2-5 0z" fill="#06221f"/><path d="M45.6 4.5c1.9-3.2 5.8-4.4 8.6-2.6-2.8 0-4.7 1.3-5.7 3.3zM45.6 11.5c1.9 3.2 5.8 4.4 8.6 2.6-2.8 0-4.7-1.3-5.7-3.3z" fill="currentColor"/><path d="M48.4 6.2 69 8 48.4 9.8z" fill="currentColor"/></svg></p></form>
<form id="login-form" hidden novalidate>
<label for="login">E-mail lub nick gracza</label><div class="field"><span class="field-icon" aria-hidden="true">✉</span><input id="login" name="login" autocomplete="username" placeholder="Wpisz e-mail lub nick" required></div>
<label for="loginPassword">Hasło</label><div class="field"><span class="field-icon" aria-hidden="true">♙</span><input id="loginPassword" name="password" type="password" autocomplete="current-password" required placeholder="Wpisz hasło"><button class="eye" type="button" data-show="loginPassword" aria-label="Pokaż hasło">◉</button></div>
<button class="login-forgot" data-view="forgot" type="button">Zapomniałem hasła?</button>
<button class="submit" type="submit">Zaloguj się →</button><p class="switch">Nie masz konta? <button data-view="register" type="button">Zarejestruj się</button></p></form>
<form id="forgot-form" hidden novalidate><p class="recovery-intro">Podaj e-mail przypisany do konta. Otrzymasz jednorazowy link do zmiany hasła.</p>
<label for="forgotEmail">Adres e-mail</label><div class="field"><span class="field-icon" aria-hidden="true">✉</span><input id="forgotEmail" name="email" type="email" autocomplete="email" maxlength="254" placeholder="Wpisz adres e-mail" required></div>
<button class="submit" type="submit">Wyślij link odzyskiwania →</button><p class="switch"><button data-view="login" type="button">Wróć do logowania</button></p></form>
<form id="reset-form" hidden novalidate><p class="recovery-intro">Ustaw nowe hasło zawierające co najmniej 15 znaków.</p>
<label for="newPassword">Nowe hasło</label><div class="field"><span class="field-icon" aria-hidden="true">♙</span><input id="newPassword" name="password" type="password" autocomplete="new-password" minlength="15" maxlength="256" placeholder="Wpisz nowe hasło" required><button class="eye" type="button" data-show="newPassword" aria-label="Pokaż hasło">◉</button></div>
<label for="newPasswordRepeat">Powtórz nowe hasło</label><div class="field"><span class="field-icon" aria-hidden="true">♙</span><input id="newPasswordRepeat" name="repeatPassword" type="password" autocomplete="new-password" minlength="15" maxlength="256" placeholder="Powtórz nowe hasło" required><button class="eye" type="button" data-show="newPasswordRepeat" aria-label="Pokaż hasło">◉</button></div>
<button class="submit" type="submit">Zapisz nowe hasło →</button><p class="switch"><button data-view="login" type="button">Wróć do logowania</button></p></form>
<section id="account" hidden><h2>Twoje konto</h2><p>Zalogowano jako <strong id="user-nick"></strong></p><button id="logout" class="submit">Wyloguj się</button></section>
<section id="verified" hidden><h2>Potwierdzenie adresu e-mail</h2><p>Twoje konto jest gotowe. Możesz się zalogować.</p><button type="button" class="submit" data-view="login">Przejdź do logowania</button></section>
<div class="oauth-note">Bezpieczna rejestracja e-mail. Google, Microsoft i Discord działają po skonfigurowaniu kont aplikacji u dostawców.</div></section>
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

/* Sharp, text-free GRACZ.PL casino artwork (no page screenshot, no drawn form copy).
   The only form is the real HTML form (keyboard, screen-reader and password manager safe). */
/* Display the entire approved casino scene within the visible screen, never crop it.
   Keep it behind the real form even when the document needs vertical scrolling. */
body{
 --account-header-height:clamp(57px,8dvh,74px);
 background:#05111d;
}
body::before{
 content:"";
 position:fixed;
 inset:var(--account-header-height) 0 0;
 z-index:0;
 pointer-events:none;
 background-image:
  radial-gradient(ellipse at 52% 40%,rgba(10,110,128,.30),transparent 62%),
  linear-gradient(90deg,rgba(2,16,36,.64),rgba(2,18,38,.34) 34%,rgba(2,20,40,.16) 64%,rgba(2,16,36,.38)),
  linear-gradient(180deg,rgba(2,16,34,.44),rgba(2,22,40,.08) 38%,rgba(2,16,34,.48)),
  url('/konto/tlo.webp');
 background-repeat:no-repeat;
 background-position:center;
 background-size:100% 100%,100% 100%,100% 100%,contain;
}
.top,.scene{position:relative;z-index:1}
.scene{background:none}
@media(min-width:780px) and (max-width:1180px){
 body{--account-header-height:clamp(60px,8dvh,74px)}
}
@media(max-width:779px){
 body{--account-header-height:67px}
}
.left{background:linear-gradient(180deg,rgba(2,11,20,.66) 0%,rgba(2,11,20,.66) 51%,rgba(2,11,20,.23) 72%,transparent 100%)}
.left-copy{filter:drop-shadow(0 2px 2px #04101a)}
.cards{display:none}
.right{background:transparent}
.right .info{background:#051727ee}
.right .avatars{
 background:url('/konto/szachy.webp') center 58%/cover no-repeat;
 height:75px;
 margin:5px 0 8px;
 border-radius:8px;
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
 .top{gap:2.5vw}
 .top nav{gap:1.75vw}
}
@media(max-width:1180px){
 .top .nav-icons{display:none}
 .left{background:linear-gradient(180deg,rgba(2,10,21,.82),rgba(2,10,21,.66))}
}
@media(max-width:779px){
 .scene{background-position:center center;background-size:cover}
 .left{background:rgba(2,12,23,.68)}
 .right{display:none}
 .panel{background:#041727fa}
}

.actions a.top-register{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;white-space:nowrap;background:transparent}
/* Desktop stage fits the real browser viewport, not a fixed 1024px mockup. */
@media (min-width:1181px) {
  .top {height:clamp(57px,8dvh,74px);padding-inline:clamp(16px,4vw,96px);gap:clamp(10px,2.7vw,47px)}
  .top nav{gap:clamp(10px,1.85vw,29px)}
  .scene{
    height:auto;
    min-height:calc(100dvh - clamp(57px,8dvh,74px));
    padding:clamp(8px,1.3dvh,15px) 0 0;
    grid-template-columns:minmax(0,39.7fr) minmax(0,39.4fr) minmax(0,20.9fr);
  }
  .left{height:100%;min-height:0;padding:clamp(10px,3dvh,34px) 20px 14px clamp(14px,6vw,96px)}
  .left-copy em{font-size:clamp(22px,2.5vw,37px)}
  .hero-brand{font-size:clamp(44px,4.85vw,74px)}
  .eyebrow{font-size:clamp(13px,1.25vw,20px);margin:clamp(5px,1dvh,11px) 0 clamp(8px,2dvh,19px)}
  .benefits{gap:clamp(6px,1.4dvh,13px)}
  .benefits b{width:clamp(38px,4.6dvh,52px);height:clamp(38px,4.6dvh,52px);flex-basis:clamp(38px,4.6dvh,52px);font-size:clamp(20px,2.9dvh,27px)}
  .benefits strong{font-size:clamp(12px,1vw,15px)}
  .benefits small{font-size:clamp(11px,.84vw,13px)}
  .panel{
    height:auto;min-height:0;max-height:100%;
    padding:clamp(10px,1.5dvh,20px) clamp(14px,2vw,30px);
    overflow-y:auto;scrollbar-width:thin;scrollbar-color:#ad7c3f transparent;
  }
  .panel-heading{margin-bottom:clamp(5px,1dvh,10px);gap:clamp(10px,1.5vw,22px)}
  .panel-heading .round{width:clamp(40px,5.4dvh,60px);height:clamp(40px,5.4dvh,60px)}
  .round svg{width:clamp(28px,3.6dvh,38px);height:clamp(28px,3.6dvh,38px)}
  .panel h1{font-size:clamp(23px,2vw,33px)}
  .panel-heading p{font-size:clamp(12px,1.05vw,15px)}
  .panel form>label{margin:clamp(6px,1.3dvh,12px) 0 4px 58px;font-size:clamp(12px,1vw,14px)}
  .field{margin-left:58px}
  .field-icon{left:-57px;top:-2px;width:clamp(36px,4.7dvh,49px);height:clamp(36px,4.7dvh,49px);font-size:clamp(19px,2.5dvh,24px)}
  .field input{height:clamp(36px,4.8dvh,45px);font-size:14px}
  #nick-status{height:clamp(36px,4.8dvh,45px)}
  .hint{margin:clamp(3px,.7dvh,6px) 0 2px 58px;font-size:clamp(11px,.85vw,12px)}
  .checks{margin:clamp(8px,1.45dvh,14px) 0;gap:clamp(4px,.9dvh,8px)}
  .checks label{font-size:clamp(11px,.95vw,13px)}
  .checks input{width:clamp(18px,2.65dvh,23px);height:clamp(18px,2.65dvh,23px)}
  .submit{height:clamp(42px,5.5dvh,53px);font-size:clamp(16px,1.3vw,19px)}
  .oauth-separator{margin:clamp(7px,1.2dvh,12px) 0 clamp(5px,.8dvh,8px);font-size:12px}
  .oauth-buttons{gap:8px}
  .oauth-buttons button{height:clamp(35px,4.5dvh,44px);font-size:13px}
  .switch{margin:clamp(8px,1.4dvh,14px) 0 2px;font-size:13px}
  .right{height:100%;min-height:0;padding:clamp(30px,10dvh,86px) clamp(10px,2vw,30px) 0 clamp(8px,1vw,14px)}
  .right .info{min-height:0;padding:clamp(10px,1.5dvh,16px) 10px}
  .right .info:nth-child(2){min-height:0}
  .right .info p{margin:clamp(5px,1dvh,10px) 0}
  .right .avatars{height:clamp(45px,7dvh,72px)}
}
@media (min-width:1181px) and (max-height:690px) {
 .panel{padding:7px 16px}
 .panel-heading{margin-bottom:1px}
 .panel form>label{margin-top:4px}
 .checks{margin:6px 0;gap:3px}
 .hint{margin-top:2px}
 .right{padding-top:20px}
}

/* Keep feedback legible if the user zooms or rotates the device. */
.premium-feedback{box-sizing:border-box}
#notice:not(:empty){background:linear-gradient(125deg,#263445,#091b2b);color:#ffdfa6;border:1px solid #e2ab52;border-radius:9px;box-shadow:0 6px 20px #0007}
/* Keep premium validation in the document flow: it must not cover the next field. */
.field .premium-feedback{position:relative;top:auto;left:auto;right:auto;margin-top:9px;z-index:2}
/* Replace Chrome's native validation bubble with an accessible premium popover. */
.field input[aria-invalid="true"]{border-color:#f4bd6b;box-shadow:0 0 0 1px #e2a73d,0 0 14px #e1ab3833;outline:0}
.premium-feedback{
 position:absolute;z-index:10;left:2px;right:0;top:calc(100% + 8px);
 display:flex;align-items:flex-start;gap:11px;
 max-width:100%;padding:12px 15px;border:1px solid #e4ac50;
 border-radius:11px;background:linear-gradient(125deg,#142d3e,#071725);
 color:#ffe5b0;font-size:13px;font-weight:600;line-height:1.4;
 box-shadow:0 12px 30px #000c,0 0 16px #e4ab3455;
}
.premium-feedback[hidden]{display:none!important}
.premium-feedback::before{
 content:"";position:absolute;top:-7px;left:27px;width:12px;height:12px;
 background:#132b3b;border-top:1px solid #e4ac50;border-left:1px solid #e4ac50;transform:rotate(45deg)
}
.premium-feedback-icon{
 display:grid;place-items:center;flex:0 0 24px;width:24px;height:24px;
 border-radius:6px;background:#ffc36c;color:#2a1a05;font-size:16px;font-weight:900
}
@media (max-width:1180px) {
 .scene{min-height:0}
 .panel{min-height:0}
}
@media (max-width:779px){
 .premium-feedback{font-size:12px;padding:10px 12px;right:0;left:0}
}

/* Responsive account screen: the stage fills the window and grows (page scroll) when
   content needs more room. Nothing is clipped, scaled down or hidden by overflow. */
@media (min-width:780px){
 .scene{
  height:auto;
  min-height:calc(100dvh - clamp(57px,8dvh,74px));
  padding-top:clamp(9px,1.3dvh,16px);
  padding-bottom:clamp(9px,1.3dvh,16px);
  align-items:stretch;
 }
 .left{height:auto;min-height:0;align-self:stretch;background:none}
 .panel{align-self:start;height:auto;min-height:0;max-height:none;overflow:visible}
 .right{height:auto;min-height:0;align-self:stretch}
 .right .info{background:#051727da}
}
@media (min-width:780px) and (max-width:1180px){
 .top{height:clamp(60px,8dvh,74px)}
 .scene{
  height:auto;
  min-height:calc(100dvh - clamp(60px,8dvh,74px));
  padding:clamp(8px,1.3dvh,14px) clamp(8px,1.5vw,18px);
  grid-template-columns:minmax(0,1fr) minmax(0,1.8fr);
  gap:clamp(8px,1vw,14px);
 }
 .left{padding:clamp(15px,3dvh,30px) 12px}
 .left-copy em{font-size:clamp(20px,2.6vw,29px)}
 .hero-brand{font-size:clamp(36px,5vw,56px)}
 .eyebrow{font-size:clamp(10px,1.35vw,14px);letter-spacing:1px}
 .benefits{gap:clamp(5px,1dvh,12px)}
 .benefits b{width:38px;height:38px;flex:0 0 38px;font-size:19px}
 .benefits strong{font-size:clamp(11px,1.5vw,14px)}
 .benefits small{font-size:clamp(10px,1.2vw,12px)}
 .panel{padding:clamp(9px,1.8dvh,16px) clamp(10px,1.5vw,20px);border-radius:17px}
 .panel-heading .round{width:clamp(34px,5.5dvh,48px);height:clamp(34px,5.5dvh,48px)}
 .panel h1{font-size:clamp(19px,2.2vw,26px);white-space:normal}
 .panel-heading p{white-space:normal}
 .panel form>label{margin:clamp(5px,1dvh,10px) 0 4px 50px}
 .field{margin-left:50px}
 .field-icon{left:-48px;top:-2px;width:39px;height:39px;font-size:19px}
 .field input{height:clamp(36px,5dvh,43px)}
 .hint{margin:3px 0 3px 50px}
 .checks{margin:clamp(6px,1dvh,12px) 0;gap:4px}
 .checks label{font-size:12px}
 .checks input{width:18px;height:18px}
 .submit{height:clamp(41px,5.8dvh,49px);font-size:16px}
 .oauth-separator{margin:7px 0 5px;font-size:12px}
 .oauth-buttons{gap:6px}
 .oauth-buttons button{height:36px;font-size:11px}
 .switch{margin:7px 0 2px;font-size:12px}
}
@media (max-width:779px){
 .left{background:rgba(2,12,23,.55)}
}


/* Fluid Owner Premium stage: full browser width, no page zoom. */
@media(min-width:1181px){
 body::before{content:none!important}
 body{background:#031321;overflow-x:hidden}
 .scene{
  width:100%;max-width:none;height:auto;
  min-height:calc(100dvh - clamp(57px,8dvh,74px));
  margin:0;padding:clamp(8px,1.2dvh,16px) 0;
  display:grid;grid-template-columns:minmax(0,610fr) minmax(0,605fr) minmax(0,321fr);
  gap:0;align-items:stretch;overflow:visible;
  background:#031523 url('/konto/owner-layout.webp') center/100% 100% no-repeat;
 }
 .left,.right{background:none!important;min-height:0;height:auto;align-self:stretch;padding:0}
 .left-copy,.right .info{opacity:0;pointer-events:none}
 .panel{
  width:100%;min-height:0;max-height:none;height:auto;min-width:0;
  align-self:stretch;overflow:visible;margin:0;
  padding:clamp(10px,1.4dvh,18px) clamp(15px,2.2vw,34px);
  border:2px solid #f8bd6c;border-radius:clamp(15px,1.5vw,23px);
  background:linear-gradient(140deg,rgba(2,21,36,.985),rgba(1,15,27,.99));
  box-shadow:0 0 13px #ffba654b,0 0 2px 1px #ffbb66 inset,0 12px 30px #0008;
 }
 .panel-heading{margin-bottom:clamp(5px,1dvh,10px)}
 .panel-heading .round{width:clamp(42px,5.5dvh,65px);height:clamp(42px,5.5dvh,65px)}
 .panel h1{font-size:clamp(23px,2vw,34px);white-space:normal}
 .panel-heading p{white-space:normal}
 .panel form>label{margin-top:clamp(6px,1.3dvh,12px)}
 .field input{height:clamp(38px,5dvh,46px)}
 .checks{margin:clamp(8px,1.3dvh,17px) 0;gap:clamp(4px,.85dvh,8px)}
 .submit{height:clamp(44px,6dvh,57px)}
 .oauth-separator{margin:clamp(8px,1.3dvh,12px) 0 8px}
 .oauth-buttons button{height:clamp(38px,5dvh,46px)}
 .switch{margin:clamp(8px,1.4dvh,15px) 0 2px}
 body[data-account-view="login"] .panel{
  display:flex;flex-direction:column;justify-content:center;
  gap:0;padding-block:clamp(22px,4dvh,40px);
 }
 body[data-account-view="login"] .panel-heading{
  margin-bottom:clamp(18px,3dvh,30px);gap:clamp(12px,1.8vw,26px);
 }
 body[data-account-view="login"] .panel-heading h1{font-size:clamp(26px,2.25vw,35px)}
 body[data-account-view="login"] .panel-heading p{font-size:clamp(12px,1vw,15px)}
 body[data-account-view="login"] #login-form{display:grid;align-content:start;width:100%}
 body[data-account-view="login"] #login-form>label{
  margin:clamp(10px,1.8dvh,18px) 0 7px 58px;
  font-size:clamp(13px,.97vw,15px);
 }
 body[data-account-view="login"] #login-form .field{margin-left:58px}
 body[data-account-view="login"] #login-form .field input{
  height:clamp(43px,5.5dvh,51px);font-size:15px;
 }
 body[data-account-view="login"] #login-form .submit{
  height:clamp(49px,6.2dvh,58px);margin-top:clamp(20px,3dvh,30px);
  font-size:clamp(17px,1.3vw,20px);
 }
 body[data-account-view="login"] #login-form .switch{
  margin-top:clamp(16px,2.4dvh,24px);font-size:14px;
 }
 body[data-account-view="login"] .oauth-note{
  display:block;margin-top:clamp(15px,2.5dvh,24px);
  padding-top:clamp(12px,1.6dvh,16px);
  color:#aabed0;font-size:11px;line-height:1.5;
  border-top:1px solid #47617a;
 }
}

@media(max-width:1180px){
  .scene{background:none}
}

/* Owner-approved dark teal/gold login. Recovery shares the same secure account origin. */
.login-crown,.login-close{display:none}
body.auth-login-mode{background:#002b2c;overflow-x:hidden}
body.auth-login-mode::before{content:none!important}
body.auth-login-mode .top{z-index:3;position:relative;background:#031a25!important}
body.auth-login-mode .scene{
 display:flex!important;align-items:center!important;justify-content:center!important;
 position:relative;isolation:isolate;width:100%!important;max-width:none!important;
 min-height:calc(100dvh - 68px)!important;height:auto!important;padding:22px!important;
 /* Show the COMPLETE approved 3:1 HERO art: never crop its left copy or console.
    The dark teal base fills the spare height on taller displays. */
 background:linear-gradient(90deg,rgba(0,21,26,.34),rgba(0,15,30,.30)),
 url('https://gracz.pl/assets/gracz-hero-gomoku-approved-r1.webp') center center/contain no-repeat,
 linear-gradient(115deg,#003c3b,#00232b 58%,#031b28)!important
}
body.auth-login-mode .left,body.auth-login-mode .right{display:none!important}
body.auth-login-mode .panel{
 position:relative;z-index:2;align-self:center!important;flex:none!important;
 width:min(610px,100%)!important;max-width:610px!important;min-width:0!important;
 height:auto!important;min-height:0!important;max-height:none!important;
 margin:auto!important;padding:32px clamp(20px,3vw,43px)!important;overflow:visible!important;
 border:2px solid #ffc56e!important;border-radius:24px!important;
 background:radial-gradient(circle at 50% 0%,#04413a,#001827 70%)!important;
 box-shadow:inset 0 0 0 1px #ffe49e45,0 0 27px #efb65c80,0 25px 70px #000a!important
}
body.auth-login-mode .login-close{
 display:grid;place-items:center;position:absolute;right:17px;top:12px;
 width:38px;height:38px;text-decoration:none;color:#f9c56e;
 font:36px/1 Arial,sans-serif;border-radius:50%
}
body.auth-login-mode .login-close:focus-visible,body.auth-login-mode .login-close:hover{
 outline:2px solid #ffd579;background:#163832
}
/* The original vector crown (60:49), centred on the whole panel, never stretched. */
body.auth-login-mode .login-crown{
 display:block;flex:none;width:clamp(56px,4.6vw,68px);height:auto;aspect-ratio:60/49;
 margin:0 auto 12px;filter:drop-shadow(0 0 7px rgba(233,172,81,.5))
}
body.auth-login-mode .panel-heading{display:block!important;text-align:center!important;margin:0 0 20px!important}
body.auth-login-mode .panel-heading .round{display:none!important}
body.auth-login-mode .panel h1{
 color:#fff3d2!important;font:700 clamp(25px,3vw,41px)/1.13 Georgia,serif!important;
 white-space:normal!important;margin:0 0 10px!important
}
body.auth-login-mode .panel h1 .form-logo{color:#fff!important}
body.auth-login-mode .panel h1 .form-logo span{color:#e72f4d!important}
body.auth-login-mode .panel-heading p{font-size:clamp(13px,1vw,16px)!important;color:#eef5ef!important;white-space:normal!important}
body.auth-login-mode :is(#login-form,#forgot-form,#reset-form){display:grid!important;width:100%!important}
body.auth-login-mode :is(#login-form,#forgot-form,#reset-form)[hidden]{display:none!important}
body.auth-login-mode :is(#login-form,#forgot-form,#reset-form)>label{
 margin:13px 0 6px 54px!important;font-size:14px!important;font-weight:750!important
}
body.auth-login-mode :is(#login-form,#forgot-form,#reset-form) .field{margin-left:54px!important}
body.auth-login-mode :is(#login-form,#forgot-form,#reset-form) .field input{
 height:49px!important;border-radius:9px!important;border:1px solid #688a96!important;
 background:#0b2c38!important;color:#fff!important;padding:10px 48px 10px 15px!important
}
body.auth-login-mode .field-icon{
 top:5px!important;left:-52px!important;width:39px!important;height:39px!important;
 display:grid!important;place-items:center!important;background:#082d32!important;
 color:#ffdc98!important;border:1px solid #f5c170!important;border-radius:50%!important
}
body.auth-login-mode .eye{top:6px!important}
body.auth-login-mode .login-forgot{
 justify-self:end;margin:11px 0 0;padding:4px 0;color:#ffd26e;
 border:0;background:none;font-weight:750;text-decoration:underline;font-size:14px
}
body.auth-login-mode :is(#login-form,#forgot-form,#reset-form) .submit{
 margin-top:20px!important;min-height:58px!important;height:auto!important;
 border:1px solid #ffedb5!important;border-radius:14px!important;
 background:linear-gradient(#ffe89a,#ffc347 64%,#dfa120)!important;
 color:#002320!important;font-weight:900!important;font-size:clamp(18px,1.6vw,23px)!important;
 box-shadow:0 0 18px #e6ad4f88!important
}
body.auth-login-mode :is(#login-form,#forgot-form,#reset-form) .switch{
 margin:18px 0 0!important;font-size:14px!important;color:#f8f3e9!important
}
body.auth-login-mode .switch button{color:#ffd473!important}
body.auth-login-mode .recovery-intro{text-align:center;margin:6px 0 20px;line-height:1.55;color:#e7eeef}
body.auth-login-mode .oauth-note,body.auth-login-mode footer{display:none!important}
@media(max-width:780px){
 body.auth-login-mode .scene{min-height:calc(100dvh - 66px)!important;padding:15px!important}
 body.auth-login-mode .panel{padding:30px 18px 22px!important;max-width:520px!important}
 body.auth-login-mode .panel h1{font-size:clamp(24px,6vw,32px)!important}
 body.auth-login-mode :is(#login-form,#forgot-form,#reset-form)>label{margin-left:45px!important}
 body.auth-login-mode :is(#login-form,#forgot-form,#reset-form) .field{margin-left:45px!important}
 body.auth-login-mode .field-icon{left:-43px!important;width:35px!important;height:35px!important}
}

/* R4 top bar: the approved gracz.pl homepage header (logo, Gry, Gry karciane, Poradniki, Blog,
   Społeczność, Newsletter, search, Zaloguj się, Załóż konto), measured 1:1 in Chromium. */
@font-face{font-family:"Montserrat";font-style:normal;font-weight:500 800;font-display:swap;src:url("/konto/fonts/montserrat-latin-ext.woff2") format("woff2");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:"Montserrat";font-style:normal;font-weight:500 800;font-display:swap;src:url("/konto/fonts/montserrat-latin.woff2") format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
body{--account-header-height:68px}
.site-bar{
 position:sticky;top:0;z-index:20;height:68px;
 background:linear-gradient(110deg,#002c30 0%,#003c3d 49%,#002b31 100%);
 border-bottom:1px solid rgba(244,198,95,.65);
 color:#f5f5f2;font:16px/1.5 Montserrat,Arial,sans-serif
}
.site-bar *,.site-bar *::before,.site-bar *::after{box-sizing:border-box}
.site-bar ul{list-style:none;margin:0;padding:0}
.site-bar-inner{width:calc(100% - 56px);max-width:1444px;height:100%;margin:0 auto;display:flex;align-items:center;gap:14px}
.site-bar-logo{
 flex:none;margin-right:38px;color:#fff;text-decoration:none;white-space:nowrap;
 font:800 36px/1 Montserrat,"Open Sans",Arial,sans-serif;letter-spacing:-.055em
}
.site-bar-logo span{color:#f21a34}
.site-bar-burger{display:none}
.site-bar-menu{display:flex;flex:1 1 auto;align-items:center;min-width:0;height:100%}
.site-bar-nav{margin-left:8px;height:100%}
.site-bar-list{display:flex;align-items:center;gap:clamp(10px,1vw,19px);height:100%}
.site-bar-list>li{position:relative;display:flex;align-items:center;height:100%}
.bar-link{
 display:inline-flex;align-items:center;height:100%;color:#fff5e5;text-decoration:none;white-space:nowrap;
 font:500 14px/1 Montserrat,Arial,sans-serif;letter-spacing:-.01em
}
.bar-link:hover,.bar-link:focus-visible,.has-menu.is-open>.bar-link{color:#ffe18a}
.bar-newsletter{padding:0 17px;border-radius:999px;font-weight:700;color:#ffe18a}
.bar-newsletter:hover{color:#f7ce84;background:rgba(239,189,96,.07)}
.menu-toggle{
 display:grid;place-items:center;width:22px;height:40px;padding:0;border:0;
 background:transparent;color:#fff5e5;cursor:pointer
}
.menu-toggle svg{width:14px;height:14px;transition:transform .18s ease}
.has-menu.is-open .menu-toggle svg{transform:rotate(180deg)}
.dropdown{
 display:none;position:absolute;top:100%;left:-14px;z-index:30;min-width:220px;padding:8px;
 border-radius:14px;background:rgba(5,8,6,.99);box-shadow:0 20px 50px rgba(0,0,0,.62)
}
.has-menu.is-open>.dropdown{display:block}
.dropdown a{
 display:block;padding:10px 12px;border-radius:9px;color:#eee;text-decoration:none;white-space:nowrap;
 font:500 14px/1.25 Montserrat,Arial,sans-serif
}
.dropdown a:hover,.dropdown a:focus-visible{background:rgba(244,198,95,.1);color:#ffe18a}
.site-bar-actions{display:flex;align-items:center;gap:10px;margin-left:auto}
.bar-search{display:grid;place-items:center;flex:none;width:40px;height:40px;border-radius:8px;color:#fff}
.bar-search svg{width:22px;height:22px}
.bar-search:hover{color:#ffe18a}
.bar-btn{
 display:inline-flex;align-items:center;justify-content:center;flex:none;height:41px;padding:0 14px;
 font:700 13px/1 Montserrat,Arial,sans-serif;text-decoration:none;white-space:nowrap
}
.bar-btn--outline{
 width:clamp(126px,9.09vw,153px);border:1.5px solid #e6b650;border-radius:12px;
 background:rgba(1,28,32,.82);color:#fff8e8;box-shadow:0 0 14px rgba(223,174,72,.12)
}
.bar-btn--gold{
 width:clamp(135px,9.447vw,159px);border:1px solid #ffe19b;border-radius:9px;color:#171b17;
 background:linear-gradient(180deg,#ffe9a0 0%,#ffd766 33%,#eba72c 100%);
 box-shadow:inset 0 1px 0 rgba(255,255,255,.62),0 7px 22px rgba(215,143,23,.2)
}
.bar-btn--gold:hover{filter:brightness(1.07)}
.bar-btn--outline:hover{border-color:#ffd579;color:#fff}
.site-bar a:focus-visible,.site-bar button:focus-visible{outline:2px solid #ffd579;outline-offset:2px}
@media(min-width:1181px){
 .has-menu:hover>.dropdown,.has-menu:focus-within>.dropdown{display:block}
 .has-menu:hover .menu-toggle svg,.has-menu:focus-within .menu-toggle svg{transform:rotate(180deg)}
 .has-menu:hover>.bar-link,.has-menu:focus-within>.bar-link{color:#ffe18a}
 .scene{min-height:calc(100dvh - 68px)}
}
@media(min-width:1181px) and (max-width:1400px){.site-bar-logo{margin-right:24px}}
@media(max-width:1180px){
 body{--account-header-height:66px}
 .site-bar{height:66px}
 .site-bar-inner{width:calc(100% - 32px);gap:0}
 .site-bar-logo{margin-right:auto;font-size:34px}
 .site-bar-burger{
  display:grid;place-items:center;flex:none;width:42px;height:42px;padding:0;border:0;border-radius:50%;
  background:#070907;color:#fff;cursor:pointer
 }
 .site-bar-burger svg{width:21px;height:21px}
 .site-bar-burger .burger-close,.site-bar.menu-open .site-bar-burger .burger-open{display:none}
 .site-bar.menu-open .site-bar-burger .burger-close{display:block}
 .site-bar-menu{
  display:none;position:absolute;top:100%;left:0;right:0;height:auto;max-height:calc(100dvh - 66px);overflow-y:auto;
  padding:12px 18px 20px;background:#050706;box-shadow:0 18px 40px rgba(0,0,0,.45)
 }
 .site-bar.menu-open .site-bar-menu{display:block}
 .site-bar-nav{margin:0;height:auto}
 .site-bar-list{display:block;height:auto}
 .site-bar-list>li{display:flex;flex-wrap:wrap;height:auto;border-bottom:1px solid rgba(255,255,255,.08)}
 .bar-link{flex:1 1 auto;height:48px;font-size:15px}
 .bar-newsletter{flex:0 0 auto;height:42px;margin:3px 0;padding:0 18px}
 .menu-toggle{width:28px;height:40px}
 .dropdown{position:static;flex:0 0 100%;min-width:0;margin:0 0 10px;padding:4px;box-shadow:none;background:rgba(255,255,255,.03)}
 .site-bar-actions{display:grid;gap:10px;width:100%;margin:14px 0 0}
 .bar-search{justify-self:start;width:48px;height:48px;border-radius:50%;background:#070907}
 .bar-btn{width:100%;height:48px;padding:0 26px;font-size:15px}
 .bar-btn--gold{border-radius:999px}
}
@media(min-width:780px) and (max-width:1180px){.scene{min-height:calc(100dvh - 66px)}}
@media(max-width:420px){.site-bar-inner{width:calc(100% - 20px)}}

/* Full Max Premium registration — Owner reference R2 (register view only).
   The Owner image (1672×941) is a 1493×840 window shown at 1.12×. On desktop every size
   below is a reference CSS pixel × --u, so 1366…2560 px windows keep its proportions.
   Live HTML form; the approved chip + deck are a cut-out of the Owner reference.
   Nothing is clipped: short windows scroll vertically. */
.benefits b svg{width:54%;height:54%;display:block}
body[data-account-view="register"]{
 --u:1.12px;
 --reg-indent:calc(46.4*var(--u));--reg-input-h:calc(32*var(--u));--reg-icon:calc(34*var(--u));
 --reg-label-fs:max(12px,calc(13.4*var(--u)));--reg-input-fs:max(13px,calc(14.3*var(--u)));
 --reg-hint-fs:max(10.5px,calc(10.7*var(--u)));--reg-check-fs:max(12px,calc(13.4*var(--u)));
 --reg-check:calc(16*var(--u));--reg-submit-h:calc(49*var(--u));--reg-submit-fs:calc(25*var(--u));
 --reg-oauth-h:calc(35*var(--u));--reg-oauth-fs:max(12px,calc(15.2*var(--u)));
 --reg-q-fs:calc(17*var(--u));--reg-link-fs:calc(19.5*var(--u));--reg-orn:calc(58*var(--u));
 background:#003a3c;overflow-x:hidden
}
@media(min-width:1181px){
 body[data-account-view="register"]{--u:min(calc(100vw / 1493),calc((100dvh - 68px) / 772))}
}
body[data-account-view="register"]::before{content:none!important}
body[data-account-view="register"] .scene{
 display:grid!important;
 grid-template-columns:minmax(0,1fr) calc(595*var(--u)) calc(638*var(--u)) calc(260*var(--u)) minmax(0,1fr)!important;
 grid-template-rows:auto!important;gap:0!important;align-items:start!important;
 width:100%!important;max-width:none!important;margin:0!important;padding:0 0 calc(24*var(--u))!important;
 min-height:calc(100dvh - 68px)!important;height:auto!important;overflow:visible!important;
 background:
  linear-gradient(180deg,rgba(0,16,15,.62),rgba(0,16,15,0) calc(22*var(--u))),
  radial-gradient(ellipse 30% 44% at 93% 24%,rgba(1,84,85,.95),rgba(1,84,85,0)),
  radial-gradient(ellipse 40% 44% at 4% 30%,rgba(1,70,71,.8),rgba(1,70,71,0)),
  linear-gradient(180deg,#003d3e 0%,#003a3c 58%,#002f31 100%)!important
}
/* Left: community copy, four oval benefit badges, approved chip + deck on the teal stage. */
body[data-account-view="register"] .left{
 grid-column:2!important;grid-row:1!important;position:relative!important;display:block!important;
 align-self:stretch!important;height:auto!important;min-height:calc(706*var(--u))!important;
 padding:calc(25*var(--u)) 0 0 calc(107*var(--u))!important;background:none!important
}
body[data-account-view="register"] .left::before{content:none!important}
body[data-account-view="register"] .left-copy{
 position:relative;z-index:1;opacity:1!important;pointer-events:auto!important;
 filter:none!important;text-shadow:0 2px 8px rgba(0,16,16,.55)
}
body[data-account-view="register"] .left-copy em{
 display:inline-block;font:italic 700 calc(36*var(--u))/1.15 Georgia,"Times New Roman",serif!important;
 color:#f3deaa!important;background:linear-gradient(180deg,#fff4d6 20%,#e6c27c 92%);
 -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
 text-shadow:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))
}
body[data-account-view="register"] .hero-brand{
 display:block;margin:calc(23*var(--u)) 0 0!important;color:#fff!important;
 font:800 calc(63*var(--u))/1.04 Montserrat,Arial,sans-serif!important;letter-spacing:-.04em!important;white-space:nowrap
}
body[data-account-view="register"] .hero-brand span{color:#f80a33!important}
body[data-account-view="register"] .eyebrow{
 margin:calc(3*var(--u)) 0 0!important;color:#f5d66c!important;white-space:nowrap!important;
 font:700 calc(18.5*var(--u))/1.2 Montserrat,Arial,sans-serif!important;letter-spacing:.07em!important
}
body[data-account-view="register"] .benefits{display:grid!important;gap:calc(13.5*var(--u))!important;margin:calc(15*var(--u)) 0 0!important;padding:0!important}
body[data-account-view="register"] .benefits li{display:flex!important;align-items:center!important;gap:calc(15*var(--u))!important}
body[data-account-view="register"] .benefits b{
 display:grid!important;place-items:center;flex:0 0 auto!important;min-width:0!important;
 width:calc(52*var(--u))!important;height:calc(39*var(--u))!important;font-size:0!important;
 border:calc(2*var(--u)) solid #ebc25a!important;border-radius:50%!important;
 color:#efc95c!important;background:rgba(0,34,34,.55)!important;box-shadow:none!important
}
body[data-account-view="register"] .benefits b svg{width:calc(22*var(--u));height:calc(22*var(--u))}
body[data-account-view="register"] .benefits strong{display:block;font-size:calc(19.5*var(--u))!important;font-weight:700;line-height:1.12;color:#fff}
body[data-account-view="register"] .benefits small{
 display:block;max-width:calc(222*var(--u))!important;margin-top:calc(3*var(--u))!important;
 font-size:calc(15*var(--u))!important;line-height:1.1!important;color:#eef3ef!important
}
body[data-account-view="register"] .cards{
 display:block!important;position:absolute!important;left:calc(52*var(--u));top:calc(448*var(--u));
 width:calc(529.5*var(--u));height:auto!important;min-height:0!important;margin:0!important;pointer-events:none
}
body[data-account-view="register"] .cards-art{display:block;width:100%;height:auto}
/* Centre: glowing gold Premium frame sized to the form; crown clear of the border. */
body[data-account-view="register"] .panel{
 grid-column:3!important;grid-row:1!important;position:relative!important;z-index:2;align-self:start!important;
 display:flex!important;flex-direction:column!important;justify-content:flex-start!important;
 width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;
 margin:calc(16*var(--u)) 0 0!important;
 padding:calc(10*var(--u)) calc(31*var(--u)) calc(23.5*var(--u)) calc(34*var(--u))!important;overflow:visible!important;
 border:max(2px,calc(3*var(--u))) solid #ffd36b!important;border-radius:calc(27*var(--u))!important;
 background:radial-gradient(ellipse 80% 60% at 50% 32%,#002d2c 0%,#002626 55%,#011b1b 100%)!important;
 box-shadow:inset 0 0 0 1px rgba(255,232,160,.5),0 0 calc(12*var(--u)) rgba(255,196,80,.85),0 0 calc(30*var(--u)) rgba(255,176,56,.35),0 calc(14*var(--u)) calc(40*var(--u)) rgba(0,0,0,.4)!important
}
body[data-account-view="register"] .panel::before{
 content:"";height:2px;position:absolute;top:-1px;left:22%;right:22%;pointer-events:none;
 border-radius:60%;background:#fff3c4;box-shadow:0 0 calc(10*var(--u)) 2px #ffcf6a
}
body[data-account-view="register"] .login-close{display:none!important}
body[data-account-view="register"] .login-crown{
 display:block!important;position:relative!important;align-self:center!important;flex:none!important;
 width:auto!important;height:calc(31*var(--u))!important;aspect-ratio:60/49;margin:0!important;object-fit:contain!important;
 filter:drop-shadow(0 0 calc(6*var(--u)) rgba(240,180,70,.75))!important
}
body[data-account-view="register"] .panel-heading{
 position:relative;z-index:1;display:block!important;align-self:stretch!important;text-align:center!important;
 margin:calc(5.5*var(--u)) 0 0!important;padding:0!important
}
body[data-account-view="register"] .panel-heading .round{display:none!important}
body[data-account-view="register"] .panel-heading h1{
 margin:0!important;color:#fff5e2!important;font:700 calc(31*var(--u))/1.1 Georgia,"Times New Roman",serif!important;
 letter-spacing:0!important;white-space:nowrap!important;text-shadow:0 2px 6px rgba(0,0,0,.5)
}
body[data-account-view="register"] .panel-heading h1 .form-logo{color:inherit!important}
body[data-account-view="register"] .panel-heading h1 .form-logo span{color:#e3142c!important}
body[data-account-view="register"] .panel-heading p{
 margin:calc(3*var(--u)) 0 0!important;font-size:calc(15*var(--u))!important;font-weight:400!important;
 color:#f3f6f2!important;white-space:nowrap!important
}
body[data-account-view="register"] #register-form{display:grid!important;grid-template-columns:minmax(0,1fr);width:100%;min-width:0;gap:0}
body[data-account-view="register"] #register-form>label{
 margin:calc(10*var(--u)) 0 calc(3*var(--u)) var(--reg-indent)!important;color:#fff!important;
 font-size:var(--reg-label-fs)!important;font-weight:700!important;line-height:1
}
body[data-account-view="register"] #register-form>label:first-child{margin-top:calc(12*var(--u))!important}
body[data-account-view="register"] #register-form>.hint+label{margin-top:calc(3*var(--u))!important}
body[data-account-view="register"] #register-form .field{margin-left:var(--reg-indent)!important}
body[data-account-view="register"] #register-form .field input{
 height:var(--reg-input-h)!important;min-height:0!important;
 border:max(1px,calc(1.2*var(--u))) solid #6b9594!important;background:#003d3a!important;color:#fff!important;
 border-radius:calc(8*var(--u))!important;padding:0 calc(42*var(--u)) 0 calc(11*var(--u))!important;font-size:var(--reg-input-fs)!important
}
body[data-account-view="register"] #register-form .field input::placeholder{color:#aebfbc}
body[data-account-view="register"] #register-form .nickname-field input{padding-right:150px!important}
/* Reserve room for the nick status only while it is shown (older browsers keep the reserve). */
body[data-account-view="register"] #register-form .nickname-field:has(#nick-status:not([data-state])) input,
body[data-account-view="register"] #register-form #email{padding-right:calc(11*var(--u))!important}
body[data-account-view="register"] #register-form #nick-status{height:var(--reg-input-h);border-radius:calc(8*var(--u))}
body[data-account-view="register"] #register-form .field input:focus{outline:2px solid #ffda89!important;outline-offset:2px}
body[data-account-view="register"] #register-form .field-icon{
 position:absolute!important;left:calc(-1 * var(--reg-indent) + 1*var(--u))!important;
 top:calc((var(--reg-input-h) - var(--reg-icon)) / 2)!important;
 display:grid!important;place-items:center!important;width:var(--reg-icon)!important;height:var(--reg-icon)!important;
 border:max(1.5px,calc(2*var(--u))) solid #e9bd50!important;border-radius:50%!important;
 color:#f0c655!important;background:#002424!important;font-size:0!important
}
body[data-account-view="register"] #register-form .field-icon svg{width:58%;height:58%}
body[data-account-view="register"] #register-form .eye{
 top:0!important;right:calc(4*var(--u))!important;height:var(--reg-input-h);display:grid;place-items:center;padding:0 calc(8*var(--u))!important;color:#fff
}
body[data-account-view="register"] #register-form .eye svg{width:calc(22*var(--u));height:calc(22*var(--u))}
body[data-account-view="register"] #register-form .hint{
 margin:calc(3*var(--u)) 0 0 var(--reg-indent)!important;font-size:var(--reg-hint-fs)!important;line-height:1.25!important;color:#eef4f3!important
}
/* Consents; „Zapomniałem hasła?” shares the newsletter row on desktop, as in the reference. */
body[data-account-view="register"] #register-form .checks{
 position:relative;display:grid!important;grid-template-columns:minmax(0,1fr) auto;column-gap:calc(12*var(--u));
 row-gap:calc(7*var(--u))!important;gap:calc(7*var(--u)) calc(12*var(--u))!important;align-items:center;
 margin:calc(14*var(--u)) 0 0!important;padding:0 0 0 calc(3*var(--u))!important
}
body[data-account-view="register"] #register-form .checks label{
 grid-column:1;display:flex!important;align-items:center!important;gap:calc(14*var(--u))!important;margin:0!important;
 font-size:var(--reg-check-fs)!important;font-weight:400;line-height:1.3!important;color:#f6f8f7!important
}
body[data-account-view="register"] #register-form .checks label>span>a,
body[data-account-view="register"] #register-form .checks small{margin-left:calc(8*var(--u))}
body[data-account-view="register"] #register-form .checks a{color:#3fd8e6;text-underline-offset:2px}
body[data-account-view="register"] #register-form .checks small{font-size:1em;color:inherit}
body[data-account-view="register"] #register-form .checks input{
 width:var(--reg-check)!important;height:var(--reg-check)!important;flex:0 0 auto!important;margin:0!important;accent-color:#f8c552
}
body[data-account-view="register"] #register-form .checks input:disabled{
 -webkit-appearance:none;appearance:none;background:#fff;border:1px solid #c8d3d1;border-radius:calc(3*var(--u));cursor:not-allowed
}
/* B. „Zapomniałem hasła?” — small glowing Premium button: gold border, dark-teal interior,
   gold key, gold glint and reflection sweep; opens the existing recovery form. */
body[data-account-view="register"] .register-forgot{
 grid-column:2;grid-row:3;justify-self:end!important;align-self:center!important;
 position:relative;isolation:isolate;overflow:visible;
 display:inline-flex!important;align-items:center!important;justify-content:center;gap:calc(7*var(--u));
 width:auto;min-width:calc(183*var(--u));height:calc(30.5*var(--u));min-height:0;
 margin:calc(-7*var(--u)) calc(-4*var(--u)) calc(-7*var(--u)) 0!important;padding:0 calc(10*var(--u))!important;
 border:max(1.5px,calc(2*var(--u))) solid #f6c445!important;border-radius:999px!important;
 background:radial-gradient(ellipse 34% 30% at 50% 100%,rgba(255,214,110,.35),rgba(255,214,110,0)),linear-gradient(180deg,#0e2421 0%,#06110f 100%)!important;
 color:#f8d060!important;font-size:max(12px,calc(15*var(--u)))!important;font-weight:700!important;line-height:1!important;
 letter-spacing:0;text-decoration:none!important;white-space:nowrap;cursor:pointer;
 box-shadow:0 0 calc(8*var(--u)) rgba(255,196,64,.75),0 0 calc(18*var(--u)) rgba(255,180,50,.32),inset 0 0 calc(6*var(--u)) rgba(255,200,90,.22)!important;
 transition:border-color .2s ease,box-shadow .25s ease,color .2s ease,transform .2s ease
}
body[data-account-view="register"] .register-forgot::before{
 content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;pointer-events:none;overflow:hidden;
 background:linear-gradient(110deg,transparent 30%,rgba(255,226,150,.14) 43%,rgba(255,246,214,.34) 50%,rgba(255,226,150,.14) 57%,transparent 70%) -140% 0/220% 100% no-repeat;
 transition:background-position .7s ease
}
body[data-account-view="register"] .register-forgot::after{
 content:"";position:absolute;right:16%;top:calc(-9*var(--u));width:calc(18*var(--u));height:calc(18*var(--u));pointer-events:none;
 background:
  radial-gradient(circle,#fff 0 9%,rgba(255,240,190,.9) 16%,rgba(255,210,110,0) 52%),
  linear-gradient(90deg,rgba(255,240,200,0),rgba(255,244,214,.95) 50%,rgba(255,240,200,0)) center/100% 1.5px no-repeat,
  linear-gradient(180deg,rgba(255,240,200,0),rgba(255,244,214,.95) 50%,rgba(255,240,200,0)) center/1.5px 70% no-repeat
}
body[data-account-view="register"] .register-forgot .forgot-key{
 width:calc(19*var(--u));height:calc(19*var(--u));flex:none;color:#f4c246;filter:drop-shadow(0 0 2px rgba(255,196,80,.6))
}
body[data-account-view="register"] .register-forgot:hover,
body[data-account-view="register"] .register-forgot:focus-visible{
 color:#ffe7a0!important;border-color:#ffe39a!important;transform:translateY(-1px);
 box-shadow:0 0 calc(12*var(--u)) rgba(255,204,80,.95),0 0 calc(26*var(--u)) rgba(255,186,60,.45),inset 0 0 calc(8*var(--u)) rgba(255,210,110,.32)!important
}
body[data-account-view="register"] .register-forgot:hover::before,
body[data-account-view="register"] .register-forgot:focus-visible::before{background-position:240% 0}
body[data-account-view="register"] .register-forgot:focus-visible{outline:2px solid #ffe39c;outline-offset:3px}
body[data-account-view="register"] .register-forgot:active{transform:translateY(0)}
/* A. „Zarejestruj się” — gold gradient, user icon, centred label, no arrow.
   The invisible ::after balances the icon so the label stays optically centred. */
body[data-account-view="register"] #register-form>.submit{
 display:flex!important;align-items:center!important;justify-content:center!important;gap:calc(12*var(--u));
 width:100%;height:var(--reg-submit-h)!important;min-height:0!important;margin:calc(27.5*var(--u)) 0 0!important;
 padding:0 calc(14*var(--u))!important;color:#2a1b00!important;border-radius:calc(10*var(--u))!important;
 font-size:var(--reg-submit-fs)!important;font-weight:800!important;font-family:Montserrat,"Segoe UI",Arial,sans-serif!important;line-height:1;letter-spacing:0;
 border:1px solid #ffe7a0!important;background:linear-gradient(180deg,#ffe57f 0%,#ffcf5e 46%,#fbb02c 100%)!important;
 box-shadow:0 0 calc(14*var(--u)) rgba(255,190,60,.45),inset 0 1px 0 rgba(255,250,220,.8)!important;
 transition:filter .2s ease,box-shadow .2s ease,transform .2s ease
}
body[data-account-view="register"] #register-form>.submit::after{content:"";flex:0 0 calc(22*var(--u))}
body[data-account-view="register"] #register-form>.submit .submit-user{width:calc(22*var(--u));height:calc(22*var(--u));flex:0 0 calc(22*var(--u))}
body[data-account-view="register"] #register-form>.submit:hover:not(:disabled){
 filter:brightness(1.05);transform:translateY(-1px);box-shadow:0 0 calc(22*var(--u)) rgba(255,190,60,.7),inset 0 1px 0 rgba(255,250,220,.8)!important
}
body[data-account-view="register"] #register-form>.submit:focus-visible{outline:3px solid #fff0c2;outline-offset:3px}
body[data-account-view="register"] .oauth-separator{
 display:flex!important;align-items:center;gap:0!important;margin:calc(4*var(--u)) 0 calc(3*var(--u))!important;
 color:#f1f3ea!important;font-size:max(11px,calc(12.5*var(--u)))!important;line-height:1.2
}
body[data-account-view="register"] .oauth-separator::before,
body[data-account-view="register"] .oauth-separator::after{content:"";flex:1;height:1px;background:#4f5f4a!important}
body[data-account-view="register"] .oauth-separator span{padding:calc(2*var(--u)) calc(9*var(--u));border-radius:calc(5*var(--u));background:#012321}
body[data-account-view="register"] .oauth-buttons{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:calc(10.7*var(--u))!important}
body[data-account-view="register"] .oauth-buttons a{
 display:flex;align-items:center;justify-content:center;gap:calc(7*var(--u));min-width:0;
 height:var(--reg-oauth-h);border:max(1px,calc(1.5*var(--u))) solid #bb933f;border-radius:calc(10*var(--u));white-space:nowrap;
 color:#fff;text-decoration:none;background:rgba(0,22,22,.55);font-size:var(--reg-oauth-fs);font-weight:600
}
body[data-account-view="register"] .oauth-buttons a[aria-disabled="true"]{cursor:not-allowed}
body[data-account-view="register"] .oauth-buttons a:not([aria-disabled="true"]):hover,
body[data-account-view="register"] .oauth-buttons a:not([aria-disabled="true"]):focus-visible{
 border-color:#ffe6a0;box-shadow:0 0 12px #ffc96577
}
body[data-account-view="register"] .oauth-logo{width:calc(19*var(--u));height:calc(19*var(--u));flex:none;margin:0!important;vertical-align:middle}
/* C. „Masz już konto? Zaloguj się” — centred, italic gold question, bright turquoise
   link, symmetric gold spear ornaments. */
body[data-account-view="register"] .register-switch{
 display:flex!important;align-items:center;justify-content:center;gap:0!important;
 margin:calc(21.5*var(--u)) 0 0!important;padding:0!important;min-width:0;text-align:center;line-height:1.2;white-space:nowrap;color:inherit!important
}
body[data-account-view="register"] .switch-ornament{
 flex:0 1 var(--reg-orn);min-width:0;height:calc(18*var(--u));margin-right:calc(26*var(--u));color:#f0c052;overflow:visible;
 filter:drop-shadow(0 0 2px rgba(255,200,80,.8)) drop-shadow(0 0 6px rgba(255,180,60,.4))
}
body[data-account-view="register"] .switch-ornament--end{transform:scaleX(-1);margin:0 0 0 calc(26*var(--u))}
body[data-account-view="register"] .switch-question{
 font:italic 700 var(--reg-q-fs)/1.2 Georgia,"Times New Roman",serif;color:#f6dca4;
 text-shadow:0 1px 2px rgba(0,0,0,.6),0 0 calc(8*var(--u)) rgba(255,200,100,.22)
}
body[data-account-view="register"] .switch-login{
 margin-left:calc(12*var(--u));padding:0 1px;border:0;
 font:italic 700 var(--reg-link-fs)/1.2 Georgia,"Times New Roman",serif;color:#25e8e8;
 text-decoration:underline;text-decoration-thickness:max(1px,calc(1.5*var(--u)));text-underline-offset:calc(3*var(--u));
 text-shadow:0 0 calc(8*var(--u)) rgba(37,232,232,.55);transition:color .2s ease,text-shadow .2s ease
}
body[data-account-view="register"] .switch-login:hover,
body[data-account-view="register"] .switch-login:focus-visible{color:#a8fff6;text-decoration-color:#ffd77e;text-shadow:0 0 calc(14*var(--u)) rgba(37,232,232,.85)}
body[data-account-view="register"] .switch-login:focus-visible{outline:2px solid #ffd77e;outline-offset:3px;border-radius:4px}
body[data-account-view="register"] .oauth-note{display:none!important}
/* Right: the same teal stage, no scenery. */
body[data-account-view="register"] .right{
 grid-column:4!important;grid-row:1!important;display:block!important;position:relative!important;
 height:auto!important;min-height:0!important;padding:0!important;background:none!important
}
body[data-account-view="register"] .right .info{display:none!important}
/* Owner screenshot R5: the right column never shows decorative glyphs. */
body[data-account-view="register"] .right::after{content:none!important}
@media (prefers-reduced-motion:reduce){
 body[data-account-view="register"] .register-forgot,
 body[data-account-view="register"] .register-forgot::before,
 body[data-account-view="register"] #register-form>.submit,
 body[data-account-view="register"] .switch-login{transition:none!important}
}
/* Tablet: form beside the community copy; right column folds away. */
@media(max-width:1180px){
 body[data-account-view="register"]{--reg-submit-fs:21px;--reg-q-fs:16px;--reg-link-fs:18px;--reg-orn:48px}
 body[data-account-view="register"] .switch-ornament{margin-right:12px}
 body[data-account-view="register"] .switch-ornament--end{margin:0 0 0 12px}
 body[data-account-view="register"] .scene{
  grid-template-columns:minmax(0,1fr) minmax(0,1.25fr)!important;
  gap:clamp(12px,2vw,22px)!important;padding:clamp(12px,2vw,20px)!important;min-height:calc(100dvh - 66px)!important
 }
 body[data-account-view="register"] .left{grid-column:1!important;min-height:0!important;padding:clamp(16px,3dvh,34px) 4px 4px clamp(4px,1.5vw,16px)!important}
 body[data-account-view="register"] .left-copy em{font-size:clamp(21px,2.9vw,30px)!important}
 body[data-account-view="register"] .hero-brand{font-size:clamp(40px,5.6vw,60px)!important}
 body[data-account-view="register"] .eyebrow{font-size:clamp(11px,1.45vw,15px)!important;white-space:normal!important}
 body[data-account-view="register"] .benefits strong{font-size:clamp(13px,1.7vw,16px)!important}
 body[data-account-view="register"] .benefits small{font-size:clamp(11.5px,1.45vw,14px)!important}
 body[data-account-view="register"] .cards{position:relative!important;left:auto;top:auto;width:min(100%,430px);margin:clamp(20px,4dvh,48px) 0 0 -10px!important}
 body[data-account-view="register"] .panel{grid-column:2!important;margin:0!important;padding:16px clamp(16px,2.4vw,26px) 20px!important}
 body[data-account-view="register"] .panel-heading h1{font-size:clamp(24px,3.3vw,34px)!important;white-space:normal!important}
 body[data-account-view="register"] .panel-heading p{white-space:normal!important}
 body[data-account-view="register"] .right{display:none!important}
 body[data-account-view="register"] #register-form .checks{grid-template-columns:minmax(0,1fr)}
 body[data-account-view="register"] .register-forgot{grid-column:1;grid-row:auto;margin:calc(4*var(--u)) 0 0!important}
 body[data-account-view="register"] #register-form>.submit{margin-top:calc(16*var(--u))!important}
}
/* Phone: one column, full-width form, 16px inputs (no iOS focus zoom). */
@media(max-width:779px){
 body[data-account-view="register"]{
  --u:1.06px;--reg-input-h:44px;--reg-icon:36px;--reg-indent:46px;--reg-label-fs:13.5px;--reg-input-fs:16px;
  --reg-hint-fs:11.5px;--reg-check-fs:13px;--reg-check:18px;--reg-submit-h:52px;--reg-submit-fs:20px;
  --reg-oauth-h:42px;--reg-oauth-fs:12.5px;--reg-q-fs:16px;--reg-link-fs:18px;--reg-orn:44px
 }
 body[data-account-view="register"] .scene{display:flex!important;flex-direction:column!important;gap:10px!important;padding:10px!important;min-height:0!important}
 body[data-account-view="register"] .left{min-height:0!important;padding:14px 8px 4px!important}
 body[data-account-view="register"] .left-copy em{font-size:23px!important}
 body[data-account-view="register"] .hero-brand{font-size:45px!important}
 body[data-account-view="register"] .eyebrow{font-size:12px!important;margin:5px 0 0!important}
 body[data-account-view="register"] .benefits,
 body[data-account-view="register"] .cards{display:none!important}
 body[data-account-view="register"] .panel{padding:16px 15px 18px!important;border-radius:22px!important}
 body[data-account-view="register"] .login-crown{height:34px!important}
 body[data-account-view="register"] .panel-heading h1{font-size:clamp(22px,6.4vw,29px)!important}
 body[data-account-view="register"] .panel-heading p{font-size:13px!important}
 body[data-account-view="register"] #register-form>label{margin-top:10px!important}
 body[data-account-view="register"] #register-form .field-icon{left:calc(-1 * var(--reg-indent))!important}
 body[data-account-view="register"] #register-form .nickname-field input{padding-right:112px!important}
 body[data-account-view="register"] #register-form #nick-status{width:108px;font-size:10.5px}
 body[data-account-view="register"] #register-form .checks{gap:9px!important;margin-top:14px!important}
 body[data-account-view="register"] #register-form .checks label{align-items:flex-start!important;gap:12px!important}
 body[data-account-view="register"] .register-forgot{width:auto;height:36px;padding:0 15px!important;margin:6px 0 0!important;font-size:13px!important}
 body[data-account-view="register"] #register-form>.submit{margin-top:16px!important}
 body[data-account-view="register"] .oauth-separator{margin:14px 0 10px!important}
 body[data-account-view="register"] .oauth-buttons{gap:6px!important}
 body[data-account-view="register"] .register-switch{margin-top:18px!important}
 body[data-account-view="register"] .switch-ornament{margin-right:10px}
 body[data-account-view="register"] .switch-ornament--end{margin:0 0 0 10px}
}
@media(max-width:379px){
 body[data-account-view="register"] #register-form .field input::placeholder{font-size:14px}
}
@media(max-width:350px){
 body[data-account-view="register"] .oauth-buttons{grid-template-columns:1fr!important}
 body[data-account-view="register"] .switch-ornament{display:none}
}

`;
const js=String.raw`(function(){'use strict';
const notice=document.getElementById('notice');
document.querySelectorAll('[data-oauth-provider]').forEach(link=>{
 link.addEventListener('click',event=>{
  if(link.getAttribute('aria-disabled')==='true'){
   event.preventDefault();notice.textContent='Logowanie przez tego dostawcę będzie możliwe po podłączeniu aplikacji OAuth.';
  }
 });
});
fetch('/auth/oauth/providers',{cache:'no-store',credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(data=>{
 if(!data?.providers)return;
 document.querySelectorAll('[data-oauth-provider]').forEach(link=>{
  const name=link.dataset.oauthProvider;
  if(data.providers[name]){link.removeAttribute('aria-disabled');link.removeAttribute('tabindex');link.removeAttribute('title');}
 });
}).catch(()=>{});

const forgot=document.getElementById('forgot-form'),reset=document.getElementById('reset-form');
let resetToken='';
// Responsive CSS replaces viewport zoom of the whole page.
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


const passwordField=document.getElementById('password');
const repeatField=document.getElementById('repeatPassword');
const passwordFeedback=document.getElementById('password-feedback');
const passwordFeedbackText=document.getElementById('password-feedback-text');
function showPasswordFeedback(){
 const count=passwordField.value.length;
 passwordFeedbackText.textContent='Hasło musi mieć co najmniej 15 znaków. Wpisano '+count+'.';
 passwordField.setAttribute('aria-invalid','true');
 passwordFeedback.hidden=false;
}
function hidePasswordFeedback(){
 passwordFeedback.hidden=true;
 passwordField.removeAttribute('aria-invalid');
}
passwordField.addEventListener('input',()=>{
 if(passwordField.value.length>=15 || passwordField.value.length===0)hidePasswordFeedback();
 else if(!passwordFeedback.hidden)showPasswordFeedback();
});
passwordField.addEventListener('blur',()=>{
 if(passwordField.value.length>0 && passwordField.value.length<15)showPasswordFeedback();
});
function invalid(input,message){
 msg(message);
 input.setAttribute('aria-invalid','true');
 input.focus();
 return false;
}
form.querySelectorAll('input').forEach(input=>{
 input.addEventListener('input',()=>{if(input!==passwordField)input.removeAttribute('aria-invalid');});
 input.addEventListener('change',()=>input.removeAttribute('aria-invalid'));
});
function validateRegistration(){
 const nick=nickInput.value.trim(),email=document.getElementById('email');
 if(!/^[a-z][a-z0-9._-]{2,31}$/i.test(nick))return invalid(nickInput,'Nick musi mieć 3–32 znaki, zaczynać się literą i zawierać tylko litery, cyfry, kropki, podkreślenia lub łączniki.');
 if(nickStatus.dataset.state==='taken')return invalid(nickInput,'Ten nick jest zajęty. Wybierz inny.');
 if(!email.checkValidity())return invalid(email,'Wpisz poprawny adres e-mail.');
 if(passwordField.value.length<15){showPasswordFeedback();passwordField.focus();return false;}
 if(new TextEncoder().encode(passwordField.value).length>256)return invalid(passwordField,'Hasło jest za długie. Maksymalnie 256 bajtów.');
 hidePasswordFeedback();
 if(repeatField.value!==passwordField.value)return invalid(repeatField,'Hasła nie są takie same.');
 const terms=form.elements.namedItem('terms');
 const privacy=form.elements.namedItem('privacy');
 if(!terms.checked)return invalid(terms,'Zaakceptuj regulamin serwisu.');
 if(!privacy.checked)return invalid(privacy,'Zaakceptuj politykę prywatności.');
 msg('');
 return true;
}
function view(name){
 document.body.dataset.accountView=name;
 document.body.classList.toggle('auth-login-mode',['login','forgot','reset'].includes(name));
 form.hidden=name!=='register';login.hidden=name!=='login';forgot.hidden=name!=='forgot';reset.hidden=name!=='reset';account.hidden=name!=='account';verified.hidden=name!=='verified';
 heading.innerHTML=name==='login'?'Zaloguj się do <span class="form-logo">gracz<span>.pl</span></span>':
 name==='forgot'?'Odzyskaj hasło':name==='reset'?'Ustaw nowe hasło':
 name==='account'?'Twoje konto w gracz.pl':name==='verified'?'Potwierdzono e-mail':
 'Załóż konto w <span class="form-logo">gracz<span>.pl</span></span>';msg('');
}
async function api(path,data){const r=await fetch('/auth/'+path,{method:data===undefined?'GET':'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});const b=await r.json();if(!r.ok||!b.ok)throw Error(({SYSTEM_NIEDOSTEPNY:'System kont jest chwilowo niedostępny.',BLEDNY_LOGIN_LUB_HASLO:'Nieprawidłowe dane albo konto nie zostało jeszcze potwierdzone.',POPRAW_DANE_FORMULARZA:'Sprawdź poprawność danych i zgody.',ZBYT_WIELE_PROB:'Zbyt wiele prób. Spróbuj później.',LINK_NIEWAZNY_LUB_WYGASL:'Link jest nieważny albo wygasł.',NIE_UDALO_SIE_WYSLAC_EMAIL:'Nie udało się wysłać e-maila.'})[b.error]||'Nie udało się wykonać operacji.');return b;}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',event=>{
 if(button.tagName==='A')event.preventDefault();
 const requested=button.dataset.view;
 view(requested);
 if(requested==='login'||requested==='register'){
  history.replaceState(null,'',requested==='login'?'/konto/?widok=login':'/konto/');
  window.scrollTo(0,0);
 }
}));
// Top bar: burger panel (≤1180px) and the Gry / Gry karciane menus, as on gracz.pl.
const bar=document.querySelector('[data-account-header]'),burger=bar.querySelector('.site-bar-burger');
const barMenus=[...bar.querySelectorAll('.has-menu')];
function setBarMenu(item,open){item.classList.toggle('is-open',open);item.querySelector('.menu-toggle').setAttribute('aria-expanded',open?'true':'false');}
function closeBarMenus(except){barMenus.forEach(item=>{if(item!==except)setBarMenu(item,false);});}
function setBar(open){bar.classList.toggle('menu-open',open);burger.setAttribute('aria-expanded',open?'true':'false');burger.setAttribute('aria-label',open?'Zamknij menu':'Otwórz menu');if(!open)closeBarMenus();}
burger.addEventListener('click',()=>setBar(!bar.classList.contains('menu-open')));
barMenus.forEach(item=>item.querySelector('.menu-toggle').addEventListener('click',event=>{event.stopPropagation();const open=!item.classList.contains('is-open');closeBarMenus(item);setBarMenu(item,open);}));
bar.querySelectorAll('[data-view]').forEach(link=>link.addEventListener('click',()=>setBar(false)));
document.addEventListener('click',event=>{if(!event.target.closest('.has-menu'))closeBarMenus();});
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;closeBarMenus();if(bar.classList.contains('menu-open')){setBar(false);burger.focus();}});
document.querySelectorAll('[data-show]').forEach(button=>button.addEventListener('click',()=>{const el=document.getElementById(button.dataset.show);el.type=el.type==='password'?'text':'password';button.setAttribute('aria-label',el.type==='password'?'Pokaż hasło':'Ukryj hasło');}));
form.addEventListener('submit',async e=>{e.preventDefault();if(!validateRegistration())return;const btn=form.querySelector('[type=submit]');const d=new FormData(form);btn.disabled=true;try{const b=await api('register',{nickname:d.get('nickname'),email:d.get('email'),password:d.get('password'),repeatPassword:d.get('repeatPassword'),terms:d.get('terms')==='on',privacy:d.get('privacy')==='on'});form.reset();hidePasswordFeedback();msg(b.message);}catch(err){msg(err.message);}finally{btn.disabled=false;}});
login.addEventListener('submit',async e=>{e.preventDefault();const loginName=login.elements.namedItem('login'),loginPass=login.elements.namedItem('password');if(!loginName.value.trim())return invalid(loginName,'Wpisz e-mail lub nick gracza.');if(!loginPass.value)return invalid(loginPass,'Wpisz hasło.');const btn=login.querySelector('[type=submit]'),d=new FormData(login);btn.disabled=true;try{const b=await api('login',{login:d.get('login'),password:d.get('password')});const session=await api('session');
 if(!session.loggedIn || session.nickname!==b.nickname)throw Error('Nie udało się utrzymać sesji. Sprawdź, czy przeglądarka pozwala na ciasteczka dla gracz-contact-api.onrender.com, i spróbuj ponownie.');
 login.reset();location.assign('/konto/panel/');}catch(err){msg(err.message);}finally{btn.disabled=false;}});
forgot.addEventListener('submit',async e=>{
 e.preventDefault();const email=forgot.elements.namedItem('email');
 if(!email.value.trim()||!email.checkValidity())return invalid(email,'Wpisz poprawny adres e-mail.');
 const btn=forgot.querySelector('[type=submit]');btn.disabled=true;
 try{const result=await api('forgot-password',{email:email.value.trim()});forgot.reset();msg(result.message||'Jeżeli konto istnieje, wysłaliśmy instrukcję.');}
 catch(err){msg(err.message);}finally{btn.disabled=false;}
});
reset.addEventListener('submit',async e=>{
 e.preventDefault();const password=reset.elements.namedItem('password'),repeat=reset.elements.namedItem('repeatPassword');
 if(password.value.length<15)return invalid(password,'Hasło musi mieć co najmniej 15 znaków.');
 if(password.value!==repeat.value)return invalid(repeat,'Hasła muszą być identyczne.');
 if(!/^[a-f0-9]{64}$/.test(resetToken))return msg('Link jest nieważny lub wygasł.');
 const btn=reset.querySelector('[type=submit]');btn.disabled=true;
 try{const result=await api('reset-password',{token:resetToken,password:password.value,repeatPassword:repeat.value});resetToken='';reset.reset();view('login');msg(result.message||'Hasło zmienione.');}
 catch(err){msg(err.message);}finally{btn.disabled=false;}
});
document.getElementById('logout').addEventListener('click',async()=>{try{await api('logout',{});view('login');msg('Wylogowano.');}catch(err){msg(err.message);}});
(async()=>{
const qp=new URLSearchParams(location.search);
try{if('scrollRestoration' in history)history.scrollRestoration='manual';window.scrollTo(0,0);}catch{}
const hash=new URLSearchParams(location.hash.slice(1));const resetFromLink=hash.get('nowe-haslo');
if(resetFromLink){
 history.replaceState(null,'','/konto/');
 if(!/^[a-f0-9]{64}$/.test(resetFromLink)){view('login');msg('Nieprawidłowy link do odzyskania hasła.');return;}
 resetToken=resetFromLink;view('reset');return;
}
const token=hash.get('potwierdz');if(token){history.replaceState(null,'','/konto/');try{await api('verify',{token});view('verified');}catch(err){view('login');msg(err.message);}return;}
// Paint the requested form immediately. Network or cold-start delays must NEVER
// show registration on ?widok=login, even for a single frame.
view(qp.get('widok')==='login'?'login':'register');
try{const s=await api('session');if(s.loggedIn){location.replace('/konto/panel/');return;}}catch{}
const oauthErr=qp.get('oauth_error');
if(oauthErr)msg(oauthErr==='not-configured'?'Ten dostawca logowania nie został jeszcze skonfigurowany.':
 oauthErr==='email-already-used'?'Adres e-mail jest już przypisany do istniejącego konta. Zaloguj się e-mailem.':
 'Nie udało się potwierdzić logowania przez dostawcę. Spróbuj ponownie.');
if(qp.get('oauth_notice')==='verify')msg('Sprawdź pocztę i potwierdź adres e-mail przed pierwszym logowaniem.');
})();
})();`;
export function serveIdentityPage(req,res,url){
 const path=url.pathname.replace(/\/+$/,'')||'/';
 let type,body;
 if(path==='/konto'&&req.method==='GET'){
  type='text/html; charset=utf-8';
  const loginMode=url.searchParams.get('widok')==='login';
  // Pre-render the correct initial form server-side, before deferred JS and
  // before any session API request can finish.
  body=loginMode
   ? html.replace('<body>','<body class="auth-login-mode" data-account-view="login">')
     .replace('<form id="register-form" autocomplete="on" novalidate>','<form id="register-form" autocomplete="on" novalidate hidden>')
     .replace('<form id="login-form" hidden novalidate>','<form id="login-form" novalidate>')
     .replace('Załóż konto w <span class="form-logo">gracz<span>.pl</span></span>','Zaloguj się do <span class="form-logo">gracz<span>.pl</span></span>')
   : html.replace('<body>','<body data-account-view="register">');
}
 else if(path==='/konto/styl.css'&&req.method==='GET'){type='text/css; charset=utf-8';body=css;}
 else if(path==='/konto/app.js'&&req.method==='GET'){type='application/javascript; charset=utf-8';body=js;}
 else if(artwork.has(path)&&req.method==='GET'){type='image/webp';body=artwork.get(path);}
 else if(path==='/konto/korona.svg'&&req.method==='GET'){type='image/svg+xml';body=crownSvg;}
 else if(fonts.get(path)&&req.method==='GET'){type='font/woff2';body=fonts.get(path);}
 else return false;
 res.writeHead(200,{...headers,'Content-Type':type,'Content-Length':Buffer.byteLength(body)});
 res.end(body);
 return true;
}
