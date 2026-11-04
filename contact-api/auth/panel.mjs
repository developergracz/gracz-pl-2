import {enhanceProfileHtml,premiumProfileStyles,premiumProfileScript,servePublicProfile} from './profile-premium-ui.mjs';
const headers = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};
const html=enhanceProfileHtml(String.raw`<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Panel Gracza Full Max Premium — gracz.pl</title>
<link rel="stylesheet" href="/konto/panel/styl.css"><script src="/konto/panel/app.js" defer></script></head>
<body><a class="skip" href="#content">Przejdź do treści</a>
<div class="site-nav"><a class="site-brand" href="https://gracz.pl/" aria-label="Strona startowa gracz.pl">gracz<span>.pl</span></a><nav aria-label="Menu główne serwisu"><a href="https://gracz.pl/gry/">Gry</a><a href="https://gracz.pl/gry/tysiac/">Gry karciane</a><a href="https://gracz.pl/poradniki/">Poradniki</a><a href="https://gracz.pl/blog/">Blog</a><a href="https://gracz.pl/spolecznosc/">Społeczność</a><a href="https://gracz.pl/#newsletter">Newsletter</a></nav></div>
<header class="top"><a class="logo" href="https://gracz.pl/" aria-label="gracz.pl — strona główna">gracz<span>.pl</span></a>
<span class="top-tag">POLSKIE CENTRUM GRACZA <b>FULL MAX PREMIUM</b></span>
<a class="top-link" href="https://gracz.pl/gry/">Odkryj gry <span aria-hidden="true">↗</span></a></header>
<section id="access-screen" class="access-screen" aria-live="polite">
<div class="access-card">
<p class="card-kicker">POLSKIE CENTRUM GRACZA · FULL MAX PREMIUM</p>
<div class="access-icon" aria-hidden="true">♟</div>
<h1 id="access-title">Sprawdzanie konta…</h1>
<p id="access-message">Trwa bezpieczna weryfikacja sesji. Twoje dane nie są jeszcze wyświetlane.</p>
<div class="access-actions"><a id="access-login" class="primary link-button" href="/konto/?widok=login" hidden>Zaloguj się do konta</a><button id="access-retry" class="secondary" type="button" hidden>Spróbuj ponownie</button></div>
</div></section>
<div class="shell" id="player-shell" hidden>
<aside class="sidebar"><div class="identity"><div class="avatar" id="nav-avatar" aria-hidden="true">G</div><p class="small">TWOJE KONTO</p>
<strong id="nav-name">Wczytywanie…</strong><span class="status"><i aria-hidden="true"></i> Zalogowany gracz</span></div>
<nav aria-label="Panel gracza">
<button class="nav active" data-section="dashboard" type="button"><span aria-hidden="true">⌂</span> Pulpit gracza</button>
<button class="nav" data-section="profile" type="button"><span aria-hidden="true">♙</span> Konto i profil</button>
<button class="nav" data-section="friends" type="button"><span aria-hidden="true">♧</span> Moi znajomi</button>
<button class="nav" data-section="security" type="button"><span aria-hidden="true">✦</span> Bezpieczeństwo</button>
<button class="nav" data-section="privacy" type="button"><span aria-hidden="true">◈</span> Prywatność</button>
<button class="nav" data-section="notifications" type="button"><span aria-hidden="true">♢</span> Powiadomienia</button>
<button class="nav" data-section="messages" type="button"><span aria-hidden="true">✉</span> Wiadomości i chat</button>
<button class="nav" data-section="challenges" type="button"><span aria-hidden="true">⚔</span> Zaproszenia do gier</button>
<button class="nav" data-section="play" type="button"><span aria-hidden="true">▦</span> Moje partie</button>
<a class="nav" href="/konto/gomoku/"><span aria-hidden="true">◉</span> Gomoku Premium</a>
<button class="nav" data-section="games" type="button"><span aria-hidden="true">♜</span> Gry i rozgrywka</button>
<button class="nav" data-section="appearance" type="button"><span aria-hidden="true">☼</span> Wygląd i dostępność</button>
<button class="nav" data-section="sessions" type="button"><span aria-hidden="true">▣</span> Sesje i urządzenia</button>
<button class="nav" data-section="data" type="button"><span aria-hidden="true">▤</span> Dane i konto</button>
</nav><button class="nav create-room" id="create-room" type="button"><span aria-hidden="true">＋</span> Utwórz pokój</button><button class="signout" id="side-logout" type="button">Wyloguj się <span aria-hidden="true">↗</span></button></aside>
<main id="content" class="main">
<div class="masthead"><div><p class="eyebrow">CENTRUM GRACZA <span aria-hidden="true">◆</span> FULL MAX PREMIUM</p>
<h1 id="title">Pulpit gracza</h1><p id="subtitle">Witaj w Twoim centrum rozgrywek.</p></div>
<div class="mark" aria-hidden="true"><span>♠</span><small>GRACZ.PL</small></div></div>
<div id="notice" class="notice" role="status" aria-live="polite">Sprawdzanie bezpiecznej sesji…</div>
<section class="view active" data-panel="dashboard">
<div class="card hero-card"><div class="player-avatar" id="dashboard-avatar" aria-hidden="true">G</div><div><p class="card-kicker">WITAJ W POLSKIM CENTRUM GRACZA</p><h2 id="dashboard-name">Twoje centrum gier</h2><p>Twoje konto, ulubione gry i ustawienia w jednym miejscu.</p></div><div class="verified">✓ Konto potwierdzone</div></div>
<div class="stats"><div class="card stat"><small>AKTYWNE SESJE</small><strong id="dashboard-sessions">—</strong><span>Zalogowane urządzenia</span></div>
<div class="card stat"><small>ULUBIONE GRY</small><strong id="dashboard-favorites">—</strong><span>Twój szybki dostęp</span></div>
<div class="card stat"><small>GRACZ OD</small><strong id="dashboard-joined">—</strong><span>Data utworzenia konta</span></div></div>
<div class="card"><div class="card-heading"><div><p class="card-kicker">TWOJA STREFA</p><h2>Ulubione gry</h2></div><button class="secondary" type="button" id="dashboard-manage-games">Zarządzaj grami</button></div>
<p id="favorites-empty">Dodaj ulubione tytuły w zakładce Gry i rozgrywka.</p><div class="favorite-links" id="favorites-links"></div></div>
<div class="card"><p class="card-kicker">SZYBKIE DZIAŁANIA</p><div class="quick-actions">
<button type="button" class="secondary" id="dashboard-profile">Edytuj profil</button>
<button type="button" class="secondary" id="dashboard-devices">Bezpieczne sesje</button>
<a class="primary link-button" href="/konto/gomoku/">Zagraj w Gomoku</a>
<a class="secondary link-button" href="https://gracz.pl/gry/">Pozostałe gry</a></div></div>
</section>
<section class="view premium-profile" data-panel="profile">
<div class="card profile-hero-premium">
 <div class="profile-topline"><span>✦ TWOJA STREFA · FULL MAX PREMIUM</span><span class="profile-verified">● Konto zweryfikowane</span></div>
 <div class="profile-hero-body"><div class="profile-intro"><div class="profile-avatar-frame"><div class="profile-avatar-large" id="profile-avatar" aria-hidden="true">G</div><span class="profile-avatar-check">✓</span></div>
 <div><p class="card-kicker">PROFIL GRACZA</p><h2 id="profile-heading">Gracz</h2><p id="profile-handle">@gracz</p><div class="profile-chips"><span id="profile-country-tag">Polska</span><span id="profile-language-tag">Polski</span><span>GRACZ.PL</span></div></div></div>
 <div class="profile-hero-actions"><button type="button" class="primary" id="profile-edit-scroll">Edytuj wizytówkę</button><button type="button" class="secondary" data-profile-jump="appearance">Wygląd panelu</button></div></div>
 <div class="profile-metrics">
 <div class="profile-metric"><small>UZUPEŁNIENIE PROFILU</small><strong id="profile-completion">—</strong><progress id="profile-progress" max="100" value="0" aria-label="Stopień uzupełnienia profilu"></progress><span id="profile-next-step">Uzupełnij wizytówkę</span></div>
 <div class="profile-metric"><small>ULUBIONE GRY</small><strong id="profile-favorites">—</strong><span>Zapisane na koncie</span></div>
 <div class="profile-metric"><small>AKTYWNE SESJE</small><strong id="profile-sessions">—</strong><span>Zalogowane urządzenia</span></div>
 <div class="profile-metric"><small>GRACZ OD</small><strong id="profile-joined-summary">—</strong><span>Data dołączenia</span></div>
 </div></div>
<div class="profile-layout"><div class="profile-main-column">
 <form id="profile-form" class="card profile-editor" autocomplete="on">
 <div class="card-heading"><div><p class="card-kicker">01 / PERSONALIZACJA</p><h2>Edytuj dane gracza</h2><p>Ustaw swoją wizytówkę. Edycja zapisuje się na koncie dopiero po zatwierdzeniu.</p></div><span class="profile-pill">BEZPIECZNA EDYCJA</span></div>
 <div class="form-grid">
 <label>Nick gracza <small>Stały identyfikator</small><input id="nickname" disabled title="Nick jest identyfikatorem konta"></label>
 <label>Adres e-mail <small>Zweryfikowany</small><input id="email" type="email" disabled title="Adres potwierdzony podczas rejestracji"></label>
 <label>Nazwa wyświetlana <small>Widoczna w wizytówce</small><input id="display-name" maxlength="40" minlength="2" autocomplete="nickname" required></label>
 <label>Kraj <small>Informacja w profilu</small><select id="country"><option value="PL">Polska</option><option value="DE">Niemcy</option><option value="CZ">Czechy</option><option value="SK">Słowacja</option><option value="OTHER">Inny</option></select></label>
 <label>Język <small>Twój język</small><select id="language"><option value="pl">Polski</option><option value="en">English</option><option value="de">Deutsch</option></select></label>
 <label class="wide">O mnie <small>Twój styl gry i zainteresowania</small><textarea id="bio" rows="5" maxlength="300" placeholder="W jakie gry lubisz grać? Jakim jesteś graczem?"></textarea><small id="profile-bio-counter">0 / 300 znaków</small></label>
 </div>
 <div class="profile-edit-hint"><span aria-hidden="true">✦</span> Podgląd obok aktualizuje się podczas pisania. Tylko zapisane dane zostają na koncie.</div>
 <div class="form-actions"><span id="saved-state" role="status" aria-live="polite">Dane zapisane bezpiecznie w koncie</span><div class="profile-form-buttons"><button class="secondary" id="profile-reset" type="button">Cofnij zmiany</button><button class="primary" id="save" type="submit">Zapisz profil</button></div></div>
 </form>
 <div class="card profile-password-card" id="profile-password-section">
  <div class="card-heading"><div><p class="card-kicker">OCHRONA KONTA · FULL MAX PREMIUM</p><h2>Zmiana hasła</h2><p>Zmień hasło bez opuszczania panelu gracza. Po zapisaniu pozostałe zalogowane urządzenia zostaną wylogowane.</p></div><span class="profile-pill">BEZPIECZNE KONTO</span></div>
  <form id="pw-change-form" class="profile-password-form" autocomplete="on">
   <label for="pw-current">Obecne hasło</label><div class="profile-password-field"><input type="password" id="pw-current" autocomplete="current-password" required maxlength="256"><button type="button" data-password-toggle="pw-current" aria-label="Pokaż obecne hasło" aria-pressed="false">Pokaż</button></div>
   <label for="pw-next">Nowe hasło</label><div class="profile-password-field"><input type="password" id="pw-next" autocomplete="new-password" minlength="15" maxlength="256" required aria-describedby="pw-hint"><button type="button" data-password-toggle="pw-next" aria-label="Pokaż nowe hasło" aria-pressed="false">Pokaż</button></div>
   <small id="pw-hint">Co najmniej 15 znaków. Użyj unikalnego hasła, którego nie używasz w innych serwisach.</small>
   <label for="pw-confirm">Powtórz nowe hasło</label><div class="profile-password-field"><input type="password" id="pw-confirm" autocomplete="new-password" minlength="15" maxlength="256" required><button type="button" data-password-toggle="pw-confirm" aria-label="Pokaż potwierdzenie hasła" aria-pressed="false">Pokaż</button></div>
   <div class="form-actions"><span id="pw-change-status" role="status" aria-live="polite">Aktualne hasło nie jest wyświetlane ani zapisywane w panelu.</span><button class="primary" id="pw-change-submit" type="submit">Zmień hasło</button></div>
  </form>
 </div>
 <div class="card profile-shortcuts"><p class="card-kicker">02 / CENTRUM GRACZA</p><h2>Szybkie zarządzanie</h2><div class="profile-shortcut-grid">
 <button type="button" data-profile-jump="games"><span aria-hidden="true">♜</span><strong>Moje gry</strong><small>Ulubione tytuły</small></button>
 <button type="button" data-profile-jump="friends"><span aria-hidden="true">♧</span><strong>Moi znajomi</strong><small>Kontakty i zaproszenia</small></button>
 <button type="button" data-profile-jump="sessions"><span aria-hidden="true">▣</span><strong>Sesje i urządzenia</strong><small>Kontrola logowań</small></button>
 <button type="button" data-profile-jump="data"><span aria-hidden="true">⇩</span><strong>Dane konta</strong><small>Eksport profilu</small></button></div></div>
</div>
<aside class="profile-side-column" aria-label="Podgląd i informacje o profilu">
 <div class="card profile-preview-card"><p class="card-kicker">PODGLĄD NA ŻYWO</p><h2>Twoja wizytówka</h2>
 <div class="profile-preview-inner"><div class="profile-preview-avatar" id="profile-preview-avatar" aria-hidden="true">G</div><strong id="profile-preview-name">Gracz</strong><span id="profile-preview-handle">@gracz</span><p id="profile-preview-bio">Tutaj pojawi się Twój opis gracza.</p>
 <div class="profile-chips"><span id="profile-preview-country">Polska</span><span id="profile-preview-language">Polski</span></div></div>
 <p class="profile-preview-caption">Podgląd widoczny tylko w Twoim panelu. Nie oznacza publicznego opublikowania profilu.</p></div>
 <div class="card profile-account-card"><p class="card-kicker">TWOJA TOŻSAMOŚĆ</p><h2>Informacje o koncie</h2>
 <div class="detail"><span>Nick</span><strong id="profile-info-nick">—</strong></div>
 <div class="detail"><span>E-mail</span><strong id="profile-info-email">—</strong></div>
 <div class="detail"><span>Dołączono</span><strong id="profile-info-joined">—</strong></div>
 <div class="detail"><span>Status</span><strong>Potwierdzony</strong></div>
 <button type="button" class="secondary profile-security-link" data-profile-jump="security">Bezpieczeństwo konta</button></div>
 <div class="profile-game-links"><a href="/konto/warcaby/">♟ Graj w Warcaby</a><a href="/konto/gomoku/">◉ Graj w Gomoku</a></div>
</aside></div>
</section>
<section class="view" data-panel="friends">
<div class="card"><p class="card-kicker">TWOJA SPOŁECZNOŚĆ · FULL MAX PREMIUM</p><h2>Moi znajomi</h2>
<p>Wyszukaj gracza po nicku i wyślij zaproszenie. Kontrolujesz, kto może nawiązać z Tobą kontakt. Status online wymaga przyszłej integracji. Prywatne wiadomości są dostępne w osobnej zakładce.</p>
<form id="friends-search-form" class="friends-search" role="search">
<label for="friends-query">Znajdź gracza</label><div class="friends-search-controls">
<input id="friends-query" type="search" placeholder="Wpisz co najmniej 3 znaki nicku" minlength="3" maxlength="32" autocomplete="off" required>
<button class="primary" type="submit">Szukaj</button></div></form>
<div id="friends-search-results" class="friends-items" aria-live="polite"></div>
<p id="friends-status" role="status" aria-live="polite">Twoja lista znajomych jest wczytywana…</p></div>
<div class="stats friends-stats">
<div class="card stat"><small>MOI ZNAJOMI</small><strong id="friends-count">—</strong><span>Zaakceptowane kontakty</span></div>
<div class="card stat"><small>ZAPROSZENIA</small><strong id="friends-incoming-count">—</strong><span>Oczekujące na decyzję</span></div>
<div class="card stat"><small>WYSŁANE</small><strong id="friends-outgoing-count">—</strong><span>Oczekujące na odpowiedź</span></div></div>
<div class="card"><div class="card-heading"><div><p class="card-kicker">KONTAKTY</p><h2>Lista znajomych</h2></div><button id="friends-refresh" type="button" class="secondary">Odśwież</button></div><div id="friends-list" class="friends-items"></div></div>
<div class="card"><p class="card-kicker">ZAPROSZENIA PRZYCHODZĄCE</p><h2>Zaproszenia do znajomych</h2><div id="friends-incoming" class="friends-items"></div></div>
<div class="card"><p class="card-kicker">ZAPROSZENIA WYSŁANE</p><h2>Oczekujące odpowiedzi</h2><div id="friends-outgoing" class="friends-items"></div></div>
<div class="card"><p class="card-kicker">PRYWATNOŚĆ</p><h2>Zablokowani użytkownicy</h2>
<p>Zablokowane osoby nie mogą wysyłać Ci zaproszeń. Możesz je odblokować w dowolnym momencie.</p><div id="friends-blocked" class="friends-items"></div></div>
</section>
<section class="view" data-panel="security"><div class="card"><p class="card-kicker">BEZPIECZEŃSTWO</p><h2>Ochrona konta</h2><p>Adres e-mail został potwierdzony. Hasło jest przechowywane w formie kryptograficznego skrótu, a sesja jest chroniona ciasteczkiem HttpOnly.</p>
<div class="detail"><span>Sesja</span><strong>Aktywna na tym urządzeniu</strong></div><div class="detail"><span>Zmiana hasła</span><strong>Dostępna w „Konto i profil”</strong></div><div class="detail"><span>2FA</span><strong>W przygotowaniu</strong></div>
<button class="secondary" id="security-logout" type="button">Wyloguj z tego urządzenia</button></div></section>
<section class="view" data-panel="privacy"><div class="card"><p class="card-kicker">PRYWATNOŚĆ</p><h2>Widoczność profilu</h2><p>Ustawienia widoczności, historii rozgrywek i zaproszeń będą dostępne po wdrożeniu społeczności Gracz Next. Żadne niewdrożone ustawienie nie jest tutaj prezentowane jako aktywne.</p></div></section>
<section class="view" data-panel="notifications"><div class="card"><p class="card-kicker">POWIADOMIENIA</p><h2>Informacje o rozgrywkach</h2><p>Powiadomienia o wiadomościach, turniejach i rankingach zostaną dodane po uruchomieniu tych modułów.</p></div></section>
<section class="view" data-panel="messages">
<div class="card">
<p class="card-kicker">PRYWATNE ROZMOWY</p><h2>Wiadomości ze znajomymi</h2>
<p>Rozmawiaj bezpośrednio z zaakceptowanymi znajomymi. Wiadomości są przechowywane w Twoim koncie. Rozmowę możesz odświeżyć ręcznie; czat na żywo jest przygotowywany.</p>
<label class="social-label" for="message-recipient">Wybierz znajomego</label>
<div class="social-controls"><select id="message-recipient"><option value="">Wybierz znajomego</option></select>
<button id="messages-refresh" type="button" class="secondary">Odśwież rozmowę</button></div>
<div id="message-thread" class="social-thread" aria-live="polite"><p>Wybierz znajomego, aby wyświetlić rozmowę.</p></div>
<form id="message-form" class="social-send">
<label class="social-label" for="message-content">Nowa wiadomość</label>
<textarea id="message-content" rows="3" maxlength="1000" placeholder="Napisz prywatną wiadomość…" required></textarea>
<div class="form-actions"><span>Do 1000 znaków · tylko znajomi</span><button class="primary" type="submit" id="message-send" disabled>Wyślij wiadomość</button></div>
</form><p id="messages-state" aria-live="polite">Wybierz znajomego z listy.</p>
</div></section>
<section class="view" data-panel="challenges">
<div class="card"><p class="card-kicker">WARCABY I GOMOKU</p><h2>Zaproszenia do gier</h2>
<p>Wyślij znajomemu wyzwanie, zaakceptuj lub odrzuć zaproszenie. Wyzwania są zapisane na kontach obu graczy i wygasają po 7 dniach.</p>
<p class="social-limitation">Po zaakceptowaniu wyzwania kliknij „Graj online”, aby otworzyć wspólną planszę. Ruchy są zatwierdzane i zapisywane na serwerze. Stan gry odświeża się automatycznie.</p>
<form id="challenge-form" class="social-send">
<label class="social-label" for="challenge-friend">Zaproś znajomego</label>
<div class="social-controls"><select id="challenge-friend"><option value="">Wybierz znajomego</option></select>
<select id="challenge-game" aria-label="Wybierz grę"><option value="warcaby">Warcaby</option><option value="gomoku">Gomoku</option></select>
<button class="primary" type="submit">Wyślij wyzwanie</button></div>
</form>
<div class="card-heading"><div><p class="card-kicker">AKTYWNE WYZWANIA</p><h2>Twoje zaproszenia</h2></div>
<button class="secondary" id="challenges-refresh" type="button">Odśwież</button></div>
<div id="challenge-list" class="friends-items" aria-live="polite"></div>
<p id="challenges-state" aria-live="polite"></p>
</div></section>
<section class="view" data-panel="play">
<div class="card"><p class="card-kicker">ROZGRYWKA DWÓCH GRACZY · FULL MAX PREMIUM</p>
<h2 id="match-heading">Wybierz przyjęte wyzwanie</h2>
<p id="match-state" aria-live="polite">Otwórz zakładkę „Zaproszenia do gier” i wybierz „Graj online” przy zaakceptowanym wyzwaniu.</p>
<div class="match-top">
<div id="match-players" class="match-players"></div>
<button id="match-refresh" class="secondary" type="button">Odśwież partię</button>
</div>
<div id="match-board" class="match-board" role="group" aria-label="Plansza gry"></div>
<p class="social-limitation">Gomoku: 15×15, wygrywa pięć w rzędzie. Warcaby: 8×8, obowiązkowe bicie, możliwe wielokrotne bicie, damka porusza się o jedno pole. Ruchy są zatwierdzane przez serwer i widoczne u obu graczy.</p>
</div>
</section>
<section class="view" data-panel="games">
<div class="card"><p class="card-kicker">MOJA BIBLIOTEKA</p><h2>Ulubione gry</h2>
<p>Wybierz ulubione tytuły. Gwiazdka zapisuje wybór w Twoim koncie i dodaje skrót na pulpicie.</p>
<div class="game-grid">
<div class="game-tile"><div class="game-emoji" aria-hidden="true">♟</div><h3>Warcaby</h3><p>Gra strategiczna</p><div class="game-actions"><a href="/konto/warcaby/">Graj teraz</a><button type="button" data-favorite="warcaby" aria-pressed="false" aria-label="Dodaj Warcaby do ulubionych">☆ Ulubione</button></div></div>
<div class="game-tile"><div class="game-emoji" aria-hidden="true">◉</div><h3>Gomoku</h3><p>Pięć w rzędzie</p><div class="game-actions"><a href="/konto/gomoku/">Graj teraz</a><a href="https://gracz.pl/gry/gomoku/">Zasady</a><button type="button" data-favorite="gomoku" aria-pressed="false" aria-label="Dodaj Gomoku do ulubionych">☆ Ulubione</button></div></div>
<div class="game-tile"><div class="game-emoji" aria-hidden="true">♣</div><h3>Tysiąc</h3><p>Gra karciana</p><div class="game-actions"><a href="https://gracz.pl/gry/tysiac/">Otwórz</a><button type="button" data-favorite="tysiac" aria-pressed="false" aria-label="Dodaj Tysiąc do ulubionych">☆ Ulubione</button></div></div>
<div class="game-tile"><div class="game-emoji" aria-hidden="true">♠</div><h3>Poker treningowy</h3><p>Trening rozgrywki</p><div class="game-actions"><a href="https://gracz.pl/gry/poker-treningowy/">Otwórz</a><button type="button" data-favorite="poker" aria-pressed="false" aria-label="Dodaj Poker do ulubionych">☆ Ulubione</button></div></div>
</div></div></section>
<section class="view" data-panel="appearance"><div class="card">
<p class="card-kicker">PERSONALIZACJA PREMIUM</p><h2>Wygląd i dostępność</h2><p>Ustawienia działają na Twoim panelu i zapisują się na koncie, również po ponownym logowaniu.</p>
<form id="appearance-form" class="appearance-form"><label class="setting"><span><strong>Gęstość układu</strong><small>Wybierz ilość przestrzeni wokół elementów.</small></span>
<select id="setting-density"><option value="comfortable">Komfortowy</option><option value="compact">Kompaktowy</option></select></label>
<label class="setting"><span><strong>Większy tekst</strong><small>Większa czytelność informacji na ekranie.</small></span><input id="setting-large" type="checkbox"></label>
<label class="setting"><span><strong>Ogranicz animacje</strong><small>Mniej efektów ruchu niezależnie od urządzenia.</small></span><input id="setting-motion" type="checkbox"></label>
<div class="form-actions"><span id="appearance-state">Ustawienia zapisane na koncie</span><button class="primary" id="appearance-save" type="submit">Zapisz wygląd</button></div></form>
</div></section>
<section class="view" data-panel="sessions"><div class="card">
<p class="card-kicker">BEZPIECZEŃSTWO</p><h2>Aktywne sesje</h2>
<p>Sprawdź daty aktywnych logowań. Ze względów prywatności nie pokazujemy nazw urządzeń, których system dotąd nie rejestrował.</p>
<div id="session-list" class="session-list" aria-live="polite"></div>
<div class="quick-actions"><button class="secondary" id="sessions-refresh" type="button">Odśwież sesje</button><button class="primary" id="sessions-revoke" type="button">Wyloguj inne sesje</button><button class="secondary" id="session-logout" type="button">Wyloguj to urządzenie</button></div>
</div></section>
<section class="view" data-panel="data"><div class="card">
<p class="card-kicker">DANE GRACZA</p><h2>Twoje dane</h2>
<p>Pobierz kopię swoich podstawowych danych profilu i ustawień panelu w formacie JSON. To nie jest pełny eksport wszystkich danych usług gracz.pl.</p>
<button class="primary" id="export-profile" type="button">Pobierz dane profilu (JSON)</button>
<div class="detail"><span>Usunięcie konta i pełny dostęp do danych</span><strong>Kontakt z administracją</strong></div>
<p>Samodzielne usunięcie konta wymaga osobnego, bezpiecznego procesu. Nie jest jeszcze dostępne w panelu.</p>
<a class="secondary link-button" href="mailto:kontakt@gracz.pl">Kontakt z administracją</a>
</div></section>
<footer class="footer">© gracz.pl · Polskie Centrum Gracza · Full Max Premium</footer></main></div></body></html>`);
const css=String.raw`[hidden]{display:none!important}*{box-sizing:border-box}html{background:#03101d;color:#f4f8fc;font-family:Inter,"Segoe UI",Arial,sans-serif}body{margin:0;min-height:100dvh;background:radial-gradient(ellipse at 85% 12%,#073e52b5,transparent 38%),radial-gradient(ellipse at 14% 78%,#1830527d,transparent 38%),linear-gradient(145deg,#03101b,#071927 58%,#020914)}button,input,select,textarea{font:inherit}button,a{touch-action:manipulation}a{color:inherit}.skip{position:absolute;left:-999px;top:0;z-index:5}.skip:focus{left:15px;top:15px;background:#ffd07a;color:#071421;padding:9px}.top{min-height:80px;padding:14px clamp(16px,4.5vw,80px);display:flex;align-items:center;gap:30px;justify-content:space-between;background:#021321d9;border-bottom:1px solid #326073}.logo{font-size:clamp(30px,3vw,43px);font-weight:900;letter-spacing:-2px;text-decoration:none;white-space:nowrap}.logo span{color:#e92c49}.top-tag{font-size:11px;letter-spacing:2px;color:#99c7d8;font-weight:800}.top-tag b{color:#f7cb75;margin-left:13px}.top-link{border:1px solid #e9ba62;border-radius:9px;padding:11px 16px;text-decoration:none;color:#ffdc8c;font-weight:750;white-space:nowrap}.shell{max-width:1700px;margin:auto;display:grid;grid-template-columns:270px minmax(0,1fr);gap:24px;padding:clamp(14px,2.2vw,34px)}.sidebar{min-width:0;align-self:start;border:1px solid #2c5465;border-radius:22px;background:linear-gradient(160deg,#0b2434f5,#061824f5);box-shadow:0 18px 50px #0005;overflow:hidden;position:sticky;top:15px}.identity{padding:26px 23px 19px;border-bottom:1px solid #21475b}.avatar,.player-avatar{display:grid;place-items:center;border-radius:50%;border:2px solid #eac476;color:#ffd67d;background:radial-gradient(circle at 30% 25%,#246078,#041a2b 78%);font-weight:800;box-shadow:0 0 22px #0eb9da44}.avatar{height:64px;width:64px;font-size:31px}.small,.card-kicker,.eyebrow{font-size:11px;letter-spacing:2px;color:#e5bd74;font-weight:900}.identity strong{display:block;font-size:20px;overflow-wrap:anywhere}.identity .small{margin:16px 0 7px}.status{color:#99c9d3;font-size:12px;display:flex;align-items:center;gap:8px;margin-top:12px}.status i{height:8px;width:8px;background:#3ee5ac;border-radius:50%;box-shadow:0 0 10px #3ee5ac}.sidebar nav{display:grid;gap:5px;padding:17px 10px}.nav{display:flex;gap:12px;text-align:left;width:100%;align-items:center;background:transparent;color:#b6cfd9;border:1px solid transparent;border-radius:10px;padding:13px 14px;cursor:pointer;font-weight:700;font-size:13px}.nav span{width:23px;text-align:center;font-size:19px;color:#79c9d6}.nav:hover,.nav:focus-visible{background:#17364a;color:#fff}.nav.active{background:linear-gradient(90deg,#194454,#0b2c41);color:#fff;border-color:#427587}.nav.active span{color:#ffd07a}.signout{width:calc(100% - 24px);margin:2px 12px 16px;padding:13px;border:1px solid #42677a;border-radius:10px;background:#102c3d;color:#fff;font-weight:800;cursor:pointer}.signout span{float:right}.main{min-width:0}.masthead{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:190px;margin-bottom:18px;padding:clamp(22px,3vw,42px);border-radius:22px;border:1px solid #266779;background:linear-gradient(110deg,#0c3249e8,#06162799 65%),radial-gradient(circle at 85% 45%,#0a778a8c,transparent 50%);position:relative;overflow:hidden}.masthead:after{content:"";pointer-events:none;position:absolute;inset:0;border-radius:22px;box-shadow:inset 0 0 65px #05b5ce16}.masthead h1{font-size:clamp(32px,4.4vw,55px);line-height:1.05;margin:12px 0;color:#fff;letter-spacing:-1px}.masthead p:last-child{color:#b4cfdc;margin:0}.mark{height:124px;width:124px;border:8px double #e4b96b;border-radius:50%;display:grid;place-items:center;align-content:center;transform:rotate(8deg);color:#ffd27c;background:#082638;box-shadow:0 0 40px #dcb56632;flex:none}.mark span{font-size:55px;line-height:1}.mark small{font-size:10px;font-weight:900}.notice{padding:12px 17px;background:#112d39;border:1px solid #386578;border-radius:12px;margin-bottom:16px;color:#c8e5ed;font-size:13px}.notice[hidden]{display:none}.notice.error{border-color:#a9505d;color:#ffdadc}.view{display:none}.view.active{display:grid;gap:18px}.card{background:linear-gradient(145deg,#0a2332f6,#061925f8);border:1px solid #2c5667;box-shadow:0 10px 40px #0004;border-radius:18px;padding:clamp(19px,2.5vw,32px)}.card h2{font-size:clamp(21px,2.5vw,30px);margin:5px 0 15px}.card p{line-height:1.7;color:#b7cbd4}.card-kicker{margin:0!important;color:#e8b967!important}.hero-card{display:flex;gap:24px;align-items:center;border-color:#906d3d;background:linear-gradient(100deg,#102b3d,#071d2e)}.player-avatar{width:87px;height:87px;flex:none;font-size:44px}.hero-card h2{margin:6px 0 2px}.hero-card p{margin:0}.verified{margin-left:auto;color:#66e6b9;border:1px solid #247967;background:#0d403d73;padding:9px 14px;border-radius:50px;font-size:12px;font-weight:800;white-space:nowrap}.card-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:10px}.card-note{font-size:12px;color:#95b4c1}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.form-grid label{display:grid;align-content:start;gap:9px;color:#d9e6ed;font-size:13px;font-weight:750}.form-grid .wide{grid-column:1/-1}.form-grid input,.form-grid select,.form-grid textarea{background:#091e2c;border:1px solid #426274;color:#fff;border-radius:9px;min-height:46px;padding:12px 13px;width:100%;min-width:0;outline-offset:3px}.form-grid textarea{resize:vertical;min-height:110px}.form-grid input:disabled{background:#0b2630;color:#a4bfce;cursor:not-allowed}.form-grid small{color:#85a8b9;font-size:11px}.form-actions{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap;padding-top:25px}.form-actions span{color:#8bafbb;font-size:12px}.primary,.secondary{border-radius:10px;padding:14px 20px;font-size:14px;font-weight:850;cursor:pointer}.primary{border:1px solid #ffdd95;background:linear-gradient(180deg,#ffe1a0,#dca94f);color:#101725;box-shadow:0 5px 20px #edb35f35}.primary:disabled{opacity:.65;cursor:wait}.secondary{border:1px solid #5490a2;background:#10374b;color:#f2f9fb}.link-button{display:inline-flex;text-decoration:none;margin-top:12px}.detail{display:flex;justify-content:space-between;gap:14px;border-bottom:1px solid #285062;padding:18px 0;color:#b2cad5}.detail strong{color:#fff;text-align:right}.footer{padding:23px;color:#7194a8;font-size:12px;text-align:center}:focus-visible{outline:3px solid #ffd17c;outline-offset:3px}@media(max-width:900px){.shell{grid-template-columns:1fr}.sidebar{position:static}.sidebar nav{display:flex;overflow-x:auto;gap:8px}.nav{min-width:max-content;width:auto}.identity{display:flex;align-items:center;gap:13px;padding:14px}.identity .small,.identity .status{display:none}.avatar{width:45px;height:45px;font-size:24px}.identity strong{font-size:16px}.signout{width:auto;margin:0 12px 14px}.top-tag{display:none}}@media(max-width:610px){.top{min-height:65px}.top-link{font-size:12px;padding:10px}.shell{padding:12px;gap:14px}.masthead{min-height:155px;padding:20px}.mark{width:67px;height:67px;border-width:4px}.mark span{font-size:29px}.mark small{font-size:7px}.hero-card{flex-wrap:wrap;gap:12px}.player-avatar{height:68px;width:68px;font-size:33px}.verified{margin-left:0}.form-grid{grid-template-columns:1fr}.card-heading{display:block}.card-note{display:none}.form-actions{align-items:stretch}.form-actions button{width:100%}}.access-screen{min-height:calc(100dvh - 80px);display:grid;place-items:center;padding:20px}.access-card{width:min(100%,560px);text-align:center;border-radius:22px;border:1px solid #3d7080;background:linear-gradient(145deg,#102c41,#061925);box-shadow:0 18px 50px #0007;padding:clamp(25px,5vw,45px)}.access-icon{font-size:58px;color:#efc578;margin:12px auto}.access-card h1{font-size:clamp(26px,4vw,37px);margin:12px 0}.access-card>p:not(.card-kicker){color:#b8d1dc;line-height:1.6}.access-actions{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;margin-top:15px}.access-actions .primary,.access-actions .secondary{margin-top:0}

.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.stat{padding:20px}.stat small{font-size:10px;color:#f4c67d;font-weight:900;letter-spacing:1.2px}.stat strong{display:block;font-size:clamp(22px,3vw,36px);margin:8px 0;color:#f6fbff}.stat span{font-size:12px;color:#a6c3d0}.favorite-links,.quick-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.favorite-links a{display:inline-flex;border:1px solid #478399;background:#103849;color:#e5f6fa;padding:10px 15px;border-radius:10px;text-decoration:none;font-weight:750;font-size:13px}.quick-actions .link-button{margin-top:0}.game-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;margin-top:20px}.game-tile{padding:19px;border:1px solid #356679;background:linear-gradient(145deg,#0c3446,#081f30);border-radius:15px}.game-tile h3{font-size:19px;margin:8px 0 4px}.game-tile p{font-size:12px;margin:4px 0 14px}.game-emoji{font-size:30px;color:#f4cb80}.game-actions{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}.game-actions a,.game-actions button{font-size:13px;font-weight:800;color:#dff9fd;border:1px solid #548b9c;border-radius:8px;background:#123e51;padding:9px 11px;text-decoration:none;cursor:pointer}.game-actions button[aria-pressed="true"]{background:#4c3e23;color:#f8d288;border-color:#d1aa66}.appearance-form{display:grid;gap:10px}.setting{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:17px 0;border-bottom:1px solid #284858}.setting span{display:grid;gap:6px}.setting strong{font-size:14px}.setting small{font-size:12px;color:#9db6c5}.setting select{background:#0b2939;border:1px solid #4a8090;color:#fff;border-radius:8px;padding:11px;max-width:200px}.setting input{width:22px;height:22px;accent-color:#efc77d}.session-list{margin:18px 0}.session-item{border-bottom:1px solid #285364;padding:15px 0;display:flex;justify-content:space-between;gap:12px;align-items:center}.session-item strong{font-size:13px}.session-item span{display:block;margin-top:5px;color:#a1bcca;font-size:12px}.session-item em{font-size:11px;color:#a4ecd5;font-style:normal}body.panel-compact .card{padding:14px}body.panel-compact .view.active{gap:10px}body.panel-large{font-size:18px}body.panel-large .card p,body.panel-large .nav,body.panel-large .detail,body.panel-large .setting small{font-size:1rem}body.panel-no-motion *,body.panel-no-motion *:before,body.panel-no-motion *:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}@media(max-width:610px){.stats,.game-grid{grid-template-columns:1fr}.setting{flex-wrap:wrap}.session-item{align-items:flex-start}}
.friends-search{display:grid;gap:10px}.friends-search label{font-size:13px;font-weight:800;color:#dcebf0}.friends-search-controls{display:flex;align-items:stretch;gap:10px}.friends-search-controls input{flex:1;min-width:0;background:#071e2a;border:1px solid #487a8d;color:#f1faff;font:inherit;font-size:14px;border-radius:10px;padding:13px}.friends-items{display:grid;gap:9px;margin:12px 0}.friend-person{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;background:linear-gradient(105deg,#0d3040,#081e2e);border:1px solid #35697b;border-radius:12px}.friend-name{font-size:14px;font-weight:850;overflow-wrap:anywhere}.friend-sub{font-size:11px;color:#9dbdcb;margin-top:4px}.friend-controls{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}.friend-controls button{border-radius:8px;border:1px solid #518b9c;background:#103849;color:#f1fcff;padding:9px 11px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.friend-controls button.friend-main{border-color:#dfba73;background:#533e24;color:#ffdd9c}.friend-controls button:disabled{opacity:.55;cursor:wait}.friend-empty{color:#8daebb!important;font-size:13px;margin:6px 0!important}.friend-alert{color:#ffd59f!important;font-size:13px}.friends-stats .stat strong{font-variant-numeric:tabular-nums}@media(max-width:610px){.friends-search-controls{flex-wrap:wrap}.friends-search-controls button{width:100%}.friend-person{align-items:flex-start;flex-wrap:wrap}.friend-controls{width:100%;justify-content:flex-start}}

.social-label{display:block;color:#dbeff6;font-weight:800;margin:12px 0;font-size:13px}
.social-controls{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:18px}
.social-controls select{flex:1;min-width:160px;padding:12px;background:#082537;color:#fff;border:1px solid #447b8f;border-radius:9px;font:inherit}
.social-thread{min-height:260px;max-height:420px;overflow-y:auto;border:1px solid #386c7e;border-radius:13px;background:linear-gradient(140deg,#061622,#09283b);padding:16px;display:flex;flex-direction:column;gap:11px}
.social-thread>p{color:#a7c3d2}.social-bubble{padding:12px 15px;border:1px solid #367185;border-radius:13px;max-width:85%;align-self:flex-start;background:#143448;overflow-wrap:anywhere}.social-bubble.own{align-self:flex-end;background:#453c2b;border-color:#8f774c}
.social-bubble p{color:#f4f8fc!important;white-space:pre-wrap;margin:0 0 7px;line-height:1.55}.social-bubble small{font-size:10px;color:#b5cfdb}
.social-send textarea{width:100%;min-height:90px;background:#091f2d;color:#f8fbfc;border:1px solid #416c80;border-radius:9px;padding:12px;font:inherit}
.social-limitation{border:1px solid #816a42;border-radius:11px;background:#42311c55;color:#f6d6a2!important;padding:13px}
@media(max-width:610px){.social-controls{align-items:stretch;flex-direction:column}.social-controls>*{width:100%}.social-bubble{max-width:95%}}

.match-top{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:17px 0}
.match-players{font-weight:800;font-size:14px;color:#ebc786}
.match-board{display:grid;max-width:650px;width:100%;aspect-ratio:1;margin:12px auto;border:5px solid #d5ab63;border-radius:12px;overflow:hidden;background:#092337;gap:0}
.match-cell{min-width:0;min-height:0;padding:0;display:grid;place-items:center;border:1px solid #52708155;font-weight:900;cursor:pointer;font-family:inherit;line-height:1}
.match-board.checkers .match-cell{font-size:clamp(18px,3.1vw,49px)}
.match-board.checkers .match-cell.dark{background:#254b5c}
.match-board.checkers .match-cell.light{background:#b2c8c8}
.match-board.checkers .match-cell.selected{box-shadow:inset 0 0 0 4px #ffdc84}
.match-board.checkers .match-cell.p1{color:#e5eefa;text-shadow:0 2px 3px #0007}
.match-board.checkers .match-cell.p2{color:#eac071;text-shadow:0 2px 3px #0009}
.match-board.gomoku{background:#d9b77b}
.match-board.gomoku .match-cell{background:transparent;border-color:#6f5b3c80;position:relative;font-size:clamp(8px,1.9vw,23px)}
.match-board.gomoku .match-cell.p1{color:#193744}
.match-board.gomoku .match-cell.p2{color:#faf8e9;text-shadow:0 1px 3px #000a}
.match-cell:disabled{cursor:default}
.match-cell:focus-visible{outline:3px solid #ffcb6b;outline-offset:-3px}
@media(max-width:610px){.match-board{border-width:3px}.match-board.checkers .match-cell{font-size:clamp(15px,5vw,35px)}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation:none!important;transition:none!important}}/* Player panel reference layout — 2026-11-04. Visual only; existing account logic retained. */
.site-nav{min-height:54px;padding:8px clamp(18px,4vw,70px);display:flex;align-items:center;gap:42px;background:#001622;border-bottom:1px solid #17c4be}
.site-brand{text-decoration:none;font-size:29px;line-height:1;font-weight:950;letter-spacing:-1.7px;color:#fff;white-space:nowrap}
.site-brand span{color:#eb2b4a}.site-nav nav{display:flex;align-items:center;gap:clamp(18px,3vw,52px);flex-wrap:wrap}
.site-nav nav a{text-decoration:none;color:#e6eff6;font-weight:650;font-size:clamp(13px,1.2vw,18px)}.site-nav nav a:hover{color:#65fff0}
.top{min-height:74px;padding:12px clamp(20px,4.5vw,76px);background:#031c29;border-color:#18ccc2}
.top-tag{color:#f3f7f9}.top-tag b{color:#f8ce65}.top-link{border-color:#e4b04d;color:#ffd772}
.shell{max-width:1800px;grid-template-columns:minmax(0,1fr) 310px;gap:30px;padding:26px clamp(20px,2.3vw,44px)}
.main{grid-column:1;grid-row:1}.sidebar{grid-column:2;grid-row:1;top:16px;background:linear-gradient(145deg,#07313e,#031925 72%);border:1px solid #368190;box-shadow:inset 0 0 36px #00e5de11,0 14px 42px #0006;border-radius:22px}
.identity{padding:19px 24px 15px}.identity .small{color:#f9cb53}.identity strong{font-size:19px}.avatar,.player-avatar{border-color:#ffe08a;box-shadow:0 0 0 2px #1fe9d8,0 0 27px #16e6d96e;color:#ffe0a1}
.sidebar nav{gap:3px;padding:12px 16px}.sidebar .nav{padding:8px 13px;font-weight:650;border-radius:12px;color:#e6f3f5}.sidebar .nav span{color:#65e8e0}
.sidebar .nav.active{border-color:#10f3d9;background:linear-gradient(90deg,#095e63,#037277 55%,#063b49);box-shadow:inset 0 0 12px #00f9e55c,0 0 14px #00e6d85c}.sidebar .nav.active span{color:#8bfff2}
.create-room{width:calc(100% - 34px)!important;margin:14px 17px 7px!important;justify-content:center;color:#ffdf81!important;border:1px solid #ffd266!important;background:linear-gradient(180deg,#685427,#29251c)!important;box-shadow:0 0 20px #eecb5d4d;font-size:15px!important}
.create-room span{color:#ffdb80!important}.signout{border-color:#2a7679}
.masthead{min-height:224px;border:1px solid #099b9b;border-radius:23px;background:radial-gradient(ellipse at 76% 45%,#007b85b8,transparent 51%),linear-gradient(145deg,#034751,#002432 48%,#00616a);box-shadow:inset 0 -30px 45px #00454b80}
.masthead:before{content:"";position:absolute;inset:auto -5% -42% 40%;height:85%;border-top:2px solid #15f6dc;border-radius:50%;transform:rotate(-22deg);box-shadow:0 -10px 20px #00e9c74d;pointer-events:none}
.masthead h1{font-size:clamp(36px,4.8vw,60px);text-shadow:0 3px 10px #00171d7a}.masthead .eyebrow,.card-kicker,.stat small{color:#ffd25c!important}
.mark{width:136px;height:136px;border:9px double #ffd659;transform:none;box-shadow:0 0 0 3px #08ccb7,0 0 32px #03e4d36b;background:#00222d}
.card{background:linear-gradient(135deg,#073544,#031d2c 80%);border-color:#0b999c;box-shadow:inset 0 0 26px #04b8b014,0 11px 30px #0003}
.hero-card{min-height:155px;border-color:#d1a04b;background:radial-gradient(ellipse at 58% 140%,#135d67,transparent 65%),linear-gradient(110deg,#053540,#031d2b)}
.hero-card .player-avatar{width:89px;height:89px}.hero-card h2{font-size:32px}.verified{border-color:#00ebc4;color:#48ffdc;background:#003c40}
.stats{gap:18px}.stat{border-color:#02aca9!important;box-shadow:inset 0 -2px 0 #17edda,0 0 18px #04bdb91a!important}.stat strong{font-size:clamp(30px,3vw,42px)}
body{background:radial-gradient(ellipse at 60% 22%,#064653,transparent 55%),linear-gradient(125deg,#001b29,#001420 75%,#011c26)}
@media(max-width:900px){.shell{grid-template-columns:minmax(0,1fr) 250px;gap:16px;padding:16px}.sidebar{grid-column:2;grid-row:1;position:sticky;top:10px}.main{grid-column:1;grid-row:1}.site-nav{gap:15px}.site-nav nav{gap:12px}.site-nav nav a{font-size:12px}.masthead{min-height:185px}}
@media(max-width:700px){.site-nav{padding:12px 16px;display:block}.site-nav nav{margin-top:12px;gap:12px 20px}.shell{display:flex;flex-direction:column;padding:12px}.main{order:1}.sidebar{order:2;position:static;width:100%}.masthead{min-height:170px;padding:20px}.mark{width:84px;height:84px;border-width:5px}.mark span{font-size:36px}.hero-card{flex-wrap:wrap}.verified{margin-left:0}.top-tag{display:none}}

/* Konto i profil — premium bez zmian w pozostałych panelach */
.premium-profile{gap:21px}.premium-profile .profile-hero-premium{position:relative;overflow:hidden;border:1px solid #19c7bd;border-radius:23px;padding:clamp(20px,3vw,38px);background:radial-gradient(ellipse at 80% 10%,#00a99a52,transparent 45%),radial-gradient(ellipse at 5% 90%,#037b965e,transparent 45%),linear-gradient(135deg,#053746,#011e2d 70%,#064656);box-shadow:inset 0 0 42px #0cf7dc17,0 14px 38px #0005}
.profile-topline{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:28px}.profile-topline>span:first-child{color:#9dffec;font-size:11px;font-weight:900;letter-spacing:1.6px}.profile-verified{border-radius:30px;background:#075b5480;border:1px solid #13a893;padding:8px 12px;color:#a4ffe2;font-size:12px;font-weight:800}
.profile-hero-body,.profile-intro{display:flex;align-items:center;gap:23px;flex-wrap:wrap}.profile-hero-body{justify-content:space-between}.profile-intro{min-width:0}.profile-avatar-frame{height:118px;width:118px;border:2px solid #19f4d8;box-shadow:0 0 28px #08eac44d,inset 0 0 18px #0debc524;border-radius:26px;display:grid;place-items:center;position:relative;background:#063747}
.profile-avatar-large{font-size:68px;font-weight:900;color:#ffe0a1}.profile-avatar-check{position:absolute;bottom:-8px;right:-8px;background:#069e8b;color:#fff;border:2px solid #8dffe1;border-radius:50%;height:31px;width:31px;display:grid;place-items:center}
.profile-intro h2{margin:4px 0 0;font-size:clamp(30px,3.7vw,47px);line-height:1.1;overflow-wrap:anywhere}.profile-intro #profile-handle{margin:5px 0 12px;color:#7ffff0;font-weight:800}.profile-chips{display:flex;flex-wrap:wrap;gap:8px}.profile-chips span{background:#095565;color:#e2ffff;border:1px solid #1b8790;border-radius:24px;padding:6px 11px;font-size:11px;font-weight:800}
.profile-hero-actions{display:flex;gap:11px;flex-wrap:wrap}.profile-hero-actions button{padding:12px 15px}.profile-metrics{display:grid;grid-template-columns:1.4fr repeat(3,minmax(0,1fr));gap:13px;margin-top:30px}.profile-metric{min-width:0;background:#073e4e9c;border:1px solid #168c98;border-radius:15px;padding:16px}.profile-metric small{display:block;color:#a9d9df;font-size:10px;font-weight:900;letter-spacing:.9px}.profile-metric strong{display:block;font-size:clamp(24px,2.7vw,35px);margin:9px 0 2px;line-height:1.2;color:#fff}.profile-metric span{color:#a7d3da;font-size:11px}.profile-metric progress{width:100%;height:8px;border-radius:20px;overflow:hidden;accent-color:#13e3cb;margin:6px 0;display:block}.profile-metric progress::-webkit-progress-bar{background:#07303e}.profile-metric progress::-webkit-progress-value{background:#29efd7}.profile-metric progress::-moz-progress-bar{background:#29efd7}
.profile-layout{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(260px,1fr);gap:20px;align-items:start}.profile-main-column,.profile-side-column{display:grid;gap:20px;min-width:0}.premium-profile .profile-editor,.premium-profile .profile-shortcuts,.premium-profile .profile-preview-card,.premium-profile .profile-account-card{background:linear-gradient(140deg,#073746,#031e2d);border:1px solid #178d97;border-radius:20px}
.premium-profile .card-heading{align-items:flex-start;flex-wrap:wrap}.premium-profile .card-heading p{margin:0 0 12px}.profile-pill{color:#8cffe5;background:#0a5b54;border-radius:30px;border:1px solid #17a08e;padding:8px 10px;font-size:10px;letter-spacing:.5px;font-weight:900}
.premium-profile .form-grid{gap:18px}.premium-profile .form-grid label{gap:7px}.premium-profile .form-grid input,.premium-profile .form-grid textarea,.premium-profile .form-grid select{border-radius:12px;border:1px solid #2a8694;background:#041e2d}.premium-profile .form-grid :is(input,textarea,select):focus-visible{outline:2px solid #63fce3;outline-offset:2px}.premium-profile #profile-bio-counter{text-align:right}
.profile-edit-hint{display:flex;gap:9px;margin-top:19px;padding:13px;border:1px solid #197a83;border-radius:11px;background:#075e6559;color:#b3e1e5;font-size:12px}.profile-edit-hint span{color:#8affe4}.profile-form-buttons{display:flex;flex-wrap:wrap;gap:10px}.profile-form-buttons button{padding:12px 16px}.premium-profile .form-actions{margin-top:16px;border-top:1px solid #1f5a66;padding-top:17px}
.profile-shortcut-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.profile-shortcut-grid button{display:grid;grid-template-columns:40px 1fr;align-items:center;column-gap:10px;min-width:0;cursor:pointer;text-align:left;padding:13px;color:#eefbff;background:#083948;border:1px solid #147d8b;border-radius:13px}.profile-shortcut-grid button span{grid-row:span 2;background:#08646c;border-radius:11px;width:40px;height:40px;display:grid;place-items:center;color:#8bffdf;font-size:23px}.profile-shortcut-grid button strong{font-size:13px}.profile-shortcut-grid button small{color:#a4cbd2;font-size:11px}.profile-shortcut-grid button:hover,.profile-shortcut-grid button:focus-visible{background:#0b5660;border-color:#53f5dc}
.profile-preview-inner{display:flex;flex-direction:column;align-items:center;text-align:center;border:1px solid #148b97;border-radius:18px;padding:25px 18px;margin-top:16px;background:radial-gradient(ellipse at 50% 0%,#09869561,transparent 65%),linear-gradient(150deg,#073d4b,#03202f);min-width:0}.profile-preview-avatar{width:85px;height:85px;border:2px solid #1af8d7;border-radius:23px;background:#075764;color:#ffe1a1;font-size:49px;font-weight:900;display:grid;place-items:center;box-shadow:0 0 20px #0defcc55}.profile-preview-inner strong{margin-top:14px;font-size:clamp(20px,2.5vw,29px);overflow-wrap:anywhere}.profile-preview-inner>span{color:#81ffeb;font-weight:800;font-size:12px;margin-top:5px;overflow-wrap:anywhere}.profile-preview-inner p{font-size:13px;min-height:52px;margin:18px 0;overflow-wrap:anywhere}.profile-preview-inner .profile-chips{justify-content:center}.profile-preview-caption{color:#99bdc6!important;font-size:11px;line-height:1.5!important}.profile-account-card .detail{font-size:12px;align-items:center;padding:14px 0}.profile-account-card .detail strong{max-width:61%;overflow-wrap:anywhere;font-size:12px}.profile-security-link{margin-top:18px;width:100%;font-size:12px}
.profile-game-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.profile-game-links a{text-decoration:none;text-align:center;padding:15px 8px;background:#085662;border:1px solid #19b9ab;color:#eefeff;border-radius:12px;font-size:12px;font-weight:850}.profile-game-links a:hover{background:#097481}
@media(max-width:1250px){.profile-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.profile-layout{grid-template-columns:minmax(0,1fr)}.profile-side-column{grid-template-columns:repeat(2,minmax(0,1fr))}.profile-game-links{grid-column:1/-1}}
@media(max-width:650px){.premium-profile .profile-hero-premium{padding:18px}.profile-avatar-frame{width:90px;height:90px;border-radius:19px}.profile-avatar-large{font-size:52px}.profile-topline{margin-bottom:19px}.profile-metrics{gap:9px;margin-top:19px}.profile-metric{padding:12px}.profile-metric strong{font-size:25px}.premium-profile .form-grid{grid-template-columns:1fr}.profile-side-column,.profile-shortcut-grid{grid-template-columns:1fr}.profile-form-buttons{width:100%}.profile-form-buttons button{flex:1}.profile-hero-actions button{flex:1}}

.profile-password-card{margin-top:18px;border:1px solid #268d8c!important;background:radial-gradient(ellipse at 87% 0%,#097a7960,transparent 54%),linear-gradient(145deg,#063741,#041d2b)!important}
.profile-password-form{display:grid;grid-template-columns:minmax(0,1fr);gap:9px;margin-top:18px;max-width:710px}
.profile-password-form>label{color:#ffe0a2;font-weight:800;font-size:13px;margin-top:8px}
.profile-password-form>small{color:#a8d9d8;font-size:12px}
.profile-password-field{display:flex;align-items:stretch;overflow:hidden;border:1px solid #348d91;border-radius:12px;background:#041f2a}
.profile-password-field:focus-within{border-color:#24f3da;box-shadow:0 0 0 2px #1bdbca31}
.profile-password-field input{flex:1;min-width:0;min-height:48px;border:0!important;border-radius:0!important;background:transparent!important;color:#fff!important;padding:11px 13px!important}
.profile-password-field button{border:0;border-left:1px solid #286b70;background:#10404a;color:#aaf6e8;font-weight:750;padding:0 17px;min-width:81px;cursor:pointer}
.profile-password-field button:hover{background:#14616a}
.profile-password-form .form-actions{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:14px}
.profile-password-form .form-actions #pw-change-status{max-width:470px;line-height:1.5;font-size:13px}
.profile-password-form .form-actions button{min-width:165px}
@media(max-width:650px){.profile-password-form .form-actions button{width:100%}}
`+premiumProfileStyles;
const js=String.raw`(()=>{
'use strict';
const $=id=>document.getElementById(id);
const sectionNames={
 dashboard:['Pulpit gracza','Witaj w Twoim centrum rozgrywek.'],
 profile:['Konto i profil','Twoje miejsce w Polskim Centrum Gracza.'],
 friends:['Moi znajomi','Kontakty, zaproszenia i bezpieczeństwo społeczności.'],
 security:['Bezpieczeństwo','Kontrola bezpieczeństwa Twojego konta.'],
 privacy:['Prywatność','Zarządzanie widocznością danych.'],
 notifications:['Powiadomienia','Informacje o Twoich aktywnościach.'],
 messages:['Wiadomości','Prywatne rozmowy ze znajomymi.'],
 challenges:['Zaproszenia do gier','Wyzwania Warcaby i Gomoku dla znajomych.'],
 play:['Moje partie','Wspólna rozgrywka online ze znajomym.'],
 games:['Gry i rozgrywka','Wszystkie gry w jednym miejscu.'],
 appearance:['Wygląd i dostępność','Panel dopasowany do Twojego ekranu.'],
 sessions:['Sesje i urządzenia','Kontrola zalogowanych urządzeń.'],
 data:['Dane i konto','Informacje o zarządzaniu kontem.']
};

const gameCatalog={
 warcaby:{name:'Warcaby',url:'https://gracz.pl/gry/warcaby/'},
 gomoku:{name:'Gomoku',url:'https://gracz.pl/gry/gomoku/'},
 tysiac:{name:'Tysiąc',url:'https://gracz.pl/gry/tysiac/'},
 poker:{name:'Poker treningowy',url:'https://gracz.pl/gry/poker-treningowy/'}
};
let profileSnapshot=null,centerState=null;
function formattedDate(value){
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('pl-PL',{day:'2-digit',month:'short',year:'numeric'}).format(date);
}
function renderFavorites(){
 const favorites=centerState?.preferences?.favoriteGames||[];
 $('dashboard-favorites').textContent=String(favorites.length);
 $('profile-favorites').textContent=String(favorites.length);
 $('favorites-empty').hidden=favorites.length>0;
 const links=$('favorites-links');links.replaceChildren();
 favorites.forEach(key=>{
  if(!gameCatalog[key])return;
  const item=document.createElement('a');item.href=gameCatalog[key].url;
  item.textContent='★ '+gameCatalog[key].name;links.append(item);
 });
 document.querySelectorAll('[data-favorite]').forEach(button=>{
  const selected=favorites.includes(button.dataset.favorite);
  button.setAttribute('aria-pressed',String(selected));
  button.textContent=(selected?'★ ':'☆ ')+(selected?'W ulubionych':'Ulubione');
  button.disabled=!centerState;
 });
}
function renderSessions(){
 const sessions=centerState?.sessions||[];
 $('dashboard-sessions').textContent=String(sessions.length);
 $('profile-sessions').textContent=String(sessions.length);
 const list=$('session-list');list.replaceChildren();
 if(!sessions.length){list.textContent='Nie znaleziono aktywnych sesji.';return;}
 sessions.forEach((session,index)=>{
  const entry=document.createElement('div');entry.className='session-item';
  const body=document.createElement('div'),title=document.createElement('strong'),dates=document.createElement('span'),state=document.createElement('em');
  title.textContent=session.current?'Ta przeglądarka':'Inna aktywna sesja '+(index+1);
  dates.textContent='Zalogowano: '+formattedDate(session.createdAt)+' · ważna do: '+formattedDate(session.expiresAt);
  state.textContent=session.current?'BIEŻĄCA':'AKTYWNA';
  body.append(title,dates);entry.append(body,state);list.append(entry);
 });
 $('sessions-revoke').disabled=sessions.filter(x=>!x.current).length===0;
}
function applyCenter(center){
 if(!center||!center.preferences||!Array.isArray(center.sessions))throw new Error('Niepełne dane centrum gracza.');
 centerState=center;
 const prefs=center.preferences;
 $('setting-density').value=prefs.density;
 $('setting-large').checked=prefs.largeText;
 $('setting-motion').checked=prefs.reduceMotion;
 document.body.classList.toggle('panel-compact',prefs.density==='compact');
 document.body.classList.toggle('panel-large',prefs.largeText===true);
 document.body.classList.toggle('panel-no-motion',prefs.reduceMotion===true);
 renderFavorites();renderSessions();
}
async function refreshCenter(){
 const result=await api('player-center');
 applyCenter(result.center);
 return result.center;
}
async function saveCenter(next){
 if(!sessionConfirmed||!centerState)throw new Error('Zaloguj się ponownie, aby zapisać ustawienia.');
 const result=await api('player-center',{method:'PUT',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(next)});
 applyCenter(result.center);
 return result.center;
}

let friendsState=null;
function friendsStatus(message,error=false){
 const el=$('friends-status');el.textContent=message;el.classList.toggle('friend-alert',error);
}
function friendRow(nickname,description,actions){
 const row=document.createElement('div');row.className='friend-person';
 const info=document.createElement('div');
 const name=document.createElement('div');name.className='friend-name';name.textContent='♟ '+nickname;
 const sub=document.createElement('div');sub.className='friend-sub';sub.textContent=description;
 info.append(name,sub);row.append(info);
 if(actions.length){
  const controls=document.createElement('div');controls.className='friend-controls';
  actions.forEach(({action,label})=>{
   const button=document.createElement('button');button.type='button';button.textContent=label;
   if(action==='accept'||action==='send')button.classList.add('friend-main');
   button.setAttribute('aria-label',label+': '+nickname);
   button.addEventListener('click',async()=>{
    if(action==='message'){void openSocialContact('messages',nickname);return;}
    if(action==='challenge'){void openSocialContact('challenges',nickname);return;}
    button.disabled=true;
    try{await api('friends/action',{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({action,nickname})});await refreshFriends();
     friendsStatus('Wykonano: '+label.toLowerCase()+' — '+nickname+'.');
    }catch(error){friendsStatus(error.message,true);}finally{button.disabled=false;}
   });
   controls.append(button);
  });
  row.append(controls);
 }
 return row;
}
function renderFriendList(id,items,empty,description,actions){
 const container=$(id);container.replaceChildren();
 if(!items.length){const p=document.createElement('p');p.className='friend-empty';p.textContent=empty;container.append(p);return;}
 items.forEach(item=>container.append(friendRow(item.nickname,description,actions)));
}
async function refreshFriends(){
 if(!sessionConfirmed)return;
 try{
  const result=await api('friends');
  friendsState=result;
  const accepted=result.connections.filter(x=>x.status==='accepted');
  const incoming=result.connections.filter(x=>x.status==='pending'&&x.direction==='incoming');
  const outgoing=result.connections.filter(x=>x.status==='pending'&&x.direction==='outgoing');
  $('friends-count').textContent=String(accepted.length);
  $('friends-incoming-count').textContent=String(incoming.length);
  $('friends-outgoing-count').textContent=String(outgoing.length);
  renderFriendList('friends-list',accepted,'Nie masz jeszcze znajomych.','Znajomy',
   [{action:'message',label:'Napisz'},{action:'challenge',label:'Zaproś do gry'},{action:'remove',label:'Usuń'},{action:'block',label:'Zablokuj'}]);
  renderFriendList('friends-incoming',incoming,'Brak nowych zaproszeń.','Zaprasza Cię do znajomych',
   [{action:'accept',label:'Akceptuj'},{action:'decline',label:'Odrzuć'},{action:'block',label:'Zablokuj'}]);
  renderFriendList('friends-outgoing',outgoing,'Nie masz oczekujących zaproszeń.','Oczekuje na odpowiedź',
   [{action:'cancel',label:'Anuluj'}]);
  renderFriendList('friends-blocked',result.blocked,'Lista zablokowanych jest pusta.','Zablokowany użytkownik',
   [{action:'unblock',label:'Odblokuj'}]);
  friendsStatus('Znajomi: '+accepted.length+' · Zaproszenia: '+incoming.length+' · Wysłane: '+outgoing.length+'.');
  return result;
 }catch(error){
  friendsStatus(error.message,true);
  if(error.status===401)accessState('Zaloguj się do konta','Sesja wygasła. Zaloguj się, aby zarządzać znajomymi.',{login:true});
  return null;
 }
}
$('friends-refresh').addEventListener('click',()=>void refreshFriends());
$('friends-search-form').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!sessionConfirmed)return;
 const query=$('friends-query').value.trim();
 if(!/^[a-z][a-z0-9._-]{2,31}$/i.test(query)){
  friendsStatus('Nick musi mieć od 3 do 32 znaków i zaczynać się literą.',true);return;
 }
 const results=$('friends-search-results');results.replaceChildren();
 friendsStatus('Wyszukiwanie graczy…');
 try{
  const result=await api('friends/search?nick='+encodeURIComponent(query));
  const relationships=new Map((friendsState?.connections||[]).map(x=>[x.nickname.toLowerCase(),x]));
  if(!result.players.length){
   const message=document.createElement('p');message.className='friend-empty';
   message.textContent='Nie znaleziono gracza o takim nicku.';results.append(message);
  }
  result.players.forEach(player=>{
   const rel=relationships.get(player.nickname.toLowerCase());
   let description='Możesz wysłać zaproszenie';
   if(rel?.status==='accepted')description='Już jesteście znajomymi';
   else if(rel?.direction==='outgoing')description='Zaproszenie już wysłane';
   else if(rel?.direction==='incoming')description='Ta osoba już Cię zaprosiła';
   const actions=rel?[]:[{action:'send',label:'Zaproś'}];
   results.append(friendRow(player.nickname,description,actions));
  });
  friendsStatus('Wyniki wyszukiwania: '+result.players.length+'.');
 }catch(error){friendsStatus(error.message,true);}
});


let activeMatchId=null,activeMatch=null,selectedChecker=null,moving=false;
function gameDescription(match){
 const state=match.state;
 const names=match.players;
 if(state.winner===3)return 'Remis. Partia zakończona.';
 if(state.winner===1||state.winner===2)return 'Wygrał gracz '+names[state.winner-1]+'. Partia zakończona.';
 return 'Tura: '+names[state.turn-1]+(state.turn===match.player?' (Twój ruch)':' (ruch przeciwnika)')+
  (state.forced!==null&&state.forced!==undefined?' · obowiązkowe kolejne bicie':'')+
  (match.playable?'':' · partia zablokowana');
}
function drawMatch(match){
 activeMatch=match;
 const state=match.state,game=match.game;
 $('match-heading').textContent=(game==='warcaby'?'Warcaby 8×8':'Gomoku 15×15')+' — partia online';
 $('match-players').textContent='Gracz 1: '+match.players[0]+' · Gracz 2: '+match.players[1];
 $('match-state').textContent=gameDescription(match);
 const board=$('match-board');
 board.replaceChildren();
 board.className='match-board '+(game==='warcaby'?'checkers':'gomoku');
 const n=game==='warcaby'?8:15;
 board.style.gridTemplateColumns='repeat('+n+',minmax(0,1fr))';
 for(let i=0;i<n*n;i++){
  const [r,c]=[Math.floor(i/n),i%n],piece=state.board[i];
  const cell=document.createElement('button');cell.type='button';cell.className='match-cell';
  cell.setAttribute('aria-label','Rząd '+(r+1)+', kolumna '+(c+1)+
   (piece?(', '+(piece===1||piece===3?'gracz 1':'gracz 2')+(piece>=3?' damka':' pion')):' puste'));
  if(game==='warcaby'){
   cell.classList.add((r+c)%2===1?'dark':'light');
   if(selectedChecker===i)cell.classList.add('selected');
   cell.textContent=piece>=3?'♛':piece?'●':'';
  }else cell.textContent=piece?'●':'';
  if(piece)cell.classList.add((piece===1||piece===3)?'p1':'p2');
  const yourTurn=state.turn===match.player&&state.winner===0&&match.playable;
  cell.disabled=!yourTurn||(game==='warcaby'&&(r+c)%2===0);
  if(!cell.disabled)cell.addEventListener('click',()=>void boardCellClick(i));
  board.append(cell);
 }
}
async function openMatch(id){
 if(!sessionConfirmed)return;
 activeMatchId=id;selectedChecker=null;
 switchSection('play');
 $('match-state').textContent='Łączenie z pokojem rozgrywki…';
 await refreshMatch();
}
async function refreshMatch(){
 if(!activeMatchId||!sessionConfirmed)return;
 const expected=activeMatchId;
 try{
  const result=await api('match?id='+encodeURIComponent(expected));
  if(activeMatchId!==expected)return;
  drawMatch(result.match);
 }catch(error){
  $('match-state').textContent='Nie udało się otworzyć partii: '+error.message;
 }
}
async function boardCellClick(to){
 if(moving||!activeMatch||activeMatch.state.winner!==0||
  activeMatch.state.turn!==activeMatch.player)return;
 const {game,state,version}=activeMatch;
 let move;
 if(game==='gomoku'){
  if(state.board[to]!==0)return;
  move={to};
 }else{
  const piece=state.board[to];
  const own=piece&&(piece===activeMatch.player||piece===activeMatch.player+2);
  if(own){
   if(state.forced!==null&&state.forced!==to){
    $('match-state').textContent='Musisz kontynuować bicie wskazanym pionkiem.';
    return;
   }
   selectedChecker=to;drawMatch(activeMatch);return;
  }
  if(selectedChecker===null){
   $('match-state').textContent='Najpierw wybierz własny pionek.';
   return;
  }
  move={from:selectedChecker,to};
 }
 moving=true;
 try{
  const result=await api('match',{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({id:activeMatchId,version,move})});
  selectedChecker=result.match.state.forced??null;
  drawMatch(result.match);
 }catch(error){
  await refreshMatch();
  $('match-state').textContent='Ruch nie został wykonany: '+error.message;
 }finally{moving=false;}
}
$('match-refresh').addEventListener('click',()=>void refreshMatch());
if(typeof setInterval==='function')setInterval(()=>{
 if(activeMatchId&&sessionConfirmed&&!moving&&
  document.querySelector('[data-panel="play"]').classList.contains('active')&&
  (typeof document.visibilityState==='undefined'||document.visibilityState==='visible'))
   void refreshMatch();
},4000);
function socialNotice(id,message,error=false){
 const el=$(id);el.textContent=message;el.classList.toggle('friend-alert',error);
}
function safeDate(value){
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'—':date.toLocaleString('pl-PL',{dateStyle:'short',timeStyle:'short'});
}
async function prepareSocial(name){
 if(!sessionConfirmed)return;
 if(!friendsState)await refreshFriends();
 const accepted=(friendsState?.connections||[]).filter(item=>item.status==='accepted');
 const selectIds=['message-recipient','challenge-friend'];
 for(const id of selectIds){
  const sel=$(id),selected=sel.value;sel.replaceChildren();
  const empty=document.createElement('option');empty.value='';empty.textContent='Wybierz znajomego';sel.append(empty);
  accepted.forEach(item=>{
   const option=document.createElement('option');option.value=item.nickname;
   option.textContent=item.nickname;sel.append(option);
  });
  if(accepted.some(item=>item.nickname===selected))sel.value=selected;
 }
 $('message-send').disabled=!$('message-recipient').value;
 if(name==='challenges')await refreshChallenges();
}
async function openSocialContact(section,nick){
 switchSection(section);
 await prepareSocial(section);
 const selection=$(section==='messages'?'message-recipient':'challenge-friend');
 selection.value=nick;
 if(section==='messages')await refreshThread();
}
async function refreshThread(){
 const select=$('message-recipient'),nick=select.value;
 const thread=$('message-thread');thread.replaceChildren();
 $('message-send').disabled=!nick;
 if(!nick){
  const p=document.createElement('p');p.textContent='Wybierz znajomego, aby wyświetlić rozmowę.';thread.append(p);
  return;
 }
 socialNotice('messages-state','Wczytywanie rozmowy…');
 try{
  const response=await api('social/messages?nick='+encodeURIComponent(nick));
  if(select.value!==nick)return;
  if(!response.messages.length){
   const p=document.createElement('p');p.textContent='Nie ma jeszcze wiadomości. Rozpocznij rozmowę.';thread.append(p);
  }
  response.messages.forEach(item=>{
   const bubble=document.createElement('div');bubble.className='social-bubble'+(item.own?' own':'');
   const text=document.createElement('p');text.textContent=item.body;
   const date=document.createElement('small');date.textContent=(item.own?'Ty':'Znajomy')+' · '+safeDate(item.createdAt);
   bubble.append(text,date);thread.append(bubble);
  });
  thread.scrollTop=thread.scrollHeight;
  socialNotice('messages-state','Wiadomości w rozmowie: '+response.messages.length+'.');
 }catch(error){socialNotice('messages-state',error.message,true);}
}
$('message-recipient').addEventListener('change',()=>void refreshThread());
$('messages-refresh').addEventListener('click',()=>void refreshThread());
$('message-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const nick=$('message-recipient').value,body=$('message-content').value.trim();
 if(!nick||!body||body.length>1000){socialNotice('messages-state','Wybierz znajomego i wpisz wiadomość (maks. 1000 znaków).',true);return;}
 const button=$('message-send');button.disabled=true;
 try{
  await api('social/messages',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({nickname:nick,message:body})});
  $('message-content').value='';await refreshThread();
  socialNotice('messages-state','Wiadomość wysłana.');
 }catch(error){socialNotice('messages-state',error.message,true);}
 finally{button.disabled=!$('message-recipient').value;}
});
async function refreshChallenges(){
 const list=$('challenge-list');list.replaceChildren();
 socialNotice('challenges-state','Wczytywanie wyzwań…');
 try{
  const response=await api('social/challenges');
  if(!response.challenges.length){
   const p=document.createElement('p');p.className='friend-empty';
   p.textContent='Brak zaproszeń do gier. Zaproś znajomego do Warcabów lub Gomoku.';
   list.append(p);
  }
  response.challenges.forEach(challenge=>{
   const row=document.createElement('div');row.className='friend-person';
   const info=document.createElement('div');
   const title=document.createElement('div');title.className='friend-name';
   title.textContent=(challenge.game==='warcaby'?'♟ Warcaby':'◉ Gomoku')+' · '+challenge.opponent;
   const detail=document.createElement('div');detail.className='friend-sub';
   const states={pending:'Oczekuje',accepted:'Przyjęto',declined:'Odrzucono',
    cancelled:'Anulowano',expired:'Wygasło'};
   detail.textContent=(challenge.outgoing?'Wysłane · ':'Otrzymane · ')+(states[challenge.status]||challenge.status)+' · '+safeDate(challenge.createdAt);
   info.append(title,detail);row.append(info);
   const controls=document.createElement('div');controls.className='friend-controls';
   const actions=challenge.status==='pending'?
     challenge.outgoing?[['cancel','Anuluj']]:[['accept','Akceptuj'],['decline','Odrzuć']]:[];
   actions.forEach(([action,label])=>{
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.addEventListener('click',async()=>{
     button.disabled=true;
     try{
      await api('social/challenges',{method:'POST',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({action,id:challenge.id})});
      await refreshChallenges();socialNotice('challenges-state','Zaktualizowano zaproszenie.');
     }catch(error){socialNotice('challenges-state',error.message,true);}
     finally{button.disabled=false;}
    });
    controls.append(button);
   });
   if(challenge.status==='accepted'){
    if(challenge.game==='gomoku'){
      const link=document.createElement('a');link.className='secondary link-button';
      link.href='/konto/gomoku/?match='+encodeURIComponent(challenge.id);
      link.textContent='Graj w Gomoku';controls.append(link);
    }else if(challenge.game==='warcaby'){
      const link=document.createElement('a');link.className='secondary link-button';
      link.href='/konto/warcaby/?match='+encodeURIComponent(challenge.id);
      link.textContent='Graj w Warcaby';controls.append(link);
    }
   }
   row.append(controls);list.append(row);
  });
  socialNotice('challenges-state','Zaproszenia: '+response.challenges.length+'.');
 }catch(error){socialNotice('challenges-state',error.message,true);}
}
$('challenges-refresh').addEventListener('click',()=>void refreshChallenges());
$('challenge-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const nickname=$('challenge-friend').value,game=$('challenge-game').value;
 if(!nickname){socialNotice('challenges-state','Wybierz znajomego.',true);return;}
 const button=$('challenge-form').querySelector('button[type="submit"]');button.disabled=true;
 try{
  await api('social/challenges',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'send',nickname,game})});
  await refreshChallenges();socialNotice('challenges-state','Wysłano zaproszenie do '+(game==='warcaby'?'Warcabów':'Gomoku')+'.');
 }catch(error){socialNotice('challenges-state',error.message,true);}
 finally{button.disabled=false;}
});
function notice(text,error=false){const n=$('notice');n.textContent=text;n.hidden=!text;n.classList.toggle('error',error);}
function switchSection(name){
 if(!sectionNames[name])return;
 document.querySelectorAll('[data-section]').forEach(e=>{e.classList.toggle('active',e.dataset.section===name);e.setAttribute('aria-current',e.dataset.section===name?'page':'false');});
 document.querySelectorAll('[data-panel]').forEach(e=>e.classList.toggle('active',e.dataset.panel===name));
 $('title').textContent=sectionNames[name][0];$('subtitle').textContent=sectionNames[name][1];
 if(name==='friends'&&sessionConfirmed)void refreshFriends();
 if((name==='messages'||name==='challenges')&&sessionConfirmed)void prepareSocial(name);
}
document.querySelectorAll('[data-section]').forEach(button=>button.addEventListener('click',()=>switchSection(button.dataset.section)));
async function api(path,options={}){
 const response=await fetch('/auth/'+path,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(options.headers||{})},...options});
 let body={};try{body=await response.json();}catch{}
 if(!response.ok||body.ok!==true){
  const messages={
   WPISZ_NICK:'Wpisz co najmniej trzy poprawne znaki nicku.',
   GRACZ_NIEDOSTEPNY:'Gracz nie istnieje, nie potwierdził e-maila albo nie może otrzymywać zaproszeń.',
   ZAPROSZENIE_NIEDOSTEPNE:'Zaproszenie jest już wysłane, nieaktualne lub kontakt nie jest dozwolony.',
   ZBYT_WIELE_ZAPROSZEN:'Limit zaproszeń został osiągnięty. Spróbuj później.',
   ZBYT_WIELE_PROB:'Zbyt wiele operacji. Spróbuj później.',
   BLEDNE_AKTUALNE_HASLO:'Obecne hasło jest nieprawidłowe.',
   POPRAW_NOWE_HASLO:'Sprawdź długość nowego hasła, potwierdzenie i to, czy różni się od obecnego.',
   HASLO_ZMIENIONE_PONOW_PROBE:'Hasło zostało zmienione w innej sesji. Odśwież stronę i spróbuj ponownie.'
  };
  const error=new Error(messages[body.error]||(response.status===401?'Sesja wygasła. Zaloguj się ponownie.':
   'Nie udało się wykonać operacji. Spróbuj ponownie.'));
  error.status=response.status;throw error;
 }
 return body;
}
const countryLabels={PL:'Polska',DE:'Niemcy',CZ:'Czechy',SK:'Słowacja',OTHER:'Inny'};
const languageLabels={pl:'Polski',en:'English',de:'Deutsch'};
function profileDraft(){
 return {displayName:$('display-name').value.trim(),bio:$('bio').value.trim(),country:$('country').value,language:$('language').value};
}
function renderProfilePreview(){
 if(!profileSnapshot)return;
 const draft=profileDraft();
 const name=draft.displayName||profileSnapshot.nickname||'Gracz';
 const initial=name.slice(0,1).toUpperCase()||'G';
 const country=countryLabels[draft.country]||'Nie podano',language=languageLabels[draft.language]||'Nie podano';
 $('profile-preview-avatar').textContent=initial;
 $('profile-preview-name').textContent=name;
 $('profile-preview-handle').textContent='@'+profileSnapshot.nickname;
 $('profile-preview-bio').textContent=draft.bio||'Dodaj opis, aby Twoja wizytówka opowiadała o Tobie.';
 $('profile-preview-country').textContent=country;
 $('profile-preview-language').textContent=language;
 $('profile-country-tag').textContent=country;
 $('profile-language-tag').textContent=language;
 $('profile-bio-counter').textContent=$('bio').value.length+' / 300 znaków';
 const score=[Boolean(profileSnapshot.nickname),Boolean(profileSnapshot.email),draft.displayName.length>=2,draft.bio.length>=10,Boolean(draft.country),Boolean(draft.language)];
 const percent=Math.round(score.filter(Boolean).length/score.length*100);
 $('profile-completion').textContent=percent+'%';
 $('profile-progress').value=percent;
 $('profile-next-step').textContent=draft.bio.length<10?'Dodaj opis (minimum 10 znaków)':'Wizytówka jest uzupełniona';
 const dirty=['displayName','bio','country','language'].some(key=>draft[key]!==profileSnapshot[key]);
 $('profile-reset').disabled=!dirty;
 $('saved-state').textContent=dirty?'Masz niezapisane zmiany':'Dane zapisane bezpiecznie w koncie';
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
 profileSnapshot=profile;
 $('profile-info-nick').textContent=profile.nickname;
 $('profile-info-email').textContent=profile.email;
 $('profile-info-joined').textContent=formattedDate(profile.createdAt);
 $('profile-joined-summary').textContent=formattedDate(profile.createdAt);
 $('dashboard-name').textContent=profile.displayName;
 $('dashboard-joined').textContent=formattedDate(profile.createdAt);
 const initial=profile.displayName.slice(0,1).toUpperCase()||'G';
 $('nav-avatar').textContent=initial;$('profile-avatar').textContent=initial;$('dashboard-avatar').textContent=initial;
 renderProfilePreview();
 if(typeof window!=='undefined' && typeof Event!=='undefined')window.dispatchEvent(new Event('gracz:profile-ready'));
}
let sessionConfirmed=false;
function accessState(title,message,{login=false,retry=false}={}){
 sessionConfirmed=false;
 $('player-shell').hidden=true;
 $('access-screen').hidden=false;
 $('access-title').textContent=title;
 $('access-message').textContent=message;
 $('access-login').hidden=!login;
 $('access-retry').hidden=!retry;
}
async function load(){
 accessState('Sprawdzanie konta…','Trwa bezpieczna weryfikacja sesji. Twoje dane nie są jeszcze wyświetlane.');
 try{
  const result=await api('profile');
  if(!result.profile || !result.profile.nickname)throw new Error('Nie udało się odczytać danych konta.');
  fill(result.profile);
  sessionConfirmed=true;
  $('player-shell').hidden=false;
  $('access-screen').hidden=true;
  notice('');
  try{await refreshCenter();}catch{notice('Profil jest dostępny, ale ustawienia premium lub lista sesji są chwilowo niedostępne.',true);}
 }catch(error){
  if(error.status===401)accessState('Zaloguj się do konta','Sesja wygasła lub nie została rozpoznana. Zaloguj się, aby otworzyć swój panel.',{login:true});
  else accessState('Nie udało się wczytać konta','Nie możemy teraz potwierdzić sesji. Spróbuj ponownie. Dane konta pozostają ukryte.',{retry:true});
 }
}
$('access-retry').addEventListener('click',load);

document.querySelectorAll('[data-password-toggle]').forEach(button=>button.addEventListener('click',()=>{
 const field=$(button.dataset.passwordToggle),reveal=field.type==='password';
 field.type=reveal?'text':'password';button.textContent=reveal?'Ukryj':'Pokaż';
 button.setAttribute('aria-pressed',String(reveal));
 button.setAttribute('aria-label',(reveal?'Ukryj':'Pokaż')+' hasło');
}));
$('pw-change-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const form=$('pw-change-form'),save=$('pw-change-submit'),label=$('pw-change-status');
 if(!sessionConfirmed){label.textContent='Zaloguj się ponownie, aby zmienić hasło.';return;}
 const currentPassword=$('pw-current').value,newPassword=$('pw-next').value,repeatPassword=$('pw-confirm').value;
 if(newPassword.length<15||new TextEncoder().encode(newPassword).length>256){
  label.textContent='Nowe hasło musi mieć co najmniej 15 znaków i maksymalnie 256 bajtów.';return;
 }
 if(newPassword!==repeatPassword){label.textContent='Nowe hasła nie są identyczne.';return;}
 if(currentPassword===newPassword){label.textContent='Nowe hasło musi różnić się od obecnego.';return;}
 save.disabled=true;label.textContent='Bezpieczne zapisywanie nowego hasła…';
 try{
  const result=await api('change-password',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({currentPassword,newPassword,repeatPassword})});
  form.reset();
  document.querySelectorAll('[data-password-toggle]').forEach(button=>{
   $(button.dataset.passwordToggle).type='password';button.textContent='Pokaż';
   button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Pokaż hasło');
  });
  label.textContent='Hasło zmieniono. Wylogowano pozostałe sesje: '+result.otherSessionsRevoked+'.';
  notice('Hasło zostało zmienione. Inne urządzenia zostały wylogowane.');
 }catch(error){label.textContent=error.message;}
 finally{save.disabled=false;}
});

$('profile-form').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!sessionConfirmed){accessState('Zaloguj się do konta','Zaloguj się ponownie, aby edytować profil.',{login:true});return;}
 const displayName=$('display-name').value.trim(),bio=$('bio').value.trim();
 if(displayName.length<2||displayName.length>40){notice('Nazwa wyświetlana musi mieć 2–40 znaków.',true);$('display-name').focus();return;}
 if(bio.length>300){notice('Opis może mieć najwyżej 300 znaków.',true);return;}
 const save=$('save');save.disabled=true;$('saved-state').textContent='Zapisywanie…';
 try{
  const result=await api('profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName,bio,country:$('country').value,language:$('language').value})});
  fill(result.profile);$('saved-state').textContent='Zmiany zapisane w koncie';notice('Profil został zapisany.');
 }catch(error){$('saved-state').textContent='Nie zapisano zmian';notice(error.message,true);if(error.status===401)accessState('Zaloguj się do konta','Sesja wygasła. Zaloguj się ponownie, aby edytować profil.',{login:true});}
 finally{save.disabled=false;}
});
async function logout(){
 try{await api('logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});location.replace('/konto/?widok=login');}
 catch(error){notice(error.message,true);}
}

['display-name','bio'].forEach(id=>$(id).addEventListener('input',renderProfilePreview));
['country','language'].forEach(id=>$(id).addEventListener('change',renderProfilePreview));
$('profile-reset').addEventListener('click',()=>{
 if(!profileSnapshot)return;
 fill(profileSnapshot);
 notice('Przywrócono ostatnio zapisane dane profilu.');
});
$('profile-edit-scroll').addEventListener('click',()=>{
 $('profile-form').scrollIntoView({behavior:document.body.classList.contains('panel-no-motion')?'auto':'smooth',block:'start'});
 $('display-name').focus({preventScroll:true});
});
document.querySelectorAll('[data-profile-jump]').forEach(button=>button.addEventListener('click',()=>switchSection(button.dataset.profileJump)));
$('dashboard-profile').addEventListener('click',()=>switchSection('profile'));
$('dashboard-manage-games').addEventListener('click',()=>switchSection('games'));
$('dashboard-devices').addEventListener('click',()=>switchSection('sessions'));
document.querySelectorAll('[data-favorite]').forEach(button=>button.addEventListener('click',async()=>{
 if(!centerState){notice('Najpierw wczytaj ustawienia konta.',true);return;}
 const key=button.dataset.favorite,previous=centerState.preferences;
 const favorites=new Set(previous.favoriteGames);
 if(favorites.has(key))favorites.delete(key);else favorites.add(key);
 button.disabled=true;
 try{await saveCenter({...previous,favoriteGames:[...favorites]});notice('Ulubione gry zapisane w koncie.');}
 catch(error){notice(error.message,true);}
 finally{button.disabled=false;}
}));
$('appearance-form').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!centerState){notice('Ustawienia są chwilowo niedostępne.',true);return;}
 const button=$('appearance-save');button.disabled=true;$('appearance-state').textContent='Zapisywanie…';
 try{
  await saveCenter({
   ...centerState.preferences,
   density:$('setting-density').value,
   reduceMotion:$('setting-motion').checked,
   largeText:$('setting-large').checked
  });
  $('appearance-state').textContent='Zapisano na Twoim koncie';
  notice('Wygląd panelu został zapisany.');
 }catch(error){$('appearance-state').textContent='Nie zapisano';notice(error.message,true);}
 finally{button.disabled=false;}
});
$('sessions-refresh').addEventListener('click',async()=>{
 try{await refreshCenter();notice('Sesje odświeżone.');}catch(error){notice(error.message,true);}
});
$('sessions-revoke').addEventListener('click',async()=>{
 if(!sessionConfirmed||!centerState)return;
 const button=$('sessions-revoke');button.disabled=true;
 try{
  const result=await api('player-center/revoke-others',{method:'POST',
   headers:{'Content-Type':'application/json'},body:'{}'});
  await refreshCenter();
  notice('Zakończono inne sesje: '+result.revoked+'.');
 }catch(error){notice(error.message,true);}
 finally{button.disabled=false;}
});
$('export-profile').addEventListener('click',()=>{
 if(!sessionConfirmed||!profileSnapshot||!centerState){notice('Najpierw wczytaj dane konta.',true);return;}
 const payload={source:'gracz.pl — dane profilu i ustawienia panelu',exportedAt:new Date().toISOString(),
  profile:profileSnapshot,preferences:centerState.preferences};
 const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download='gracz-pl-moj-profil.json';
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 notice('Przygotowano plik JSON z danymi profilu.');
});

$('create-room').addEventListener('click',()=>switchSection('challenges'));
['side-logout','security-logout','session-logout'].forEach(id=>$(id).addEventListener('click',logout));
load();
})();`+premiumProfileScript;
export function servePlayerPanel(req,res,url){
  if(req.method!=='GET')return false;
  if(servePublicProfile(req,res,url,css,headers))return true;
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
