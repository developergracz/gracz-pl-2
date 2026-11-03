// Standalone Gomoku console. Online games use the existing authenticated, server-authoritative /auth/match API.
const secure={
 'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'
};
const html=String.raw`<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#04191b"><meta name="robots" content="noindex,nofollow,noarchive">
<title>Gomoku Online — Full Max Premium | gracz.pl</title>
<link rel="stylesheet" href="/konto/gomoku/styl.css"><script src="/konto/gomoku/app.js" defer></script></head>
<body>
<a class="skip" href="#board">Przejdź do planszy</a>
<main class="layout" id="game">
<aside class="sidebar" aria-label="Panel gry">
<header class="side-header">
<div class="gomoku-heading" aria-label="Gomoku Online">
<h1 class="gomoku-heading-title"><span class="gomoku-heading-gold">Gomoku</span><span class="gomoku-heading-white">Online</span></h1>
<div class="gomoku-heading-ornament" aria-hidden="true"><span class="gomoku-heading-line"></span><svg class="gomoku-heading-crown" viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 7.2 7.8 11 12 3.5 16.2 11 21 7.2 19.2 17.6H4.8L3 7.2Z" fill="currentColor" stroke="#FBE19C" stroke-width=".8" stroke-linejoin="round"/><path d="M5.3 20h13.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="3" cy="6.3" r="1.4" fill="#FFE4A5"/><circle cx="12" cy="2.8" r="1.4" fill="#FFE4A5"/><circle cx="21" cy="6.3" r="1.4" fill="#FFE4A5"/></svg><span class="gomoku-heading-line"></span></div>
</div>
</header>
<div class="mode" role="group" aria-label="Tryb gry">
<button type="button" class="mode-choice active" id="training-mode" aria-pressed="true"><span class="mode-icon" aria-hidden="true">🎓</span><span><strong>Trening</strong><small>Graj od razu z komputerem</small></span><span class="mode-arrow" aria-hidden="true">›</span></button>
<button type="button" class="mode-choice" id="online-mode" aria-pressed="false"><span class="mode-icon" aria-hidden="true">👥</span><span><strong>Ze znajomym</strong><small>Wspólna partia online</small></span><span class="mode-arrow" aria-hidden="true">›</span></button>
</div>
<section class="sidecard" id="training-settings"><h2>Twój trening</h2>
<details class="panel-help"><summary>O treningu</summary><p>Grasz czarnymi kamieniami. Komputer odpowiada białymi. Bez konta i bez rankingu.</p></details>
<label for="ai-level">Poziom komputera</label>
<select id="ai-level" aria-label="Poziom trudności komputera"><option value="normal">Normalny</option><option value="hard">Trudny</option><option value="expert" selected>♛ Ekspert — dla bardzo doświadczonych</option></select>
<details class="panel-help"><summary>Opis poziomu</summary><p id="ai-hint" class="hint">Ekspert szuka wymuszonych wygranych, blokuje zagrożenia i rzadko popełnia błędy. Najtrudniejszy poziom.</p></details>
<label for="training-time" class="training-timer-label">Czas na partię dla każdego gracza</label>
<select id="training-time" aria-label="Czas gry z komputerem">
<option value="0">Bez limitu czasu</option><option value="1">1 minuta</option><option value="2">2 minuty</option><option value="3">3 minuty</option>
<option value="5">5 minut</option><option value="7" selected>7 minut</option>
<option value="10">10 minut</option><option value="15">15 minut</option>
<option value="30">30 minut</option>
</select>
<label for="training-increment" class="training-timer-label">Bonus czasu po każdym ruchu</label>
<select id="training-increment" aria-label="Dodatkowe sekundy po ruchu w treningu"><option value="0" selected>Bez bonusu</option><option value="2">+2 sekundy</option><option value="3">+3 sekundy</option><option value="5">+5 sekund</option><option value="10">+10 sekund</option></select>
<details class="panel-help"><summary>Jak działają zegary?</summary><p class="training-clock-help">Zegary są niezależne. Czas mija tylko podczas własnej tury, a bonus dolicza się po prawidłowym ruchu. Zmiana ustawień rozpoczyna nową partię.</p></details>
<button class="primary" id="restart" type="button"><span aria-hidden="true">▶</span> Nowa partia</button></section>
<section class="sidecard training-records" id="training-records" aria-label="Statystyki treningu"><h2>♛ Mój bilans treningu</h2><p class="records-note sr-only">Wyniki partii z komputerem na tym urządzeniu, bez rankingu.</p><div class="records-grid"><div><strong id="record-wins">0</strong><small>Wygrane</small></div><div><strong id="record-draws">0</strong><small>Remisy</small></div><div><strong id="record-losses">0</strong><small>Przegrane</small></div></div><p class="records-total">Rozegrano: <strong id="record-total">0</strong> · Skuteczność: <strong id="record-rate">0%</strong></p></section>
<section class="sidecard" id="online-settings" hidden><h2>Moje pokoje Gomoku</h2>
<p id="account-note" role="status">Sprawdzanie sesji gracza…</p>
<div class="room-creator">
 <h3>Utwórz pokój · ustawienia partii</h3>
 <label for="create-room-friend">Nick znajomego, którego zapraszasz</label>
 <input id="create-room-friend" type="text" maxlength="40" autocomplete="off" placeholder="Nick znajomego">
 <label for="create-room-time">Czas dla każdego gracza</label>
 <select id="create-room-time">
  <option value="0">Bez limitu czasu</option>
  <option value="1">1 minuta</option><option value="2">2 minuty</option><option value="3">3 minuty</option><option value="5">5 minut</option>
  <option value="7" selected>7 minut</option><option value="10">10 minut</option>
  <option value="15">15 minut</option><option value="30">30 minut</option>
 </select>
 <label for="create-room-increment">Dodatkowy czas po ruchu</label>
 <select id="create-room-increment" aria-label="Bonus czasu na każdy legalny ruch"><option value="0" selected>Brak bonusu</option><option value="2">+2 sekundy</option><option value="3">+3 sekundy</option><option value="5">+5 sekund</option><option value="10">+10 sekund</option></select>
 <details class="panel-help"><summary>Zasady pokoju na czas</summary><p class="room-creator-hint">Każdy ma własny zegar. Po każdym zaakceptowanym ruchu otrzymuje wybrany bonus. Zegary startują dopiero po wejściu obojga graczy.</p></details>
 <button type="button" class="primary" id="create-room">Utwórz pokój i zaproś</button>
 <p id="create-room-status" role="status" class="muted"></p>
</div>
<label for="room-select">Wybierz zaakceptowane wyzwanie</label>
<select id="room-select"><option value="">Brak wybranego pokoju</option></select>
<div class="actions"><button class="primary" id="join-room" type="button">Otwórz partię</button><button class="secondary" id="reload-rooms" type="button">Odśwież listę</button></div>
<a class="textlink" href="/konto/panel/">Dodaj znajomego lub wyślij zaproszenie w Panelu Gracza</a></section>
<details class="sidecard rules"><summary>Jak grać?</summary>
<p>Ułóż 5 swoich kamieni w linii: poziomo, pionowo lub na skos. Blokuj zagrożenia przeciwnika i planuj ruchy z wyprzedzeniem.</p>
<p class="muted">W trybie online serwer zatwierdza ruchy. Trening nie jest rankingowy.</p>
</details>
<nav class="side-links"><a href="/konto/panel/">Mój panel</a><a href="https://gracz.pl/gry/gomoku/">Zasady Gomoku</a></nav>
</aside>
<section class="boardarea" aria-label="Konsola gry Gomoku">
<div class="players">
<div class="player first"><span class="stone black" aria-hidden="true"></span><div><strong id="black-name">Ty</strong><small>Czarne — zaczynają</small></div><span class="player-icon" aria-hidden="true">♛</span><span class="player-clock" id="clock-1" aria-label="Czas czarnych" hidden>07:00</span></div>
<div class="versus" aria-label="VS — kontra">
<svg class="versus-emblem" viewBox="0 0 105 70" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="vs-foil" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0" stop-color="#fff09b"/><stop offset=".25" stop-color="#ffd642"/><stop offset=".52" stop-color="#f4bb16"/><stop offset=".78" stop-color="#ffe16a"/><stop offset="1" stop-color="#c78b08"/></linearGradient>
<linearGradient id="vs-leaf" x1="0" y1="0" x2="1" y2=".65"><stop stop-color="#b98307"/><stop offset=".42" stop-color="#ffcf26"/><stop offset=".6" stop-color="#ffe77d"/><stop offset="1" stop-color="#e6a90b"/></linearGradient>
<path id="vs-leaf-shape" d="M0 0C-2.5-2-2.8-5.6 0-9C2.2-5.7 2.3-2.5 0 0Z"/>
</defs>
<g id="vs-laurel-half" fill="url(#vs-leaf)">
<path d="M28 65C8 57 5 32 22 17" fill="none" stroke="url(#vs-foil)" stroke-width="1.05"/>
<path d="M21 21C20 17 24 15 28 14C27 18 24 20 21 21Z"/>
<use href="#vs-leaf-shape" transform="translate(19 25) rotate(-8)"/>
<use href="#vs-leaf-shape" transform="translate(19 25) rotate(57) scale(.85)"/>
<use href="#vs-leaf-shape" transform="translate(15 31) rotate(-19)"/>
<use href="#vs-leaf-shape" transform="translate(15 31) rotate(66) scale(.85)"/>
<use href="#vs-leaf-shape" transform="translate(13 38) rotate(-33)"/>
<use href="#vs-leaf-shape" transform="translate(13 38) rotate(77) scale(.85)"/>
<use href="#vs-leaf-shape" transform="translate(14 45) rotate(-49)"/>
<use href="#vs-leaf-shape" transform="translate(14 45) rotate(92) scale(.85)"/>
<use href="#vs-leaf-shape" transform="translate(17 52) rotate(-64)"/>
<use href="#vs-leaf-shape" transform="translate(17 52) rotate(107) scale(.85)"/>
<use href="#vs-leaf-shape" transform="translate(21 58) rotate(-76)"/>
<use href="#vs-leaf-shape" transform="translate(21 58) rotate(117) scale(.85)"/>
<use href="#vs-leaf-shape" transform="translate(27 63) rotate(-91)"/>
<use href="#vs-leaf-shape" transform="translate(27 63) rotate(128) scale(.85)"/>
</g>
<use href="#vs-laurel-half" transform="translate(105 0) scale(-1 1)"/>
<g fill="url(#vs-foil)" stroke="#ae7a0a" stroke-width=".3" stroke-linejoin="round">
<path d="M32 28H46V30H42.5L49 46L55 30H51.5V28H62V30H59L49.8 52H46.4L36.7 30H32Z"/>
<path d="M72 29V35H70.2C69.5 31.3 67.8 29.5 65 29.5C62.8 29.5 61.4 30.6 61.4 32.4C61.4 34.4 63.4 35.3 67.2 36.8C71.7 38.6 74 40.6 74 44.3C74 49.3 70.4 52.5 65 52.5C62.1 52.5 59.7 51.8 57.5 50.5V44H59.3C60.2 48.3 62.3 50.6 65.4 50.6C68 50.6 69.6 49.3 69.6 47.2C69.6 45 67.4 44 63.8 42.5C59.4 40.8 57.2 38.7 57.2 35.2C57.2 30.6 60.7 27.6 65.4 27.6C68 27.6 70.3 28.2 72 29Z"/>
</g>
</svg></div>
<div class="player second"><span class="stone white" aria-hidden="true"></span><div><strong id="white-name">Komputer</strong><small>Białe</small></div><span class="player-icon" aria-hidden="true">♟</span><span class="player-clock" id="clock-2" aria-label="Czas białych" hidden>07:00</span></div>
</div>
<nav class="premium-quick-links" aria-label="Szybkie odnośniki gracz.pl"><a class="premium-mini-link" href="https://gracz.pl/gry/" title="Gry gracz.pl" aria-label="Gry gracz.pl" data-tooltip="Gry gracz.pl"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h12c2 0 3 1.4 3.4 3.4l1 6.3c.3 2.2-2 3.2-3.6 1.8l-3.2-3H8.4l-3.2 3c-1.6 1.4-3.9.4-3.6-1.8l1-6.3C3 9.4 4 8 6 8Z"/><path d="M8 10.5v5M5.5 13h5"/><circle cx="15.5" cy="11.5" r=".8" fill="currentColor" stroke="none"/><circle cx="18" cy="14" r=".8" fill="currentColor" stroke="none"/></svg></a>
<a class="premium-mini-link" href="https://gracz.pl/gry/gomoku/" title="Zasady gry w Gomoku" aria-label="Zasady gry w Gomoku" data-tooltip="Zasady gry w Gomoku"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5c-2-1.4-5-1.8-9-1.8V4.2c3.9 0 7.3.5 9 2.1 1.7-1.6 5.1-2.1 9-2.1v14.5c-4 0-7 .4-9 1.8Z"/><path d="M12 6.3v14.2M5.2 7.5c1.5 0 3.2.2 4.5.7M14.4 8.2c1.3-.5 3-.7 4.4-.7"/></svg></a>
<a class="premium-mini-link" href="https://gracz.pl/#spolecznosc" title="Społeczność graczy" aria-label="Społeczność graczy" data-tooltip="Społeczność graczy"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="7.1" r="3"/><path d="M6 20v-2.3c0-3 2.5-5.1 6-5.1s6 2.1 6 5.1V20ZM4.8 9.9a2.2 2.2 0 1 1 .9-4.3M3.8 15c-1.5.6-2.3 1.9-2.3 3.7V20h3.1M19.2 9.9a2.2 2.2 0 1 0-.9-4.3M20.2 15c1.5.6 2.3 1.9 2.3 3.7V20h-3.1"/></svg></a>
<a class="premium-mini-link" href="https://gracz.pl/#aktualnosci" title="Aktualności gracz.pl" aria-label="Aktualności gracz.pl" data-tooltip="Aktualności gracz.pl"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h10M7 10.5h10M7 14h4M13.5 14h3.5v3.5h-3.5ZM7 18h4"/></svg></a>
<a class="premium-mini-link" href="/konto/panel/" title="Panel Gracza" aria-label="Panel Gracza" data-tooltip="Panel Gracza"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 6 4.6 4.2L12 3l4.4 7.2L21 6l-2 12H5L3 6ZM5.6 21h12.8"/><circle cx="12" cy="12.5" r="1" fill="currentColor" stroke="none"/></svg></a></nav>
<div class="state" id="game-state" role="status" aria-live="polite">Twój ruch — postaw czarny kamień.</div>
<div class="arena">
<div class="board-center"><div class="boardtop"><h2 id="session-heading">Trening z komputerem</h2><span id="room-tag" class="roomtag">TRENING</span></div>
<div class="boardframe"><div class="board" id="board" role="grid" aria-label="Plansza Gomoku 15 na 15"></div></div>
</div>
<aside class="side-dock" aria-label="Historia ruchów i rozmowa">
<section class="match-panel">
<div class="dock-header"><span class="dock-eyebrow">GOMOKU · PREMIUM</span><span class="dock-live" id="dock-status">● TRENING</span></div>
<div class="dock-tabs" role="tablist" aria-label="Panel partii">
<button type="button" class="dock-tab active" id="chat-tab" role="tab" aria-selected="true" aria-controls="chat-panel">▣ &nbsp;Czat <span class="chat-led" aria-hidden="true"></span></button>
<button type="button" class="dock-tab" id="history-tab" role="tab" aria-selected="false" aria-controls="moves-panel">☷ &nbsp;Ruchy</button></div>
<div class="replay-shortcut"><button type="button" id="replay-game" aria-label="Powtórka zakończonej partii" title="Odtwórz zakończoną partię">⏮ &nbsp; Powtórka zakończonej partii</button></div>
<div id="moves-panel" class="dock-content" role="tabpanel" aria-labelledby="history-tab" hidden>
<div class="dock-title"><strong>Historia ruchów</strong><span id="history-count">0</span></div>
<div id="moves-list" class="moves-list" aria-live="polite"><p class="dock-empty">Wybierz pole i rozpocznij partię.</p></div>
<div class="history-footer" id="history-info">Zapis lokalny w treningu</div>
</div>
<div id="chat-panel" class="dock-content" role="tabpanel" aria-labelledby="chat-tab">
<div class="dock-title"><strong>Czat przy stole</strong><span class="chat-lock">Prywatny</span></div>
<div id="chat-messages" class="chat-messages" aria-live="polite"><p class="dock-empty">Rozmowa przy stole gry.</p></div>
</div>
<div class="mini-chat">
<div id="chat-preview" class="chat-preview" aria-label="Ostatnie wiadomości"><p class="dock-empty">Rozpocznij partię lub rozmowę.</p></div>
<form id="chat-form" class="chat-form"><label for="chat-input" class="sr-only">Napisz wiadomość do przeciwnika lub komputera treningowego</label>
<div class="chat-compose"><input id="chat-input" maxlength="600" type="text" autocomplete="off" placeholder="Napisz wiadomość…"><button id="chat-send" type="submit" aria-label="Wyślij wiadomość">➤</button></div></form>
<p class="chat-footnote" id="chat-status">Komentarze treningowe · bez zapisu na serwerze</p>
</div>
</section>
<div class="game-tools" aria-label="Narzędzia gry">
<button type="button" class="tool-btn" id="undo-move" title="Cofnij ruch" aria-label="Cofnij ruch" data-tooltip="Cofnij ruch"><span aria-hidden="true">↶</span><span class="sr-only" id="undo-label">Cofnij czarny kamień</span></button>
<button type="button" class="tool-btn" id="analyze-position" title="Analiza partii" aria-label="Analiza partii" data-tooltip="Analiza partii"><span aria-hidden="true">▥</span></button>
<button type="button" class="tool-btn" id="game-settings" title="Ustawienia czata" aria-label="Ustawienia czata" data-tooltip="Ustawienia czata"><span aria-hidden="true">⚙</span></button>
<button type="button" class="tool-btn" id="fullscreen-game" title="Pełny ekran" aria-label="Pełny ekran" data-tooltip="Pełny ekran"><span aria-hidden="true">⛶</span></button>
<button type="button" class="tool-btn" id="invite-friend" title="Zaproś znajomego" aria-label="Zaproś znajomego" data-tooltip="Zaproś znajomego"><span aria-hidden="true">♧</span></button>
<button type="button" class="tool-btn" id="remove-player" title="Wyproś gracza z pokoju" aria-label="Wyproś gracza z pokoju" data-tooltip="Wyproś gracza"><span aria-hidden="true">⊖</span></button>
<button type="button" class="tool-btn" id="block-player" title="Zablokuj gracza" aria-label="Zablokuj gracza" data-tooltip="Zablokuj gracza"><span aria-hidden="true">⊘</span></button>
<button type="button" class="tool-btn" id="refresh-match" title="Odśwież partię" aria-label="Odśwież partię" data-tooltip="Odśwież partię" hidden><span aria-hidden="true">↻</span></button>
</div></aside></div>
<div class="bottom"><span class="info-pill" id="move-count">Ruchy: 0</span><span id="board-help" class="help">Wybierz wolne pole, aby postawić czarny kamień.</span><span class="info-pill" id="turn-label">Tura: czarne</span></div>
<p class="analysis-note" id="analysis-note" role="status" aria-live="polite" hidden></p>
</section>
</main>
<div id="replay-modal" class="replay-overlay" role="dialog" aria-modal="true" aria-labelledby="replay-title" hidden>
<section class="replay-card"><div class="replay-header"><div><span class="replay-kicker">GRACZ.PL · STUDIO ANALIZY</span><h2 id="replay-title">Powtórka partii Gomoku</h2></div><button type="button" id="replay-close" class="replay-close" aria-label="Zamknij powtórkę">×</button></div>
<p id="replay-status" class="replay-status" aria-live="polite">Przebieg rozegranej partii</p><div id="replay-board" class="replay-board" role="img" aria-label="Plansza powtórki 15 na 15"></div>
<div class="replay-controls" role="group" aria-label="Przewijanie partii"><button type="button" id="replay-start" aria-label="Początek partii">⏮</button><button type="button" id="replay-prev" aria-label="Poprzedni ruch">◀</button><span id="replay-counter">0 / 0</span><button type="button" id="replay-next" aria-label="Następny ruch">▶</button><button type="button" id="replay-end" aria-label="Koniec partii">⏭</button></div><p class="replay-footnote">Odtwarzanie nie zmienia wyniku, planszy ani zegarów rozegranej partii.</p></section></div>
<div id="game-result-modal" class="result-overlay" role="dialog" aria-modal="true" aria-labelledby="game-result-title" aria-describedby="game-result-description" hidden>
<section class="result-card" data-result="win">
<button type="button" id="game-result-close" class="result-close" aria-label="Zamknij wynik i zobacz planszę">×</button>
<span class="result-brand">GRACZ.PL <b>FULL MAX PREMIUM</b></span>
<div class="result-medal" aria-hidden="true">♛</div>
<span class="result-eyebrow">GOMOKU · WYNIK PARTII</span>
<h2 id="game-result-title">Koniec partii</h2>
<p id="game-result-description">Wynik został rozstrzygnięty.</p>
<button type="button" class="result-start" id="game-result-new">▶ &nbsp; Rozpocznij nową partię</button>
<button type="button" class="result-review" id="game-result-review">Zobacz zakończoną planszę</button>
<p class="result-online-hint" id="game-result-online-hint" hidden>Nowy pojedynek online wymaga nowego zaproszenia. Otworzymy Panel Gracza.</p>
</section></div>
<div id="player-actions-modal" class="premium-overlay" role="dialog" aria-modal="true" aria-labelledby="player-actions-title" hidden>
<section class="premium-popup"><button type="button" class="popup-close" id="player-actions-close" aria-label="Zamknij">×</button>
<p class="premium-eyebrow">GOMOKU · FULL MAX PREMIUM</p>
<h2 id="player-actions-title">Zaproś znajomego</h2>
<p id="player-actions-status" role="status">Lista znajomych</p>
<div id="player-actions-list" class="player-actions-list"></div></section></div>
<div id="chat-settings-modal" class="premium-overlay" role="dialog" aria-modal="true" aria-labelledby="chat-settings-title" aria-describedby="chat-settings-intro" hidden>
<section class="premium-popup chat-control-panel">
 <button type="button" class="popup-close" id="chat-settings-close" aria-label="Zamknij ustawienia rozmowy">×</button>
 <div class="chat-control-header">
  <span class="chat-control-icon" aria-hidden="true">♛</span>
  <div><p class="premium-eyebrow">GRACZ.PL · GOMOKU · FULL MAX PREMIUM</p>
   <h2 id="chat-settings-title">Centrum rozmowy</h2>
   <p id="chat-settings-intro">Dopasuj czat do swojego stylu gry. Wszystkie wybory zapisują się na tym urządzeniu.</p></div>
 </div>
 <div class="chat-control-status" role="status"><span class="chat-control-led" aria-hidden="true"></span>
  <strong id="chat-settings-mode">Trening z komputerem</strong><span id="chat-settings-access">Komentarze treningowe · tylko lokalnie</span>
 </div>
 <div class="chat-settings-sections">
  <fieldset class="chat-settings-section">
   <legend><span aria-hidden="true">◈</span> Widok rozmowy</legend>
   <p class="chat-settings-desc">To Ty decydujesz, jak wyświetlają się wiadomości.</p>
   <label class="chat-switch"><span><strong>Pokazuj wiadomości</strong><small>Wyświetlaj pełną historię czatu</small></span><input id="chat-show-messages" type="checkbox" checked></label>
   <label class="chat-switch"><span><strong>Podgląd przy planszy</strong><small>Ostatnie wiadomości pod historią ruchów</small></span><input id="chat-show-preview" type="checkbox" checked></label>
   <label class="chat-switch"><span><strong>Godziny wiadomości</strong><small>Pokazuj czas wysłania obok rozmowy</small></span><input id="chat-timestamps" type="checkbox" checked></label>
   <label class="chat-switch"><span><strong>Widok kompaktowy</strong><small>Więcej wiadomości w mniejszej przestrzeni</small></span><input id="chat-compact" type="checkbox"></label>
  </fieldset>
  <fieldset class="chat-settings-section">
   <legend><span aria-hidden="true">✦</span> Komfort i powiadomienia</legend>
   <p class="chat-settings-desc">Wybierz sposób czytania i obsługi rozmowy.</p>
   <label class="chat-select-label" for="chat-font-size"><span><strong>Wielkość tekstu</strong><small>Wiadomości dopasowane do ekranu</small></span>
    <select id="chat-font-size"><option value="small">Mała</option><option value="normal" selected>Standardowa</option><option value="large">Duża</option></select></label>
   <label class="chat-switch"><span><strong>Automatyczne przewijanie</strong><small>Przechodź do najnowszych wiadomości</small></span><input id="chat-auto-scroll" type="checkbox" checked></label>
   <label class="chat-switch"><span><strong>Wysyłaj klawiszem Enter</strong><small>Gdy wyłączysz, używaj złotego przycisku</small></span><input id="chat-enter-send" type="checkbox" checked></label>
   <label class="chat-switch"><span><strong>Dźwięk nowej wiadomości</strong><small>Krótki sygnał podczas partii online</small></span><input id="chat-sounds" type="checkbox"></label>
   <button type="button" class="chat-sound-test" id="chat-sound-test"><span aria-hidden="true">♫</span> Sprawdź dźwięk</button>
  </fieldset>
 </div>
 <div class="chat-privacy-strip"><span aria-hidden="true">♧</span><div><strong>Bezpieczna rozmowa</strong>
  <p id="chat-privacy-description">Trening nie wysyła wiadomości na serwer. W partii online czat jest dostępny tylko dla jej uczestników.</p>
 </div></div>
 <div class="chat-settings-actions">
  <button type="button" class="chat-settings-reset" id="chat-settings-reset">Przywróć domyślne</button>
  <button type="button" class="premium-confirm" id="chat-settings-save">✓ Zapisz ustawienia</button>
 </div>
</section></div>
<div id="undo-request-modal" class="undo-modal" role="dialog" aria-modal="true"
 aria-labelledby="undo-modal-title" aria-describedby="undo-modal-message" hidden>
 <div class="undo-modal-card">
 <span class="undo-modal-symbol" aria-hidden="true">♛</span>
 <p class="undo-modal-kicker">GOMOKU · WSPÓLNA PARTIA</p>
 <h2 id="undo-modal-title">Prośba o cofnięcie ruchu</h2>
 <p id="undo-modal-message">Użytkownik prosi o cofnięcie ruchu.</p>
 <div class="undo-modal-actions">
 <button type="button" id="undo-accept" class="undo-accept">Akceptuj</button>
 <button type="button" id="undo-reject" class="undo-reject">Odrzuć</button>
 </div>
 </div>
</div>
</body></html>`;
const css=String.raw`:root{color-scheme:dark;font-family:Inter,"Segoe UI",Arial,sans-serif;font-synthesis:none;--gold:#efca82;--teal:#51d6d3;--navy:#03171e;--line:#395f64}
*{box-sizing:border-box}html{background:#031519}body{margin:0;min-height:100dvh;color:#f1f9fc;background:#031519}
body:before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(ellipse 70% 70% at 74% 53%,#08747555,transparent 72%),linear-gradient(135deg,#021218,#05202b 50%,#03151d)}
a{color:inherit}button,select{font:inherit}button{cursor:pointer}button:disabled{opacity:.43;cursor:not-allowed}button:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid #86f6f1;outline-offset:3px}
.skip{position:absolute;z-index:50;top:-100px;left:10px;padding:11px;background:white;color:#101010}.skip:focus{top:10px}
.layout{display:grid;grid-template-columns:clamp(270px,27vw,370px) minmax(0,1fr);width:100%;height:100dvh;min-height:590px;max-width:1800px;margin:auto;isolation:isolate;overflow:hidden}


















select{width:100%;padding:12px 13px;background:linear-gradient(#0c2c31,#03171e);color:#f7f5f1;border:1px solid #f0c477;border-radius:10px;min-width:0;box-shadow:0 0 0 1px #e9bd5f2b}
select option{background:#102c34;color:#fff}

.primary,.secondary{display:inline-flex;align-items:center;justify-content:center;gap:11px;font-size:13px;font-weight:900;border-radius:11px;padding:12px 15px}
.primary{background:linear-gradient(180deg,#fff0be 0%,#f3c36d 57%,#cb9035 100%);border:1px solid #ffebb0;color:#1d1d16;box-shadow:inset 0 1px #fffdf0,0 0 0 1px #9b682d,0 5px 20px #d9973c60}
#restart{display:flex;width:100%;font-size:16px;border-radius:24px;padding:12px 20px}
.secondary{border:1px solid #4c888b;background:linear-gradient(#06333b,#031f28);color:#f3f9f8}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}.textlink{display:block;font-size:11px;color:#a4f0e6;line-height:1.5;margin-top:14px}
.muted{color:#9bb8bb!important;font-size:11px!important}

.boardarea{min-width:0;min-height:0;position:relative;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:clamp(8px,1.2vh,14px);padding:clamp(12px,2vh,22px) clamp(14px,2.2vw,32px) clamp(13px,1.8vh,20px);background:radial-gradient(ellipse 72% 60% at 59% 55%,#09656e39,transparent 75%),linear-gradient(145deg,#031719,#043139 55%,#031b25)}
.boardarea:before,.boardarea:after{content:"";position:absolute;pointer-events:none;z-index:-1;width:520px;height:240px;border-radius:50%;border-top:1px solid #41c6b367;filter:drop-shadow(0 0 12px #11bcc37c);transform:rotate(-23deg)}
.boardarea:before{left:-80px;bottom:16px}.boardarea:after{right:-190px;top:30px;transform:rotate(155deg)}
.players{display:grid;grid-template-columns:minmax(0,1fr) 64px minmax(0,1fr);gap:clamp(8px,1.5vw,22px);align-items:center;min-height:64px}
.player{display:flex;align-items:center;gap:13px;min-width:0;min-height:63px;padding:8px 16px;border-radius:18px;background:linear-gradient(130deg,#0a3b40,#021c21 70%,#07353a);border:1px solid #f5d498;box-shadow:inset 0 1px 2px #ffe6a17c,0 0 0 1px #eab7606a,0 0 22px #e5ae5440}
.player div{min-width:0}.player strong{font-size:clamp(15px,2vw,23px);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.player small{font-size:11px;display:block;color:#c6d7db;margin-top:3px}
.player .stone{width:42px;height:42px}.player-icon{font-size:24px;color:#f5ce84;margin-left:auto}
.stone{display:inline-block;flex:none;width:26px;height:26px;border-radius:50%;box-shadow:inset -4px -5px 7px #0008,0 2px 5px #0008}
.stone.black{background:radial-gradient(circle at 31% 22%,#aab2b5,#3b4348 27%,#0a1017 61%,#010203 89%)}
.stone.white{background:radial-gradient(circle at 31% 19%,#fff,#f3f6f8 39%,#d9e0e2 74%,#869296 99%)}
.versus{text-align:center;font-size:clamp(16px,2vw,26px);font-weight:950;color:#f3d089;letter-spacing:1px;text-shadow:0 0 10px #be8b45}
.state{padding:10px 18px;min-height:39px;display:grid;place-items:center;text-align:center;background:linear-gradient(105deg,#064343,#062e36 52%,#062b30);border:1px solid #cb9d50;border-radius:18px;color:#f8e0a9;font-size:clamp(11px,1.2vw,15px);font-weight:850;box-shadow:inset 0 1px #4e9c94a0}
.arena{display:grid;grid-template-columns:minmax(0,1fr) clamp(104px,11vw,160px);gap:clamp(10px,1.6vw,24px);min-height:0;align-items:center}
.board-center{min-width:0;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px}
.boardtop{display:flex;align-items:center;justify-content:center;gap:11px;min-height:23px}
.boardtop h2{font-size:11px;font-weight:700;color:#c4dde0;margin:0}.roomtag{border:1px solid #bd9555;color:#f8dca3;padding:3px 9px;border-radius:30px;font-size:9px;font-weight:800}
.boardframe{width:min(100%,calc(100dvh - 212px),720px);aspect-ratio:1;flex:none;padding:clamp(6px,.8vw,10px);margin:auto;border-radius:clamp(13px,1.6vw,23px);overflow:hidden}
.board{width:100%;height:100%;display:grid;grid-template-columns:repeat(15,minmax(0,1fr));grid-template-rows:repeat(15,minmax(0,1fr));border:2px solid #bcab8d;border-radius:10px;overflow:hidden;background:radial-gradient(circle at 34% 25%,#fff 0%,#f8f9f8 47%,#edf0ec 100%)}
.cell{border:0;padding:0;min-width:0;min-height:0;position:relative;display:grid;place-items:center;background:transparent}
.cell::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(to right,transparent calc(50% - .6px),#707778a8 calc(50% - .6px),#707778a8 calc(50% + .6px),transparent calc(50% + .6px)),linear-gradient(to bottom,transparent calc(50% - .6px),#707778a8 calc(50% - .6px),#707778a8 calc(50% + .6px),transparent calc(50% + .6px))}
.cell.edge-top::before{background:linear-gradient(to right,transparent calc(50% - .6px),#707778a8 calc(50% - .6px),#707778a8 calc(50% + .6px),transparent calc(50% + .6px)),linear-gradient(to bottom,transparent 50%,#707778a8 50%,#707778a8 calc(50% + .6px),transparent calc(50% + .6px))}
.cell.edge-bottom::before{background:linear-gradient(to right,transparent calc(50% - .6px),#707778a8 calc(50% - .6px),#707778a8 calc(50% + .6px),transparent calc(50% + .6px)),linear-gradient(to bottom,transparent calc(50% - .6px),#707778a8 calc(50% - .6px),#707778a8 50%,transparent 50%)}
.cell.edge-left::before{background:linear-gradient(to right,transparent 50%,#707778a8 50%,#707778a8 calc(50% + .6px),transparent calc(50% + .6px)),linear-gradient(to bottom,transparent calc(50% - .6px),#707778a8 calc(50% - .6px),#707778a8 calc(50% + .6px),transparent calc(50% + .6px))}
.cell.edge-right::before{background:linear-gradient(to right,transparent calc(50% - .6px),#707778a8 calc(50% - .6px),#707778a8 50%,transparent 50%),linear-gradient(to bottom,transparent calc(50% - .6px),#707778a8 calc(50% - .6px),#707778a8 calc(50% + .6px),transparent calc(50% + .6px))}
.cell.star:not(.occupied)::after{content:"";width:15%;height:15%;background:#b6975b;border-radius:50%;position:relative;z-index:1}
.cell.occupied::after{content:"";display:block;width:84%;height:84%;border-radius:50%;position:relative;z-index:2;box-shadow:inset -2px -3px 4px #0007,0 2px 4px #0006}
.cell.p1.occupied::after{background:radial-gradient(circle at 27% 19%,#9babb1,#313b42 29%,#060e14 64%,#000)}
.cell.p2.occupied::after{background:radial-gradient(circle at 27% 18%,#fff 0%,#fbfcfc 34%,#dfe6e8 76%,#98a2a7)}
.cell.last::after{outline:2px solid #d69f4e;outline-offset:1px}
.cell.suggested:not(.occupied){background:#31bbb455!important;box-shadow:inset 0 0 0 2px #008f92}
.cell:not(:disabled):hover{background:#c9e6df6e;cursor:pointer}.cell:focus-visible{outline:2px solid #078a91;outline-offset:-2px;z-index:3}
.game-tools{display:flex;flex-direction:column;justify-content:center;gap:clamp(9px,1.5vh,17px)}
.tool-btn{display:flex;align-items:center;justify-content:flex-start;gap:9px;width:100%;min-height:44px;text-align:left;border:1px solid #93baa9;border-radius:12px;color:#f6faf9;padding:8px 11px;background:linear-gradient(155deg,#0b4946,#05242d 77%);box-shadow:inset 0 1px #7cafa27a,0 7px 17px #0005;font-size:11px;font-weight:750;transition:transform .15s,border-color .15s}
.tool-btn:hover:not(:disabled){transform:translateY(-2px);border-color:#f4cf88}.tool-btn span{font-size:22px;color:#f3c676;min-width:27px;text-align:center}
.bottom{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:39px;color:#cfebeb}
.info-pill{border:1px solid #dfb66b;border-radius:22px;padding:9px 15px;background:linear-gradient(115deg,#073a3c,#021c22);font-size:12px;font-weight:800;white-space:nowrap}
.help{color:#c4dade;font-size:11px;line-height:1.45;text-align:center;margin:0}
.analysis-note{position:absolute;left:50%;bottom:70px;transform:translateX(-50%);z-index:5;max-width:80%;text-align:center;padding:11px 17px;color:#fff5d1;border:1px solid #c79b55;background:#07252bea;border-radius:12px;box-shadow:0 8px 20px #0007;font-size:12px}
[hidden]{display:none!important}
@media(max-width:1050px){.layout{grid-template-columns:260px minmax(0,1fr)}.arena{grid-template-columns:minmax(0,1fr) 112px}.boardframe{width:min(100%,calc(100dvh - 220px))}.player{padding:8px 10px}.player .stone{height:31px;width:31px}.player-icon{display:none}}
@media(max-width:800px){.layout{height:auto;min-height:100dvh;display:block;overflow:visible}.boardarea{min-height:0;padding:12px;gap:11px}.boardframe{width:min(100%,calc(100dvh - 210px),680px)}.arena{grid-template-columns:minmax(0,1fr) 115px}.players{min-height:50px}.player{min-height:53px}}
@media(max-width:560px){.players{grid-template-columns:minmax(0,1fr) 27px minmax(0,1fr);gap:5px}.player{min-height:46px;padding:5px 7px;gap:6px;border-radius:11px}.player .stone{width:24px;height:24px}.player strong{font-size:12px}.player small{font-size:9px}.versus{font-size:14px}.state{font-size:11px;min-height:36px}.arena{display:flex;flex-direction:column;gap:11px}.board-center{width:100%}.boardframe{width:100%;max-width:520px;border-width:2px;padding:6px}.game-tools{width:100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.tool-btn{min-height:40px;padding:7px;font-size:11px}.tool-btn span{font-size:20px}.bottom{gap:7px;flex-wrap:wrap}.info-pill{font-size:10px;padding:7px 10px}.help{order:3;width:100%;font-size:11px}.boardtop h2{font-size:10px}}
@media(max-height:700px) and (min-width:801px){.layout{min-height:560px}.boardframe{width:min(100%,calc(100dvh - 180px),650px)}.arena{gap:10px}.boardarea{gap:7px;padding:9px 15px}.players{min-height:53px}.player{min-height:51px}}

/* Premium in-game dock: move list, private match chat, functional tools */
.arena{grid-template-columns:minmax(0,1fr) clamp(236px,22vw,306px);gap:clamp(12px,1.5vw,23px)}
.side-dock{display:flex;flex-direction:column;min-height:0;max-height:min(100%,calc(100dvh - 152px));gap:12px;align-self:stretch;justify-content:center}
.match-panel{display:flex;flex-direction:column;min-height:220px;flex:1;max-height:520px;overflow:hidden;background:linear-gradient(150deg,#0c4244,#041e28 60%,#061b23);border:1px solid #c19a63;border-radius:16px;box-shadow:inset 0 1px #a9d6ca50,0 10px 24px #0006}
.dock-header{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:13px 14px 9px}.dock-eyebrow{font-size:10px;letter-spacing:1.3px;color:#f2d4a0;font-weight:900}.dock-live{font-size:10px;color:#86e8c9;font-weight:900}
.dock-tabs{display:grid;grid-template-columns:1fr 1fr;padding:4px;margin:0 10px 8px;border:1px solid #3f6971;border-radius:11px;background:#021923;gap:3px}
.dock-tab{padding:9px 3px;color:#aeced1;border:0;background:transparent;border-radius:8px;font-size:12px;font-weight:800}
.dock-tab.active{color:#16292b;background:linear-gradient(160deg,#ffe6af,#cda15c);box-shadow:0 1px 7px #e3b76e50}
.dock-content{display:flex;flex-direction:column;min-height:0;flex:1;padding:1px 13px 12px}
.dock-title{display:flex;align-items:center;justify-content:space-between;gap:5px;margin:4px 0 10px}.dock-title strong{font-size:12px}.dock-title>span{font-size:10px;color:#f4d594;border:1px solid #bd9567;border-radius:12px;padding:3px 8px}
.moves-list,.chat-messages{min-height:110px;flex:1;overflow-y:auto;scrollbar-color:#76979b #0a2a32;scrollbar-width:thin;border-radius:10px;padding:2px 3px 4px}
.dock-empty{font-size:12px;color:#a2bfc7;line-height:1.55;text-align:center;padding:25px 8px}
.move-row{display:grid;grid-template-columns:25px minmax(0,1fr) auto;gap:9px;align-items:center;margin:5px 0;padding:9px 7px;border:1px solid #31565b;border-radius:9px;background:linear-gradient(90deg,#153b46,#072731)}
.move-row.latest{border-color:#d8ae64;background:linear-gradient(90deg,#31534f,#102f34)}
.move-number{font-size:10px;font-weight:900;color:#b5cbd0}.move-player{display:flex;gap:8px;align-items:center;min-width:0}.move-player strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mini-stone{width:17px;height:17px;border-radius:50%;box-shadow:inset -3px -3px 4px #0009,0 1px 4px #0008;flex:none}.mini-stone.p1{background:radial-gradient(circle at 25% 25%,#9ea8b0,#131b22 60%,#020205)}.mini-stone.p2{background:radial-gradient(circle at 25% 25%,white,#e8eff1 60%,#a2afb8)}
.move-coordinate{font-size:12px;font-weight:900;color:#f3d292}
.history-footer{font-size:10px;color:#b4ced0;padding:10px 2px 0;border-top:1px solid #325c60;margin-top:7px}
.chat-messages{display:flex;flex-direction:column;gap:8px}
.chat-bubble{max-width:92%;padding:9px 11px;align-self:flex-start;background:#183d48;border:1px solid #498188;border-radius:13px 13px 13px 4px;overflow-wrap:anywhere}
.chat-bubble.own{align-self:flex-end;background:#54442a;border-color:#d0a866;border-radius:13px 13px 4px 13px}
.chat-bubble strong{display:block;font-size:10px;color:#f2d39a;margin-bottom:5px}.chat-bubble p{margin:0;font-size:12px;line-height:1.45;white-space:pre-wrap;color:#f6fbfa}.chat-bubble time{display:block;margin-top:6px;text-align:right;color:#a9c3c4;font-size:9px}
.chat-compose{display:flex;gap:6px;align-items:center;margin-top:9px}.chat-compose input{width:100%;min-width:0;height:39px;border:1px solid #4f838a;border-radius:9px;color:#ecf6f9;background:#041f2b;padding:8px;font:inherit;font-size:11px}.chat-compose button{border:1px solid #f6d995;border-radius:9px;background:linear-gradient(#ffe7ab,#d2a155);color:#142028;font-weight:950;padding:9px 11px}
.chat-footnote{font-size:10px;color:#a8c7c6;margin:7px 0 0;line-height:1.4}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
.side-dock .game-tools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;flex:none}
.side-dock .tool-btn{min-height:36px;padding:7px 8px;gap:5px;font-size:10px;border-radius:9px}.side-dock .tool-btn span{font-size:16px;min-width:18px}
@media(max-width:1150px) and (min-width:801px){.arena{grid-template-columns:minmax(0,1fr) 222px;gap:10px}.side-dock{max-height:calc(100dvh - 145px)}.dock-header{padding:9px}.dock-content{padding:0 8px 8px}.move-row{gap:5px;padding:8px 5px}.side-dock .tool-btn{font-size:9px}.boardframe{width:min(100%,calc(100dvh - 222px))}}
@media(max-width:800px){.arena{display:flex;flex-direction:column}.side-dock{width:100%;max-height:none;flex-direction:column}.match-panel{max-height:none;min-height:290px;height:340px;flex:none}.moves-list,.chat-messages{max-height:214px}.side-dock .game-tools{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.side-dock{width:100%;max-height:none}.match-panel{height:320px}.dock-tab{font-size:12px}.move-row{grid-template-columns:25px 1fr auto}.boardframe{max-width:520px}}

/* OWNER APPROVED GOMOKU FULL MAX PREMIUM: faithful 1648x925 three-column composition */
:root{--gold:#ffd47b;--gold-deep:#96601d;--cyan:#39d9d5;--ivory:#f9f9f8}
.layout{position:relative;grid-template-columns:27.5% minmax(0,1fr);width:100%;max-width:1920px;height:100dvh;min-height:590px;margin:0 auto;border-radius:clamp(16px,3.6vw,56px);border:1px solid #477f70;overflow:hidden;background:#01191d;box-shadow:inset 0 0 0 1px #c49b4a52,0 0 0 3px #001414}
.layout:after{content:"";pointer-events:none;position:absolute;inset:0;z-index:5;border-radius:inherit;box-shadow:inset 0 0 0 1px #cda75a75,inset 0 0 32px #09b7bd20;background:radial-gradient(ellipse 46% 18% at 96% -4%,#ffe19ba6,transparent 75%),radial-gradient(ellipse 40% 10% at 1% 103%,#dca54b7c,transparent 70%),radial-gradient(ellipse 55% 8% at 103% 101%,#ffd16f65,transparent 75%);opacity:.7}


























#restart{font-family:Georgia,"Times New Roman",serif;font-size:clamp(17px,1.7vw,26px);padding:10px;border:2px solid #fff1ae;border-radius:14px;background:linear-gradient(180deg,#ffe997 0%,#ffb92e 60%,#d38909 100%);box-shadow:inset 0 1px 2px #fff,0 0 14px #edac3b98,0 5px 10px #0007}
#restart span{font-family:Arial,sans-serif;font-size:24px}


.boardarea{z-index:1;position:relative;display:grid;grid-template-columns:minmax(0,1fr) clamp(290px,23vw,385px);grid-template-rows:68px 43px minmax(0,1fr) 58px;column-gap:clamp(14px,1.3vw,24px);row-gap:10px;padding:17px clamp(17px,1.3vw,25px);background:radial-gradient(ellipse 68% 85% at 54% 52%,#06696b58,transparent 78%),linear-gradient(120deg,#011c20,#042c2d 55%,#01151a)}
.boardarea:before{z-index:-1;opacity:.7;border-top:2px solid #29d3cf99;width:60%;height:20%;left:-10%;bottom:-8%;filter:drop-shadow(0 0 10px #00d4da)}
.boardarea:after{z-index:-1;opacity:.8;border-top:3px solid #f1c97f;width:60%;height:20%;right:-24%;top:-10%;filter:drop-shadow(0 0 15px #edba61)}
.players{grid-column:1;grid-row:1;grid-template-columns:minmax(0,1fr) 70px minmax(0,1fr);gap:8px;min-height:0}
.player{min-height:0;height:66px;padding:6px 16px;border-radius:20px;background:linear-gradient(145deg,#035959,#01181d 55%,#064c50);border:2px solid #ffe7a3;box-shadow:inset 0 0 0 2px #a56e21,0 0 0 1px #e8ad45,0 0 17px #ecc06a8c}
.player .stone{height:45px;width:45px;border:2px solid #d9ac55;box-shadow:0 0 12px #c28e41a0,inset -6px -6px 10px #0008}
.player strong{font-family:Georgia,"Times New Roman",serif;font-size:clamp(19px,1.65vw,27px);color:#fff}.player small{font-size:clamp(10px,.95vw,14px);color:#fff}
.player-icon{display:block;color:#f9c356;font-size:30px;text-shadow:0 0 7px #e6a33a}
.versus{font-family:Georgia,"Times New Roman",serif;font-size:27px;color:#ffce64;text-shadow:0 0 10px #ffc14e}
.state{grid-column:1;grid-row:2;min-height:0;padding:6px 13px;border-radius:15px;font-family:Georgia,"Times New Roman",serif;font-size:clamp(14px,1.18vw,20px);color:#f1e4bd;border:1px solid #37d7d7;background:linear-gradient(#075857,#011b20 82%);box-shadow:inset 0 1px 0 #a3f8e36e,0 4px 12px #0008}
.arena{display:contents}
.board-center{grid-column:1;grid-row:3;min-height:0;min-width:0;gap:0;justify-content:center}
.boardtop{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.boardframe{width:min(100%,calc(100dvh - 270px),750px);max-width:100%;aspect-ratio:1;padding:clamp(8px,.85vw,13px);border-radius:clamp(21px,2.3vw,33px)}
.board{background:radial-gradient(ellipse at 40% 35%,#fff 1%,#fafbfa 58%,#ededec);border:3px solid #72542e;border-radius:13px;box-shadow:inset 0 0 12px #9986694a}
.cell::before{background:linear-gradient(to right,transparent calc(50% - .65px),#434549c8 calc(50% - .65px),#434549c8 calc(50% + .65px),transparent calc(50% + .65px)),linear-gradient(to bottom,transparent calc(50% - .65px),#434549c8 calc(50% - .65px),#434549c8 calc(50% + .65px),transparent calc(50% + .65px))}
.cell.star:not(.occupied)::after{width:16%;height:16%;background:radial-gradient(circle at 30% 30%,#ffda7c,#c8881f);box-shadow:0 0 3px #f6ae33}
.cell.occupied::after{width:90%;height:90%;box-shadow:inset -3px -4px 5px #0009,0 2px 4px #0008,0 0 1px #000a}
.cell.p1.occupied::after{background:radial-gradient(circle at 27% 19%,#a7acb2 0%,#34393e 24%,#080d12 57%,#010103 95%)}
.cell.p2.occupied::after{background:radial-gradient(circle at 27% 18%,#fff 0%,#fff 35%,#dce3e7 68%,#899398 100%);box-shadow:inset -3px -4px 4px #0004,0 3px 5px #0006}
.bottom{grid-column:1;grid-row:4;min-height:0;align-items:center;gap:8px}
.info-pill{border:2px solid #fbd27f;background:linear-gradient(140deg,#074343,#03171e);color:#fff;font-family:Georgia,"Times New Roman",serif;font-size:clamp(15px,1.3vw,23px);padding:10px 20px;box-shadow:inset 0 1px #84f7db55,0 0 8px #dca7478a}
.help{font-size:11px;color:#a2cbcb}
.side-dock{grid-column:2;grid-row:1 / 5;align-self:stretch;justify-content:stretch;max-height:none;min-height:0;margin:54px 0 70px;padding:10px 10px 13px;gap:8px;border:2px solid #e6bd73;border-radius:25px;background:linear-gradient(145deg,#083f40,#02171c 55%,#041a1e);box-shadow:inset 0 0 0 2px #426b58,0 0 18px #ecac4060}
.match-panel{min-height:0;max-height:none;flex:1;border:0;background:none;border-radius:0;box-shadow:none;overflow:hidden}
.dock-header{height:0;padding:0;visibility:hidden;overflow:hidden}
.dock-tabs{flex:none;display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 8px;padding:0;border:0;background:none}
.dock-tab{border:1px solid #18d1cb;background:linear-gradient(160deg,#0b5050,#05292e);color:#fff;height:45px;border-radius:14px 14px 4px 4px;font-family:Georgia,"Times New Roman",serif;font-size:clamp(15px,1.15vw,19px);font-weight:bold}
.dock-tab.active{background:linear-gradient(180deg,#fff1b4,#f9bf45 58%,#b77913);border:2px solid #fff4b8;color:#191a15;box-shadow:inset 0 1px #fff,0 0 12px #ffbc44b5}
.chat-led{display:inline-block;width:8px;height:8px;border-radius:100%;background:#25ea7e;box-shadow:0 0 6px #32f38c}
.dock-content{padding:0 2px 5px;min-height:0;flex:1}
.dock-title{display:none}
.moves-list{min-height:0;border:1px solid #08b7b3;border-radius:11px;padding:3px 8px;background:#001b20;scrollbar-color:#dfc593 #09262a}
.move-row{height:clamp(22px,2.6vh,29px);margin:0;padding:0 6px;border:0;border-radius:0;border-bottom:1px solid #42656666;background:transparent;grid-template-columns:29px minmax(0,1fr) auto;gap:8px}
.move-row.latest{background:#1f514e75;border:0;border-bottom:1px solid #5f8d73}
.move-number{font-size:12px;color:#ecf4ec;font-weight:700}.move-player strong{font-size:12px;color:#fff}.move-coordinate{font-size:13px;color:#fff}.mini-stone{width:17px;height:17px}
.history-footer{display:none}
.mini-chat{display:flex;flex-direction:column;flex:0 0 clamp(178px,22vh,225px);min-height:0;border-top:1px solid #b785327d;padding:6px 1px 1px}
.chat-preview{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:7px;padding:4px 0}
.chat-preview .chat-bubble{max-width:94%;padding:5px 8px;border-radius:11px;background:linear-gradient(145deg,#0b6665,#082f3d)}
.chat-preview .chat-bubble.own{background:linear-gradient(140deg,#13696a,#03343b);align-self:flex-start}
.chat-preview .chat-bubble p{font-size:12px}.chat-preview .chat-bubble time{font-size:9px}
.chat-preview .dock-empty{padding:10px;color:#d3dbd6}
#chat-panel .chat-messages{max-height:none;min-height:0}
.chat-compose input{height:39px;padding:8px 11px;font-size:12px;background:linear-gradient(#031920,#03343a);border:1px solid #e7bb64;border-radius:13px}
.chat-compose button{font-size:18px;padding:7px 11px;border-radius:10px;background:linear-gradient(#fff5ba,#f2c343 62%,#ae7119)}
.chat-footnote{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.side-dock .game-tools{grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
.side-dock .tool-btn{height:clamp(64px,7.8vh,85px);min-height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:5px;padding:4px;border:1px solid #38d5c9;border-radius:15px;background:linear-gradient(#064747,#011b23 85%);color:#fff;font-size:clamp(10px,.78vw,13px);line-height:1.15;box-shadow:inset 0 1px #afe7cb44}
.side-dock .tool-btn span{font-size:clamp(20px,2.2vw,34px);min-width:0;line-height:1;color:#f3bd55;text-shadow:0 0 7px #e2ae378c}
@media(max-width:1190px) and (min-width:801px){.layout{grid-template-columns:27% minmax(0,1fr)}.boardarea{grid-template-columns:minmax(0,1fr) clamp(255px,25vw,320px);padding:10px;column-gap:10px}.side-dock{margin:45px 0 65px;padding:7px}.boardframe{width:min(100%,calc(100dvh - 236px))}.player{padding:5px 8px}}
@media(max-width:800px){.layout{display:block;width:100%;height:auto;min-height:100dvh;overflow:visible;border-radius:22px}.boardarea{display:flex;flex-direction:column;padding:12px;gap:10px}.players{width:100%;display:grid;grid-template-columns:1fr 40px 1fr}.player{height:57px}.arena{display:flex;flex-direction:column;gap:15px}.board-center{width:100%}.boardframe{width:min(100%,calc(100dvh - 165px),700px)}.boardtop{position:absolute}.side-dock{width:100%;margin:0;padding:12px;gap:10px;max-height:none;min-height:0}.match-panel{height:400px;min-height:350px;flex:none;max-height:none}.mini-chat{flex-basis:165px}.side-dock .game-tools{grid-template-columns:repeat(4,minmax(0,1fr))}.bottom{width:100%}.info-pill{font-size:15px}}
@media(max-width:560px){.layout{border-radius:15px}.boardarea{padding:10px}.players{grid-template-columns:1fr 26px 1fr;gap:5px}.player{height:50px;padding:5px}.player .stone{height:26px;width:26px}.player strong{font-size:13px}.player small{font-size:9px}.player-icon{display:none}.versus{font-size:15px}.boardframe{width:100%;padding:7px;border-radius:15px}.board{border-width:1px}.state{font-size:12px}.match-panel{height:370px}.mini-chat{flex-basis:145px}.side-dock .tool-btn{height:62px;font-size:9px;gap:3px}.side-dock .tool-btn span{font-size:22px}.bottom{flex-wrap:wrap}.info-pill{font-size:12px;padding:7px}.help{order:3;width:100%}}
@media(max-height:700px) and (min-width:801px){.layout{min-height:560px}.boardarea{grid-template-rows:54px 35px minmax(0,1fr) 44px;gap:6px;padding:8px 12px}.player{height:52px}.boardframe{width:min(100%,calc(100dvh - 192px))}.side-dock{margin:45px 0 46px}.mini-chat{flex-basis:155px}.side-dock .tool-btn{height:57px;min-height:54px}}


/* APPROVED REFERENCE R3 — measured against 1672×941 source artwork.
   Preserve live 15×15 interaction, game API and accessible controls. */
@media (min-width:801px) {

















 #restart{padding:7px 10px;font-size:clamp(19px,1.48vw,26px)}


 .boardarea{grid-template-columns:minmax(0,1fr) clamp(315px,23vw,390px);
    grid-template-rows:65px 42px minmax(0,1fr) 53px;
    padding:15px clamp(15px,1.45vw,24px);row-gap:9px;column-gap:clamp(12px,1.3vw,22px)}
 .boardframe{width:min(100%,calc(112dvh - 286px),680px);aspect-ratio:1.12;
    padding:clamp(8px,.85vw,13px)}
 .side-dock{margin:52px 0 58px;padding:9px;gap:7px}
 .match-panel{min-height:0}
 .mini-chat{flex-basis:clamp(165px,21vh,210px)}
 .chat-preview .chat-bubble p{font-size:clamp(10px,.87vw,13px)}
 .side-dock .tool-btn{height:clamp(61px,7.1vh,79px);min-height:55px}
 .move-row{height:clamp(20px,2.45vh,26px)}
 .dock-tab{height:43px}
}
@media (min-width:801px) and (max-height:740px) {







 .boardarea{grid-template-rows:53px 35px minmax(0,1fr) 44px;row-gap:6px;padding-top:8px;padding-bottom:8px}
 .player{height:52px}
 .boardframe{width:min(100%,calc(112dvh - 236px),630px)}
 .side-dock{margin:41px 0 44px}
 .mini-chat{flex-basis:145px}
 .side-dock .tool-btn{min-height:52px;height:52px}
}
@media (min-width:801px) and (max-width:1190px) {
 .boardarea{grid-template-columns:minmax(0,1fr) clamp(240px,24vw,290px)}
 .boardframe{width:min(100%,calc(112dvh - 286px),600px)}
 .side-dock{margin:44px 0 50px}
}
@media (max-width:800px) {
 .boardframe{width:min(100%,580px);aspect-ratio:1}


 .side-dock{margin:0}
 .side-dock .tool-btn{min-height:58px}
}
@media (min-width:801px) {
 .boardarea{background:
  radial-gradient(ellipse 55% 60% at 48% 53%,#0a6c6f6b,transparent 79%),
  linear-gradient(135deg,#00191d,#022e31 55%,#00151c)}
}
.layout{box-shadow:inset 0 0 0 1px #f4c4747d,0 0 0 3px #001716,0 0 45px #f2b7443d}
.boardarea:before{border-top:3px solid #38e8e7a6;filter:drop-shadow(0 0 15px #22e9e9);opacity:.95}
.boardarea:after{border-top:4px solid #ffda83;filter:drop-shadow(0 0 20px #ffd17c);opacity:1}
/* Polished gold: crisp layered bevels within the existing frame dimensions. */
.boardframe{border:3px solid;border-color:#fff0bd #a36a20 #805019 #f5d98c;
 background:linear-gradient(115deg,transparent 14%,#fff9d84d 18%,transparent 22%,transparent 61%,#fff9d826 65%,transparent 69%),
 linear-gradient(135deg,#fff9d8 0%,#f2ce76 12%,#bd842c 27%,#fff0b2 40%,#e1b053 54%,#b27a25 72%,#79501d 100%);
 box-shadow:inset 0 0 0 1px #80501c,inset 0 0 0 3px #f9df98,
 inset 0 0 0 4px #a46d23,inset 1px 1px 0 5px #fff0b5,inset -1px -1px 0 5px #80501c,
 0 0 0 1px #79501e,0 0 9px 1px #e7b65340,0 8px 16px #0007}
.board{background:radial-gradient(ellipse at 34% 20%,#fff 8%,#f9f9f8 64%,#ecece9 100%);
 border:3px solid;border-color:#71532d #bba577 #c8b487 #866333;
 box-shadow:inset 0 0 0 1px #e5dcc8}
.cell.p1.occupied::after{background:radial-gradient(circle at 28% 17%,#45494d 0%,#202327 14%,#090b0e 42%,#010205 78%);
 box-shadow:inset 0 1px 1px #ffffff24,inset -3px -4px 6px #000b,0 2px 4px #0009}
.cell.p2.occupied::after{background:radial-gradient(circle at 26% 18%,#fff 0%,#fff 31%,#e1e6e8 62%,#a3afb2 100%);
 box-shadow:inset 0 0 0 1px #78858c80,inset -3px -4px 5px #0003,0 2px 4px #0006}
.side-dock{border:2px solid #e9bf6b;box-shadow:inset 0 0 0 2px #47695e,0 0 13px #eeb95b85,0 8px 25px #000a}
.dock-tab.active{box-shadow:inset 0 2px #fff,0 0 14px #ffd06a8f}
.move-row{background:linear-gradient(90deg,#05272d,#001a20);border-bottom:1px solid #5577706d}
.chat-preview .chat-bubble{border-color:#35c2ba;background:linear-gradient(145deg,#0c6664,#032e35)}
.chat-preview .chat-bubble.own{border-color:#edc377;background:linear-gradient(145deg,#12555d,#05252e)}
.state{color:#ffe49c;text-shadow:0 0 8px #d8a44b7a;box-shadow:inset 0 1px #b5f1e77b,0 4px 14px #0008}
.bottom{position:relative}
.bottom:before{content:"";position:absolute;left:30%;right:30%;top:50%;height:2px;pointer-events:none;
 background:linear-gradient(90deg,transparent,#ffd278 50%,transparent);box-shadow:0 0 10px #f9bf4a;opacity:.7}
.bottom>*{position:relative;z-index:1}
#move-count:before{content:"▱";font-weight:900;font-size:1.22em;color:#ffc956;margin-right:10px}
#turn-label:before{content:"";display:inline-block;vertical-align:middle;width:20px;height:20px;margin-right:10px;border-radius:50%;
 background:radial-gradient(circle at 28% 20%,#a2aeb4,#202b31 40%,#020408 85%);border:1px solid #ecc471;
 box-shadow:0 0 8px #d6a94b,inset -3px -3px 4px #0008}




/* Premium global navigation, crisp vector grid and consent dialog */
.game-topbar{height:62px;display:flex;align-items:center;justify-content:space-between;gap:20px;
 padding:0 clamp(14px,2.4vw,40px);color:#f3f8f4;background:linear-gradient(100deg,#01151b 0%,#064346 52%,#02161c);
 border-bottom:2px solid #deaf5c;box-shadow:inset 0 1px #7dc0b73c,0 3px 16px #0008;position:relative;z-index:20}
.topbar-brand{font-size:clamp(19px,1.8vw,27px);font-weight:950;letter-spacing:-1px;white-space:nowrap;text-decoration:none}
.topbar-brand span{color:#ed3951}.topbar-brand b{font-size:9px;font-weight:900;letter-spacing:.4px;
 display:inline-block;vertical-align:middle;margin-left:9px;padding:5px 8px;color:#172022;border:1px solid #f9dda3;
 border-radius:12px;background:linear-gradient(#ffedba,#dba84f)}
.game-navigation{display:flex;align-items:center;justify-content:center;gap:clamp(10px,1.6vw,25px);min-width:0}
.game-navigation a{font-size:clamp(11px,.93vw,15px);font-weight:750;text-decoration:none;
 white-space:nowrap;padding:9px 2px;color:#e6f8f5;transition:color .14s,border-color .14s;border-bottom:2px solid transparent}
.game-navigation a:hover,.game-navigation a:focus-visible{color:#ffe3a1;border-color:#ffcf76}
.topbar-caption{font-size:10px;font-weight:900;letter-spacing:1.3px;color:#ffda91;white-space:nowrap}
.layout{height:calc(100dvh - 62px);min-height:525px;max-height:calc(100dvh - 62px)}
/* Opaque cells keep grid and stones consistent while moves are disabled. */
.board .cell{opacity:1}
/* One opaque 2px stroke per axis; edge variables also compose at corners. */
.board .cell::before{inset:-1px;background:
 linear-gradient(#363b3e,#363b3e) var(--grid-x,center) center / var(--grid-width,100%) 2px no-repeat,
 linear-gradient(#363b3e,#363b3e) center var(--grid-y,center) / 2px var(--grid-height,100%) no-repeat;
 filter:none;opacity:1}
.board .cell.edge-top{--grid-y:bottom;--grid-height:50%}
.board .cell.edge-bottom{--grid-y:top;--grid-height:50%}
.board .cell.edge-left{--grid-x:right;--grid-width:50%}
.board .cell.edge-right{--grid-x:left;--grid-width:50%}
.undo-modal[hidden]{display:none!important}
.undo-modal{position:fixed;inset:0;z-index:100;display:grid;place-items:center;
 background:#001519d6;backdrop-filter:blur(6px);padding:15px}
.undo-modal-card{position:relative;width:min(100%,470px);padding:29px 28px 31px;text-align:center;
 background:radial-gradient(circle at 50% 0%,#146363,#04272d 67%,#03191f);
 border:2px solid #f8d28f;border-radius:23px;box-shadow:inset 0 0 0 2px #bd8d48,0 0 30px #ecc36b8c,0 25px 80px #000b}
.undo-modal-symbol{font-size:39px;color:#ffcf7b;filter:drop-shadow(0 0 8px #e2a94b)}
.undo-modal-kicker{font-size:11px;letter-spacing:1.8px;color:#f1c57a;font-weight:900}
.undo-modal-card h2{font-family:Georgia,"Times New Roman",serif;font-size:clamp(23px,3vw,33px);
 color:#ffde9d;margin:13px 0}
.undo-modal-card p#undo-modal-message{font-size:16px;line-height:1.5;color:#f4ffff;margin:13px 0 23px}
.undo-modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.undo-modal-actions button{min-height:47px;border-radius:11px;font-size:15px;font-weight:900}
.undo-accept{background:linear-gradient(#fff0b8,#e7b24f);color:#132a2a;border:1px solid #fff5c5;
 box-shadow:0 0 11px #e4b5576b}
.undo-reject{background:linear-gradient(#0b4a50,#03262f);color:#f3fff9;border:1px solid #47d0c3}
#undo-label{font-size:inherit;font-weight:inherit;min-width:0}
@media(min-width:801px){.boardarea{grid-template-rows:60px 38px minmax(0,1fr) 45px}
 .boardframe{width:min(100%,calc(100dvh - 355px),660px)}
 .side-dock{margin:43px 0 49px}
 .side-dock .tool-btn{min-height:55px;height:60px}
}
@media(max-width:1050px){.game-topbar{gap:10px}.topbar-caption{display:none}
 .game-navigation{gap:12px}}
@media(max-width:800px){.game-topbar{height:auto;min-height:60px;flex-wrap:wrap;gap:5px;padding:7px 12px}
 .topbar-brand{font-size:20px}.game-navigation{width:100%;justify-content:flex-start;overflow-x:auto;scrollbar-width:thin;gap:17px}
 .game-navigation a{font-size:12px;padding:5px 1px}
 .layout{height:auto;max-height:none;min-height:100dvh}.boardframe{width:min(100%,560px)}
}


/* Gomoku board viewport fit R4: use the ACTUAL available grid row instead
   of subtracting a fixed 355px from dvh (which shrank the board on laptops). */
@media (min-width:801px) {
 .boardarea{
  grid-template-rows: minmax(52px,7vh) minmax(34px,5vh) minmax(0,1fr) 45px;
  row-gap:6px;
  padding:9px clamp(10px,1vw,18px);
  column-gap:clamp(10px,1.1vw,19px);
 }
 .board-center{
  grid-column:1;grid-row:3;
  width:100%;height:100%;min-width:0;min-height:0;
  display:grid;place-items:center;
  overflow:visible;
 }
 .boardframe{
  width:auto;
  height:100%;
  min-width:0;
  max-width:100%;
  max-height:100%;
  aspect-ratio:1.12;
  flex:none;
  margin:0;
 }
}
@media (min-width:801px) and (max-height:650px) {
 .boardarea{
  grid-template-rows:50px 34px minmax(0,1fr) 40px;
  row-gap:5px;
  padding:7px 11px;
 }
 .side-dock{margin-top:35px;margin-bottom:37px}
}
@media (max-width:800px) {
 .board-center{
  width:100%;height:auto;min-height:0;
  display:flex;justify-content:center;align-items:center;
 }
 .boardframe{
  width:100%;height:auto;
  max-width:620px;
  max-height:none;
  aspect-ratio:1;
  margin:0 auto;
 }
}


/* Compact Premium navigation: five golden pictograms at player-bar height.
   No extra top header; keep maximum available space for the live Gomoku board. */
.layout{height:100dvh;max-height:100dvh}
@media (min-width:801px){
 .boardarea{padding-top:28px}
 .premium-quick-links{grid-column:2;grid-row:1;align-self:center;justify-self:center;
  display:flex;align-items:center;gap:clamp(4px,.45vw,8px);z-index:8}
 .side-dock{margin-top:72px}
}
.premium-quick-links{display:flex;align-items:center;justify-content:center;gap:6px;position:relative;z-index:8}
.premium-mini-link{display:grid;place-items:center;position:relative;flex:0 0 auto;
 width:clamp(32px,2.4vw,39px);height:clamp(32px,2.4vw,39px);
 border:1px solid #f9cd71;border-radius:9px;color:#ffda78;text-decoration:none;
 background:linear-gradient(145deg,#0b4745,#031b24 72%);
 box-shadow:inset 0 1px #fff1b04f,0 0 9px #eaba5e5c;
 transition:box-shadow .15s,transform .15s,border-color .15s}
.premium-mini-link svg{width:21px;height:21px;display:block;filter:drop-shadow(0 0 2px #e5b65f69)}
.premium-mini-link:hover,.premium-mini-link:focus-visible{border-color:#ffeba9;color:#fff0b4;
 transform:translateY(-1px);box-shadow:inset 0 1px #fff4c181,0 0 16px #ffc75a9e}
.premium-mini-link::after{content:attr(data-tooltip);position:absolute;left:50%;bottom:calc(100% + 7px);
 transform:translate(-50%,5px);padding:8px 12px;white-space:nowrap;pointer-events:none;
 border:1px solid #f5cd7b;border-radius:9px;color:#ffe7ab;
 font:750 12px/1.2 Inter,"Segoe UI",Arial,sans-serif;letter-spacing:.1px;
 background:linear-gradient(135deg,#06383a,#021822);box-shadow:0 0 14px #daa84c75,0 8px 20px #0008;
 opacity:0;visibility:hidden;transition:opacity .15s,transform .15s,visibility .15s;z-index:50}
.premium-mini-link:is(:hover,:focus-visible)::after{opacity:1;visibility:visible;transform:translate(-50%,0)}
@media (max-width:800px){
 .layout{height:auto;max-height:none}
 .premium-quick-links{width:100%;justify-content:center;gap:8px;margin:3px 0 8px;order:0}
 .premium-mini-link{width:39px;height:39px}
 .premium-mini-link::after{bottom:auto;top:calc(100% + 6px)}
}
@media(prefers-reduced-motion:reduce){.premium-mini-link,.premium-mini-link::after{transition:none}}


/* Premium Gomoku micro-toolbars and real modal controls. */
.versus{display:flex;align-items:center;justify-content:center;gap:2px;white-space:nowrap}
.vs-laurel{font-size:clamp(13px,1.4vw,22px);color:#ffda83;filter:drop-shadow(0 0 4px #d09b41)}
.dock-tabs{direction:ltr}
.side-dock .game-tools{display:flex;justify-content:center;flex-wrap:nowrap;gap:clamp(3px,.38vw,7px);padding:3px 0 0}
.side-dock .game-tools .tool-btn{position:relative;flex:1 1 0;min-width:0;max-width:49px;height:clamp(28px,2.9vw,38px);
 min-height:28px;padding:2px;display:grid;place-items:center;gap:0;overflow:visible;
 border:1px solid #eac178;border-radius:9px;background:linear-gradient(#0b4946,#031d27);color:#ffe09d}
.side-dock .game-tools .tool-btn span:not(.sr-only){font-size:clamp(16px,1.6vw,23px);line-height:1;min-width:0}
.side-dock .game-tools .tool-btn:is(:hover,:focus-visible):not(:disabled){border-color:#ffe7b2;box-shadow:0 0 13px #efbd5994}
.side-dock .game-tools .tool-btn::after{content:attr(data-tooltip);position:absolute;bottom:calc(100% + 8px);
 left:50%;transform:translate(-50%,5px);font:700 11px/1.3 Inter,"Segoe UI",sans-serif;
 white-space:nowrap;background:linear-gradient(#0d4344,#031e28);border:1px solid #edbf6b;
 border-radius:9px;color:#ffe5a8;padding:7px 9px;box-shadow:0 0 16px #e4b14b80;
 opacity:0;visibility:hidden;pointer-events:none;transition:opacity .15s,transform .15s;z-index:40}
.side-dock .game-tools .tool-btn:is(:hover,:focus-visible)::after{opacity:1;visibility:visible;transform:translate(-50%,0)}
.premium-overlay[hidden]{display:none!important}
.premium-overlay{position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:#00171adc;padding:12px}
.premium-popup{position:relative;width:min(100%,470px);max-height:85dvh;overflow-y:auto;border:2px solid #e8bc6f;
 border-radius:22px;padding:24px;color:#f6fafa;background:linear-gradient(150deg,#0d4948,#031b25);
 box-shadow:inset 0 0 0 1px #75baa764,0 0 24px #e0ac5770,0 20px 55px #000b}
.popup-close{position:absolute;right:13px;top:9px;background:transparent;color:#ffdf9d;border:0;font-size:28px}
.premium-eyebrow{font-size:10px;font-weight:900;letter-spacing:1.5px;color:#f4c774}
.premium-popup h2{font:700 27px Georgia,serif;color:#ffe2a3;margin:4px 0 12px}
.player-actions-list{display:grid;gap:7px;margin-top:14px}
.player-actions-list .friend-row{display:flex;align-items:center;justify-content:space-between;gap:8px;
 padding:10px 11px;background:#05262c;border:1px solid #467e78;border-radius:11px}
.friend-row strong{font-size:13px}.friend-row small{font-size:11px;margin-left:8px;color:#acbab9}
.friend-row small.online{color:#72f6af}
.friend-row button,.premium-confirm{padding:9px 12px;border:1px solid #ffe1a1;border-radius:10px;color:#172624;
 background:linear-gradient(#ffe6a4,#ddb052);font-size:12px;font-weight:900}
.friend-row button:disabled{opacity:.45}
.premium-muted{font-size:12px;color:#b6d2d3;line-height:1.5}
.chat-settings-grid{display:grid;gap:12px;margin:14px 0}
.chat-settings-grid>label{font-size:13px}
.chat-settings-grid .premium-option{display:flex;align-items:center;gap:9px}
.chat-settings-grid input[type=checkbox]{accent-color:#e7bd67;width:17px;height:17px}
.chat-settings-grid select{font-size:12px}
@media(max-width:560px){
 .side-dock .game-tools{gap:4px}
 .side-dock .game-tools .tool-btn{height:37px;min-height:34px}
 .side-dock .game-tools .tool-btn span:not(.sr-only){font-size:21px}
}


/* R5: faithful MINIATURE (vs) motif, never oversize VS */
.players .versus{
 display:flex;align-items:center;justify-content:center;
 padding:0;min-width:0;overflow:visible;
 font:700 clamp(11px,.86vw,15px)/1 Georgia,"Times New Roman",serif;
 letter-spacing:0;text-transform:none;color:#ffe29a;text-shadow:0 0 5px #f2c56a7f;
}
.players .versus .versus-medallion{
 position:relative;display:inline-flex;align-items:center;justify-content:center;
 white-space:nowrap;font-size:inherit;line-height:1;
 padding:5px 9px;border-radius:50%;
 background:radial-gradient(ellipse at center,#0d404054,transparent 75%);
 filter:drop-shadow(0 0 3px #edba6b65);
}
.players .versus .versus-medallion::before,.players .versus .versus-medallion::after{
 content:"❧";position:absolute;top:50%;font:700 10px/1 Georgia,serif;
 color:#f3ce81;text-shadow:0 0 3px #e3ad49;white-space:nowrap
}
.players .versus .versus-medallion::before{right:calc(100% - 11px);transform:translateY(-48%) rotate(-30deg)}
.players .versus .versus-medallion::after{left:calc(100% - 11px);transform:translateY(-48%) scaleX(-1) rotate(-30deg)}
/* R5: one horizontal row of seven tiny golden tool icons at ALL widths */
.side-dock .game-tools{
 display:grid;grid-template-columns:repeat(7,minmax(0,1fr));
 width:100%;min-width:0;max-width:100%;
 flex-wrap:nowrap;align-items:center;justify-items:stretch;
 gap:clamp(3px,.33vw,5px);padding:4px 0 0;
}
.side-dock .game-tools .tool-btn{
 position:relative;display:grid;place-items:center;
 width:100%;height:clamp(31px,2.35vw,37px);
 min-height:31px;min-width:0;max-width:none;
 flex:none;gap:0;padding:0;
 border:1px solid #e5b968;border-radius:8px;
 background:linear-gradient(145deg,#07524e,#041d29 80%);
 color:#f9d485;
 box-shadow:inset 0 1px #f1dca33d,0 0 5px #dca64759;
 overflow:visible;
}
.side-dock .game-tools .tool-btn span:not(.sr-only){
 display:block;font-size:clamp(16px,1.45vw,21px);line-height:1;min-width:0;
}
.side-dock .game-tools .tool-btn:is(:hover,:focus-visible){z-index:20}
.side-dock .game-tools .tool-btn::after{z-index:60}
@media(max-width:800px){
 .side-dock .game-tools{
  display:grid;grid-template-columns:repeat(7,minmax(0,1fr));
  width:100%;gap:clamp(3px,1vw,6px);
 }
 .side-dock .game-tools .tool-btn{
  width:100%;height:clamp(34px,7vw,42px);min-height:34px;max-width:none;
 }
 .side-dock .game-tools .tool-btn span:not(.sr-only){font-size:clamp(18px,4vw,23px)}
 .players .versus .versus-medallion{padding:4px 7px}
 .players .versus .versus-medallion::before,.players .versus .versus-medallion::after{font-size:8px}
}


/* Full Max Premium R6: golden laurel VS reference and functional Chat Control Center */
.players{grid-template-columns:minmax(0,1fr) clamp(78px,5.6vw,100px) minmax(0,1fr)}
.players .versus{display:flex;align-items:center;justify-content:center;min-width:0;padding:0;overflow:visible;
 color:#f9d577;filter:none;text-shadow:none}
.players .versus .versus-emblem{display:block;width:clamp(74px,5.5vw,100px);max-width:100%;height:auto;max-height:100%;aspect-ratio:3/2}
.chat-control-panel{width:min(96vw,820px);max-height:calc(100dvh - 28px);padding:clamp(15px,2.5vw,29px);
 background:radial-gradient(ellipse 55% 45% at 80% -15%,#0e7a6b81,transparent 95%),
  linear-gradient(150deg,#0c4b4c,#031e27 56%,#061b22 100%);
 border:2px solid #f0c876;border-radius:25px;
 box-shadow:inset 0 0 0 1px #b2e4c842,inset 0 1px #ffeda268,0 0 34px #e4b7587e,0 26px 75px #000b}
.chat-control-header{display:flex;align-items:center;gap:18px;padding:2px 38px 15px 0}
.chat-control-icon{width:57px;height:57px;flex:none;display:grid;place-items:center;
 border:1px solid #e7bd6e;border-radius:17px;font-size:33px;color:#ffdc8d;
 background:linear-gradient(135deg,#165d56,#032a31);box-shadow:inset 0 1px #afedd97a,0 0 15px #e0b74b6b}
.chat-control-header h2{font:700 clamp(26px,3vw,38px)/1.1 Georgia,"Times New Roman",serif;
 margin:5px 0 6px;color:#ffe0a1;text-shadow:0 0 12px #e8b66164}
.chat-control-header #chat-settings-intro{font-size:12px;line-height:1.55;color:#bdd6d6;margin:0}
.chat-control-status{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:11px 16px;margin-bottom:16px;
 background:linear-gradient(90deg,#0b5b55,#042a32);border:1px solid #479c87;border-radius:12px}
.chat-control-led{width:9px;height:9px;flex:none;background:#56f1a7;border-radius:50%;box-shadow:0 0 7px #67f8a4}
.chat-control-status strong{font-size:13px;color:#f8e0ae}
.chat-control-status>span:last-child{font-size:12px;color:#bde7e1}
.chat-settings-sections{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:stretch}
.chat-settings-section{border:1px solid #467774;border-radius:14px;margin:0;min-width:0;padding:14px 14px 11px;
 background:linear-gradient(160deg,#092f35dc,#03262edc);box-shadow:inset 0 1px #79d4b625}
.chat-settings-section legend{font:700 18px Georgia,"Times New Roman",serif;color:#ffe0a1;padding:0 4px}
.chat-settings-section legend span{color:#f2bd65;font-size:18px;margin-right:6px}
.chat-settings-desc{font-size:11px;line-height:1.4;color:#b2cfd1;margin:0 0 10px}
.chat-switch,.chat-select-label{display:flex;align-items:center;justify-content:space-between;gap:13px;
 min-height:52px;padding:9px 3px;border-bottom:1px solid #5a7d7250;cursor:pointer}
.chat-switch:last-child{border-bottom:0}
.chat-switch span,.chat-select-label span{display:grid;gap:4px;min-width:0}
.chat-switch strong,.chat-select-label strong{font-size:12px;font-weight:800;color:#f4ffff}
.chat-switch small,.chat-select-label small{color:#a8c8cb;font-size:10px;line-height:1.3}
.chat-switch input{width:37px;height:21px;flex:none;appearance:none;position:relative;border:1px solid #6c9893;
 border-radius:16px;background:#173840;cursor:pointer;transition:background .16s,border-color .16s}
.chat-switch input:before{content:"";position:absolute;left:3px;top:3px;width:13px;height:13px;
 background:#b5c7c6;border-radius:50%;box-shadow:0 1px 3px #0008;transition:transform .16s}
.chat-switch input:checked{background:linear-gradient(#ffdf9c,#dba34c);border-color:#ffe4a9}
.chat-switch input:checked:before{background:#173c3d;transform:translateX(16px)}
.chat-switch input:focus-visible,.chat-select-label select:focus-visible{outline:2px solid #66f1de;outline-offset:2px}
.chat-select-label select{max-width:134px;min-width:114px;font-size:11px;border-radius:9px;padding:9px 7px;
 color:#ffe5aa;border:1px solid #ba9556;background:#092d35}
.chat-sound-test{margin-top:11px;border:1px solid #edbc6a;border-radius:9px;padding:9px 13px;
 color:#ffe4a6;font-size:11px;font-weight:850;background:linear-gradient(#15524c,#062d32)}
.chat-sound-test:hover{box-shadow:0 0 11px #f1c16c94}
.chat-privacy-strip{display:flex;align-items:flex-start;gap:12px;margin:14px 0;
 border:1px solid #6b895a86;border-radius:11px;padding:13px;background:#1c474042}
.chat-privacy-strip>span{color:#f6c775;font-size:24px;line-height:1}
.chat-privacy-strip strong{font-size:12px;color:#ffe4ae}
.chat-privacy-strip p{font-size:11px;color:#bcd8d7;line-height:1.4;margin:4px 0 0}
.chat-settings-actions{display:flex;justify-content:space-between;gap:12px;align-items:center}
.chat-settings-actions button{min-height:43px;padding:10px 17px;border-radius:10px;font-size:12px;font-weight:900}
.chat-settings-reset{border:1px solid #89b8ae;background:#0d3b41;color:#f1faf7}
.chat-settings-reset:hover{border-color:#f3d082;color:#ffe3a9}
.chat-settings-actions .premium-confirm{min-width:178px;background:linear-gradient(#ffe6a3,#dfaa4c);
 box-shadow:inset 0 1px #fff3d5,0 0 12px #e6b85e6b}
.chat-messages[hidden],.chat-preview[hidden]{display:none!important}
.chat-messages.chat-compact .chat-bubble,.chat-preview.chat-compact .chat-bubble{padding:5px 7px}
.chat-messages.chat-compact{gap:4px}.chat-preview.chat-compact{gap:3px}
.chat-messages.chat-font-small .chat-bubble p,.chat-preview.chat-font-small .chat-bubble p{font-size:10px}
.chat-messages.chat-font-normal .chat-bubble p,.chat-preview.chat-font-normal .chat-bubble p{font-size:12px}
.chat-messages.chat-font-large .chat-bubble p,.chat-preview.chat-font-large .chat-bubble p{font-size:15px;line-height:1.55}
@media(max-width:700px){
 .chat-control-panel{max-height:calc(100dvh - 16px);width:100%;padding:17px}
 .chat-control-header{gap:10px;padding-right:25px}
 .chat-control-icon{width:43px;height:43px;font-size:26px}
 .chat-settings-sections{grid-template-columns:minmax(0,1fr);gap:15px}
 .chat-control-status{margin-bottom:13px}
 .chat-control-header #chat-settings-intro{font-size:11px}
}
@media(max-width:560px){
 .players{grid-template-columns:minmax(0,1fr) 46px minmax(0,1fr)}
 .players .versus .versus-emblem{width:44px}
 .chat-settings-actions .premium-confirm{min-width:0}
}
@media(prefers-reduced-motion:reduce){.chat-switch input,.chat-switch input:before{transition:none}}


/* Full Max Premium: game outcome announcement, winner-specific and accessible. */
.result-overlay[hidden]{display:none!important}
.result-overlay{position:fixed;inset:0;z-index:125;display:grid;place-items:center;padding:16px;
 background:#00141ae9;backdrop-filter:blur(5px)}
.result-card{position:relative;width:min(100%,490px);padding:clamp(22px,3vw,35px);
 display:flex;flex-direction:column;align-items:center;gap:11px;text-align:center;
 border:2px solid #fbe09a;border-radius:26px;color:#f9ffff;
 background:radial-gradient(ellipse at 50% 0%,#14615f,#05272d 65%,#03191f);
 box-shadow:inset 0 0 0 2px #ab7937,inset 0 1px #fff5d0a5,0 0 36px #ffcd6f7a,0 24px 65px #000b}
.result-card:before{content:"";position:absolute;inset:8px;pointer-events:none;
 border:1px solid #a8d7ad4e;border-radius:19px}
.result-close{position:absolute;top:10px;right:14px;border:0;background:none;color:#ffe8b7;font-size:27px}
.result-brand{font-size:11px;font-weight:950;letter-spacing:1.1px;color:#f1f7f5}
.result-brand b{display:inline-block;color:#15272a;font-size:9px;letter-spacing:0;
 border-radius:8px;padding:3px 8px;background:linear-gradient(135deg,#fff2b8,#dfaa51)}
.result-medal{display:grid;place-items:center;width:83px;height:83px;margin:4px 0 0;
 border-radius:50%;font-size:43px;color:#ffdb85;border:2px solid #f9d68f;
 background:radial-gradient(circle at 30% 20%,#197574,#02242c 75%);
 box-shadow:inset 0 0 0 5px #02353b,0 0 0 2px #7f5327,0 0 22px #eebc5b96}
.result-eyebrow{font-size:11px;letter-spacing:2px;font-weight:900;color:#f7ca75}
.result-card h2{font:750 clamp(25px,3.3vw,38px)/1.13 Georgia,"Times New Roman",serif;
 color:#ffe0a1;text-shadow:0 0 12px #e1af5591;margin:3px 0}
.result-card p#game-result-description{font-size:14px;line-height:1.55;color:#ebf6f3;margin:0 0 7px}
.result-start{width:100%;min-height:56px;padding:12px 17px;border:2px solid #fff3bc;
 border-radius:13px;background:linear-gradient(#fff0b4,#f3c05a 58%,#ce8d2a);
 color:#1b2724;font-size:clamp(15px,2vw,19px);font-weight:950;
 box-shadow:inset 0 1px #fff9e6,0 0 14px #eeb64c85}
.result-start:hover{filter:brightness(1.07);box-shadow:inset 0 1px #fff9e6,0 0 22px #efbe58b9}
.result-review{padding:8px 13px;color:#bde9e1;border:0;background:none;
 font-size:12px;text-decoration:underline;text-underline-offset:4px}
.result-online-hint{font-size:11px;line-height:1.45;color:#accdca;margin:0}
.result-card[data-result="loss"] .result-medal{color:#f4bd70;filter:saturate(.8)}
.result-card[data-result="draw"] .result-medal{color:#dcf6ed;filter:saturate(.75)}
@media(max-width:560px){.result-card{padding:24px 20px}.result-medal{width:67px;height:67px;font-size:36px}}


/* Local, independent time controls for the non-ranking computer training mode */



/* Real server-authoritative time controls for accepted Gomoku rooms */







/* R11: player content fits the existing gold frame without changing board geometry. */
.players{container:players / inline-size}
.player{container:player-panel / inline-size;gap:clamp(3px,.6vw,9px);padding:6px 8px}
.player>div{flex:1;min-width:0;line-height:1.2}
.player strong{font-size:clamp(12px,7cqi,27px);line-height:1.15}
.player small{font-size:clamp(8px,4cqi,12px);line-height:1.2;margin-top:3px;white-space:nowrap}
.player .stone{flex:none;width:clamp(20px,10cqi,40px);height:clamp(20px,10cqi,40px)}
.player .player-icon{flex:none;margin-left:0;font-size:24px;line-height:1}
.player .player-clock{flex:none;font:800 clamp(10px,5cqi,16px)/1.1 "Segoe UI",sans-serif;
 font-variant-numeric:tabular-nums;letter-spacing:0;white-space:nowrap;color:#ffe5a6;
 padding:5px 6px;border:1px solid #e5ba6b;border-radius:8px;
 background:linear-gradient(#063f40,#031e27);box-shadow:0 0 9px #d8a34f54}
.player .player-clock[hidden]{display:none!important}
.player .player-clock.clock-running{border-color:#a5f2dc;color:#c3fff0;box-shadow:0 0 11px #2be8cc6b}
.player .player-clock.clock-warning{border-color:#ffad67;color:#ffb376;background:#462018}
.player .player-clock.clock-expired{border-color:#ff7878;color:#ff9797}
@container player-panel (max-width:300px){.player .player-icon{display:none}}
@container players (max-width:450px){
 .player{display:grid;grid-template-columns:18px minmax(0,1fr) auto;
  grid-template-rows:auto auto;align-content:center;gap:2px 3px;padding:3px}
 .player>div{display:contents}
 .player .stone{grid-column:1;grid-row:1;width:18px;height:18px}
 .player strong{grid-column:2;grid-row:1;align-self:center;font-size:clamp(11px,8cqi,14px)}
 .player small{grid-column:1 / 3;grid-row:2;margin:0;font-size:8px;line-height:1.15;white-space:normal}
 .player .player-clock{grid-column:3;grid-row:1 / 3;font-size:10px;padding:4px 3px}
}

.replay-shortcut{margin:0 0 6px;text-align:center}.replay-shortcut button{width:100%;min-height:29px;border:1px solid #aa8a51;border-radius:8px;background:linear-gradient(135deg,#0c5558,#052635);color:#fbe4a1;font:700 11px "Segoe UI",sans-serif}.replay-shortcut button:disabled{opacity:.5}

.replay-overlay{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;overflow-y:auto;background:#000b;padding:12px}.replay-overlay[hidden]{display:none!important}.replay-card{width:min(94vw,570px);max-height:96dvh;overflow:auto;background:linear-gradient(145deg,#073b43,#031925);border:2px solid #ddb772;border-radius:19px;padding:clamp(12px,2vw,23px);box-shadow:0 25px 85px #000e,0 0 50px #00766a3c;color:#ecf9f5}.replay-header{display:flex;align-items:start;justify-content:space-between;gap:10px}.replay-kicker{font-size:10px;letter-spacing:1.1px;color:#ffd987}.replay-header h2{font:700 clamp(18px,2.5vw,27px) Georgia,serif;color:#ffe5a8;margin:4px 0 8px}.replay-close{border:1px solid #d5ad66;border-radius:9px;background:#082a32;color:#ffe4b6;font-size:27px;width:38px;height:38px;flex:none}.replay-status{font-size:13px;text-align:center;color:#d5eae7;margin:6px 0 10px}.replay-board{display:grid;grid-template-columns:repeat(15,minmax(0,1fr));grid-template-rows:repeat(15,minmax(0,1fr));width:min(100%,420px);aspect-ratio:1;margin:0 auto;border:5px solid #d7ac68;border-radius:10px;overflow:hidden;background:#f6f4ea;box-shadow:0 9px 24px #0008}.replay-cell{min-width:0;min-height:0;display:grid;place-items:center;border-right:1px solid #787b73;border-bottom:1px solid #787b73;position:relative}.replay-cell.stone-black:after,.replay-cell.stone-white:after{content:"";width:79%;height:79%;border-radius:50%;z-index:1;box-shadow:inset -3px -4px 5px #0008,0 2px 5px #0007}.replay-cell.stone-black:after{background:radial-gradient(circle at 30% 25%,#606873,#11151b 58%,#000)}.replay-cell.stone-white:after{background:radial-gradient(circle at 30% 25%,#fff,#f2f6f7 65%,#a8b4bd)}.replay-cell.is-last{background:#dec58a}.replay-controls{display:grid;grid-template-columns:48px 48px minmax(64px,1fr) 48px 48px;align-items:center;justify-content:center;gap:7px;margin:14px auto 5px;max-width:400px}.replay-controls button{height:39px;border:1px solid #e5bf75;background:linear-gradient(#116060,#05313c);color:#ffefa9;border-radius:10px;font-size:17px}.replay-controls button:disabled{opacity:.32}.replay-controls span{text-align:center;font-weight:800;font-variant-numeric:tabular-nums}.replay-footnote{font-size:11px;text-align:center;color:#aacbc5;margin:10px 0 0}
@media(max-width:560px){.replay-card{width:100%;padding:11px}.replay-board{width:min(100%,calc(92dvh - 205px))}.replay-controls{grid-template-columns:40px 40px minmax(50px,1fr) 40px 40px;gap:4px}}

/* R12: one sidebar design system; native disclosures keep guidance accessible. */
.sidebar{display:flex;flex-direction:column;gap:10px;min-height:0;overflow-y:auto;overflow-x:hidden;
 padding:clamp(12px,1.5vh,18px) clamp(12px,1.4vw,24px);scrollbar-width:thin;
 background:radial-gradient(ellipse at 0 0,#0b535b66,transparent 60%),linear-gradient(150deg,#031a27,#032b30);
 border-right:1px solid #426569;box-shadow:inset -6px 0 18px #0004;position:relative;z-index:1}
.sidebar>*{flex:none;min-width:0}
.side-header{margin:0;position:relative}
.gomoku-heading{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;padding:2px 0 4px;
 background:radial-gradient(ellipse 80% 90% at 48% 10%,#a7822121,transparent 72%)}
.gomoku-heading-title{display:flex;align-items:baseline;justify-content:center;gap:.22em;white-space:nowrap;min-width:0;width:100%;margin:0;
 font:700 clamp(24px,2.35vw,36px)/1.08 Georgia,"Times New Roman",serif;letter-spacing:-.055em}
.gomoku-heading-gold{color:#ffe49b;text-shadow:0 0 11px #caa24c66,0 1px 0 #fff4ce7a}
.gomoku-heading-white{color:#fffdf8;text-shadow:0 2px 7px #0009}
.gomoku-heading-ornament{display:grid;grid-template-columns:minmax(0,1fr) 24px minmax(0,1fr);align-items:center;
 gap:10px;width:min(94%,295px);height:24px;margin-top:3px}
.gomoku-heading-line{height:1px;background:linear-gradient(90deg,transparent,#f2c96f 70%,#ffdf8c);box-shadow:0 0 4px #d1a34966}
.gomoku-heading-line:last-child{transform:rotate(180deg)}
.gomoku-heading-crown{display:block;justify-self:center;color:#e6b54a;filter:drop-shadow(0 0 5px #e8b55766)}
@media(max-width:320px){.gomoku-heading-title{font-size:22px}}
.mode{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0}
.mode-choice{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-height:44px;padding:8px 5px;
 border:1px solid #47777b;border-radius:11px;color:#e2f6f4;background:linear-gradient(145deg,#0d424c,#06252e);text-align:center}
.mode-choice.active{border-color:#efc56a;background:linear-gradient(135deg,#37544a,#113c3d);box-shadow:inset 0 0 12px #efc56a20,0 0 10px #d9b65428}
.mode-choice strong{font:700 clamp(13px,1.1vw,17px)/1.2 Georgia,serif;white-space:nowrap}
.mode-choice small,.mode-arrow{display:none}
.mode-icon{font-size:18px;line-height:1}
.sidecard{margin:0;padding:0;border:0}
.sidecard h2{font:700 clamp(16px,1.25vw,21px)/1.25 Georgia,serif;color:#f2d49a;margin:0 0 7px}
.sidecard label,.room-creator label{display:block;font-size:12px;font-weight:700;line-height:1.3;margin:8px 0 4px;color:#d8ece9}
.sidebar select,.sidebar input{display:block;width:100%;min-width:0;min-height:36px;padding:7px 9px;border:1px solid #658982;
 border-radius:9px;background:#062630;color:#f0f8f6;font:500 12px/1.3 "Segoe UI",sans-serif;text-overflow:ellipsis}
.sidebar .primary{min-height:39px;padding:8px 10px;font:750 13px/1.25 "Segoe UI",sans-serif;border-radius:10px}
.sidebar #restart{width:100%;min-height:44px;margin-top:9px;font:750 18px/1.2 Georgia,serif}
.sidebar .secondary{min-height:36px;padding:7px;font-size:12px}
.sidebar .actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:8px 0}
.panel-help{margin:5px 0;font-size:11px;line-height:1.4;color:#adcac8}
.panel-help summary,.rules summary{cursor:pointer;border-radius:5px;padding:3px 0;color:#ddcfaa;font-size:12px;line-height:1.3}
.sidebar p,.sidecard .hint{font-size:12px;line-height:1.4;margin:6px 0;color:#c7ded9}
.training-records{padding:10px;border-radius:12px;background:linear-gradient(140deg,#0c3941,#062731)}
.records-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;text-align:center}
.records-grid strong{display:block;color:#ffdc91;font:750 20px/1.2 Georgia,serif}
.records-grid small{display:block;color:#c2dcd7;font-size:10px}
.sidebar .records-total{margin:6px 0 0;font-size:11px;text-align:center}
.room-creator{padding:0;margin:8px 0 10px}
.room-creator h3{font:700 14px/1.3 Georgia,serif;color:#f0d49c;margin:0 0 5px}
.room-creator button{width:100%;margin-top:7px}
#create-room-status:empty{display:none}
.sidebar .textlink{font-size:11px;line-height:1.4;margin:6px 0}
.side-links{display:flex;justify-content:space-between;gap:10px;margin-top:0;padding-top:7px;font-size:12px}
.side-links a{color:#c7e6e1;text-decoration:none;padding:4px 0}
.sidebar :is(button,a,summary,select,input):focus-visible{outline:2px solid #ffe3a1;outline-offset:3px}
.sidebar :is(button,a,summary):hover{filter:brightness(1.15)}
.sidebar button:active{filter:brightness(.95)}
@media(max-height:800px){
 .sidebar{gap:7px;padding-top:10px;padding-bottom:10px}
 .sidecard label,.room-creator label{margin-top:6px}
 .sidebar select,.sidebar input{min-height:33px;padding:6px 8px}
 .sidebar p{margin:4px 0;font-size:11px}
 .panel-help{margin:3px 0}
 .training-records{padding:8px}
}
@media(max-width:800px){.sidebar{height:auto;overflow:visible;border-right:0;gap:8px}.side-links{margin-top:0}.mode-choice{min-height:44px}}

@media(prefers-reduced-motion:reduce){*,*:before,*:after{transition:none!important;animation:none!important}}`;
const js=String.raw`(()=>{'use strict';
const $=id=>document.getElementById(id);
const size=15,count=225;
const matchPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const state={mode:'training',board:Array(count).fill(0),winner:0,moves:0,last:-1,
 thinking:false,matchId:null,match:null,busy:false,epoch:0,snapshots:[],suggestion:-1,serverOffsetMs:0,
 trainHistory:[],trainClock:null,dockTab:'chat',chatBusy:false,chatSignature:'',localChat:[],chatSequence:0,showcase:false,undoDialogId:null,resultShownKey:null,resultDismissedKey:null};

const trainingRecordKey='gracz.gomoku.training-records.v1';
function loadTrainingRecord(){
 const record={wins:0,draws:0,losses:0};
 try{
  const saved=JSON.parse(window.localStorage?.getItem(trainingRecordKey)||'null');
  if(saved&&typeof saved==='object'){
   for(const key of Object.keys(record))
    if(Number.isSafeInteger(saved[key])&&saved[key]>=0&&saved[key]<=1000000)record[key]=saved[key];
  }
 }catch{}
 return record;
}
state.trainingRecord=loadTrainingRecord();
state.recordedEpoch=null;
state.replayEntries=[];
state.replayIndex=0;
function recordTrainingFinish(){
 if(state.mode!=='training'||state.showcase||![1,2,3].includes(state.winner)||
    state.recordedEpoch===state.epoch)return;
 state.recordedEpoch=state.epoch;
 const key=state.winner===1?'wins':state.winner===2?'losses':'draws';
 state.trainingRecord[key]++;
 try{window.localStorage?.setItem(trainingRecordKey,JSON.stringify(state.trainingRecord));}catch{}
}
function renderTrainingRecord(){
 const r=state.trainingRecord,total=r.wins+r.draws+r.losses;
 $('record-wins').textContent=String(r.wins);
 $('record-draws').textContent=String(r.draws);
 $('record-losses').textContent=String(r.losses);
 $('record-total').textContent=String(total);
 $('record-rate').textContent=(total?Math.round(100*r.wins/total):0)+'%';
}
function replaySource(){
 const online=state.mode==='online',m=state.match;
 if(online&&(!m?.state?.winner||!Array.isArray(m?.state?.history)||
   m.state.history.length!==m.state.moves))return null;
 if(!online&&(state.showcase||!state.winner))return null;
 const entries=online?m.state.history:state.trainHistory;
 if(!Array.isArray(entries)||!entries.length||entries.length>225)return null;
 const occupied=new Set();
 for(const entry of entries){
  if(!entry||![1,2].includes(entry.player)||!Number.isInteger(entry.to)||
     entry.to<0||entry.to>=225||occupied.has(entry.to))return null;
  occupied.add(entry.to);
 }
 return entries.map(e=>({player:e.player,to:e.to}));
}
function renderReplay(){
 const entries=state.replayEntries,limit=Math.min(state.replayIndex,entries.length);
 const board=Array(225).fill(0);
 for(let i=0;i<limit;i++)board[entries[i].to]=entries[i].player;
 const last=limit?entries[limit-1]:null;
 const area=$('replay-board');area.replaceChildren();
 for(let i=0;i<225;i++){
  const square=document.createElement('div');
  square.className='replay-cell'+(board[i]===1?' stone-black':board[i]===2?' stone-white':'')+
   (last?.to===i?' is-last':'');
  area.append(square);
 }
 $('replay-counter').textContent=limit+' / '+entries.length;
 $('replay-status').textContent=last?
  ('Ruch '+limit+': '+(last.player===1?'czarne':'białe')+' · '+notation(last.to)):
  'Początek partii — pusta plansza';
 $('replay-start').disabled=limit===0;$('replay-prev').disabled=limit===0;
 $('replay-next').disabled=limit===entries.length;
 $('replay-end').disabled=limit===entries.length;
}
function openReplay(){
 const moves=replaySource();
 if(!moves)return;
 state.replayEntries=moves;state.replayIndex=moves.length;
 renderReplay();
 $('replay-modal').hidden=false;
 $('replay-close').focus?.();
}
function stepReplay(to){
 state.replayIndex=Math.max(0,Math.min(state.replayEntries.length,to));
 renderReplay();
}
function closeReplay(){$('replay-modal').hidden=true;}
$('replay-game').addEventListener('click',openReplay);
$('replay-close').addEventListener('click',closeReplay);
$('replay-start').addEventListener('click',()=>stepReplay(0));
$('replay-prev').addEventListener('click',()=>stepReplay(state.replayIndex-1));
$('replay-next').addEventListener('click',()=>stepReplay(state.replayIndex+1));
$('replay-end').addEventListener('click',()=>stepReplay(state.replayEntries.length));

const inBounds=(r,c)=>r>=0&&r<size&&c>=0&&c<size;
function victory(board,to,side){
 const r=Math.floor(to/size),c=to%size;
 for(const [dr,dc] of [[1,0],[0,1],[1,1],[1,-1]]){
  let total=1;
  for(const sign of [-1,1])for(let n=1;n<=4;n++){
   const rr=r+dr*n*sign,cc=c+dc*n*sign;
   if(!inBounds(rr,cc)||board[rr*size+cc]!==side)break;total++;
  }
  if(total>=5)return true;
 }
 return false;
}
function describe(){
 if(state.mode==='training'){
  if(state.showcase)return 'Przykładowy układ partii — kliknij planszę, aby rozpocząć grę.';
  if(state.trainClock?.timeoutLoser===1)return 'Twój czas minął — komputer wygrał na czas.';
  if(state.trainClock?.timeoutLoser===2)return 'Czas komputera minął — wygrywasz na czas!';
  if(state.winner===1)return 'Wygrywasz! Pięć czarnych kamieni w rzędzie.';
  if(state.winner===2)return 'Komputer wygrał. Rozpocznij nową partię.';
  if(state.winner===3)return 'Remis — plansza została zapełniona.';
  return state.thinking?'Komputer analizuje ruch…':state.moves>0&&state.last>=0&&state.board[state.last]===2?'🏆 Komputer zagrał ruch. Twoja kolej!':'Twój ruch — postaw czarny kamień.';
 }
 const m=state.match;
 if(!m)return 'Wybierz przyjęte wyzwanie i otwórz pokój.';
 if(m.state.clock&&!m.state.clock.ready.every(Boolean)&&!m.state.winner)
  return 'Pokój na czas: oczekiwanie na wejście drugiego gracza.';
 if(m.state.clock?.timeoutLoser)
  return m.state.clock.timeoutLoser===m.player?'Twój czas minął — przegrywasz na czas.':'Przeciwnik przekroczył czas — wygrywasz!';
 if(m.state.winner===1||m.state.winner===2)return 'Wygrał '+m.players[m.state.winner-1]+'.';
 if(m.state.winner===3)return 'Remis — zakończono partię.';
 if(!m.playable)return 'Partia jest niedostępna z powodu blokady.';
 if(m.undoRequest)return m.undoRequest.requester===m.player?
  'Prośba o cofnięcie wysłana. Oczekiwanie na odpowiedź przeciwnika…':
  'Przeciwnik prosi o cofnięcie ruchu — odpowiedz w oknie Premium.';
 return m.state.turn===m.player?'Twoja tura — wybierz wolne pole.':'Tura gracza '+m.players[m.state.turn-1]+'.';
}

function syncGameResult(){
 const online=state.mode==='online',match=state.match;
 const winner=online?(match?.state?.winner||0):state.winner;
 const modal=$('game-result-modal');
 if((online&&!match)||(!online&&state.showcase)||![1,2,3].includes(winner)){
  modal.hidden=true;state.resultShownKey=null;return;
 }
 const key=online?'online:'+(state.matchId||match.id)+':'+winner+':'+(match.state.moves||0):
  'training:'+state.epoch+':'+winner+':'+state.moves;
 if(state.resultShownKey===key||state.resultDismissedKey===key)return;
 const outcome=winner===3?'draw':online?(match.player===winner?'win':'loss'):(winner===1?'win':'loss');
 const timedOut=online?match.state.clock?.timeoutLoser:state.trainClock?.timeoutLoser;
 $('game-result-title').textContent=timedOut?
  (outcome==='win'?'Wygrałeś na czas!':'Przegrałeś na czas.'):
  outcome==='draw'?'Remis!':outcome==='win'?
  (online?'Wygrałeś partię!':'Wygrałeś z komputerem!'):
  (online?'Przegrałeś partię.':'Przegrałeś z komputerem.');
 $('game-result-description').textContent=timedOut&&!online?
  (outcome==='win'?'Komputer przekroczył limit czasu.':'Twój zegar osiągnął zero.'):
  outcome==='draw'?
  'Nikt nie wygrał tej rozgrywki. Możesz rozpocząć kolejną partię.':
  online?'Zwycięzca: '+(match.players?.[winner-1]||'Przeciwnik')+'.':
  outcome==='win'?'Świetna partia! Pięć czarnych kamieni w jednej linii.':
  'Komputer ułożył pięć białych kamieni w jednej linii.';
 $('game-result-online-hint').hidden=!online;
 modal.querySelector?.('.result-card')?.setAttribute('data-result',outcome);
 state.resultShownKey=key;modal.hidden=false;$('game-result-new').focus?.();
}
function dismissGameResult(){
 if(state.resultShownKey)state.resultDismissedKey=state.resultShownKey;
 $('game-result-modal').hidden=true;
}
$('game-result-close').addEventListener('click',dismissGameResult);
$('game-result-review').addEventListener('click',dismissGameResult);
$('game-result-new').addEventListener('click',()=>{
 dismissGameResult();
 if(state.mode==='training')restart();
 else window.location.assign('/konto/panel/');
});

function formatGomokuClock(ms){
 const whole=Math.max(0,Math.ceil(ms/1000));
 return String(Math.floor(whole/60)).padStart(2,'0')+':'+String(whole%60).padStart(2,'0');
}
// Training is local and non-ranking; online clocks remain PostgreSQL-authoritative.
const trainingNow=()=>window.performance?.now?.()??Date.now();
function createTrainingClock(){
 const minutes=Number($('training-time').value);
 if(![1,2,3,5,7,10,15,30].includes(minutes))return null;
 const ms=minutes*60000;
 const selected=Number($('training-increment').value);
 const incrementMs=[0,2,3,5,10].includes(selected)?selected*1000:0;
 return {remaining:[ms,ms],incrementMs,turn:1,since:null,timeoutLoser:0};
}
function advanceTrainingClock(){
 const clock=state.mode==='training'?state.trainClock:null;
 if(!clock||state.showcase||state.winner||clock.since===null)return false;
 const now=trainingNow(),spent=Math.max(0,now-clock.since);
 clock.remaining[clock.turn-1]=Math.max(0,clock.remaining[clock.turn-1]-spent);
 clock.since=now;
 if(clock.remaining[clock.turn-1]>0)return false;
 clock.timeoutLoser=clock.turn;
 state.winner=clock.turn===1?2:1;
 state.thinking=false;
 ++state.epoch; // invalidate an already scheduled computer move
 return true;
}
function renderGomokuClocks(){
 const training=state.mode==='training';
 const m=training?null:state.match;
 const clock=training?state.trainClock:m?.state?.clock;
 for(let player=1;player<=2;player++){
  const el=$('clock-'+player);
  if(!clock){el.hidden=true;continue;}
  el.hidden=false;
  const active=training?
   !state.showcase&&!state.winner&&clock.since!==null&&clock.turn===player:
   !!clock.since&&!m.state.winner&&m.state.turn===player;
  const elapsed=active?Math.max(0,training?trainingNow()-clock.since:
   Date.now()+state.serverOffsetMs-Date.parse(clock.since)):0;
  const remaining=Math.max(0,clock.remaining[player-1]-elapsed);
  el.textContent=formatGomokuClock(remaining);
  el.title=clock.incrementMs?('Po ruchu: +'+(clock.incrementMs/1000)+' s'):'Bez bonusu czasu';
  el.classList.toggle('clock-running',active);
  el.classList.toggle('clock-warning',active&&remaining<=30000);
  el.classList.toggle('clock-expired',Boolean(clock.timeoutLoser===player&&
   (training?state.winner:m.state.winner)));
 }
}
function synchronizeGameTime(result){
 const ts=Date.parse(result?.serverTime);
 if(Number.isFinite(ts))state.serverOffsetMs=ts-Date.now();
}
async function createTimedRoom(){
 if(state.busy)return;
 const nickname=$('create-room-friend').value.trim();
 const minutes=Number($('create-room-time').value);
 const incrementSeconds=Number($('create-room-increment').value);
 if(!nickname||![0,1,2,3,5,7,10,15,30].includes(minutes)||
    ![0,2,3,5,10].includes(incrementSeconds)||(minutes===0&&incrementSeconds!==0)){
  $('create-room-status').textContent='Wpisz nick znajomego i wybierz dozwolony czas.';return;
 }
 state.busy=true;$('create-room').disabled=true;
 try{
  const result=await api('social/challenges',{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'send',game:'gomoku',nickname,timeLimitMinutes:minutes,incrementSeconds})});
  $('create-room-status').textContent='Zaproszenie wysłane. Pokój '+(minutes?minutes+' min'+(incrementSeconds?' + '+incrementSeconds+' s/ruch':'')+' na gracza':'bez limitu')+
   ' będzie dostępny po akceptacji przez '+nickname+'.';
  await rooms();
 }catch(e){$('create-room-status').textContent=e.message;}
 finally{state.busy=false;$('create-room').disabled=false;}
}
$('create-room').addEventListener('click',()=>void createTimedRoom());
window.setInterval(()=>{
 if(state.mode==='training'&&state.trainClock){
  if(advanceTrainingClock())render();
  else renderGomokuClocks();
 }else if(state.mode==='online'&&state.match?.state?.clock)renderGomokuClocks();
},250);

function render(){
 if(state.mode==='training')advanceTrainingClock();
 const online=state.mode==='online',m=state.match;
 const board=online?(m?m.state.board:Array(count).fill(0)):state.board;
 const canPlay=online?Boolean(m&&m.playable&&!state.busy&&!m.undoRequest&&m.state.winner===0&&m.state.turn===m.player):
  !state.thinking&&state.winner===0;
 const area=$('board');area.replaceChildren();
 for(let i=0;i<count;i++){
  const row=Math.floor(i/size),col=i%size,piece=board[i];
  const cell=document.createElement('button');cell.type='button';cell.className='cell';
  if(row===0)cell.classList.add('edge-top');
  if(row===size-1)cell.classList.add('edge-bottom');
  if(col===0)cell.classList.add('edge-left');
  if(col===size-1)cell.classList.add('edge-right');
  if([3,7,11].includes(row)&&[3,7,11].includes(col))cell.classList.add('star');
  if(piece){cell.classList.add('occupied','p'+piece);}
  if(!online&&i===state.suggestion&&!piece)cell.classList.add('suggested');
  const last=online?(m?.state?.last??-1):state.last;
  if(last===i)cell.classList.add('last');
  cell.disabled=!!piece||!canPlay;
  cell.setAttribute('aria-label','Wiersz '+(row+1)+', kolumna '+(col+1)+
    (piece===1?' czarny kamień':piece===2?' biały kamień':' wolne pole'));
  if(!cell.disabled)cell.addEventListener('click',()=>void play(i));
  area.append(cell);
 }
 const moves=online?(m?.state?.moves||0):state.moves;
 $('move-count').textContent='Ruchy: '+moves;
 const turn=online?(m?.state?.turn||1):(state.thinking?2:1);
 $('turn-label').textContent='Tura: '+(turn===1?'czarne':'białe');
 $('game-state').textContent=describe();
 renderGomokuClocks();
 renderMoveHistory();
 $('dock-status').textContent=online?(m?'● POKÓJ ONLINE':'● ŁĄCZENIE'):'● TRENING';
 $('history-info').textContent=online?'Ruchy potwierdzane na serwerze':'Zapis lokalny w treningu';
 const myMove=online?Array.isArray(m?.state?.history)&&m.state.history.some(item=>
  item.player===m.player&&m.state.board[item.to]===m.player):
  !state.showcase&&state.trainHistory.some(item=>item.player===1&&state.board[item.to]===1);
 $('undo-move').disabled=state.busy||(online?(!m||!m.playable||!!m.undoRequest||!myMove):(!myMove||!!state.trainClock?.timeoutLoser));
 $('undo-label').textContent=online?'Poproś o cofnięcie ruchu':'Cofnij czarny kamień';
 syncUndoDialog();
 $('analyze-position').disabled=online||state.thinking||state.winner!==0;
 if(online&&m){
  $('black-name').textContent=m.players[0];$('white-name').textContent=m.players[1];
  $('session-heading').textContent='Partia online — Gomoku';
  $('room-tag').textContent='POKÓJ ONLINE';
 }else if(!online){
  $('black-name').textContent='Ty';$('white-name').textContent='Komputer';
  $('session-heading').textContent='Trening z komputerem';$('room-tag').textContent='TRENING';
 }
 $('black-name').title=$('black-name').textContent;
 $('white-name').title=$('white-name').textContent;
 recordTrainingFinish();
 renderTrainingRecord();
 $('replay-game').disabled=!replaySource();
 syncGameResult();
}
function restart(){
 ++state.epoch;state.board=Array(count).fill(0);state.winner=0;state.moves=0;
 state.last=-1;state.thinking=false;state.snapshots=[];state.suggestion=-1;state.trainHistory=[];
 state.showcase=false;state.trainClock=createTrainingClock();
 state.localChat=[];state.chatSignature='';
 showChatNotice('Napisz komentarz do komputera treningowego. Odpowiedzi są automatyczne i nie są zapisywane.');
 $('analysis-note').hidden=true;render();
}
// Tactical evaluation for free-style Gomoku (five or more wins).
// All candidate calculations temporarily place a stone and restore the board.
const axes=[[1,0],[0,1],[1,1],[1,-1]];
const decisive=10000000;
function vicinity(board){
 const spots=new Uint8Array(count);
 let stones=0;
 for(let i=0;i<count;i++)if(board[i]){
  stones++;
  const row=Math.floor(i/size),col=i%size;
  for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){
   const r=row+dr,c=col+dc;
   if(inBounds(r,c)&&!board[r*size+c])spots[r*size+c]=1;
  }
 }
 if(!stones)return [Math.floor(count/2)];
 const result=[];
 for(let i=0;i<count;i++)if(spots[i])result.push(i);
 return result;
}
function tacticalScore(board,at,player){
 if(board[at])return -1;
 const row=Math.floor(at/size),col=at%size;
 board[at]=player;
 let score=0,openThrees=0,fourThreats=0;
 for(const [dr,dc] of axes){
  let left=0,right=0;
  for(let step=1;step<size;step++){
   const r=row-dr*step,c=col-dc*step;
   if(!inBounds(r,c)||board[r*size+c]!==player)break;
   left++;
  }
  for(let step=1;step<size;step++){
   const r=row+dr*step,c=col+dc*step;
   if(!inBounds(r,c)||board[r*size+c]!==player)break;
   right++;
  }
  const span=left+1+right;
  if(span>=5){board[at]=0;return decisive;}
  const beforeR=row-dr*(left+1),beforeC=col-dc*(left+1);
  const afterR=row+dr*(right+1),afterC=col+dc*(right+1);
  const open=(inBounds(beforeR,beforeC)&&!board[beforeR*size+beforeC]?1:0)+
   (inBounds(afterR,afterC)&&!board[afterR*size+afterC]?1:0);
  if(span===4){score+=open===2?110000:open===1?23000:0;if(open)fourThreats++;}
  if(span===3){score+=open===2?12000:open===1?1700:0;if(open===2)openThrees++;}
  if(span===2)score+=open===2?750:open===1?135:0;
  if(span===1&&open===2)score+=20;
  // Also detect split sequences, e.g. XX_XX, which a contiguous-run count misses.
  for(let offset=-4;offset<=0;offset++){
   let ours=0,empty=0,valid=true;
   for(let j=0;j<5;j++){
    const r=row+dr*(offset+j),c=col+dc*(offset+j);
    if(!inBounds(r,c)){valid=false;break;}
    const piece=board[r*size+c];
    if(piece===player)ours++;
    else if(!piece)empty++;
    else {valid=false;break;}
   }
   if(valid&&ours===4&&empty===1){score+=7000;fourThreats++;}
   else if(valid&&ours===3&&empty===2)score+=350;
  }
 }
 board[at]=0;
 if(openThrees>=2)score+=80000;
 if(fourThreats>=2)score+=110000;
 score+=Math.max(0,14-Math.abs(row-7)-Math.abs(col-7))*2;
 return score;
}
function rankedMoves(board,turn,limit){
 const places=vicinity(board);
 const opponent=3-turn;
 const ranked=places.map(at=>{
  const attack=tacticalScore(board,at,turn);
  const block=tacticalScore(board,at,opponent);
  return {at,attack,block,rank:attack*1.18+block*1.12};
 });
 const wins=ranked.filter(move=>move.attack>=decisive);
 if(wins.length)return wins.sort((a,b)=>b.rank-a.rank).slice(0,limit);
 const blocks=ranked.filter(move=>move.block>=decisive);
 if(blocks.length)return blocks.sort((a,b)=>b.rank-a.rank).slice(0,limit);
 return ranked.sort((a,b)=>b.rank-a.rank||a.at-b.at).slice(0,limit);
}
function positionValue(board,turn){
 const spots=vicinity(board);
 let bestCPU=0,nextCPU=0,bestHuman=0,nextHuman=0;
 for(const at of spots){
  const cpu=tacticalScore(board,at,2),human=tacticalScore(board,at,1);
  if(cpu>bestCPU){nextCPU=bestCPU;bestCPU=cpu;}
  else if(cpu>nextCPU)nextCPU=cpu;
  if(human>bestHuman){nextHuman=bestHuman;bestHuman=human;}
  else if(human>nextHuman)nextHuman=human;
 }
 if(bestCPU>=decisive&&turn===2)return decisive*2;
 if(bestHuman>=decisive&&turn===1)return -decisive*2;
 return (bestCPU*1.15+nextCPU*.16)*(turn===2?1.14:1)-
  (bestHuman*1.18+nextHuman*.16)*(turn===1?1.14:1);
}
function searchPosition(board,turn,depth,alpha,beta,last,ply,search){
 if(last>=0&&victory(board,last,3-turn))return turn===1?decisive*5-ply:-decisive*5+ply;
 if(depth<=0||++search.nodes>search.nodeLimit)return positionValue(board,turn);
 const maximizing=turn===2;
 let best=maximizing?-Infinity:Infinity;
 const limit=depth>=3?6:depth===2?5:4;
 const moves=rankedMoves(board,turn,limit);
 if(!moves.length)return 0;
 for(const move of moves){
  board[move.at]=turn;
  const value=searchPosition(board,3-turn,depth-1,alpha,beta,move.at,ply+1,search);
  board[move.at]=0;
  if(maximizing){best=Math.max(best,value);alpha=Math.max(alpha,best);}
  else{best=Math.min(best,value);beta=Math.min(beta,best);}
  if(beta<=alpha)break;
 }
 return best;
}
function cpuMove(board,level='expert'){
 const places=vicinity(board);
 if(!places.length)return -1;
 let bestWin=-1,bestBlock=-1;
 for(const at of places){
  if(tacticalScore(board,at,2)>=decisive){bestWin=at;break;}
 }
 if(bestWin>=0)return bestWin;
 for(const at of places){
  if(tacticalScore(board,at,1)>=decisive){bestBlock=at;break;}
 }
 if(bestBlock>=0)return bestBlock;
 const moves=rankedMoves(board,2,level==='expert'?8:level==='hard'?6:1);
 if(!moves.length)return -1;
 if(level==='normal')return moves[0].at;
 const search={nodes:0,nodeLimit:level==='expert'?1350:360};
 const depth=level==='expert'?3:2;
 let result=moves[0].at,best=-Infinity;
 for(const move of moves){
  board[move.at]=2;
  const estimate=searchPosition(board,1,depth-1,-Infinity,Infinity,move.at,1,search);
  board[move.at]=0;
  // Use tactical score as a tiebreaker after searching the opponent's response.
  const combined=estimate+move.attack*.015+move.block*.004;
  if(combined>best){best=combined;result=move.at;}
 }
 return result;
}
function trainMove(to){
 if(state.showcase)restart();
 if(advanceTrainingClock()){render();return;}
 if(state.thinking||state.winner||state.board[to])return;
 state.snapshots.push({board:state.board.slice(),winner:state.winner,moves:state.moves,last:state.last,history:state.trainHistory.slice()});
 state.suggestion=-1;$('analysis-note').hidden=true;
 state.board[to]=1;state.last=to;state.moves++;
 state.trainHistory.push({player:1,to,number:state.moves});
 if(victory(state.board,to,1))state.winner=1;
 else if(state.moves===count)state.winner=3;
 else state.thinking=true;
 if(state.thinking&&state.trainClock){
  state.trainClock.remaining[0]+=state.trainClock.incrementMs;
  state.trainHistory[state.trainHistory.length-1].incrementApplied=true;
  state.trainClock.turn=2;state.trainClock.since=trainingNow();
 }
 render();
 if(!state.thinking)return;
 const epoch=state.epoch;
 window.setTimeout(()=>{
  if(epoch!==state.epoch||state.mode!=='training'||!state.thinking)return;
  if(advanceTrainingClock()){render();return;}
  const at=cpuMove(state.board,$('ai-level').value);
  if(advanceTrainingClock()){render();return;}
  if(at<0){state.winner=3;state.thinking=false;render();return;}
  state.board[at]=2;state.last=at;state.moves++;
  state.trainHistory.push({player:2,to:at,number:state.moves});
  if(state.moves===2 || (state.moves>=6&&state.moves%6===0)){
   const reactions=[
    'Twój ruch! Powodzenia! 🙂',
    'Uważaj na otwarte trójki i czwarte kamienie. ♟',
    'Ciekawa partia. Szukam najlepszego ruchu. ♟'
   ];
   state.localChat.push({id:'local-'+(++state.chatSequence),player:2,
    body:reactions[state.moves===2?0:Math.floor(state.moves/6)%2+1],
    createdAt:new Date().toISOString()});
   state.localChat=state.localChat.slice(-40);
   state.chatSignature='';drawRoomChat(state.localChat);
  }
  if(victory(state.board,at,2))state.winner=2;
  else if(state.moves===count)state.winner=3;
  state.thinking=false;
  if(!state.winner&&state.trainClock){
   state.trainClock.remaining[1]+=state.trainClock.incrementMs;
   state.trainClock.turn=1;state.trainClock.since=trainingNow();
  }
  render();
 },330);
}
async function api(path,options={}){
 const response=await fetch('/auth/'+path,{
  credentials:'same-origin',cache:'no-store',
  headers:{Accept:'application/json',...(options.headers||{})},...options
 });
 let body={};try{body=await response.json();}catch{}
 if(!response.ok||body.ok!==true){
  const e=new Error(response.status===401?'Zaloguj się, aby grać ze znajomym.':
   response.status===409?'Stan partii się zmienił lub ruch jest niedozwolony. Odśwież planszę.':
   response.status===404?'Nie znaleziono partii dostępnej dla Twojego konta.':
   'Nie udało się wczytać danych. Spróbuj ponownie.');
  e.status=response.status;throw e;
 }
 return body;
}
function note(message){$('account-note').textContent=message;}
async function rooms(){
 note('Wczytywanie pokoi…');
 $('join-room').disabled=true;
 try{
  await api('profile');
  const result=await api('social/challenges');
  const available=result.challenges.filter(c=>c.game==='gomoku'&&c.status==='accepted');
  const select=$('room-select'),previous=select.value;
  select.replaceChildren();
  const blank=document.createElement('option');blank.value='';
  blank.textContent=available.length?'Wybierz rozgrywkę':'Brak przyjętych zaproszeń do Gomoku';
  select.append(blank);
  available.forEach(c=>{
   const option=document.createElement('option');option.value=c.id;option.textContent='Gomoku z '+c.opponent+' · '+(c.timeLimitMinutes?c.timeLimitMinutes+' min'+(c.incrementSeconds?' + '+c.incrementSeconds+' s/ruch':''):'bez limitu');
   select.append(option);
  });
  const wanted=new URLSearchParams(location.search).get('match');
  if(available.some(c=>c.id===wanted))select.value=wanted;
  else if(available.some(c=>c.id===previous))select.value=previous;
  else if(available.length)select.value=available[0].id;
  $('join-room').disabled=!select.value;
  note(available.length?'Przyjęte zaproszenia: '+available.length+'. Wybierz rozgrywkę.':
    'Nie masz jeszcze przyjętej partii. Dodaj znajomego i wyślij mu wyzwanie w panelu.');
 }catch(e){
  $('room-select').replaceChildren();$('join-room').disabled=true;
  note(e.message+' Otwórz panel, aby się zalogować lub wysłać zaproszenie.');
 }
}
async function loadMatch(id){
 if(!matchPattern.test(id))return;
 if(state.busy)return;
 state.busy=true;const epoch=state.epoch;
 try{
  const result=await api('match?id='+encodeURIComponent(id));
  if(epoch!==state.epoch||state.mode!=='online')return;
  if(result.match?.game!=='gomoku')throw new Error('Ten pokój nie jest partią Gomoku.');
  synchronizeGameTime(result);
  state.matchId=id;state.match=result.match;
  state.chatSignature='';void refreshRoomChat();
  $('room-select').value=id;
  history.replaceState(null,'','/konto/gomoku/?match='+encodeURIComponent(id));
  note('Połączono z pokojem. Ruchy są zatwierdzane przez serwer.');
 }catch(e){note(e.message);}
 finally{state.busy=false;render();}
}
async function onlineMove(to){
 const m=state.match;
 if(!m||state.busy||!m.playable||m.state.turn!==m.player||m.state.winner||m.state.board[to])return;
 state.busy=true;render();
 try{
  const result=await api('match',{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({id:state.matchId,version:m.version,move:{to}})});
  synchronizeGameTime(result);state.match=result.match;
 }catch(e){note(e.message);await refreshOnline(true);}
 finally{state.busy=false;render();}
}
async function refreshOnline(force=false){
 if(state.mode!=='online'||!state.matchId||(!force&&state.busy))return;
 if(!force)state.busy=true;
 const epoch=state.epoch,id=state.matchId;
 try{
  const result=await api('match?id='+encodeURIComponent(id));
  if(epoch===state.epoch&&state.matchId===id&&result.match?.game==='gomoku'){
   synchronizeGameTime(result);state.match=result.match;
  }
 }catch(e){if(epoch===state.epoch)note(e.message);}
 finally{if(!force){state.busy=false;render();}}
}
async function play(to){
 if(state.mode==='training')trainMove(to);
 else await onlineMove(to);
}

function notation(to){
 const row=Math.floor(to/15),col=to%15;
 return String.fromCharCode(65+col)+(row+1);
}
function renderMoveHistory(){
 const online=state.mode==='online',m=state.match;
 const entries=online?(Array.isArray(m?.state?.history)?m.state.history:[]):state.trainHistory;
 const list=$('moves-list');
 const lastSeen=list.dataset?.signature;
 const signature=(online?(m?.id||'none')+':':'training:')+
  entries.map(item=>item.number+':'+item.player+':'+item.to).join(',');
 if(signature===lastSeen)return;
 if(list.dataset)list.dataset.signature=signature;
 list.replaceChildren();
 $('history-count').textContent=String(entries.length);
 if(!entries.length){
  const empty=document.createElement('p');empty.className='dock-empty';
  empty.textContent=online&&m?.state?.moves>0?
   'Starsze ruchy tej partii nie były jeszcze rejestrowane. Nowe ruchy pojawią się tutaj.':
   online?'Wybierz pokój i rozpocznij partię.':'Wybierz pole i rozpocznij partię.';
  list.append(empty);return;
 }
 entries.forEach((entry,i)=>{
  if(!Number.isInteger(entry.to)||entry.to<0||entry.to>=225||
     ![1,2].includes(entry.player))return;
  const row=document.createElement('div');
  row.className='move-row'+(i===entries.length-1?' latest':'');
  const number=document.createElement('span');number.className='move-number';
  number.textContent=String(entry.number||i+1).padStart(2,'0');
  const player=document.createElement('span');player.className='move-player';
  const stone=document.createElement('i');stone.className='mini-stone p'+entry.player;
  stone.setAttribute('aria-hidden','true');
  const nick=document.createElement('strong');
  nick.textContent=online?(m?.players?.[entry.player-1]||'Gracz'):
    entry.player===1?'Ty':'Komputer';
  player.append(stone,nick);
  const move=document.createElement('strong');move.className='move-coordinate';
  move.textContent=notation(entry.to);
  row.append(number,player,move);list.append(row);
 });
 list.scrollTop=list.scrollHeight;
}
function setDockTab(tab){
 state.dockTab=tab;
 const moves=tab==='moves';
 $('moves-panel').hidden=!moves;$('chat-panel').hidden=moves;
 $('chat-preview').hidden=!moves||!chatPrefs.preview;
 $('history-tab').classList.toggle('active',moves);$('chat-tab').classList.toggle('active',!moves);
 $('history-tab').setAttribute('aria-selected',String(moves));
 $('chat-tab').setAttribute('aria-selected',String(!moves));
 if(!moves)void refreshRoomChat();
 applyChatPreferences();
}
function showChatNotice(text){
 for(const id of ['chat-messages','chat-preview']){
  const box=$(id);box.replaceChildren();
  const p=document.createElement('p');p.className='dock-empty';p.textContent=text;box.append(p);
 }
 $('chat-status').textContent=state.mode==='training'?
  'Trening: krótkie odpowiedzi automatyczne · lokalnie':
  'Prywatny czat dwóch uczestników · 600 znaków';
}
function drawRoomChat(messages){
 const signature=(state.mode==='training'?'training':state.matchId||'')+':'+messages.map(x=>x.id).join(',');
 if(signature===state.chatSignature)return;
 maybeNotifyNewChat(messages);
 state.chatSignature=signature;
 const box=$('chat-messages');box.replaceChildren();
 if(!messages.length){
  showChatNotice(state.mode==='training'?
   'Napisz do komputera treningowego. Odpowiedzi są krótkimi, automatycznymi komentarzami.':
   'Rozpocznij rozmowę z przeciwnikiem. Czat jest prywatny dla uczestników partii.');
  return;
 }
 messages.forEach(message=>{
  const mine=message.player===(state.mode==='training'?1:state.match?.player);
  const bubble=document.createElement('div');bubble.className='chat-bubble'+(mine?' own':'');
  const title=document.createElement('strong');
  title.textContent=mine?'Ty':state.mode==='training'?'Komputer':(state.match?.players?.[message.player-1]||'Przeciwnik');
  const text=document.createElement('p');text.textContent=message.body;
  const time=document.createElement('time');
  const date=new Date(message.createdAt);
  time.textContent=Number.isNaN(date.getTime())?'':date.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'});
  time.hidden=!chatPrefs.timestamps;
  bubble.append(title,text,time);box.append(bubble);
 });
 if(chatPrefs.autoScroll)box.scrollTop=box.scrollHeight;
 const preview=$('chat-preview');preview.replaceChildren();
 messages.slice(-2).forEach(message=>{
  const own=message.player===(state.mode==='training'?1:state.match?.player);
  const bubble=document.createElement('div');bubble.className='chat-bubble'+(own?' own':'');
  const title=document.createElement('strong');
  title.textContent=own?'Ty':state.mode==='training'?'Komputer':(state.match?.players?.[message.player-1]||'Przeciwnik');
  const content=document.createElement('p');content.textContent=message.body;
  const time=document.createElement('time');const date=new Date(message.createdAt);
  time.textContent=Number.isNaN(date.getTime())?'':date.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'});
  time.hidden=!chatPrefs.timestamps;
  bubble.append(title,content,time);preview.append(bubble);
 });
 if(chatPrefs.autoScroll)preview.scrollTop=preview.scrollHeight;
}
async function refreshRoomChat(){
 if(state.mode==='training'){
  $('chat-input').disabled=false;$('chat-send').disabled=false;
  state.chatSignature='';
  drawRoomChat(state.localChat);
  $('chat-status').textContent='Trening: komentarze automatyczne · bez zapisu';
  return;
 }
 if(!state.matchId||!state.match){
  $('chat-input').disabled=true;$('chat-send').disabled=true;
  showChatNotice('Otwórz zaakceptowany pokój, aby rozpocząć prywatny czat.');
  return;
 }
 if(state.chatBusy)return;
 state.chatBusy=true;
 const id=state.matchId,epoch=state.epoch;
 try{
  const result=await api('match/chat?id='+encodeURIComponent(id));
  if(epoch!==state.epoch||state.matchId!==id)return;
  $('chat-input').disabled=false;$('chat-send').disabled=false;
  drawRoomChat(result.messages);
  $('chat-status').textContent='Prywatny czat partii · ostatnie 60 wiadomości';
 }catch(error){
  if(epoch!==state.epoch)return;
  $('chat-input').disabled=true;$('chat-send').disabled=true;
  $('chat-status').textContent=error.message;
 }finally{state.chatBusy=false;}
}
$('history-tab').addEventListener('click',()=>setDockTab('moves'));
$('chat-tab').addEventListener('click',()=>setDockTab('chat'));
$('chat-form').addEventListener('submit',async event=>{
 event.preventDefault();
 if(state.chatBusy)return;
 const message=$('chat-input').value.trim();
 if(!message||message.length>600){
  $('chat-status').textContent='Wpisz wiadomość o długości do 600 znaków.';return;
 }
 if(state.mode==='training'){
  if(state.showcase)restart();
  const now=new Date().toISOString();
  state.localChat.push({id:'local-'+(++state.chatSequence),player:1,body:message,createdAt:now});
  const lower=message.toLocaleLowerCase('pl-PL');
  const answer=/powodzen|cześć|witam|hej/.test(lower)?'Dzięki, wzajemnie! 🤝':
   /ruch|porad|pomoc|wskaz/.test(lower)?'Szukaj otwartych trójek i pilnuj zagrożeń. ♟':
   /dzięk|dziek/.test(lower)?'Nie ma za co! Powodzenia! 🙂':
   'Dobry trening! Najważniejsze to pięć w jednej linii. ♟';
  state.localChat.push({id:'local-'+(++state.chatSequence),player:2,body:answer,createdAt:new Date().toISOString()});
  state.localChat=state.localChat.slice(-40);
  $('chat-input').value='';state.chatSignature='';drawRoomChat(state.localChat);
  $('chat-status').textContent='Trening: automatyczne komentarze komputera · lokalnie';
  return;
 }
 if(!state.matchId)return;
 const id=state.matchId,epoch=state.epoch;
 $('chat-send').disabled=true;
 try{
  await api('match/chat',{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({id,message})});
  if(epoch!==state.epoch||state.matchId!==id)return;
  $('chat-input').value='';
  state.chatSignature='';
  await refreshRoomChat();
 }catch(error){$('chat-status').textContent=error.message;}
 finally{if(epoch===state.epoch&&state.matchId===id)$('chat-send').disabled=false;}
});
window.setInterval(()=>{
 if(state.mode==='online'&&state.matchId&&document.visibilityState==='visible')void refreshRoomChat();
},8000);


function syncUndoDialog(){
 const pending=state.mode==='online'?state.match?.undoRequest:null;
 const receiving=!!pending&&pending.requester!==state.match?.player;
 const modal=$('undo-request-modal');
 const visible=receiving&&!state.busy;
 modal.hidden=!visible;
 if(!visible){state.undoDialogId=null;return;}
 const actor=pending.requesterName||state.match.players[pending.requester-1]||'Gracz';
 $('undo-modal-message').textContent='Użytkownik '+actor+' prosi o cofnięcie ruchu ('+
  notation(pending.targetTo)+'). Czy akceptujesz tę prośbę?';
 if(state.undoDialogId!==pending.id){
  state.undoDialogId=pending.id;
  $('undo-accept').focus?.();
 }
}
async function sendUndoAction(action){
 const match=state.match;
 if(!match||state.mode!=='online'||!state.matchId||state.busy)return;
 const request=match.undoRequest;
 if(action!=='request'&&(!request||request.requester===match.player))return;
 if(action==='request'&&request)return;
 state.busy=true;
 try{
  const result=await api('match/undo',{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({id:state.matchId,version:match.version,
    action,requestId:request?.id})});
  if(state.matchId===match.id){
   state.match=result.match;
   if(action==='request')note('Prośba o cofnięcie ruchu została wysłana do przeciwnika.');
   if(action==='accept')note('Prośba zaakceptowana. Cofnięto wyłącznie kamień proszącego gracza.');
   if(action==='reject')note('Prośba o cofnięcie ruchu została odrzucona.');
  }
 }catch(error){
  note(error.message);
  await refreshOnline(true);
 }finally{state.busy=false;render();}
}
$('undo-accept').addEventListener('click',()=>void sendUndoAction('accept'));
$('undo-reject').addEventListener('click',()=>void sendUndoAction('reject'));
function handleUndoClick(){
 if(state.mode==='training')undoTrainingMove();
 else void sendUndoAction('request');
}

function undoTrainingMove(){
 if(state.mode!=='training'||state.showcase||state.trainClock?.timeoutLoser)return;
 if(advanceTrainingClock()){render();return;}
 const index=state.trainHistory.map(item=>item.player).lastIndexOf(1);
 if(index<0)return;
 ++state.epoch;state.thinking=false;
 const removed=state.trainHistory[index];
 if(state.board[removed.to]!==1)return;
 // A revoked move must not mint free Fischer time via repeated undo.
 if(state.trainClock&&removed.incrementApplied)
  state.trainClock.remaining[0]=Math.max(0,state.trainClock.remaining[0]-state.trainClock.incrementMs);
 state.board[removed.to]=0;
 state.trainHistory.splice(index,1);
 state.trainHistory=state.trainHistory.map((item,i)=>({...item,number:i+1}));
 state.moves=state.trainHistory.length;
 state.last=state.trainHistory.length?state.trainHistory[state.trainHistory.length-1].to:-1;
 state.winner=0;
 for(let i=0;i<count;i++){
  const piece=state.board[i];
  if(piece&&victory(state.board,i,piece)){state.winner=piece;break;}
 }
 if(!state.winner&&state.moves===count)state.winner=3;
 state.snapshots=[];state.suggestion=-1;
 if(!state.winner&&state.trainClock){
  state.trainClock.turn=1;state.trainClock.since=trainingNow();
 }
 const label=$('analysis-note');
 label.textContent='Cofnięto wyłącznie Twój czarny kamień. Białe kamienie pozostały na planszy.';
 label.hidden=false;render();
}
function analyzeTrainingPosition(){
 if(state.mode!=='training'||state.thinking||state.winner!==0)return;
 const choices=rankedMoves(state.board,1,3);
 if(!choices.length)return;
 const candidate=choices[0];state.suggestion=candidate.at;
 const row=Math.floor(candidate.at/15)+1,col=candidate.at%15+1;
 const reason=candidate.attack>=decisive?'Możliwa natychmiastowa wygrana.':
   candidate.block>=decisive?'Zablokuj natychmiastową wygraną komputera.':
   candidate.attack>12000?'Rozwijaj silne zagrożenie.':'Propozycja na podstawie analizy taktycznej.';
 const label=$('analysis-note');label.textContent='Analiza: rząd '+row+', kolumna '+col+'. '+reason;
 label.hidden=false;render();
}


const chatDefaults={sounds:false,messages:true,preview:true,timestamps:true,compact:false,
 autoScroll:true,enterSend:true,fontSize:'normal'};
const chatPrefs={...chatDefaults};
try{
 const saved=window.localStorage?.getItem('gracz.gomoku.chat-prefs.v1');
 if(saved){
  const value=JSON.parse(saved);
  for(const key of Object.keys(chatDefaults)){
   if(key==='fontSize'){
    if(['small','normal','large'].includes(value[key]))chatPrefs[key]=value[key];
   }else if(typeof value[key]==='boolean')chatPrefs[key]=value[key];
  }
 }
}catch{}
function applyChatPreferences(){
 $('chat-messages').hidden=!chatPrefs.messages;
 $('chat-preview').hidden=!chatPrefs.preview||state.dockTab!=='moves';
 for(const id of ['chat-messages','chat-preview']){
  const element=$(id);
  element.classList.toggle('chat-compact',chatPrefs.compact);
  for(const size of ['small','normal','large'])
   element.classList.toggle('chat-font-'+size,chatPrefs.fontSize===size);
  element.querySelectorAll?.('time').forEach(time=>{time.hidden=!chatPrefs.timestamps;});
 }
 $('chat-status').textContent=chatPrefs.messages?'Rozmowa aktywna · wiadomości widoczne':
  'Wiadomości ukryte w Twoim widoku';
}
function updateChatSettingsForm(){
 $('chat-sounds').checked=chatPrefs.sounds;
 $('chat-show-messages').checked=chatPrefs.messages;
 $('chat-show-preview').checked=chatPrefs.preview;
 $('chat-timestamps').checked=chatPrefs.timestamps;
 $('chat-compact').checked=chatPrefs.compact;
 $('chat-auto-scroll').checked=chatPrefs.autoScroll;
 $('chat-enter-send').checked=chatPrefs.enterSend;
 $('chat-font-size').value=chatPrefs.fontSize;
}
function writeChatPrefs(){
 try{window.localStorage?.setItem('gracz.gomoku.chat-prefs.v1',JSON.stringify(chatPrefs));}catch{}
}
function soundForIncomingMessage(){
 try{
  const Context=window.AudioContext||window.webkitAudioContext;
  if(typeof Context!=='function')return;
  const context=new Context();
  const oscillator=context.createOscillator();
  const gain=context.createGain();
  const start=context.currentTime;
  oscillator.type='sine';
  oscillator.frequency.setValueAtTime(740,start);
  oscillator.frequency.exponentialRampToValueAtTime(1050,start+.10);
  gain.gain.setValueAtTime(.0001,start);
  gain.gain.exponentialRampToValueAtTime(.055,start+.016);
  gain.gain.exponentialRampToValueAtTime(.0001,start+.17);
  oscillator.connect(gain);gain.connect(context.destination);
  oscillator.start(start);oscillator.stop(start+.18);
  oscillator.onended=()=>{void context.close?.().catch?.(()=>{});};
 }catch{}
}
let soundMatchId=null,lastSoundMessageId='';
function maybeNotifyNewChat(messages){
 if(state.mode!=='online'||!state.matchId)return;
 const tail=messages[messages.length-1];
 const currentId=tail?.id||'';
 if(soundMatchId===state.matchId&&lastSoundMessageId&&currentId!==lastSoundMessageId&&
   tail?.player!==state.match?.player&&chatPrefs.sounds&&document.visibilityState==='visible'){
  soundForIncomingMessage();
 }
 soundMatchId=state.matchId;
 lastSoundMessageId=currentId;
}
function closePremiumPopup(id){$(id).hidden=true;}
$('chat-settings-close').addEventListener('click',()=>closePremiumPopup('chat-settings-modal'));
$('player-actions-close').addEventListener('click',()=>closePremiumPopup('player-actions-modal'));
$('chat-settings-save').addEventListener('click',()=>{
 chatPrefs.sounds=$('chat-sounds').checked;
 chatPrefs.messages=$('chat-show-messages').checked;
 chatPrefs.preview=$('chat-show-preview').checked;
 chatPrefs.timestamps=$('chat-timestamps').checked;
 chatPrefs.compact=$('chat-compact').checked;
 chatPrefs.autoScroll=$('chat-auto-scroll').checked;
 chatPrefs.enterSend=$('chat-enter-send').checked;
 const font=$('chat-font-size').value;
 chatPrefs.fontSize=['small','normal','large'].includes(font)?font:'normal';
 writeChatPrefs();applyChatPreferences();
 closePremiumPopup('chat-settings-modal');
});
$('chat-settings-reset').addEventListener('click',()=>{
 Object.assign(chatPrefs,chatDefaults);
 updateChatSettingsForm();writeChatPrefs();applyChatPreferences();
});
$('chat-sound-test').addEventListener('click',soundForIncomingMessage);
$('chat-input').addEventListener('keydown',event=>{
 if(event.key==='Enter'&&!chatPrefs.enterSend)event.preventDefault();
});
document.addEventListener?.('keydown',event=>{
 if(event.key==='Escape'&&!$('chat-settings-modal').hidden)closePremiumPopup('chat-settings-modal');
});
async function gameFriends(action){
 $('player-actions-modal').hidden=false;
 $('player-actions-title').textContent=action==='invite'?'Zaproś znajomego':
  action==='block'?'Zablokuj gracza':'Wyproś gracza';
 $('player-actions-list').replaceChildren();
 $('player-actions-status').textContent='Sprawdzanie znajomych…';
 try{
  if(action==='remove'){
   $('player-actions-status').textContent='Wypraszanie będzie dostępne dla gospodarza w lobby pokoi. W aktualnej partii 1 na 1 nie usuwamy przeciwnika bez zakończenia rozgrywki.';
   return;
  }
  const result=await api('friends/presence');
  $('player-actions-status').textContent=action==='invite'?
   'Zielony znacznik: aktywny w ostatnich 100 sekundach.':
   'Blokada uniemożliwia kontakt i dalsze zaproszenia.';
  const list=$('player-actions-list');
  const friends=result.friends||[];
  if(!friends.length){
   const p=document.createElement('p');p.className='premium-muted';
   p.textContent='Nie masz jeszcze zaakceptowanych znajomych. Dodaj ich w Panelu Gracza.';
   list.append(p);
   return;
  }
  for(const friend of friends){
   const row=document.createElement('div');row.className='friend-row';
   const info=document.createElement('span');
   const nickname=document.createElement('strong');nickname.textContent=friend.nickname;
   const availability=document.createElement('small');availability.textContent=friend.online?'● online':'● offline';
   if(friend.online)availability.className='online';
   info.append(nickname,availability);
   const button=document.createElement('button');button.type='button';
   button.textContent=action==='invite'?'Zaproś':'Zablokuj';
   button.disabled=action==='invite'&&!friend.online;
   button.addEventListener('click',async()=>{
    button.disabled=true;
    try{
     if(action==='invite')await api('social/challenges',{method:'POST',
       headers:{'Content-Type':'application/json'},
       body:JSON.stringify({action:'send',game:'gomoku',nickname:friend.nickname})});
     else await api('friends/action',{method:'POST',
       headers:{'Content-Type':'application/json'},
       body:JSON.stringify({action:'block',nickname:friend.nickname})});
     $('player-actions-status').textContent=action==='invite'?
       'Wysłano zaproszenie do '+friend.nickname+'.':'Zablokowano '+friend.nickname+'.';
     if(action==='block')row.hidden=true;
    }catch(e){button.disabled=false;$('player-actions-status').textContent=e.message;}
   });
   row.append(info,button);list.append(row);
  }
 }catch(e){$('player-actions-status').textContent=e.message;}
}
$('invite-friend').addEventListener('click',()=>void gameFriends('invite'));
$('remove-player').addEventListener('click',()=>void gameFriends('remove'));
$('block-player').addEventListener('click',()=>void gameFriends('block'));
window.setInterval(()=>{
 if(document.visibilityState==='visible')void api('friends/presence').catch(()=>{});
},45000);

function openGameSettings(){
 updateChatSettingsForm();
 const online=state.mode==='online';
 $('chat-settings-mode').textContent=online?'Partia online — 2 uczestników':'Trening z komputerem';
 $('chat-settings-access').textContent=online?
  'Wiadomości prywatne · zapis w pokoju':'Komentarze treningowe · tylko lokalnie';
 $('chat-privacy-description').textContent=online?
  'Rozmowę widzą tylko uczestnicy tej partii. Ustawienia są zapisywane tylko na Twoim urządzeniu.':
  'Trening nie wysyła wiadomości na serwer. Odpowiedzi komputera są lokalnymi komentarzami, nie wiadomościami innych graczy.';
 $('chat-settings-modal').hidden=false;
 $('chat-sounds').focus();
}
async function toggleFullscreen(){
 try{
  if(document.fullscreenElement){await document.exitFullscreen();return;}
  if(!document.documentElement?.requestFullscreen)throw new Error('unsupported');
  await document.documentElement.requestFullscreen();
 }catch{
  const label=$('analysis-note');label.textContent='Tryb pełnoekranowy nie jest dostępny w tej przeglądarce.';
  label.hidden=false;
 }
}
function setMode(mode){
 if(state.mode===mode)return;
 state.mode=mode;state.epoch++;state.busy=false;state.match=null;state.matchId=null;state.serverOffsetMs=0;
 state.undoDialogId=null;$('undo-request-modal').hidden=true;
 state.chatSignature='';setDockTab('chat');
 $('chat-input').disabled=mode!=='training';$('chat-send').disabled=mode!=='training';
 if(mode==='training')showChatNotice('Napisz komentarz do komputera treningowego. Odpowiedzi są automatyczne.');
 state.suggestion=-1;$('analysis-note').hidden=true;
 $('training-settings').hidden=mode!=='training';$('training-records').hidden=mode!=='training';$('online-settings').hidden=mode!=='online';
 $('refresh-match').hidden=mode!=='online';
 $('training-mode').classList.toggle('active',mode==='training');
 $('online-mode').classList.toggle('active',mode==='online');
 $('training-mode').setAttribute('aria-pressed',String(mode==='training'));
 $('online-mode').setAttribute('aria-pressed',String(mode==='online'));
 if(mode==='online'){render();void rooms();}
 else {history.replaceState(null,'','/konto/gomoku/');restart();}
}
$('training-mode').addEventListener('click',()=>setMode('training'));
$('online-mode').addEventListener('click',()=>setMode('online'));
$('restart').addEventListener('click',restart);
$('undo-move').addEventListener('click',handleUndoClick);
$('analyze-position').addEventListener('click',analyzeTrainingPosition);
$('game-settings').addEventListener('click',openGameSettings);
$('fullscreen-game').addEventListener('click',()=>void toggleFullscreen());
$('training-time').addEventListener('change',()=>{
 const unlimited=$('training-time').value==='0';
 $('training-increment').disabled=unlimited;
 if(unlimited)$('training-increment').value='0';
 restart();
});
$('training-increment').addEventListener('change',restart);
$('create-room-time').addEventListener('change',()=>{
 const unlimited=$('create-room-time').value==='0';
 $('create-room-increment').disabled=unlimited;
 if(unlimited)$('create-room-increment').value='0';
});
$('ai-level').addEventListener('change',()=>{
 const descriptions={
  normal:'Normalny: podstawowe szukanie pięciu w rzędzie, blokowanie i ocena bliskich pól.',
  hard:'Trudny: analizuje zagrożenia oraz odpowiedź przeciwnika.',
  expert:'Ekspert: analizuje kilka kolejnych ruchów, podwójne zagrożenia i wymuszone bloki.'
 };
 $('ai-hint').textContent=descriptions[$('ai-level').value]||descriptions.expert;
 restart();
});
$('reload-rooms').addEventListener('click',()=>void rooms());
$('join-room').addEventListener('click',()=>void loadMatch($('room-select').value));
$('refresh-match').addEventListener('click',()=>void refreshOnline());
window.setInterval(()=>{
 if(state.mode==='online'&&state.matchId&&!state.busy&&document.visibilityState==='visible')
  void refreshOnline();
},4000);
// The reference artwork depicts a mid-game position. The opening display is clearly
// marked as a visual example; the FIRST click starts a clean, playable game.
function installReferenceShowcase(){
 const sequence=[
  [1,'H7'],[2,'H3'],[1,'I7'],[2,'H4'],[1,'J7'],[2,'H5'],
  [1,'K7'],[2,'H6'],[1,'K6'],[2,'L7'],[1,'H10'],[2,'J8']
 ];
 state.board=Array(count).fill(0);
 state.trainHistory=[];
 for(let n=0;n<sequence.length;n++){
  const [player,move]=sequence[n];
  const at=(Number(move.slice(1))-1)*15+(move.charCodeAt(0)-65);
  state.board[at]=player;
  state.trainHistory.push({player,to:at,number:n+1});
  state.last=at;
 }
 state.moves=sequence.length;state.winner=0;state.showcase=true;
 state.trainClock=createTrainingClock();
 state.localChat=[
  {id:'example-1',player:1,body:'Powodzenia! 🙂',createdAt:'2026-11-01T20:34:00.000Z'},
  {id:'example-2',player:2,body:'Dzięki, wzajemnie! 🤝',createdAt:'2026-11-01T20:35:00.000Z'}
 ];
 state.chatSignature='';state.chatSequence=2;
}
installReferenceShowcase();
render();
drawRoomChat(state.localChat);
applyChatPreferences();
$('chat-status').textContent='Podgląd przykładowej partii · kliknij planszę, by rozpocząć';
const entry=new URLSearchParams(location.search).get('match');
if(entry&&matchPattern.test(entry))setMode('online');
})();`;
export function serveGomokuConsole(req,res,url){
 if(req.method!=='GET')return false;
 const path=url.pathname.replace(/\/+$/,'')||'/';
 const response={
  '/konto/gomoku':['text/html; charset=utf-8',html],
  '/konto/gomoku/styl.css':['text/css; charset=utf-8',css],
  '/konto/gomoku/app.js':['application/javascript; charset=utf-8',js]
 }[path];
 if(!response)return false;
 res.writeHead(200,{...secure,'Content-Type':response[0],'Content-Length':Buffer.byteLength(response[1])});
 res.end(response[1]);return true;
}

