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
<div class="site-nav"><a class="site-brand" href="https://gracz.pl/" aria-label="Strona startowa gracz.pl">gracz<span>.pl</span></a><nav aria-label="Menu główne serwisu"><a href="https://gracz.pl/gry/">Gry</a><a href="https://gracz.pl/gry/tysiac/">Gry karciane</a><a href="https://gracz.pl/poradniki/">Poradniki</a><a href="https://gracz.pl/blog/">Blog</a><a href="https://gracz.pl/spolecznosc/">Społeczność</a><a href="https://gracz.pl/#newsletter">Newsletter</a></nav><a class="site-discover" href="https://gracz.pl/gry/">Odkryj gry <span aria-hidden="true">↗</span></a></div>
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
 <label>Nick gracza <small>Login · zmiana w sekcji „Zmiana nicku”</small><input id="nickname" disabled title="Nick jest identyfikatorem konta"></label>
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
 <div class="card profile-password-card" id="profile-nickname-section">
  <div class="card-heading"><div><p class="card-kicker">LOGIN GRACZA · FULL MAX PREMIUM</p><h2>Zmiana nicku</h2><p>Nowy nick służy do logowania i jest widoczny dla innych graczy. Konto, e-mail, hasło, sesje, znajomi i historia gier pozostają bez zmian.</p></div><span class="profile-pill">BEZPIECZNA ZMIANA</span></div>
  <form id="nick-change-form" class="profile-password-form" autocomplete="off">
   <label for="nick-next">Nowy nick</label><div class="profile-password-field"><input id="nick-next" maxlength="32" minlength="3" pattern="[A-Za-z][A-Za-z0-9._-]{2,31}" required spellcheck="false" autocapitalize="off" aria-describedby="nick-hint"></div>
   <small id="nick-hint">3–32 znaki, zaczyna się literą. Litery, cyfry, _ – . Po zmianie logujesz się nowym nickiem albo adresem e-mail.</small>
   <label for="nick-password">Obecne hasło</label><div class="profile-password-field"><input type="password" id="nick-password" autocomplete="current-password" required maxlength="256"><button type="button" data-password-toggle="nick-password" aria-label="Pokaż obecne hasło" aria-pressed="false">Pokaż</button></div>
   <div class="form-actions"><span id="nick-change-status" role="status" aria-live="polite">Zmiana wymaga potwierdzenia obecnym hasłem.</span><button class="primary" id="nick-change-submit" type="submit">Zmień nick</button></div>
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
 <div class="profile-game-links"><a href="/konto/warcaby/">♟ Graj w Warcaby</a><a href="/konto/gomoku/">◉ Graj w Gomoku</a><a href="/konto/szachy/">♔ Graj w Szachy</a></div>
</aside></div>
</section>
<section class="view" data-panel="friends">
<div class="friendshub-hero">
 <div><p class="card-kicker">POLSKIE CENTRUM GRACZA · FULL MAX PREMIUM</p><h2>Moja społeczność</h2>
 <p>Znajomi, kluby, osobista książka adresowa i zaproszenia — wszystko w jednym bezpiecznym miejscu.</p></div>
 <div class="friendshub-hero-badge"><strong>GRACZ.PL</strong><span>TWOJE KONTAKTY</span></div>
</div>
<nav id="friendshub-tabs" class="friendshub-tabs" role="tablist" aria-label="Zarządzanie znajomymi">
 <button type="button" class="active" role="tab" aria-selected="true" data-fh-tab="overview">♟ Znajomi</button>
 <button type="button" role="tab" aria-selected="false" data-fh-tab="book">▤ Książka adresowa</button>
 <button type="button" role="tab" aria-selected="false" data-fh-tab="requests">✉ Zaproszenia <span id="fh-requests-badge" aria-live="polite"></span></button>
 <button type="button" role="tab" aria-selected="false" data-fh-tab="blocked">◇ Blokady</button>
 <button type="button" role="tab" aria-selected="false" data-fh-tab="forum">◈ Forum i kluby</button>
</nav>
<div data-fh-pane="overview" class="friendshub-pane">

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
</div><div data-fh-pane="requests" class="friendshub-pane" hidden>
<div class="card"><p class="card-kicker">ZAPROSZENIA PRZYCHODZĄCE</p><h2>Zaproszenia do znajomych</h2><div id="friends-incoming" class="friends-items"></div></div>
<div class="card"><p class="card-kicker">ZAPROSZENIA WYSŁANE</p><h2>Oczekujące odpowiedzi</h2><div id="friends-outgoing" class="friends-items"></div></div>
</div><div data-fh-pane="blocked" class="friendshub-pane" hidden>
<div class="card"><p class="card-kicker">PRYWATNOŚĆ</p><h2>Zablokowani użytkownicy</h2>
<p>Zablokowane osoby nie mogą wysyłać Ci zaproszeń. Możesz je odblokować w dowolnym momencie.</p><div id="friends-blocked" class="friends-items"></div></div>
</div>
<div data-fh-pane="book" class="friendshub-pane" hidden>
 <div class="card friendshub-book-top">
  <div class="card-heading"><div><p class="card-kicker">PRYWATNA KSIĄŻKA ADRESOWA</p><h2>Kontakty i grupy</h2>
   <p>Uporządkuj znajomych, zapisz prywatne notatki, numery i adresy, które samodzielnie podasz. Tych informacji nie udostępniamy innym graczom.</p></div>
   <div class="friendshub-actions"><button type="button" id="ab-new" class="primary">＋ Nowy kontakt</button><button type="button" id="ab-export" class="secondary">Eksport JSON</button><button type="button" id="ab-import-trigger" class="secondary">Import JSON</button><input id="ab-import-file" type="file" accept=".json,application/json" hidden></div>
  </div>
  <div class="friendshub-stat-grid"><div><small>KONTAKTY W KSIĄŻCE</small><strong id="ab-total">—</strong></div><div><small>GRUPY</small><strong id="ab-groups-count">—</strong></div><div><small>ULUBIONE</small><strong id="ab-favorites-count">—</strong></div></div>
  <div class="friendshub-book-filters">
   <label>Wyszukaj kontakt<input type="search" id="ab-search" maxlength="80" placeholder="Nick, alias, etykieta lub notatka"></label>
   <label>Grupa<select id="ab-group-filter"><option value="">Wszystkie grupy</option></select></label>
   <label class="friendshub-only-favs"><input id="ab-favorites-filter" type="checkbox"> Tylko ulubione</label>
   <button type="button" class="secondary" id="ab-refresh">Odśwież</button>
  </div>
  <div class="friendshub-group-chips" id="ab-group-chips" aria-label="Grupy kontaktów"></div>
 </div>
 <div class="friendshub-book-grid">
  <div class="card"><div class="card-heading"><div><p class="card-kicker">TWOJA BAZA KONTAKTÓW</p><h2>Lista kontaktów</h2></div></div>
   <div id="ab-list" class="friendshub-contact-list"><p>Otwórz książkę adresową, aby wczytać kontakty.</p></div>
   <div class="friendshub-pagination"><button id="ab-prev" class="secondary" type="button" disabled>Poprzednia</button><span id="ab-page-status"></span><button id="ab-next" class="secondary" type="button" disabled>Następna</button></div>
  </div>
  <div class="card friendshub-editor"><div class="card-heading"><div><p class="card-kicker">PRYWATNA WIZYTÓWKA</p><h2 id="ab-form-title">Dodaj kontakt</h2></div></div>
   <form id="ab-form" class="friendshub-form" autocomplete="off">
    <input id="ab-id" type="hidden">
    <label for="ab-name">Nazwa / alias kontaktu</label><input id="ab-name" maxlength="64" required placeholder="Np. Mój partner do Gomoku">
    <label for="ab-nickname">Nick znajomego na GRACZ.PL (opcjonalnie)</label><input id="ab-nickname" maxlength="32" placeholder="Tylko zaakceptowany znajomy">
    <p class="friendshub-hint">Powiązanie z kontem jest możliwe wyłącznie dla zaakceptowanego znajomego. Własne kontakty spoza platformy można zapisać bez nicku.</p>
    <label for="ab-group">Grupa / klub</label><input id="ab-group" maxlength="32" required list="ab-group-options" value="Bez grupy"><datalist id="ab-group-options"><option value="Przyjaciele"><option value="Klub graczy"><option value="Trening"><option value="Turnieje"><option value="Rodzina"><option value="Bez grupy"></datalist>
    <label for="ab-tags">Etykiety (oddzielone przecinkami, maks. 8)</label><input id="ab-tags" maxlength="200" placeholder="szachy, warcaby, drużyna">
    <div class="friendshub-split"><label for="ab-email">E-mail (opcjonalnie)<input id="ab-email" type="email" maxlength="160" placeholder="Dopisany przez Ciebie"></label>
    <label for="ab-phone">Telefon (opcjonalnie)<input id="ab-phone" type="tel" maxlength="40" placeholder="Dopisany przez Ciebie"></label></div>
    <label for="ab-note">Prywatna notatka</label><textarea id="ab-note" maxlength="1000" rows="4" placeholder="Wspólne turnieje, preferowane gry, ważne ustalenia…"></textarea>
    <label class="friendshub-check"><input type="checkbox" id="ab-favorite"> ★ Dodaj do ulubionych</label>
    <div class="friendshub-actions"><button id="ab-save" class="primary" type="submit">Zapisz kontakt</button><button type="button" id="ab-cancel" class="secondary">Wyczyść</button><button type="button" id="ab-delete" class="secondary" hidden>Usuń z książki</button></div>
    <p role="status" aria-live="polite" id="ab-form-status">Twoje dane kontaktowe pozostają prywatne.</p>
   </form>
  </div>
 </div>
 <p id="ab-status" role="status" aria-live="polite"></p>
</div>
<div data-fh-pane="forum" class="friendshub-pane" hidden>
 <div class="card friendshub-forum">
  <p class="card-kicker">ARCHITEKTURA GOTOWA NA FORUM · FULL MAX PREMIUM</p><h2>Forum, kluby i społeczność</h2>
  <p>W przyszłości zaakceptowane znajomości będzie można łączyć z profilami forum, klubami, tematami, turniejami i wspólnymi drużynami. Książka adresowa korzysta ze stabilnego identyfikatora konta, więc nie będzie potrzeby tworzenia kolejnych kont gracza.</p>
  <div class="friendshub-roadmap"><div><strong>✓ Teraz</strong><span>Znajomi, prywatne kontakty i grupy</span></div><div><strong>✓ Teraz</strong><span>Wiadomości i zaproszenia do gier</span></div><div><strong>Planowane</strong><span>Powiązanie z profilem forum i aktywnością klubową</span></div><div><strong>Planowane</strong><span>Wspólne turnieje, społeczności i powiadomienia forum</span></div></div>
  <p class="friendshub-hint">Integracja forum nie została jeszcze uruchomiona. Nie wyświetlamy fikcyjnego statusu online ani nieistniejących wiadomości forum.</p>
 </div>
</div>
</section>
<section class="view" data-panel="security">
<div class="sec-hero">
 <div><p class="card-kicker">GRACZ.PL · CENTRUM OCHRONY · FULL MAX PREMIUM</p><h2>Bezpieczeństwo konta</h2><p>Kontroluj aktywne sesje, urządzenia, hasło, historię operacji i ustawienia widoczności alertów.</p></div>
 <span class="sec-shield" aria-hidden="true">♜</span>
</div>
<div class="sec-metrics">
 <div><small>WERYFIKACJA E-MAIL</small><strong id="sec-email-status">Sprawdzanie</strong><span>Tożsamość konta</span></div>
 <div><small>AKTYWNE SESJE</small><strong id="sec-session-count">—</strong><span>Przeglądarki i urządzenia</span></div>
 <div><small>OSTATNIE ZDARZENIE</small><strong id="sec-last-event">—</strong><span>Od wdrożenia historii</span></div>
 <div><small>2FA</small><strong>Planowane</strong><span>Nie jest aktywne</span></div>
</div>
<nav class="sec-tabs" role="tablist" aria-label="Moduły bezpieczeństwa">
 <button class="active" role="tab" type="button" data-sec-tab="overview" aria-selected="true">◈ Centrum ochrony</button>
 <button role="tab" type="button" data-sec-tab="devices" aria-selected="false">▣ Urządzenia i sesje</button>
 <button role="tab" type="button" data-sec-tab="history" aria-selected="false">◷ Historia zdarzeń</button>
 <button role="tab" type="button" data-sec-tab="alerts" aria-selected="false">♢ Alerty i ustawienia</button>
 <button role="tab" type="button" data-sec-tab="recovery" aria-selected="false">✧ Odzyskiwanie</button>
</nav>
<p class="sec-status" id="sec-status" role="status" aria-live="polite">Ochrona konta: oczekiwanie na weryfikację danych sesji.</p>
<div class="sec-pane" data-sec-pane="overview">
 <div class="sec-two">
  <div class="card sec-feature"><p class="card-kicker">HASŁO I DOSTĘP</p><h2>Ochrona hasłem</h2><p>Sprawdzenie aktualnego hasła, szyfrowane połączenie oraz bezpieczny skrót kryptograficzny. Zmiana hasła unieważnia pozostałe sesje.</p>
   <div class="sec-feature-actions"><button id="sec-change-password" class="primary" type="button">Zmień hasło</button><span class="sec-inline-note">Bezpośrednio w „Konto i profil”</span></div>
  </div>
  <div class="card sec-feature"><p class="card-kicker">BEZPIECZNA SESJA</p><h2>Kontrola dostępu</h2><p>Możesz wylogować się z bieżącej przeglądarki albo unieważnić sesje pozostałych urządzeń.</p>
   <div class="sec-feature-actions"><button id="sec-revoke-quick" class="secondary" type="button">Wyloguj inne urządzenia</button><button class="secondary" id="security-logout" type="button">Wyloguj tutaj</button></div>
  </div>
 </div>
 <div class="card"><p class="card-kicker">BEZPIECZEŃSTWO W PRAKTYCE</p><h2>Stan zabezpieczeń</h2>
  <div class="sec-checklist">
   <div><strong>✓ Potwierdzony e-mail</strong><span>Wymagany do aktywnego konta.</span></div>
   <div><strong>✓ Sesje HttpOnly</strong><span>Tokeny sesji nie są dostępne skryptom w przeglądarce.</span></div>
   <div><strong>✓ Zmiana hasła</strong><span>Weryfikacja aktualnego hasła i wylogowanie pozostałych sesji.</span></div>
   <div><strong>○ Uwierzytelnianie dwuskładnikowe</strong><span>Funkcja nie jest obecnie uruchomiona — nie można jej włączyć tutaj.</span></div>
  </div>
 </div>
</div>
<div class="sec-pane" data-sec-pane="devices" hidden>
 <div class="card">
  <div class="card-heading"><div><p class="card-kicker">PRZEGLĄDARKI I URZĄDZENIA</p><h2>Aktywne sesje konta</h2><p>Rozpoznawanie przeglądarek jest orientacyjne; nie zbieramy lokalizacji ani dokładnego adresu IP do tego widoku.</p></div><div class="sec-feature-actions"><button class="secondary" id="sec-devices-refresh" type="button">Odśwież</button><button class="primary" id="sec-revoke-others" type="button">Wyloguj pozostałe</button></div></div>
  <div id="sec-device-list" class="sec-device-list"><p>Odczytywanie sesji…</p></div>
  <p class="sec-inline-note">Bieżącej sesji nie można usunąć z tej listy. Aby ją zamknąć, użyj „Wyloguj tutaj” w Centrum ochrony.</p>
 </div>
</div>
<div class="sec-pane" data-sec-pane="history" hidden>
 <div class="card">
  <div class="card-heading"><div><p class="card-kicker">DZIENNIK BEZPIECZEŃSTWA</p><h2>Historia wybranych zdarzeń</h2></div><div class="sec-feature-actions"><button id="sec-history-refresh" class="secondary" type="button">Odśwież</button><button id="sec-export-events" class="secondary" type="button">Eksport CSV</button></div></div>
  <p class="sec-inline-note" id="sec-history-note">Dziennik obejmuje jedynie zdarzenia zapisywane od wdrożenia tego modułu, nie wcześniejsze logowania.</p>
  <label class="sec-history-filter">Pokaż wydarzenia<select id="sec-event-filter">
   <option value="all">Wszystkie</option><option value="login_success">Udane logowania</option>
   <option value="password_changed">Zmiana hasła</option><option value="session_revoked">Wylogowane urządzenia</option>
   <option value="other_sessions_revoked">Wylogowanie pozostałych</option><option value="preferences_updated">Zmiana ustawień</option>
  </select></label>
  <div id="sec-event-list" class="sec-event-list"><p>Historia jest wczytywana…</p></div>
 </div>
</div>
<div class="sec-pane" data-sec-pane="alerts" hidden>
 <div class="card sec-feature"><p class="card-kicker">POWIADOMIENIA W PANELU</p><h2>Wyróżnianie ważnych zdarzeń</h2><p>Ustawienia wpływają na oznaczenia w panelu bezpieczeństwa, a nie na wysyłkę e-mail lub SMS.</p>
  <form id="sec-alert-form" class="sec-alert-form">
   <label><span><strong>Nowe logowania</strong><small>Wyróżniaj udane logowania w historii.</small></span><input type="checkbox" id="sec-alert-logins"></label>
   <label><span><strong>Zmiana hasła</strong><small>Wyróżniaj zdarzenia zmiany hasła.</small></span><input type="checkbox" id="sec-alert-password"></label>
   <div class="sec-feature-actions"><button class="primary" id="sec-alert-save" type="submit">Zapisz ustawienia</button><span id="sec-alert-status" role="status" aria-live="polite"></span></div>
  </form>
  <p class="sec-inline-note" id="sec-alert-note">Wysyłka e-mail/SMS nie została uruchomiona.</p>
 </div>
</div>
<div class="sec-pane" data-sec-pane="recovery" hidden>
 <div class="card sec-feature">
  <p class="card-kicker">PRZYWRACANIE DOSTĘPU</p><h2>Bezpieczne odzyskiwanie konta</h2>
  <div class="sec-checklist">
   <div><strong>1. Potwierdzony adres e-mail</strong><span>Sprawdzaj, czy nadal masz dostęp do swojej skrzynki. Obecnie brak formularza zmiany adresu w tej sekcji.</span></div>
   <div><strong>2. Zmiana hasła</strong><span>Jeżeli znasz obecne hasło, możesz zmienić je bez wylogowania.</span></div>
   <div><strong>3. Podejrzane sesje</strong><span>Jeżeli nie rozpoznajesz aktywnej sesji, unieważnij ją lub wszystkie pozostałe i zmień hasło.</span></div>
   <div><strong>4. 2FA i kody odzyskiwania</strong><span>Dostępne dopiero po osobnym wdrożeniu i weryfikacji mechanizmu 2FA. Obecnie nie generujemy żadnych fikcyjnych kodów.</span></div>
  </div>
  <div class="sec-feature-actions"><button type="button" class="secondary" id="sec-recovery-password">Przejdź do zmiany hasła</button><button type="button" class="secondary" id="sec-recovery-devices">Zobacz sesje</button></div>
 </div>
</div>
</section>
<section class="view" data-panel="privacy">
<div class="priv-hero">
 <div><p class="card-kicker">GRACZ.PL · CENTRUM PRYWATNOŚCI · FULL MAX PREMIUM</p>
 <h2>Twoja prywatność. Twoje zasady.</h2>
 <p>Ty decydujesz, kto znajdzie Twoje konto, co zobaczy na wizytówce i kto może nawiązać z Tobą kontakt.</p></div>
 <div class="priv-emblem" aria-hidden="true"><span>✦</span><small>PRIVACY</small></div>
</div>
<div class="priv-metrics">
 <div><small>WIDOCZNOŚĆ PROFILU</small><strong id="priv-metric-profile">—</strong><span>Dla innych graczy</span></div>
 <div><small>WYSZUKIWANIE</small><strong id="priv-metric-search">—</strong><span>Znajdowanie nicku</span></div>
 <div><small>STATUS ONLINE</small><strong id="priv-metric-online">—</strong><span>Widoczność dla znajomych</span></div>
 <div><small>KONTAKTY</small><strong id="priv-metric-contact">—</strong><span>Wiadomości i zaproszenia</span></div>
</div>
<nav class="priv-tabs" role="tablist" aria-label="Opcje prywatności">
 <button type="button" role="tab" aria-selected="true" class="active" data-priv-tab="overview">◈ Centrum prywatności</button>
 <button type="button" role="tab" aria-selected="false" data-priv-tab="profile">♙ Profil publiczny</button>
 <button type="button" role="tab" aria-selected="false" data-priv-tab="detail">▤ Szczegóły profilu</button>
 <button type="button" role="tab" aria-selected="false" data-priv-tab="contacts">◇ Znajomi i kontakt</button>
 <button type="button" role="tab" aria-selected="false" data-priv-tab="trusted">★ Zaufane kontakty</button>
 <button type="button" role="tab" aria-selected="false" data-priv-tab="games">♟ Gry i aktywność</button>
 <button type="button" role="tab" aria-selected="false" data-priv-tab="data">▤ Moje dane</button>
 <button type="button" role="tab" aria-selected="false" data-priv-tab="future">✧ Forum i przyszłość</button>
</nav>
<div class="priv-controlled-count"><strong>20</strong> szczegółowych ustawień prywatności · zapis po stronie serwera · ochrona konta bez dodatkowej usługi</div>
<p class="priv-notice" id="priv-status" role="status" aria-live="polite">Wczytywanie zapisanych preferencji prywatności…</p>
<div class="priv-pane" data-priv-pane="overview">
 <div class="card">
  <p class="card-kicker">JEDNYM KLIKNIĘCIEM</p><h2>Wybierz poziom prywatności</h2>
  <p>Wybór ustawia przełączniki w panelu. Zmiany zostaną wprowadzone dopiero po naciśnięciu „Zapisz ustawienia”.</p>
  <div class="priv-presets">
   <button type="button" data-priv-preset="private"><strong><span>♜</span> Maksymalna prywatność</strong><small>Profil ukryty, bez wyszukiwania, zaproszeń i widoczności online.</small></button>
   <button type="button" data-priv-preset="friends"><strong><span>♟</span> Tylko znajomi</strong><small>Kontakty od zaakceptowanych znajomych, bez publicznej wizytówki.</small></button>
   <button type="button" data-priv-preset="open"><strong><span>✦</span> Profil otwarty</strong><small>Publiczna wizytówka, odkrywanie i wiadomości od znajomych.</small></button>
  </div>
 </div>
 <div class="priv-info-grid">
  <div class="card"><p class="card-kicker">PROFIL</p><h2>Publiczna wizytówka</h2><p>Imię wyświetlane, opis, statystyki i osiągnięcia są pokazywane zgodnie z Twoimi zgodami.</p><button class="secondary" type="button" data-priv-goto="profile">Zarządzaj wizytówką</button></div>
  <div class="card"><p class="card-kicker">RELACJE</p><h2>Kontakty i zaproszenia</h2><p>Zezwalaj lub blokuj nowe zaproszenia do znajomych, wiadomości i wyzwania w grach.</p><button class="secondary" type="button" data-priv-goto="contacts">Ustaw kontakty</button></div>
  <div class="card"><p class="card-kicker">PRESENCE</p><h2>Status online</h2><p>Decyduj, czy zaakceptowani znajomi widzą Twoją bieżącą dostępność.</p><button class="secondary" type="button" data-priv-goto="games">Ustaw aktywność</button></div>
  <div class="card"><p class="card-kicker">PRAWA DO DANYCH</p><h2>Eksport ustawień</h2><p>Pobierz swoje ustawienia prywatności i podstawowe dane wizytówki w pliku JSON.</p><button class="secondary" type="button" data-priv-goto="data">Przejdź do danych</button></div>
 </div>
</div>
<div class="priv-pane" data-priv-pane="profile" hidden>
 <div class="card">
  <p class="card-kicker">PREZENTACJA W SERWISIE</p><h2>Publiczny profil gracza</h2>
  <p>To są te same uprawnienia, które obowiązują w module „Konto i profil”. Profil prywatny nie jest udostępniany publicznym odwiedzającym.</p>
  <div class="priv-options">
   <label class="priv-option"><span><strong>Publiczna wizytówka</strong><small>Umożliwiaj otwarcie profilu innym osobom przez publiczny adres GRACZ.PL.</small></span><input type="checkbox" id="priv-publicProfile"></label>
   <label class="priv-option"><span><strong>Pokazuj statystyki gier</strong><small>Udostępniaj zestawienie rozegranych partii i zwycięstw na publicznym profilu (tylko gdy jest włączony).</small></span><input type="checkbox" id="priv-showStats"></label>
   <label class="priv-option"><span><strong>Pokazuj miasto i kraj</strong><small>Ujawniaj lokalizację wpisaną we własnym profilu — nigdy dokładny adres urządzenia.</small></span><input type="checkbox" id="priv-showCountry"></label>
   <label class="priv-option"><span><strong>Pokazuj osiągnięcia</strong><small>Publikuj zdobyte odznaki tylko, gdy włączone jest również pokazywanie statystyk.</small></span><input type="checkbox" id="priv-showBadges"></label>
  </div>
  <div class="priv-actions"><button type="button" class="secondary" id="priv-preview-profile">Otwórz mój profil publiczny</button><button type="button" class="secondary" id="priv-edit-card">Edytuj wygląd wizytówki</button></div>
  <p class="priv-hint">Wyłączenie profilu publicznego ukrywa go przed anonimowym dostępem. Zapisane statystyki i odznaki nie są usuwane.</p>
 </div>
</div>
<div class="priv-pane" data-priv-pane="detail" hidden>
 <div class="card">
  <p class="card-kicker">PRECYZYJNA KONTROLA WIZYTÓWKI</p><h2>Co dokładnie inni zobaczą?</h2>
  <p>Możesz ukrywać poszczególne informacje nawet wtedy, gdy Twój profil jest publiczny. Zmiany dotyczą publicznego API — nie usuwają danych z Twojego własnego konta.</p>
  <div class="priv-options">
   <label class="priv-option"><span><strong>Moja nazwa wyświetlana</strong><small>Wyłączenie zastępuje nazwę wyświetlaną nickiem gracza na publicznej wizytówce.</small></span><input type="checkbox" id="priv-showDisplayName"></label>
   <label class="priv-option"><span><strong>Opis biograficzny</strong><small>Ukryj opis profilu przed innymi graczami, bez usuwania jego treści.</small></span><input type="checkbox" id="priv-showBio"></label>
   <label class="priv-option"><span><strong>Moje motto</strong><small>Decyduj, czy motto będzie widoczne na publicznej wizytówce.</small></span><input type="checkbox" id="priv-showMotto"></label>
   <label class="priv-option"><span><strong>Data dołączenia</strong><small>Ukryj datę utworzenia konta na publicznym profilu.</small></span><input type="checkbox" id="priv-showJoined"></label>
   <label class="priv-option"><span><strong>Miasto</strong><small>Kontroluj miasto osobno. Wyświetla się wyłącznie wtedy, gdy pozwolisz również na widoczność kraju i lokalizacji.</small></span><input type="checkbox" id="priv-showCity"></label>
   <label class="priv-option"><span><strong>Wskaźnik skuteczności wygranych</strong><small>Ukryj procent wygranych w publicznym API. Własne statystyki pozostają dostępne po zalogowaniu.</small></span><input type="checkbox" id="priv-showWinRate"></label>
  </div>
  <p class="priv-hint">Statystyki i skuteczność są publiczne tylko wtedy, gdy włączono również publiczną wizytówkę i statystyki. Odznaki nadal mają odrębną zgodę.</p>
 </div>
</div>
<div class="priv-pane" data-priv-pane="contacts" hidden>
 <div class="card"><p class="card-kicker">ODKRYWANIE I ZNAJOMOŚCI</p><h2>Kto może Cię znaleźć i zaprosić?</h2>
  <div class="priv-options">
   <label class="priv-option"><span><strong>Widoczność w wyszukiwarce graczy</strong><small>Twój nick może pojawić się w wynikach wyszukiwania GRACZ.PL. Bez tej zgody nowe osoby nie znajdą Cię przez wyszukiwanie w panelu.</small></span><input type="checkbox" id="priv-discoverable"></label>
   <label class="priv-option"><span><strong>Otrzymuj zaproszenia do znajomych</strong><small>Inni gracze mogą wysyłać zaproszenia do znajomych. Wyłączenie blokuje nowe zaproszenia, nie usuwa dotychczasowych.</small></span><input type="checkbox" id="priv-friendRequests"></label>
   <label class="priv-option"><span><strong>Wiadomości od zaakceptowanych znajomych</strong><small>Twoi znajomi mogą wysyłać nowe wiadomości. Wyłączenie nie usuwa istniejących rozmów.</small></span><input type="checkbox" id="priv-friendMessages"></label>
  </div>
  <div class="priv-actions"><button type="button" id="priv-manage-friends" class="secondary">Moi znajomi</button><button type="button" id="priv-manage-blocks" class="secondary">Zarządzaj blokadami</button></div>
 </div>
 <div class="card"><p class="card-kicker">CO ZOSTAJE PRYWATNE</p><h2>Twoje kontakty są Twoje</h2><p>Notatki, telefony, adresy e-mail oraz grupy w Twojej książce adresowej nie są udostępniane innym graczom.</p></div>
</div>
<div class="priv-pane" data-priv-pane="trusted" hidden>
 <div class="card">
  <p class="card-kicker">KONTROLA ZAUFANIA FULL MAX PREMIUM</p><h2>Zaufani znajomi i bezpieczne zaproszenia</h2>
  <p>Zaufani to zaakceptowani znajomi, których wizytówkę oznaczysz gwiazdką ★ w swojej książce adresowej. Ustawienia poniżej są sprawdzane przy każdej operacji w serwerze.</p>
  <div class="priv-options">
   <label class="priv-option"><span><strong>Wyszukiwanie wyłącznie po pełnym nicku</strong><small>Inni gracze nie znajdą Cię przez wpisanie fragmentu nicku. Nadal mogą znaleźć Cię po dokładnej nazwie, jeżeli pozwalasz na wyszukiwanie.</small></span><input type="checkbox" id="priv-exactSearchOnly"></label>
   <label class="priv-option"><span><strong>Zaproszenia tylko przez wspólnych znajomych</strong><small>Nowe zaproszenie do znajomych jest dozwolone wyłącznie, gdy nadawca i odbiorca mają zaakceptowanego wspólnego znajomego.</small></span><input type="checkbox" id="priv-mutualFriendsOnlyRequests"></label>
   <label class="priv-option"><span><strong>Wiadomości tylko od zaufanych</strong><small>Wiadomości może wysyłać tylko zaakceptowany znajomy oznaczony gwiazdką w Twojej książce adresowej. Istniejące rozmowy nie są kasowane.</small></span><input type="checkbox" id="priv-trustedMessagesOnly"></label>
   <label class="priv-option"><span><strong>Zaproszenia do gier tylko od zaufanych</strong><small>Ogranicz nowe wyzwania do Gomoku i Warcabów do ulubionych, zaakceptowanych znajomych.</small></span><input type="checkbox" id="priv-trustedInvitesOnly"></label>
   <label class="priv-option"><span><strong>Status online tylko dla zaufanych</strong><small>Twoją obecność widzą jedynie znajomi oznaczeni przez Ciebie gwiazdką ★. Pozostałym znajomym status będzie pokazywany jako offline.</small></span><input type="checkbox" id="priv-trustedPresenceOnly"></label>
  </div>
  <div class="priv-actions"><button class="secondary" id="priv-trusted-manage" type="button">Otwórz zaufane kontakty</button><button class="secondary" id="priv-trusted-blocks" type="button">Blokady graczy</button></div>
  <p class="priv-hint">Włączenie restrykcji bez żadnego zaufanego kontaktu zablokuje odpowiednie interakcje dla wszystkich obecnych znajomych. Przyciski nie zmieniają statusu znajomości bez Twojej zgody.</p>
 </div>
</div>
<div class="priv-pane" data-priv-pane="games" hidden>
 <div class="card"><p class="card-kicker">ROZGRYWKI I AKTYWNOŚĆ</p><h2>Zaproszenia oraz status online</h2>
  <div class="priv-options">
   <label class="priv-option"><span><strong>Zezwalaj na wyzwania do gier</strong><small>Zaakceptowani znajomi mogą wysyłać nowe zaproszenia do Gomoku i Warcabów.</small></span><input type="checkbox" id="priv-gameInvites"></label>
   <label class="priv-option"><span><strong>Pokazuj mój status online</strong><small>Zaakceptowani znajomi widzą, kiedy jesteś aktywny w serwisie. Wyłączenie ukrywa status dla innych.</small></span><input type="checkbox" id="priv-showOnline"></label>
  </div>
  <div class="priv-hint">Wyniki i statystyki na publicznej wizytówce kontrolujesz w zakładce „Profil publiczny”. Samo wyłączenie widoczności nie usuwa historii z Twojego konta.</div>
 </div>
 <div class="card"><p class="card-kicker">PRZYSZŁE OPCJE</p><h2>Historia partii i rankingi</h2><p>Osobna kontrola widoczności poszczególnych rozegranych partii, rankingów i historii turniejowej wymaga przyszłej integracji rozgrywek społecznościowych. Ta funkcja nie jest jeszcze aktywna.</p></div>
</div>
<div class="priv-pane" data-priv-pane="data" hidden>
 <div class="card"><p class="card-kicker">PRAWA DO WŁASNYCH DANYCH</p><h2>Moje dane i eksport</h2>
  <p>Możesz pobrać kopię swoich preferencji prywatności oraz podstawowych danych profilu w postaci pliku JSON. Plik może zawierać adres e-mail — przechowuj go bezpiecznie.</p>
  <div class="priv-actions"><button type="button" class="primary" id="priv-export">Pobierz ustawienia i profil (JSON)</button><button type="button" class="secondary" id="priv-open-addressbook">Książka adresowa — import/eksport</button></div>
  <p id="priv-export-status" role="status" aria-live="polite" class="priv-hint">Eksport nie jest kompletną kopią konta; nie zawiera wiadomości ani pełnej historii gier.</p>
 </div>
 <div class="priv-info-grid">
  <div class="card"><p class="card-kicker">DANE PROFILU</p><h2>Aktualizacja</h2><p>Nick, opis, kraj oraz wygląd wizytówki znajdują się w zakładce „Konto i profil”.</p><button id="priv-open-editor" type="button" class="secondary">Otwórz edycję</button></div>
  <div class="card"><p class="card-kicker">DANE ZNAJOMYCH</p><h2>Własna książka</h2><p>Wpisy możesz edytować, usuwać i eksportować z modułu „Moi znajomi”.</p><button id="priv-open-friends" type="button" class="secondary">Otwórz książkę</button></div>
  <div class="card"><p class="card-kicker">OCHRONA KONTA</p><h2>Sesje i hasło</h2><p>Wylogowywanie urządzeń i zmiana hasła są dostępne w Centrum Bezpieczeństwa.</p><button id="priv-open-security" type="button" class="secondary">Przejdź do ochrony</button></div>
  <div class="card"><p class="card-kicker">USUNIĘCIE KONTA</p><h2>Żądania dotyczące danych</h2><p>Samodzielne usuwanie całego konta i pełny eksport archiwum nie zostały jeszcze wdrożone. Nie ma tutaj pozornego przycisku usuwania.</p></div>
 </div>
</div>
<div class="priv-pane" data-priv-pane="future" hidden>
 <div class="card"><p class="card-kicker">GRACZ NEXT · FORUM I KLUBY</p><h2>Prywatność przyszłej społeczności</h2>
 <p>Po uruchomieniu forum będzie można niezależnie kontrolować widoczność wpisów, listy klubów, zaproszeń do grup, obserwowania, powiadomień forum i komunikacji społecznościowej.</p>
 <div class="priv-roadmap">
  <div><strong>✓ Działa</strong><span>Wyszukiwanie kont i prywatność zaproszeń do znajomych</span></div>
  <div><strong>✓ Działa</strong><span>Kontrola wiadomości, wyzwań i statusu online</span></div>
  <div><strong>Planowane</strong><span>Widoczność tematów i profilu na forum</span></div>
  <div><strong>Planowane</strong><span>Zgody na kluby, turnieje i udostępnianie aktywności</span></div>
  <div><strong>Planowane</strong><span>Blokowanie wzmiankowania, obserwowania i tagowania</span></div>
  <div><strong>Planowane</strong><span>Pełne archiwum danych, żądanie usunięcia konta i automatyczna realizacja wniosków</span></div>
 </div>
 <p class="priv-hint">Nie przedstawiamy ustawień przyszłych usług jako działających zabezpieczeń.</p></div>
</div>
<div class="priv-savebar">
 <div><strong id="priv-save-state">Ustawienia nie zostały jeszcze wczytane</strong><small>Zmiany wymagają zapisania na serwerze</small></div>
 <div class="priv-actions"><button type="button" class="secondary" id="priv-reset">Cofnij niezapisane</button><button type="button" class="primary" id="priv-save">Zapisz ustawienia</button></div>
</div>
</section>
<section class="view" data-panel="notifications">
<div class="notif-hero">
 <div><p class="card-kicker">CENTRUM GRACZA · FULL MAX PREMIUM</p><h2>Centrum powiadomień</h2>
 <p>Wiadomości, znajomi, zaproszenia do gier i bezpieczeństwo. Wszystko uporządkowane na Twoim koncie.</p></div>
 <div class="notif-orb" aria-hidden="true">✦<small>GRACZ.PL</small></div>
</div>
<div class="notif-metrics">
 <div><small>NIEPRZECZYTANE</small><strong id="nt-unread">—</strong><span>Ważne dla Ciebie</span></div>
 <div><small>W SKRZYNCE</small><strong id="nt-inbox-total">—</strong><span>Aktualne zdarzenia</span></div>
 <div><small>DZISIAJ</small><strong id="nt-today">—</strong><span>Ostatnie aktywności</span></div>
 <div><small>ARCHIWUM</small><strong id="nt-archive-total">—</strong><span>Odłożone wiadomości</span></div>
</div>
<nav class="notif-tabs" role="tablist" aria-label="Kategorie powiadomień">
 <button type="button" role="tab" class="active" aria-selected="true" data-nt-tab="all">◈ Wszystkie</button>
 <button type="button" role="tab" aria-selected="false" data-nt-tab="unread">✦ Nieprzeczytane</button>
 <button type="button" role="tab" aria-selected="false" data-nt-tab="messages">✉ Wiadomości</button>
 <button type="button" role="tab" aria-selected="false" data-nt-tab="friends">♙ Znajomi</button>
 <button type="button" role="tab" aria-selected="false" data-nt-tab="games">♟ Gry</button>
 <button type="button" role="tab" aria-selected="false" data-nt-tab="security">◇ Bezpieczeństwo</button>
 <button type="button" role="tab" aria-selected="false" data-nt-tab="archive">▤ Archiwum</button>
 <button type="button" role="tab" aria-selected="false" data-nt-tab="settings">⚙ Ustawienia</button>
</nav>
<p class="notif-feedback" id="nt-feedback" role="status" aria-live="polite">Wczytywanie powiadomień…</p>
<div class="notif-view" data-nt-view="inbox">
 <div class="card notif-toolbar">
  <div class="notif-toolbar-row">
   <label for="nt-search">Wyszukaj powiadomienia<input id="nt-search" type="search" placeholder="Treść, nadawca lub nazwa gry…" maxlength="100"></label>
   <label for="nt-period">Zakres<select id="nt-period"><option value="90">Ostatnie 90 dni</option><option value="30">Ostatnie 30 dni</option><option value="7">Ostatni tydzień</option><option value="1">Ostatnie 24 godziny</option></select></label>
   <label for="nt-sort">Kolejność<select id="nt-sort"><option value="new">Najnowsze</option><option value="old">Najstarsze</option></select></label>
  </div>
  <div class="notif-actions">
   <button id="nt-refresh" class="secondary" type="button">Odśwież</button>
   <button id="nt-mark-all" class="secondary" type="button">Oznacz jako przeczytane</button>
   <button id="nt-archive-read" class="secondary" type="button">Archiwizuj przeczytane</button>
   <button id="nt-export" class="secondary" type="button">Eksport CSV</button>
  </div>
 </div>
 <div class="card notif-inbox">
  <div class="notif-list-header"><div><p class="card-kicker">TWOJA SKRZYNKA</p><h2 id="nt-list-title">Wszystkie powiadomienia</h2></div><span id="nt-list-count" class="notif-list-count">—</span></div>
  <div id="nt-list" class="notif-items"><p>Brak załadowanych zdarzeń.</p></div>
  <div class="notif-pagination"><button class="secondary" id="nt-more" type="button" hidden>Pokaż następne 20</button></div>
 </div>
</div>
<div class="notif-view" data-nt-view="settings" hidden>
 <div class="card">
  <p class="card-kicker">CENTRUM PREFERENCJI · FULL MAX PREMIUM</p><h2>Co trafia do Twojej skrzynki?</h2>
  <p>Każde ustawienie zapisuje się na Twoim koncie. Wyłączenie kategorii ukrywa ją w skrzynce, ale nie usuwa oryginalnych wiadomości, znajomości ani zaproszeń.</p>
  <form id="nt-settings-form" class="notif-settings">
   <div class="notif-settings-grid">
    <label class="notif-setting"><span><strong>✉ Wiadomości prywatne</strong><small>Nowe wiadomości od zaakceptowanych znajomych.</small></span><input id="nt-set-messages" type="checkbox"></label>
    <label class="notif-setting"><span><strong>♙ Znajomi</strong><small>Zaproszenia do znajomych i ich akceptacja.</small></span><input id="nt-set-friends" type="checkbox"></label>
    <label class="notif-setting"><span><strong>♟ Zaproszenia do gier</strong><small>Nowe wyzwania i przyjęcie/odrzucenie zaproszeń.</small></span><input id="nt-set-games" type="checkbox"></label>
    <div class="notif-setting notif-locked"><span><strong>◇ Zdarzenia bezpieczeństwa</strong><small>Zawsze widoczne — nie można ukryć zdarzeń związanych z ochroną konta.</small></span><span class="notif-required">Włączone</span></div>
   </div>
   <h3>Wygląd i sposób pracy</h3>
   <div class="notif-settings-grid">
    <label class="notif-setting"><span><strong>Wyróżniaj nieprzeczytane</strong><small>Podświetlaj nowe pozycje turkusową poświatą.</small></span><input id="nt-set-highlightUnread" type="checkbox"></label>
    <label class="notif-setting"><span><strong>Pokazuj nick nadawcy</strong><small>Ukryj nicki na liście i w odpowiedzi centrum powiadomień.</small></span><input id="nt-set-showNicknames" type="checkbox"></label>
    <label class="notif-setting"><span><strong>Pokazuj daty</strong><small>Data i godzina przy każdej pozycji w centrum.</small></span><input id="nt-set-showDates" type="checkbox"></label>
    <label class="notif-setting"><span><strong>Oznaczaj jako przeczytane po otwarciu</strong><small>Po przejściu do powiązanego modułu automatycznie zaznaczaj pozycję jako odczytaną.</small></span><input id="nt-set-autoReadOnOpen" type="checkbox"></label>
   </div>
   <h3>Wyciszenie powiadomień</h3>
   <label for="nt-mute">Wycisz wizualne wyróżnienia na<select id="nt-mute">
    <option value="0">Nie wyciszaj</option><option value="60">1 godzinę</option><option value="480">8 godzin</option><option value="1440">24 godziny</option>
   </select></label>
   <p class="notif-hint" id="nt-mute-note">Wyciszenie nie usuwa powiadomień ani nie blokuje odczytu zdarzeń bezpieczeństwa.</p>
   <div class="notif-actions"><button id="nt-save" type="submit" class="primary">Zapisz preferencje</button><button id="nt-cancel" type="button" class="secondary">Cofnij zmiany</button></div>
  </form>
 </div>
 <div class="card">
  <p class="card-kicker">PRZYSZŁE KANAŁY DOSTARCZANIA</p><h2>Powiadomienia e-mail, push i SMS</h2>
  <p>Centrum działa teraz w panelu GRACZ.PL. Wysyłka zewnętrznych powiadomień e-mail, push i SMS nie jest uruchomiona. Nie przedstawiamy żadnego z tych kanałów jako aktywnego.</p>
  <div class="notif-planned"><span>E-mail: planowane</span><span>Push: planowane</span><span>SMS: planowane</span><span>Forum i turnieje: po integracji</span></div>
 </div>
</div>
<div class="card notif-footnote"><p>Pokazywane są wyłącznie rzeczywiste zdarzenia z istniejących modułów, maksymalnie 200 z ostatnich 90 dni. Dane pozostają na Twoim koncie; archiwizacja dotyczy powiadomienia, nie oryginalnej wiadomości lub partii.</p></div>
</section>
<section class="view" data-panel="messages">
<div class="msg-hero"><div><p class="card-kicker">POLSKIE CENTRUM GRACZA · FULL MAX PREMIUM</p><h2>Wiadomości i chat</h2>
<p>Twoje rozmowy, znajomi i zaproszenia w jednym bezpiecznym miejscu.</p></div><div class="msg-hero-mark" aria-hidden="true">✉<small>GRACZ.PL</small></div></div>
<div class="msg-metrics">
 <div><small>AKTYWNE ROZMOWY</small><strong id="msg-count">—</strong><span>Twoi zaakceptowani znajomi</span></div>
 <div><small>NIEPRZECZYTANE</small><strong id="msg-unread">—</strong><span>Wiadomości do przeczytania</span></div>
 <div><small>PRZYPIĘTE</small><strong id="msg-pinned">—</strong><span>Szybki dostęp</span></div>
 <div><small>ARCHIWUM</small><strong id="msg-archived">—</strong><span>Ukryte tylko u Ciebie</span></div>
</div>
<p class="msg-notice" id="messages-state" role="status" aria-live="polite">Wczytywanie Twoich rozmów…</p>
<div class="msg-layout">
 <aside class="msg-left card">
  <div class="msg-left-head"><div><p class="card-kicker">CENTRUM KONTAKTÓW</p><h2>Moje rozmowy</h2></div><button class="secondary" id="msg-refresh-all" type="button" aria-label="Odśwież listę rozmów">↻</button></div>
  <label for="msg-find">Znajdź rozmowę<input type="search" id="msg-find" placeholder="Wyszukaj nick…" maxlength="100"></label>
  <nav class="msg-filter" aria-label="Filtr rozmów">
   <button type="button" class="active" data-msg-filter="all" aria-pressed="true">Wszystkie</button>
   <button type="button" data-msg-filter="unread" aria-pressed="false">Nowe</button>
   <button type="button" data-msg-filter="pinned" aria-pressed="false">Przypięte</button>
   <button type="button" data-msg-filter="archive" aria-pressed="false">Archiwum</button>
  </nav>
  <label for="msg-label-filter">Grupa kontaktów<select id="msg-label-filter"><option value="all">Wszystkie grupy</option><option value="priority">Ważne</option><option value="team">Drużyna</option><option value="family">Rodzina</option><option value="friends">Znajomi</option><option value="">Bez grupy</option></select></label>
  <div id="msg-conversations" class="msg-conversations" aria-live="polite"><p>Wybierz znajomego, aby rozpocząć rozmowę.</p></div>
  <div class="msg-left-footer"><button type="button" id="msg-open-friends" class="secondary">Moi znajomi</button><button type="button" id="msg-open-book" class="secondary">Książka adresowa</button></div>
 </aside>
 <div class="msg-right">
  <div class="card msg-chat">
   <header class="msg-chat-head">
    <div class="msg-chat-person"><div id="msg-chat-avatar" class="msg-avatar" aria-hidden="true">G</div>
     <div><p class="card-kicker">PRYWATNA ROZMOWA</p><h2 id="msg-chat-name">Wybierz znajomego</h2><small id="msg-chat-status">Wiadomości tylko między zaakceptowanymi znajomymi</small></div>
    </div>
    <div class="msg-chat-actions">
     <button class="secondary" type="button" id="messages-refresh">Odśwież</button>
     <button class="secondary" type="button" id="msg-invite-game">Zaproś do gry</button>
     <button class="secondary" type="button" id="msg-profile">Wizytówka</button>
    </div>
   </header>
   <div class="msg-chat-options">
    <label for="message-recipient">Rozmowa z<select id="message-recipient"><option value="">Wybierz znajomego</option></select></label>
    <label for="msg-search-thread">Znajdź w 60 ostatnich wiadomościach<input type="search" id="msg-search-thread" placeholder="Szukaj treści…" maxlength="100"></label>
   </div>
   <div class="msg-tools">
    <button type="button" class="secondary" id="msg-pin">Przypnij</button>
    <button type="button" class="secondary" id="msg-mute">Wycisz</button>
    <button type="button" class="secondary" id="msg-archive">Archiwizuj</button>
    <label for="msg-label" class="msg-label-control">Grupa<select id="msg-label"><option value="">Bez grupy</option><option value="priority">Ważne</option><option value="team">Drużyna</option><option value="family">Rodzina</option><option value="friends">Znajomi</option></select></label>
    <button type="button" class="secondary" id="msg-export">Eksport rozmowy</button>
   </div>
   <div id="message-thread" class="social-thread msg-thread" role="log" aria-live="polite" aria-label="Wiadomości w rozmowie"><p>Wybierz znajomego, aby wyświetlić rozmowę.</p></div>
   <form id="message-form" class="social-send msg-composer">
    <label class="social-label" for="message-content">Nowa wiadomość</label>
    <textarea id="message-content" rows="3" maxlength="1000" placeholder="Napisz prywatną wiadomość do znajomego…" required></textarea>
    <div class="msg-compose-bottom">
     <span id="msg-counter">0 / 1000 znaków</span><span>Ctrl + Enter: wyślij</span>
     <button class="primary" type="submit" id="message-send" disabled>Wyślij wiadomość</button>
    </div>
   </form>
  </div>
  <div class="card msg-privacy">
   <div><p class="card-kicker">TWOJA KONTROLA</p><h3>Bezpieczeństwo rozmów</h3>
   <p>Wiadomości są przechowywane na serwerze GRACZ.PL. Nie deklarujemy szyfrowania end-to-end ani czatu WebSocket. Rozmowa odświeża się okresowo, gdy ta zakładka jest otwarta.</p></div>
   <div class="msg-privacy-actions"><button id="msg-privacy-link" type="button" class="secondary">Prywatność</button><button id="msg-block-link" type="button" class="secondary">Blokady</button></div>
  </div>
 </div>
</div>
</section>
<section class="view" data-panel="challenges">
<div class="chall-metrics" aria-label="Podsumowanie zaproszeń">
 <div><small>DO ODPOWIEDZI</small><strong id="chall-incoming-count">—</strong><span>Otrzymane i aktualne</span></div>
 <div><small>OCZEKUJĄCE</small><strong id="chall-outgoing-count">—</strong><span>Wysłane zaproszenia</span></div>
 <div><small>ZAAKCEPTOWANE</small><strong id="chall-accepted-count">—</strong><span>Wspólne rozgrywki</span></div>
 <div><small>ULUBIONE</small><strong id="chall-star-count">—</strong><span>Oznaczone gwiazdką</span></div>
</div>
<nav class="chall-tabs" role="tablist" aria-label="Kategorie zaproszeń">
 <button type="button" data-chall-tab="all" class="active" aria-selected="true">◈ Wszystkie</button>
 <button type="button" data-chall-tab="incoming" aria-selected="false">✉ Otrzymane</button>
 <button type="button" data-chall-tab="outgoing" aria-selected="false">➤ Wysłane</button>
 <button type="button" data-chall-tab="accepted" aria-selected="false">✓ Przyjęte</button>
 <button type="button" data-chall-tab="starred" aria-selected="false">★ Ważne</button>
 <button type="button" data-chall-tab="history" aria-selected="false">◷ Historia</button>
 <button type="button" data-chall-tab="archive" aria-selected="false">▤ Archiwum</button>
 <button type="button" data-chall-tab="settings" aria-selected="false">⚙ Ustawienia</button>
</nav>
<p class="chall-notice" id="challenges-state" role="status" aria-live="polite">Wczytywanie Twoich zaproszeń…</p>
<div class="chall-workspace" id="chall-workspace">
 <div class="card chall-compose">
  <p class="card-kicker">NOWE WYZWANIE · FULL MAX PREMIUM</p><h2>Zaproś znajomego</h2>
  <p>Wybierz zaakceptowanego znajomego, grę i dostępne zasady. Wyzwanie wygasa po 7 dniach, jeżeli nie zostanie przyjęte.</p>
  <form id="challenge-form" class="chall-form">
   <label for="challenge-friend">Przeciwnik<select id="challenge-friend" required><option value="">Wybierz znajomego</option></select></label>
   <label for="challenge-game">Gra<select id="challenge-game"><option value="warcaby">♟ Warcaby Online</option><option value="gomoku">◉ Gomoku Online</option><option value="szachy">♔ Szachy Online</option></select></label>
   <div class="chall-time-options" id="chall-time-options" hidden>
    <label for="challenge-time">Czas na gracza<select id="challenge-time">
     <option value="0">Bez zegara</option><option value="1">1 minuta</option>
     <option value="2">2 minuty</option><option value="3">3 minuty</option>
     <option value="5">5 minut</option><option value="7">7 minut</option>
     <option value="10">10 minut</option><option value="15">15 minut</option>
     <option value="30">30 minut</option>
    </select></label>
    <label for="challenge-increment">Dodawany czas za ruch<select id="challenge-increment">
     <option value="0">Bez przyrostu</option><option value="2">+2 sekundy</option>
     <option value="3">+3 sekundy</option><option value="5">+5 sekund</option>
     <option value="10">+10 sekund</option>
    </select></label>
    <small id="chall-clock-description">Zegar dostępny dla Gomoku i Warcabów. Bez zegara przyrost wynosi 0 sekund.</small>
   </div>
   <div class="chall-preview"><span class="chall-preview-icon" id="chall-preview-icon">♟</span>
    <div><strong id="chall-preview-name">Warcaby Online</strong>
    <small id="chall-preview-details">Klasyczna partia online · bez zegara</small></div></div>
   <button class="primary" id="chall-submit" type="submit">Wyślij zaproszenie</button>
  </form>
  <div class="chall-shortcuts">
   <button class="secondary" type="button" id="chall-open-friends">Moi znajomi</button>
   <button class="secondary" type="button" id="chall-open-privacy">Prywatność zaproszeń</button>
  </div>
  <p class="chall-fineprint">Zaproszenie można wysłać tylko zaakceptowanemu, niezablokowanemu znajomemu zgodnie z jego ustawieniami prywatności. Warcaby i Gomoku: dostępne limity czasu dla obu graczy.</p>
  <p class="chall-fineprint">Po zaakceptowaniu wyzwania kliknij „Graj online”, aby otworzyć wspólną planszę. Ruchy są zatwierdzane i zapisywane na serwerze.</p>
 </div>
 <div class="card chall-inbox">
  <div class="chall-heading"><div><p class="card-kicker">CENTRUM ZAPROSZEŃ</p><h2 id="chall-list-heading">Twoje zaproszenia</h2></div><button class="secondary" id="challenges-refresh" type="button">Odśwież</button></div>
  <div class="chall-filters">
   <label for="chall-search">Znajdź gracza<input type="search" id="chall-search" placeholder="Wpisz nick…" maxlength="80"></label>
   <label for="chall-filter-game">Gra<select id="chall-filter-game">
    <option value="all">Wszystkie gry</option><option value="warcaby">Warcaby</option><option value="gomoku">Gomoku</option><option value="szachy">Szachy</option>
   </select></label>
   <label for="chall-filter-status">Status<select id="chall-filter-status">
    <option value="all">Dowolny</option><option value="pending">Oczekuje</option><option value="accepted">Przyjęte</option>
    <option value="declined">Odrzucone</option><option value="cancelled">Anulowane</option><option value="expired">Wygasłe</option>
   </select></label>
   <label for="chall-sort">Kolejność<select id="chall-sort"><option value="new">Najnowsze</option><option value="old">Najstarsze</option></select></label>
  </div>
  <div class="chall-list-summary"><span id="chall-result-count">—</span><span>Przechowujemy listę do 60 ostatnich zaproszeń z 30 dni</span></div>
  <div id="challenge-list" class="chall-list" aria-live="polite"><p>Brak zaproszeń.</p></div>
  <div class="chall-pagination"><button class="secondary" id="chall-more" type="button" hidden>Pokaż kolejne 15</button></div>
 </div>
</div>
<div class="card chall-settings" id="chall-settings" hidden>
 <p class="card-kicker">ZARZĄDZANIE WYZWANIAMI · FULL MAX PREMIUM</p><h2>Twoje zasady otrzymywania zaproszeń</h2>
 <div class="chall-settings-grid">
  <div><strong>Wybór, kto może Cię zapraszać</strong><p>W zakładce Prywatność ustawiasz, czy przyjmujesz zaproszenia do gier oraz czy ograniczasz je tylko do zaufanych kontaktów.</p><button class="secondary" id="chall-settings-privacy" type="button">Otwórz ustawienia prywatności</button></div>
  <div><strong>Blokowanie kontaktu</strong><p>Niechciane zaproszenia ograniczysz również przez moduł znajomych i blokad. Twoje blokady obowiązują także przy tworzeniu nowych wyzwań.</p><button class="secondary" id="chall-settings-blocked" type="button">Zarządzaj blokadami</button></div>
  <div><strong>Własne zaproszenia</strong><p>Oznaczaj wyzwania jako ważne, dodawaj prywatne notatki, archiwizuj i przywracaj je. Drugi gracz nie widzi tych oznaczeń.</p></div>
  <div><strong>Terminy i historia</strong><p>Zaproszenia oczekują maksymalnie 7 dni. W panelu widzisz do 60 ostatnich wyzwań z 30 dni. Przedłużanie lub umawianie partii na konkretną godzinę nie jest jeszcze uruchomione.</p></div>
 </div>
</div>
<div class="chall-note-overlay" id="chall-note-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="chall-note-title">
 <div class="chall-note-dialog"><p class="card-kicker">PRYWATNA NOTATKA</p><h2 id="chall-note-title">Notatka do zaproszenia</h2>
  <p>Widoczna tylko dla Ciebie. Nie jest wysyłana przeciwnikowi.</p>
  <label for="chall-note-input">Treść notatki<textarea id="chall-note-input" rows="4" maxlength="300" placeholder="Dodaj własną notatkę…"></textarea></label>
  <div class="chall-dialog-actions"><button class="secondary" type="button" id="chall-note-cancel">Anuluj</button><button class="primary" type="button" id="chall-note-save">Zapisz notatkę</button></div>
 </div>
</div>
</section>
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
<div class="game-tile"><div class="game-emoji" aria-hidden="true">♔</div><h3>Szachy</h3><p>Strategia szachowa</p><div class="game-actions"><a href="/konto/szachy/">Graj teraz</a><button type="button" data-favorite="szachy" aria-pressed="false" aria-label="Dodaj Szachy do ulubionych">☆ Ulubione</button></div></div>
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
<footer class="footer">© gracz.pl · Polskie Centrum Gracza · Full Max Premium</footer></main></div>

<div class="pw-success-overlay" id="pw-success-overlay" hidden>
 <section class="pw-success-modal" role="dialog" aria-modal="true" aria-labelledby="pw-success-title" aria-describedby="pw-success-message">
  <div class="pw-success-seal" aria-hidden="true"><span>✓</span></div>
  <p class="pw-success-kicker">GRACZ.PL · BEZPIECZEŃSTWO KONTA</p>
  <h2 id="pw-success-title">Hasło zostało zmienione</h2>
  <p id="pw-success-message">Twoje nowe hasło jest już aktywne. Konto jest zabezpieczone.</p>
  <div class="pw-success-confirmed"><span aria-hidden="true">✓</span> Operacja zakończona pomyślnie</div>
  <button class="pw-success-close" id="pw-success-close" type="button">Zamknij</button>
 </section>
</div>
<section class="logout-farewell" id="logout-farewell" role="dialog" aria-modal="true" aria-labelledby="logout-farewell-title" aria-describedby="logout-farewell-message" hidden>
 <div class="logout-farewell-card">
  <div class="logout-farewell-crown" aria-hidden="true">♛</div>
  <p class="logout-farewell-eyebrow">POLSKIE CENTRUM GRACZA · FULL MAX PREMIUM</p>
  <h2 id="logout-farewell-title">Dziękujemy, <span id="logout-farewell-nick"></span>!</h2>
  <p class="logout-farewell-message" id="logout-farewell-message">Miło nam, że wpadłeś do nas i dobrze się bawiłeś!</p>
  <p class="logout-farewell-invite">Zapraszamy ponownie.</p>
  <a class="logout-farewell-login" href="/konto/?widok=login" id="logout-farewell-login">Zaloguj się <span aria-hidden="true">→</span></a>
  <p class="logout-farewell-redirect">Za chwilę wrócisz na stronę główną gracz.pl.</p>
 </div>
</section>

</body></html>`);
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
.profile-password-form .form-actions #pw-change-status,.profile-password-form .form-actions #nick-change-status{max-width:470px;line-height:1.5;font-size:13px}
.profile-password-form .form-actions button{min-width:165px}
@media(max-width:650px){.profile-password-form .form-actions button{width:100%}}

/* Single success dialog shown only after a confirmed /auth/change-password response. */
body.pw-success-open{overflow:hidden}
.pw-success-overlay[hidden]{display:none!important}
.pw-success-overlay{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:20px;background:rgba(0,13,21,.83);backdrop-filter:blur(9px)}
.pw-success-modal{position:relative;width:min(100%,510px);border:1px solid #32e8d3;border-radius:24px;padding:34px clamp(22px,4vw,42px) 30px;text-align:center;color:#f2fcfa;background:radial-gradient(ellipse at 50% 0%,#136f74 0%,#063a45 47%,#031d2c 100%);box-shadow:0 0 0 1px #d2aa5359,0 23px 90px #000b,inset 0 0 32px #11dcd51b}
.pw-success-modal::before{content:"";position:absolute;top:0;left:17%;right:17%;height:2px;background:linear-gradient(90deg,transparent,#f3d483,transparent);pointer-events:none}
.pw-success-seal{width:96px;height:96px;display:grid;place-items:center;margin:0 auto 20px;border-radius:50%;border:2px solid #f7d181;background:#053e46;box-shadow:0 0 0 8px #0abfb520,0 0 37px #06e6bf65,inset 0 0 20px #00d6bf35}
.pw-success-seal span{font-size:57px;font-weight:800;line-height:1;color:#95fff0}
.pw-success-kicker{font-size:11px;font-weight:850;letter-spacing:.14em;color:#f5d88a;margin:0 0 13px}
.pw-success-modal h2{font-size:clamp(27px,4vw,36px);letter-spacing:-.02em;line-height:1.15;margin:0 0 16px;color:#fff}
.pw-success-modal p#pw-success-message{font-size:15px;line-height:1.65;color:#c6e7e7;margin:0 auto 21px;max-width:385px}
.pw-success-confirmed{display:inline-flex;gap:9px;align-items:center;justify-content:center;flex-wrap:wrap;color:#80ffde;font-weight:760;font-size:13px;margin:0 0 25px}
.pw-success-confirmed span{font-size:19px}
.pw-success-close{display:block;margin:0 auto;width:min(100%,250px);min-height:49px;border:1px solid #f9d991;border-radius:12px;color:#132b2d;background:linear-gradient(160deg,#ffe7aa,#eabd64);font-weight:850;cursor:pointer;box-shadow:0 6px 25px #e6c67534}
.pw-success-close:hover{filter:brightness(1.07)}
.pw-success-close:focus-visible{outline:3px solid #69fce9;outline-offset:4px}
@media(prefers-reduced-motion:reduce){.pw-success-overlay{scroll-behavior:auto;backdrop-filter:none}}


/* OWNER 2026-11-04: compact, proportional panel layout.
   Responsive element sizing, not zoom/transform, so text and focus stay crisp. */
@media(min-width:981px){
 .site-nav{min-height:43px;padding:6px clamp(18px,3vw,52px);gap:28px}
 .site-brand{font-size:24px}
 .site-nav nav{gap:clamp(14px,2vw,32px)}
 .site-nav nav a{font-size:clamp(12px,.92vw,15px)}
 .top{min-height:53px;padding:7px clamp(18px,3vw,50px);gap:16px}
 .top .logo{font-size:clamp(27px,2.3vw,33px)}
 .top-tag{font-size:10px;letter-spacing:1.1px}
 .top-tag b{margin-left:7px}
 .top-link{padding:8px 12px;font-size:12px}
 .shell{max-width:1620px;grid-template-columns:minmax(0,1fr) 265px;gap:17px;padding:15px clamp(15px,2vw,32px)}
 .sidebar{top:11px;border-radius:17px}
 .identity{padding:14px 16px 12px}
 .avatar{width:52px;height:52px;font-size:27px}
 .identity .small{margin:11px 0 5px;font-size:10px;letter-spacing:1.3px}
 .identity strong{font-size:16px}
 .identity .status{margin-top:8px;font-size:11px}
 .sidebar nav{padding:10px;gap:2px}
 .sidebar .nav{padding:7px 10px;min-height:36px;font-size:12px;gap:9px}
 .sidebar .nav span{font-size:16px;width:20px}
 .sidebar .create-room{margin:10px 13px 6px!important;width:calc(100% - 26px)!important;padding:10px 12px!important;font-size:13px!important}
 .signout{margin:5px 12px 12px;padding:10px;font-size:12px}
 .masthead{min-height:154px;padding:18px clamp(22px,2.5vw,34px);margin-bottom:12px;border-radius:18px}
 .masthead h1{font-size:clamp(32px,3.4vw,46px);margin:6px 0 9px}
 .masthead .eyebrow{font-size:10px;letter-spacing:1.3px}
 .masthead p:last-child{font-size:13px}
 .mark{width:95px;height:95px;border-width:6px}
 .mark span{font-size:40px}
 .mark small{font-size:8px}
 .view.active{gap:12px}
 .card{padding:clamp(14px,1.5vw,23px);border-radius:16px}
 .card h2{font-size:clamp(20px,2vw,26px);margin:4px 0 10px}
 .card p{line-height:1.5}
 .stats{gap:10px}
 .stat{padding:14px}
 .stat strong{font-size:clamp(24px,2.5vw,33px);margin:5px 0}
 .hero-card{gap:16px;min-height:128px}
 .hero-card .player-avatar{width:67px;height:67px;font-size:36px}
 .hero-card h2{font-size:26px}
 .form-grid{gap:13px}
 .form-grid input,.form-grid select,.form-grid textarea{min-height:41px;padding:9px 11px}
 .primary,.secondary{padding:10px 14px;font-size:12px}
 .detail{padding:12px 0}
 .premium-profile{gap:13px}
 .premium-profile .profile-hero-premium{padding:18px clamp(18px,2vw,27px);border-radius:17px}
 .profile-topline{margin-bottom:14px;gap:8px}
 .profile-topline>span:first-child{font-size:10px;letter-spacing:1.1px}
 .profile-verified{padding:6px 10px;font-size:11px}
 .profile-hero-body,.profile-intro{gap:15px}
 .profile-avatar-frame{width:83px;height:83px;border-radius:19px}
 .profile-avatar-large{font-size:48px}
 .profile-avatar-check{height:25px;width:25px;bottom:-5px;right:-5px}
 .profile-intro h2{font-size:clamp(29px,3vw,37px)}
 .profile-intro #profile-handle{margin:3px 0 8px;font-size:12px}
 .profile-chips{gap:5px}
 .profile-chips span{padding:4px 8px;font-size:10px}
 .profile-hero-actions{gap:8px}
 .profile-hero-actions button{padding:9px 12px}
 .profile-metrics{gap:10px;margin-top:16px}
 .profile-metric{padding:11px 13px;border-radius:12px}
 .profile-metric small{font-size:9px}
 .profile-metric strong{font-size:clamp(23px,2.2vw,30px);margin:6px 0 2px}
 .profile-metric span{font-size:10px}
 .profile-metric progress{height:6px;margin:4px 0}
 .profile-layout,.profile-main-column,.profile-side-column{gap:13px}
 .profile-edit-hint{margin-top:12px;padding:10px}
 .premium-profile .form-grid{gap:12px}
 .profile-shortcut-grid{gap:8px}
 .profile-shortcut-grid button{padding:10px}
 .profile-preview-inner{padding:16px;margin-top:10px}
 .profile-preview-avatar{width:65px;height:65px;font-size:39px}
 .profile-preview-inner p{min-height:0;margin:10px 0}
 .premium-profile-tabs{padding:7px;gap:6px;margin:12px 0}
 .premium-profile-tabs button{min-height:42px;padding:6px;font-size:12px}
 .premium-profile-workspace{padding:clamp(13px,1.5vw,20px)!important}
}
@media(min-width:981px) and (max-height:780px){
 .top{min-height:47px}
 .site-nav{min-height:39px}
 .shell{padding-top:10px;gap:13px}
 .masthead{min-height:138px;padding-top:13px;padding-bottom:13px;margin-bottom:10px}
 .mark{width:82px;height:82px}
 .mark span{font-size:34px}
 .profile-topline{margin-bottom:10px}
 .profile-metrics{margin-top:12px}
 .profile-metric{padding:9px 11px}
}
@media(min-width:701px) and (max-width:980px){
 .site-nav{min-height:43px;padding:8px 16px;gap:12px}
 .site-brand{font-size:23px}
 .site-nav nav{gap:10px}
 .top{min-height:53px;padding:8px 16px}
 .top .logo{font-size:28px}
 .top-link{padding:9px 11px;font-size:12px}
 .shell{padding:14px;gap:12px}
 .masthead{min-height:151px;padding:18px;margin-bottom:12px}
 .masthead h1{font-size:clamp(30px,4.1vw,40px)}
 .view.active{gap:12px}
 .card{padding:16px}
 .premium-profile .profile-hero-premium{padding:18px}
 .profile-topline{margin-bottom:15px}
 .profile-avatar-frame{width:84px;height:84px}
 .profile-avatar-large{font-size:48px}
 .profile-metrics{margin-top:16px;gap:10px}
 .profile-metric{padding:11px}
 .profile-metric strong{font-size:24px}
 .profile-hero-actions button{padding:10px 12px}
}
@media(max-width:700px){
 .top{min-height:55px;padding:9px 13px;gap:8px}
 .top .logo{font-size:27px}
 .top-link{padding:8px 10px;font-size:11px}
 .site-nav{padding:10px 13px}
 .site-nav nav{margin-top:8px;gap:9px 13px}
 .shell{padding:10px;gap:12px}
 .masthead{min-height:135px;padding:15px;margin-bottom:10px}
 .masthead h1{font-size:clamp(27px,7vw,37px);margin:6px 0}
 .mark{width:68px;height:68px;border-width:4px}
 .mark span{font-size:28px}
 .view.active{gap:11px}
 .card{padding:15px;border-radius:15px}
 .premium-profile .profile-hero-premium{padding:15px}
 .profile-avatar-frame{width:74px;height:74px}
 .profile-avatar-large{font-size:43px}
 .profile-intro{gap:12px}
 .profile-intro h2{font-size:29px}
 .profile-topline{margin-bottom:12px}
 .profile-metrics{margin-top:14px;gap:8px}
 .profile-metric{padding:10px}
 .profile-metric strong{font-size:23px;margin:6px 0 2px}
 .profile-hero-actions button{padding:10px}
 .premium-profile-tabs{margin:12px 0}
}

/* One top navigation bar: premium game discovery CTA, no secondary logo strip. */
.site-nav{gap:clamp(12px,2vw,27px)}
.site-nav nav{flex:1;min-width:0}
.site-nav .site-discover{display:inline-flex;align-items:center;justify-content:center;gap:7px;margin-left:auto;flex-shrink:0;white-space:nowrap;text-decoration:none;font-weight:850;font-size:clamp(12px,1vw,14px);letter-spacing:.015em;color:#ffe2a2;border:1px solid #f5c868;border-radius:12px;padding:10px 15px;background:linear-gradient(145deg,#144449,#072b3b 78%);box-shadow:inset 0 1px 0 #ffffff22,0 0 20px #14d9c21d;transition:background-color .15s ease,box-shadow .15s ease}
.site-nav .site-discover:hover{background:linear-gradient(145deg,#146d70,#0a3c46);border-color:#ffe4a0;box-shadow:0 0 20px #26e8d75c}
.site-nav .site-discover:focus-visible{outline:3px solid #5fffee;outline-offset:3px}
@media(min-width:701px) and (max-width:980px){.site-nav .site-discover{font-size:12px;padding:9px 11px}.site-nav nav{gap:9px}}
@media(max-width:700px){
 .site-nav{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:10px;row-gap:9px}
 .site-nav .site-brand{grid-column:1;grid-row:1;align-self:center}
 .site-nav .site-discover{grid-column:2;grid-row:1;margin-left:0;font-size:12px;padding:9px 12px}
 .site-nav nav{grid-column:1/-1;grid-row:2;margin-top:0;gap:9px 14px;min-width:0}
}
@media(prefers-reduced-motion:reduce){.site-nav .site-discover{transition:none}}
`+premiumProfileStyles+String.raw`
/* Friends Hub Full Max Premium: responsive, accessible and compact across tabs. */
#player-shell [data-fh-pane][hidden]{display:none!important}
#player-shell .friendshub-hero{display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid #16b6aa;border-radius:18px;padding:17px 21px;background:radial-gradient(ellipse at 84% 10%,#12d7bb57,transparent 55%),linear-gradient(125deg,#063d49,#031d2d)}
#player-shell .friendshub-hero h2{font-size:clamp(23px,2.2vw,30px);margin:5px 0}
#player-shell .friendshub-hero p{font-size:12px;line-height:1.4;color:#b3d7d7;max-width:620px;margin:5px 0}
#player-shell .friendshub-hero-badge{display:grid;place-items:center;gap:5px;min-width:135px;min-height:76px;border-radius:15px;border:1px solid #deb76d;background:#042e39;color:#ffdf91;box-shadow:0 0 22px #09e4cb30}
#player-shell .friendshub-hero-badge strong{font-size:15px}#player-shell .friendshub-hero-badge span{font-size:9px;letter-spacing:.13em}
#player-shell .friendshub-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:8px;border:1px solid #267d83;background:#052c39;border-radius:15px;position:sticky;top:0;z-index:4}
#player-shell .friendshub-tabs button{min-width:0;min-height:41px;padding:8px 5px;border-radius:10px;background:#073744;border:1px solid #286f78;color:#cbe5e5;font:800 12px Inter,"Segoe UI",sans-serif;cursor:pointer}
#player-shell .friendshub-tabs button.active{background:linear-gradient(120deg,#076c70,#084854);border-color:#41ebd8;color:#fff;box-shadow:0 0 17px #0fe2cf42}
#player-shell .friendshub-tabs button:focus-visible{outline:3px solid #ffe2a3;outline-offset:2px}
#player-shell .friendshub-tabs button span{color:#ffe0a0}
#player-shell .friendshub-pane{display:grid;gap:12px}
#player-shell .friendshub-book-top .card-heading{align-items:flex-start;gap:12px;flex-wrap:wrap}
#player-shell .friendshub-actions{display:flex;flex-wrap:wrap;align-items:center;gap:7px}
#player-shell .friendshub-actions button{min-height:39px;padding:8px 12px;font-size:11px}
#player-shell .friendshub-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:11px 0}
#player-shell .friendshub-stat-grid>div{border:1px solid #229a9c;border-radius:12px;padding:11px;background:linear-gradient(130deg,#063f4c,#052330)}
#player-shell .friendshub-stat-grid small{display:block;font-size:9px;letter-spacing:.07em;font-weight:800;color:#eec986}
#player-shell .friendshub-stat-grid strong{display:block;font-size:25px;margin-top:5px}
#player-shell .friendshub-book-filters{display:grid;grid-template-columns:minmax(0,2fr) minmax(140px,1fr) auto auto;gap:9px;align-items:end}
#player-shell .friendshub-book-filters label,#player-shell .friendshub-form label{display:grid;gap:6px;font-size:12px;color:#dbeaec;font-weight:740}
#player-shell .friendshub-book-filters input[type=search],#player-shell .friendshub-book-filters select,
#player-shell .friendshub-form :is(input:not([type=checkbox]),textarea){width:100%;min-height:39px;border:1px solid #358b92;border-radius:10px;background:#062934;color:#f0fafb;padding:8px 10px;font-size:12px;min-width:0}
#player-shell .friendshub-form textarea{resize:vertical;min-height:85px}
#player-shell .friendshub-book-filters .friendshub-only-favs{display:flex;align-items:center;min-height:39px;white-space:nowrap;gap:7px}
#player-shell .friendshub-only-favs input,#player-shell .friendshub-check input{accent-color:#31e6d3;width:16px;height:16px}
#player-shell .friendshub-group-chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
#player-shell .friendshub-group-chips button{padding:6px 9px;font-size:11px;border:1px solid #3f888d;border-radius:20px;color:#cef8f5;background:#073746;cursor:pointer}
#player-shell .friendshub-group-chips button[aria-pressed=true]{background:#087c75;color:#fff;border-color:#29ddbe}
#player-shell .friendshub-book-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(280px,1fr);gap:12px;align-items:start}
#player-shell .friendshub-contact-list{display:grid;gap:9px}
#player-shell .friendshub-contact{padding:11px 12px;border:1px solid #327c85;background:linear-gradient(125deg,#0a4650,#052734);border-radius:12px;display:grid;gap:7px}
#player-shell .friendshub-contact-head{display:flex;align-items:center;gap:9px;justify-content:space-between;min-width:0}
#player-shell .friendshub-contact-name{font-weight:850;font-size:15px;overflow-wrap:anywhere}
#player-shell .friendshub-contact-badge{display:inline-flex;flex-wrap:wrap;gap:6px}
#player-shell .friendshub-contact-badge span{color:#f5d38a;font-size:10px;border:1px solid #4d8286;border-radius:18px;padding:3px 7px}
#player-shell .friendshub-contact-sub{font-size:11px;color:#aed3d4;overflow-wrap:anywhere}
#player-shell .friendshub-contact-controls{display:flex;gap:6px;flex-wrap:wrap}
#player-shell .friendshub-contact-controls button{border:1px solid #3e8c92;border-radius:8px;padding:6px 9px;min-height:32px;color:#def5f4;background:#0a4450;font:750 11px Inter,"Segoe UI",sans-serif;cursor:pointer}
#player-shell .friendshub-contact-controls button:hover{background:#0b6b6d}
#player-shell .friendshub-contact-controls button:disabled{opacity:.55;cursor:default}
#player-shell .friendshub-form{display:grid;gap:7px}
#player-shell .friendshub-form label{margin-top:5px}
#player-shell .friendshub-form .friendshub-check{display:flex;align-items:center;margin:7px 0;color:#ffdb94}
#player-shell .friendshub-form .friendshub-split{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#player-shell .friendshub-hint{color:#9ebec6;font-size:11px;line-height:1.5}
#player-shell .friendshub-pagination{display:flex;align-items:center;gap:10px;justify-content:center;margin:12px 0 0}
#player-shell .friendshub-pagination span{font-size:11px;color:#b6ced1}
#player-shell .friendshub-roadmap{display:grid;grid-template-columns:repeat(2,1fr);gap:11px;margin:15px 0}
#player-shell .friendshub-roadmap div{padding:14px;border:1px solid #377a80;border-radius:13px;background:#07323f;display:grid;gap:6px}
#player-shell .friendshub-roadmap strong{color:#f6d08c;font-size:12px}
#player-shell .friendshub-roadmap span{font-size:12px}
#player-shell .friendshub-forum h2{color:#f4fcff}
@media(max-width:1180px){#player-shell .friendshub-book-grid{grid-template-columns:1fr}#player-shell .friendshub-book-filters{grid-template-columns:repeat(2,minmax(0,1fr))}#player-shell .friendshub-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:700px){#player-shell .friendshub-hero{padding:13px}#player-shell .friendshub-hero-badge{display:none}#player-shell .friendshub-tabs{position:static;grid-template-columns:repeat(2,minmax(0,1fr));padding:6px;gap:6px}#player-shell .friendshub-tabs button{min-height:41px}#player-shell .friendshub-stat-grid{gap:6px}#player-shell .friendshub-stat-grid>div{padding:9px}#player-shell .friendshub-book-filters{grid-template-columns:1fr}#player-shell .friendshub-book-grid{grid-template-columns:1fr}#player-shell .friendshub-form .friendshub-split,#player-shell .friendshub-roadmap{grid-template-columns:1fr}#player-shell .friendshub-contact-controls button{min-height:40px}}
`+String.raw`
/* Compact v2: consistent density on EVERY player section.
   Applied after premiumProfileStyles so profile tabs/cards follow the same scale.
   Geometry-only; no zoom/transform or modification of game/account logic. */
@media(min-width:1051px){
 .site-nav{min-height:42px;padding:5px clamp(18px,2.7vw,45px);gap:clamp(13px,1.7vw,24px)}
 .site-brand{font-size:23px}
 .site-nav nav{gap:clamp(12px,1.5vw,26px)}
 .site-nav nav a{font-size:12px}
 .site-nav .site-discover{padding:7px 12px;border-radius:10px;font-size:12px}
 body:not(.panel-large) #player-shell.shell{max-width:1480px;grid-template-columns:minmax(0,1fr) 235px;gap:14px;padding:10px clamp(12px,1.6vw,24px)}
 body:not(.panel-large) #player-shell .sidebar{top:9px;border-radius:15px}
 body:not(.panel-large) #player-shell .identity{padding:11px 13px 9px}
 body:not(.panel-large) #player-shell .avatar{width:44px;height:44px;font-size:24px}
 body:not(.panel-large) #player-shell .identity .small{font-size:9px;margin:9px 0 4px}
 body:not(.panel-large) #player-shell .identity strong{font-size:14px}
 body:not(.panel-large) #player-shell .identity .status{font-size:10px;margin-top:5px}
 body:not(.panel-large) #player-shell .sidebar nav{padding:7px;gap:1px}
 body:not(.panel-large) #player-shell .sidebar .nav{min-height:31px;padding:5px 9px;font-size:11px;gap:7px;border-radius:9px}
 body:not(.panel-large) #player-shell .sidebar .nav span{width:18px;font-size:15px}
 body:not(.panel-large) #player-shell .create-room{width:calc(100% - 20px)!important;margin:8px 10px 5px!important;padding:8px 10px!important;font-size:12px!important}
 body:not(.panel-large) #player-shell .signout{padding:8px;margin:4px 9px 9px;font-size:11px;width:calc(100% - 18px)}
 body:not(.panel-large) #player-shell .masthead{min-height:112px;padding:13px 20px;margin-bottom:9px;border-radius:15px;gap:10px}
 body:not(.panel-large) #player-shell .masthead h1{font-size:clamp(27px,2.4vw,35px);margin:4px 0 6px}
 body:not(.panel-large) #player-shell .masthead .eyebrow{font-size:9px;letter-spacing:1px}
 body:not(.panel-large) #player-shell .masthead p:last-child{font-size:12px}
 body:not(.panel-large) #player-shell .mark{width:67px;height:67px;border-width:4px}
 body:not(.panel-large) #player-shell .mark span{font-size:29px}
 body:not(.panel-large) #player-shell .mark small{font-size:7px}
}
@media(min-width:701px) and (max-width:1050px){
 .site-nav{min-height:44px;padding:7px 13px;gap:10px}
 .site-brand{font-size:22px}
 .site-nav nav{gap:9px}
 .site-nav nav a{font-size:11px}
 .site-nav .site-discover{padding:8px 10px;font-size:11px}
 body:not(.panel-large) #player-shell.shell{padding:11px;gap:11px}
 body:not(.panel-large) #player-shell .masthead{min-height:117px;padding:14px;margin-bottom:10px}
 body:not(.panel-large) #player-shell .masthead h1{font-size:clamp(27px,3.5vw,34px)}
 body:not(.panel-large) #player-shell .mark{height:68px;width:68px;border-width:4px}
 body:not(.panel-large) #player-shell .mark span{font-size:29px}
 body:not(.panel-large) #player-shell .sidebar .nav{padding:7px 9px;font-size:11px}
}
@media(min-width:701px){
 body:not(.panel-large) #player-shell .view.active{gap:9px}
 body:not(.panel-large) #player-shell .card{padding:clamp(11px,1.2vw,17px);border-radius:13px}
 body:not(.panel-large) #player-shell .card h2{font-size:clamp(17px,1.6vw,23px);margin:3px 0 8px}
 body:not(.panel-large) #player-shell .card h3{font-size:clamp(15px,1.25vw,18px);margin:5px 0}
 body:not(.panel-large) #player-shell .card p{font-size:12px;line-height:1.38}
 body:not(.panel-large) #player-shell .card-heading{gap:9px;margin-bottom:5px}
 body:not(.panel-large) #player-shell :is(.card-kicker,.eyebrow){font-size:9px;letter-spacing:1.1px}
 body:not(.panel-large) #player-shell .stats{gap:8px}
 body:not(.panel-large) #player-shell .stat{padding:10px}
 body:not(.panel-large) #player-shell .stat strong{font-size:clamp(21px,2vw,29px);margin:4px 0}
 body:not(.panel-large) #player-shell .stat span{font-size:11px}
 body:not(.panel-large) #player-shell .hero-card{gap:12px;min-height:102px}
 body:not(.panel-large) #player-shell .hero-card .player-avatar{width:57px;height:57px;font-size:31px}
 body:not(.panel-large) #player-shell .hero-card h2{font-size:22px}
 body:not(.panel-large) #player-shell .verified{padding:6px 9px;font-size:10px}
 body:not(.panel-large) #player-shell :is(.primary,.secondary){padding:8px 12px;font-size:12px;border-radius:9px}
 body:not(.panel-large) #player-shell .notice{padding:8px 12px;margin-bottom:9px}
 body:not(.panel-large) #player-shell .detail{padding:9px 0;font-size:12px}
 body:not(.panel-large) #player-shell .form-grid{gap:10px}
 body:not(.panel-large) #player-shell .form-grid label{gap:5px;font-size:12px}
 body:not(.panel-large) #player-shell .form-grid :is(input,select,textarea){min-height:36px;padding:8px 10px;font-size:12px}
 body:not(.panel-large) #player-shell .form-grid textarea{min-height:80px}
 body:not(.panel-large) #player-shell .form-actions{gap:9px;padding-top:12px}
 body:not(.panel-large) #player-shell .setting{gap:9px;padding:10px 0}
 body:not(.panel-large) #player-shell .setting strong{font-size:12px}
 body:not(.panel-large) #player-shell .setting small{font-size:11px}
 body:not(.panel-large) #player-shell .setting select{padding:7px}
 body:not(.panel-large) #player-shell .session-list{margin:9px 0}
 body:not(.panel-large) #player-shell .session-item{padding:9px 0}
 body:not(.panel-large) #player-shell .game-grid{gap:9px;margin-top:10px}
 body:not(.panel-large) #player-shell .game-tile{padding:12px;border-radius:12px}
 body:not(.panel-large) #player-shell .game-tile h3{font-size:16px}
 body:not(.panel-large) #player-shell .game-emoji{font-size:24px}
 body:not(.panel-large) #player-shell .game-actions{gap:6px}
 body:not(.panel-large) #player-shell .game-actions :is(a,button){padding:7px 9px;font-size:11px}
 body:not(.panel-large) #player-shell .friends-items{gap:7px;margin:8px 0}
 body:not(.panel-large) #player-shell .friend-person{padding:9px;gap:8px}
 body:not(.panel-large) #player-shell .friend-name{font-size:12px}
 body:not(.panel-large) #player-shell .friend-controls button{padding:7px 9px;font-size:11px}
 body:not(.panel-large) #player-shell .social-controls{gap:8px;margin-bottom:10px}
 body:not(.panel-large) #player-shell .social-controls select{padding:8px;font-size:12px}
 body:not(.panel-large) #player-shell .social-thread{min-height:170px;max-height:310px;padding:10px;gap:7px}
 body:not(.panel-large) #player-shell .social-bubble{padding:8px 11px}
 body:not(.panel-large) #player-shell .match-top{margin:9px 0}
 body:not(.panel-large) #player-shell .match-board{max-width:min(520px,100%);margin:8px auto;border-width:4px}
 body:not(.panel-large) #player-shell .premium-profile{gap:10px}
 body:not(.panel-large) #player-shell .premium-profile .profile-hero-premium{padding:12px 16px;border-radius:15px}
 body:not(.panel-large) #player-shell .profile-topline{margin-bottom:10px;gap:5px}
 body:not(.panel-large) #player-shell .profile-topline>span:first-child{font-size:9px;letter-spacing:1px}
 body:not(.panel-large) #player-shell .profile-verified{padding:5px 8px;font-size:10px}
 body:not(.panel-large) #player-shell .profile-hero-body{gap:9px}
 body:not(.panel-large) #player-shell .profile-intro{gap:10px}
 body:not(.panel-large) #player-shell .profile-avatar-frame{width:62px;height:62px;border-radius:14px}
 body:not(.panel-large) #player-shell .profile-avatar-large{font-size:36px}
 body:not(.panel-large) #player-shell .profile-avatar-check{width:19px;height:19px;bottom:-3px;right:-3px;font-size:11px}
 body:not(.panel-large) #player-shell .profile-intro h2{font-size:clamp(23px,2.4vw,30px);margin:2px 0}
 body:not(.panel-large) #player-shell .profile-intro #profile-handle{margin:2px 0 5px;font-size:11px}
 body:not(.panel-large) #player-shell .profile-chips{gap:4px}
 body:not(.panel-large) #player-shell .profile-chips span{padding:3px 6px;font-size:9px}
 body:not(.panel-large) #player-shell .profile-hero-actions{gap:6px}
 body:not(.panel-large) #player-shell .profile-hero-actions button{padding:7px 9px;font-size:11px}
 body:not(.panel-large) #player-shell .profile-metrics{margin-top:10px;gap:7px}
 body:not(.panel-large) #player-shell .profile-metric{padding:8px 9px;border-radius:10px}
 body:not(.panel-large) #player-shell .profile-metric small{font-size:9px}
 body:not(.panel-large) #player-shell .profile-metric strong{font-size:clamp(18px,1.9vw,26px);margin:4px 0 1px}
 body:not(.panel-large) #player-shell .profile-metric span{font-size:10px}
 body:not(.panel-large) #player-shell .profile-metric progress{height:5px;margin:4px 0}
 body:not(.panel-large) #player-shell .profile-layout{gap:10px}
 body:not(.panel-large) #player-shell :is(.profile-main-column,.profile-side-column){gap:10px}
 body:not(.panel-large) #player-shell .profile-shortcut-grid{gap:7px}
 body:not(.panel-large) #player-shell .profile-shortcut-grid button{padding:8px}
 body:not(.panel-large) #player-shell .profile-shortcut-grid button span{width:30px;height:30px;font-size:17px}
 body:not(.panel-large) #player-shell .profile-preview-inner{padding:12px;margin-top:8px}
 body:not(.panel-large) #player-shell .profile-preview-avatar{width:57px;height:57px;font-size:32px}
 body:not(.panel-large) #player-shell .profile-preview-inner p{min-height:0;margin:8px 0}
 body:not(.panel-large) #player-shell .profile-game-links{gap:7px}
 body:not(.panel-large) #player-shell .profile-game-links a{padding:9px 7px}
 body:not(.panel-large) #player-shell .profile-edit-hint{padding:8px;margin-top:10px}
 body:not(.panel-large) #player-shell .profile-pill{padding:5px 8px;font-size:9px}
 body:not(.panel-large) #player-shell .premium-profile-tabs{padding:5px;gap:6px;margin:9px 0;border-radius:13px;top:0}
 body:not(.panel-large) #player-shell .premium-profile-tabs button{min-height:34px;padding:5px;font-size:11px;border-radius:9px}
 body:not(.panel-large) #player-shell .premium-profile-tab-panel .premium-profile-workspace{padding:12px!important;margin:9px 0}
 body:not(.panel-large) #player-shell .premium-profile-two{gap:12px}
 body:not(.panel-large) #player-shell .premium-profile-showcase{min-height:225px;padding:17px}
 body:not(.panel-large) #player-shell .premium-showcase-avatar{width:74px;height:74px;font-size:39px}
 body:not(.panel-large) #player-shell .premium-stats-grid{gap:7px;margin:12px 0}
 body:not(.panel-large) #player-shell .premium-stats-grid>div{padding:10px 7px}
 body:not(.panel-large) #player-shell .premium-stats-grid strong{font-size:26px}
 body:not(.panel-large) #player-shell .premium-awards-grid{gap:8px}
 body:not(.panel-large) #player-shell .premium-award{padding:11px}
 body:not(.panel-large) #player-shell .premium-profile-form{gap:7px}
 body:not(.panel-large) #player-shell .premium-profile-form select,
 body:not(.panel-large) #player-shell .premium-profile-form input:not([type="checkbox"]){min-height:37px;padding:7px 10px;font-size:12px}
 body:not(.panel-large) #player-shell .profile-password-form{gap:6px;margin-top:10px}
 body:not(.panel-large) #player-shell .profile-password-field input{min-height:40px;padding:9px 11px!important}
 body:not(.panel-large) #player-shell .profile-password-field button{min-width:68px;padding:0 12px}
 body:not(.panel-large) #player-shell .footer{padding:12px}
}
@media(max-width:700px){
 /* Smaller cards and banners without shrinking mobile touch targets below 40px. */
 #player-shell.shell{padding:9px;gap:10px}
 #player-shell .masthead{min-height:107px;padding:12px;margin-bottom:8px}
 #player-shell .masthead h1{font-size:clamp(24px,6.2vw,32px)}
 #player-shell .mark{width:54px;height:54px}
 #player-shell .mark span{font-size:23px}
 #player-shell .view.active{gap:9px}
 #player-shell .card{padding:12px}
 #player-shell .card h2{font-size:20px;margin:5px 0 9px}
 #player-shell .premium-profile .profile-hero-premium{padding:11px}
 #player-shell .profile-avatar-frame{height:59px;width:59px}
 #player-shell .profile-avatar-large{font-size:35px}
 #player-shell .profile-metrics{margin-top:9px}
 #player-shell .profile-metric{padding:9px}
 #player-shell .profile-metric strong{font-size:22px}
 #player-shell .premium-profile-tabs{padding:6px;gap:6px;margin:8px 0}
 #player-shell .premium-profile-tabs button{min-height:40px;font-size:12px}
 #player-shell .premium-profile-workspace{padding:12px!important}
 #player-shell .profile-preview-inner{padding:12px}
 #player-shell .friend-person,#player-shell .game-tile{padding:11px}
 #player-shell .setting,#player-shell .session-item{padding:10px 0}
 #player-shell .social-thread{min-height:160px;padding:10px}
 #player-shell .match-board{max-width:100%}
}
@media(prefers-reduced-motion:reduce){
 #player-shell .card,#player-shell .nav{transition:none}
}

/* GRACZ.PL security center — compact, accessible Full Max Premium */
#player-shell .sec-hero{display:flex;justify-content:space-between;align-items:center;gap:17px;padding:17px 22px;border:1px solid #2ee7d3;border-radius:17px;background:radial-gradient(ellipse at 85% 5%,#12b8b568,transparent 54%),linear-gradient(115deg,#063544,#03202f);min-height:114px;box-shadow:0 12px 30px #00121d33}
#player-shell .sec-hero h2{font-size:clamp(25px,2.3vw,36px);line-height:1.16;margin:4px 0 7px;color:#fff}
#player-shell .sec-hero p:last-child{font-size:12px;line-height:1.45;margin:0;color:#b7d7dc}
#player-shell .sec-shield{display:grid;place-items:center;width:78px;height:78px;flex:0 0 auto;border:2px solid #f0ce7a;border-radius:24px;color:#ffe49d;background:#06303c;font-size:35px;box-shadow:0 0 26px #0cf7d54d}
#player-shell .sec-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
#player-shell .sec-metrics>div{min-width:0;border:1px solid #267f84;border-radius:13px;padding:12px 13px;background:linear-gradient(140deg,#07434c,#041f2b)}
#player-shell .sec-metrics small{display:block;font-size:9px;font-weight:800;letter-spacing:.09em;color:#f1ce87}
#player-shell .sec-metrics strong{display:block;font-size:clamp(15px,1.6vw,22px);margin:6px 0;overflow-wrap:anywhere;color:#f8ffff}
#player-shell .sec-metrics span{font-size:10px;color:#a2c9cc}
#player-shell .sec-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;padding:7px;border-radius:14px;border:1px solid #276f78;background:#062a37;position:sticky;top:0;z-index:5}
#player-shell .sec-tabs button{font:750 11px Inter,"Segoe UI",sans-serif;cursor:pointer;min-height:39px;min-width:0;border-radius:9px;border:1px solid #285d68;padding:7px 5px;background:#073644;color:#def2ef}
#player-shell .sec-tabs button.active{background:linear-gradient(130deg,#087d77,#0a424c);color:#fff;border-color:#29ecd6;box-shadow:0 0 12px #0ce5d43b}
#player-shell .sec-tabs button:focus-visible{outline:2px solid #ffe3a4;outline-offset:2px}
#player-shell .sec-pane{display:grid;gap:11px}
#player-shell .sec-pane[hidden]{display:none!important}
#player-shell .sec-status{margin:0;border:1px solid #26656d;border-radius:11px;padding:9px 12px;background:#05343f;color:#a9e4de;font-size:11px}
#player-shell .sec-status.sec-error{color:#ffbbbc;border-color:#bd5f6b}
#player-shell .sec-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
#player-shell .sec-feature{padding:15px}
#player-shell .sec-feature-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:13px}
#player-shell .sec-feature-actions button{min-height:37px;padding:8px 12px;font-size:11px}
#player-shell .sec-inline-note{font-size:11px;line-height:1.6;color:#99bdc5}
#player-shell .sec-checklist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}
#player-shell .sec-checklist>div{border:1px solid #2d7380;border-radius:11px;padding:11px 12px;background:#052a38;display:grid;gap:5px}
#player-shell .sec-checklist strong{font-size:12px;color:#f3d28c}
#player-shell .sec-checklist span{font-size:11px;color:#b9d4d7;line-height:1.55}
#player-shell .sec-device-list,#player-shell .sec-event-list{display:grid;gap:9px;margin-top:13px}
#player-shell .sec-device-item,#player-shell .sec-event-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #2d7b83;border-radius:11px;background:linear-gradient(120deg,#083d47,#042636)}
#player-shell .sec-device-item strong,#player-shell .sec-event-item strong{display:block;color:#f2fcfc;font-size:12px;margin-bottom:3px}
#player-shell .sec-device-item small,#player-shell .sec-event-item small{display:block;font-size:10px;line-height:1.45;color:#a4c9cd}
#player-shell .sec-event-item.sec-event-highlight{border-color:#deb569;box-shadow:inset 3px 0 0 #f4d486}
#player-shell .sec-device-item button{min-height:34px;padding:6px 10px;white-space:nowrap;font-size:11px}
#player-shell .sec-device-current{border:1px solid #21ceba;border-radius:20px;padding:5px 9px;color:#92ffe7;font-size:10px;font-weight:800}
#player-shell .sec-history-filter{display:flex;align-items:center;gap:10px;font-size:11px;margin:12px 0;color:#d0e6e6}
#player-shell .sec-history-filter select{min-height:37px;border:1px solid #2b7982;border-radius:9px;background:#052a37;color:#edfafa;padding:7px}
#player-shell .sec-alert-form{display:grid;gap:10px;margin-top:13px}
#player-shell .sec-alert-form>label{display:flex;justify-content:space-between;align-items:center;gap:15px;padding:12px;border:1px solid #2c7181;border-radius:11px;background:#062c38}
#player-shell .sec-alert-form>label span{display:grid;gap:5px}
#player-shell .sec-alert-form strong{font-size:13px;color:#f6fdfd}
#player-shell .sec-alert-form small{font-size:11px;color:#a6cfd0}
#player-shell .sec-alert-form input[type=checkbox]{width:20px;height:20px;accent-color:#10d8bf;cursor:pointer}
@media(max-width:1130px){#player-shell .sec-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}#player-shell .sec-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){#player-shell .sec-hero{padding:12px}#player-shell .sec-shield{width:56px;height:56px;font-size:26px;border-radius:16px}#player-shell .sec-tabs{position:static;grid-template-columns:repeat(2,minmax(0,1fr));padding:5px}#player-shell .sec-tabs button{min-height:41px}#player-shell .sec-two,#player-shell .sec-checklist{grid-template-columns:1fr}#player-shell .sec-device-item,#player-shell .sec-event-item{align-items:flex-start;flex-direction:column}#player-shell .sec-device-item button{min-height:40px}#player-shell .sec-metrics>div{padding:10px}#player-shell .sec-history-filter{flex-wrap:wrap}}

/* Privacy Center Full Max Premium — adaptive, compact, no global zoom */
#player-shell .priv-controlled-count{border:1px solid #327d83;background:linear-gradient(115deg,#073844,#062632);
  border-radius:10px;padding:7px 12px;font-size:11px;letter-spacing:.015em;color:#b3d4d8}
#player-shell .priv-controlled-count strong{font-size:17px;color:#ffda8f;margin-right:5px}
#player-shell .priv-pane .priv-option:has(input:disabled){border-color:#2e5960;background:#052a34}
#player-shell .priv-pane .priv-option:has(input:disabled) small{color:#8facb0}

#player-shell .priv-hero{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:122px;padding:17px 23px;border:1px solid #1dd8c7;border-radius:17px;background:radial-gradient(ellipse at 85% 5%,#15b6b272,transparent 55%),linear-gradient(120deg,#073947,#032330);box-shadow:0 12px 32px #0016203e}
#player-shell .priv-hero h2{font-size:clamp(26px,2.5vw,37px);line-height:1.15;letter-spacing:-.02em;margin:5px 0 7px;color:#fff}
#player-shell .priv-hero p:last-child{font-size:12px;color:#b7d4da;line-height:1.5;margin:0;max-width:670px}
#player-shell .priv-emblem{height:79px;width:79px;flex:0 0 auto;display:grid;place-content:center;gap:3px;border:2px solid #f1cc79;border-radius:24px;background:#052d39;box-shadow:0 0 25px #16f1d84c;text-align:center;color:#ffe09a}
#player-shell .priv-emblem span{font-size:29px;line-height:1}
#player-shell .priv-emblem small{font-size:8px;font-weight:900;letter-spacing:.11em}
#player-shell .priv-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
#player-shell .priv-metrics>div{min-width:0;padding:12px 13px;border-radius:12px;border:1px solid #277b83;background:linear-gradient(135deg,#08414d,#042330)}
#player-shell .priv-metrics small{display:block;font-size:9px;letter-spacing:.08em;font-weight:900;color:#efd18d}
#player-shell .priv-metrics strong{display:block;font-size:clamp(15px,1.6vw,21px);margin:6px 0;color:#fff;overflow-wrap:anywhere}
#player-shell .priv-metrics span{font-size:10px;color:#a9cdd1}
#player-shell .priv-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;border:1px solid #246c74;padding:7px;border-radius:15px;background:#052b39;position:sticky;top:0;z-index:5}
#player-shell .priv-tabs button{min-width:0;min-height:40px;padding:7px 4px;background:#073642;border:1px solid #2b6570;border-radius:9px;color:#daeeed;font:780 11px Inter,"Segoe UI",sans-serif;cursor:pointer}
#player-shell .priv-tabs button.active{border-color:#2fe7d0;background:linear-gradient(130deg,#087b75,#0a4b56);color:#fff;box-shadow:0 0 14px #10d6c54c}
#player-shell .priv-tabs button:focus-visible,#player-shell .priv-actions button:focus-visible{outline:2px solid #ffe0a2;outline-offset:2px}
#player-shell .priv-pane{display:grid;gap:10px}
#player-shell .priv-pane[hidden]{display:none!important}
#player-shell .priv-pane .card{padding:clamp(13px,1.3vw,19px)}
#player-shell .priv-pane .card h2{font-size:clamp(18px,1.7vw,24px)}
#player-shell .priv-pane .card>p{font-size:12px;line-height:1.55}
#player-shell .priv-notice{margin:0;padding:9px 12px;border:1px solid #267986;border-radius:10px;font-size:11px;color:#a7e4d9;background:#053540}
#player-shell .priv-notice.priv-error{border-color:#b76466;color:#ffbec2}
#player-shell .priv-info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
#player-shell .priv-info-grid .card{display:flex;flex-direction:column;gap:8px}
#player-shell .priv-info-grid .card h2{margin:1px 0}
#player-shell .priv-info-grid .card p{margin:0}
#player-shell .priv-info-grid button{align-self:flex-start;margin-top:auto}
#player-shell .priv-presets{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}
#player-shell .priv-presets button{min-width:0;text-align:left;display:grid;align-content:start;gap:9px;border:1px solid #2e8790;border-radius:13px;padding:15px;background:linear-gradient(125deg,#08444d,#052835);color:#d9f3f0;cursor:pointer}
#player-shell .priv-presets button:hover{border-color:#f5cc84;background:linear-gradient(125deg,#10636a,#053c49)}
#player-shell .priv-presets button:focus-visible{outline:2px solid #ffe0aa;outline-offset:3px}
#player-shell .priv-presets strong{font-size:13px;color:#f8da98}
#player-shell .priv-presets strong span{font-size:21px;margin-right:6px}
#player-shell .priv-presets small{font-size:11px;line-height:1.55;color:#b8d8dc}
#player-shell .priv-options{display:grid;gap:9px;margin:12px 0}
#player-shell .priv-option{display:flex;align-items:center;justify-content:space-between;gap:17px;padding:13px 15px;border:1px solid #287e85;border-radius:12px;background:linear-gradient(130deg,#073743,#052531);cursor:pointer}
#player-shell .priv-option:hover{border-color:#34caba}
#player-shell .priv-option span{display:grid;gap:5px;min-width:0}
#player-shell .priv-option strong{color:#f9ffff;font-size:13px}
#player-shell .priv-option small{font-size:11px;line-height:1.5;color:#afd2d5}
#player-shell .priv-option input{width:22px;height:22px;accent-color:#15dfcd;cursor:pointer;flex:0 0 auto}
#player-shell .priv-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#player-shell .priv-actions button{min-height:38px;padding:9px 13px;font-size:11px}
#player-shell .priv-hint{font-size:11px!important;line-height:1.6;color:#a9cbcf}
#player-shell .priv-roadmap{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:13px 0}
#player-shell .priv-roadmap>div{display:grid;gap:5px;padding:12px;border:1px solid #306f77;border-radius:12px;background:#073541}
#player-shell .priv-roadmap strong{font-size:12px;color:#efc983}
#player-shell .priv-roadmap span{font-size:11px;line-height:1.5;color:#bbd9db}
#player-shell .priv-savebar{position:sticky;bottom:10px;z-index:7;display:flex;justify-content:space-between;align-items:center;gap:13px;padding:11px 15px;border:1px solid #34cbb5;border-radius:14px;background:#052b39;box-shadow:0 12px 32px #000a,0 0 25px #10cdb633}
#player-shell .priv-savebar strong{display:block;font-size:12px;color:#f2ffff}
#player-shell .priv-savebar small{display:block;font-size:10px;color:#a8c8cd;margin-top:4px}
#player-shell .priv-savebar .primary{border-color:#ebc372;background:linear-gradient(130deg,#ffe6ab,#e2b764);color:#122d35;font-weight:900}
#player-shell .priv-savebar button:disabled{opacity:.6;cursor:not-allowed}
@media(max-width:1200px){#player-shell .priv-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}#player-shell .priv-presets{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:800px){#player-shell .priv-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}#player-shell .priv-presets{grid-template-columns:1fr}#player-shell .priv-info-grid{grid-template-columns:1fr}#player-shell .priv-roadmap{grid-template-columns:1fr}}
@media(max-width:700px){#player-shell .priv-hero{padding:12px;min-height:105px}#player-shell .priv-hero h2{font-size:25px}#player-shell .priv-emblem{height:55px;width:55px;border-radius:15px}#player-shell .priv-emblem span{font-size:22px}#player-shell .priv-tabs{position:static;grid-template-columns:repeat(2,minmax(0,1fr));padding:5px}#player-shell .priv-tabs button{min-height:41px;font-size:11px}#player-shell .priv-savebar{bottom:0;flex-wrap:wrap;border-radius:12px;padding:10px}#player-shell .priv-savebar .priv-actions{width:100%}#player-shell .priv-savebar .priv-actions button{flex:1;min-height:41px}#player-shell .priv-option{padding:11px;gap:10px}#player-shell .priv-option input{width:23px;height:23px}}

/* GRACZ.PL Notifications Full Max Premium — compact and responsive */
#player-shell .notif-hero{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:118px;padding:17px 21px;border:1px solid #27dac8;border-radius:17px;background:radial-gradient(ellipse at 83% 10%,#0ca9a65c,transparent 58%),linear-gradient(120deg,#073b47,#031f2d)}
#player-shell .notif-hero h2{font-size:clamp(23px,2.5vw,33px);margin:5px 0;color:#fff}
#player-shell .notif-hero p:last-child{font-size:12px;color:#b6d9d9;line-height:1.5;margin:0}
#player-shell .notif-orb{height:76px;width:76px;flex:0 0 auto;border:2px solid #e9c674;border-radius:50%;background:#043344;color:#f5ce83;box-shadow:0 0 23px #21d6c848;display:grid;place-content:center;text-align:center;font-size:32px;gap:0}
#player-shell .notif-orb small{font-size:8px;letter-spacing:.09em;font-weight:900}
#player-shell .notif-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
#player-shell .notif-metrics>div{min-width:0;display:grid;gap:5px;border:1px solid #2a7e85;background:linear-gradient(130deg,#08424b,#052330);border-radius:12px;padding:12px}
#player-shell .notif-metrics small{font-size:9px;font-weight:850;color:#f4d18a;letter-spacing:.1em}
#player-shell .notif-metrics strong{font-size:clamp(20px,2vw,27px);line-height:1.1;color:#fff}
#player-shell .notif-metrics span{font-size:10px;color:#a3c7cc}
#player-shell .notif-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;background:#052a39;padding:7px;border:1px solid #27787f;border-radius:13px;position:sticky;top:0;z-index:5}
#player-shell .notif-tabs button{min-width:0;min-height:38px;padding:7px;background:#073844;border:1px solid #376d75;border-radius:9px;color:#def2ef;font:800 11px Inter,"Segoe UI",sans-serif;cursor:pointer}
#player-shell .notif-tabs button.active{border-color:#23e5ca;background:linear-gradient(115deg,#08766f,#064956);color:#fff;box-shadow:0 0 16px #12e3d53b}
#player-shell .notif-tabs button:focus-visible{outline:2px solid #ffe1a4;outline-offset:2px}
#player-shell .notif-feedback{margin:0;padding:9px 12px;border:1px solid #2a6e79;background:#062f3d;border-radius:11px;font-size:11px;color:#bfe8e3}
#player-shell .notif-feedback.error{color:#ffc4bc;border-color:#ad6568}
#player-shell .notif-view{display:grid;gap:11px}
#player-shell .notif-view[hidden]{display:none!important}
#player-shell .notif-toolbar{display:grid;gap:10px;padding:13px}
#player-shell .notif-toolbar-row{display:grid;grid-template-columns:minmax(160px,2fr) minmax(100px,1fr) minmax(95px,1fr);gap:9px}
#player-shell .notif-toolbar label,#player-shell .notif-settings label[for=nt-mute]{display:grid;gap:6px;font-size:11px;font-weight:750;color:#d8efec}
#player-shell .notif-toolbar input,#player-shell .notif-toolbar select,#player-shell .notif-settings select{min-width:0;width:100%;min-height:38px;padding:7px 10px;border:1px solid #34838b;border-radius:9px;background:#052b38;color:#f7ffff;font-size:12px}
#player-shell .notif-actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
#player-shell .notif-actions button{min-height:37px;padding:8px 12px;font-size:11px}
#player-shell .notif-list-header{display:flex;align-items:center;justify-content:space-between;gap:12px}
#player-shell .notif-list-header h2{font-size:19px;margin:4px 0}
#player-shell .notif-list-count{padding:5px 10px;border:1px solid #3b9095;border-radius:20px;color:#ffe4a5;font-size:11px}
#player-shell .notif-items{display:grid;gap:8px;margin-top:11px}
#player-shell .notif-item{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:12px;align-items:start;padding:11px;border:1px solid #2c747e;border-radius:12px;background:linear-gradient(110deg,#073e48,#062533)}
#player-shell .notif-item.unread{border-color:#19c5b8;background:linear-gradient(110deg,#08646b,#05333e);box-shadow:inset 3px 0 0 #43e5c8}
#player-shell .notif-item.muted{box-shadow:none}
#player-shell .notif-item-icon{display:grid;place-items:center;width:36px;height:36px;border:1px solid #6ea8a8;border-radius:10px;color:#ffe0a1;background:#053544;font-size:17px}
#player-shell .notif-item-main{min-width:0;display:grid;gap:5px}
#player-shell .notif-item-title{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-weight:850;font-size:12px;color:#fff}
#player-shell .notif-unread-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#27e6cb;box-shadow:0 0 8px #28dfbd}
#player-shell .notif-item-info{font-size:11px;color:#bed6d8;overflow-wrap:anywhere}
#player-shell .notif-item-date{font-size:10px;color:#94b7bb}
#player-shell .notif-item-controls{display:flex;justify-content:end;align-items:center;gap:6px;flex-wrap:wrap;max-width:255px}
#player-shell .notif-item-controls button{padding:6px 9px;min-height:32px;border-radius:8px;background:#083c49;border:1px solid #367c84;color:#e5f6f3;font-size:10px;font-weight:760;cursor:pointer}
#player-shell .notif-item-controls button:hover{border-color:#ffe2a2}
#player-shell .notif-empty{padding:24px 12px;text-align:center;color:#b7d5d4;font-size:12px}
#player-shell .notif-pagination{display:flex;justify-content:center;margin:12px 0 0}
#player-shell .notif-settings{display:grid;gap:12px}
#player-shell .notif-settings h3{color:#f4d28c;font-size:15px;margin:12px 0 0}
#player-shell .notif-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
#player-shell .notif-setting{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px;border:1px solid #2a7c83;border-radius:12px;background:#063342;cursor:pointer}
#player-shell .notif-setting strong{font-size:12px;color:#fff}
#player-shell .notif-setting small{display:block;font-size:11px;line-height:1.5;color:#b4d5d7;margin-top:4px}
#player-shell .notif-setting input{width:21px;height:21px;flex:0 0 auto;accent-color:#1bcbbb;cursor:pointer}
#player-shell .notif-required{white-space:nowrap;color:#ffe09b;font-size:11px;font-weight:900}
#player-shell .notif-locked{cursor:default}
#player-shell .notif-hint,#player-shell .notif-footnote p{font-size:11px;line-height:1.6;color:#accbd0}
#player-shell .notif-planned{display:flex;gap:8px;flex-wrap:wrap}
#player-shell .notif-planned span{padding:7px 10px;border:1px solid #356c77;border-radius:20px;background:#052d38;color:#a7c3c7;font-size:11px}
#player-shell .notif-footnote{padding:12px}
#player-shell .notif-footnote p{margin:0}
#player-shell #nt-mute{max-width:270px}
@media(max-width:1100px){#player-shell .notif-toolbar-row{grid-template-columns:1fr 1fr}#player-shell .notif-toolbar-row label:first-child{grid-column:span 2}}
@media(max-width:700px){#player-shell .notif-hero{padding:12px;min-height:96px}#player-shell .notif-orb{height:55px;width:55px;font-size:22px}#player-shell .notif-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}#player-shell .notif-tabs{position:static;grid-template-columns:repeat(2,minmax(0,1fr));padding:5px}#player-shell .notif-settings-grid{grid-template-columns:1fr}#player-shell .notif-item{grid-template-columns:32px minmax(0,1fr)}#player-shell .notif-item-icon{height:32px;width:32px}#player-shell .notif-item-controls{grid-column:2;max-width:none;justify-content:flex-start}#player-shell .notif-item-controls button{min-height:40px}#player-shell .notif-toolbar-row{grid-template-columns:1fr}#player-shell .notif-toolbar-row label:first-child{grid-column:span 1}}

/* GRACZ.PL — Messages & Chat Full Max Premium: compact, responsive, legible */
#player-shell .msg-hero{display:flex;justify-content:space-between;align-items:center;min-height:114px;gap:16px;padding:17px 21px;border-radius:16px;border:1px solid #28dfc9;background:radial-gradient(ellipse at 84% 14%,#0aaca65c,transparent 58%),linear-gradient(115deg,#063b48,#03232f)}
#player-shell .msg-hero h2{font-size:clamp(25px,2.6vw,36px);color:#fff;line-height:1.16;margin:6px 0}
#player-shell .msg-hero p:last-child{font-size:12px;color:#b5d9d7;margin:0}
#player-shell .msg-hero-mark{display:grid;place-content:center;text-align:center;height:77px;width:77px;flex:0 0 auto;border:2px solid #f1cc80;border-radius:50%;box-shadow:0 0 25px #13dbc73d;background:#04313d;color:#f9d993;font-size:32px}
#player-shell .msg-hero-mark small{font-weight:900;font-size:9px;letter-spacing:.08em}
#player-shell .msg-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
#player-shell .msg-metrics>div{min-width:0;border-radius:12px;border:1px solid #277f83;padding:10px 13px;background:linear-gradient(125deg,#08424a,#052631)}
#player-shell .msg-metrics small{display:block;font-size:9px;color:#ffda90;font-weight:900;letter-spacing:.07em}
#player-shell .msg-metrics strong{display:block;color:#fff;font-size:clamp(19px,2vw,27px);margin:5px 0}
#player-shell .msg-metrics span{display:block;font-size:10px;color:#aacbd0}
#player-shell .msg-notice{margin:0;padding:9px 12px;border:1px solid #2b7c81;background:#06343c;border-radius:10px;font-size:11px;color:#bde8df}
#player-shell .msg-notice.friend-alert{color:#ffd0c5;border-color:#b4786f}
#player-shell .msg-layout{display:grid;grid-template-columns:minmax(235px,29%) minmax(0,1fr);gap:12px;align-items:start}
#player-shell .msg-layout .card{padding:13px;min-width:0}
#player-shell .msg-left{display:grid;gap:10px;position:sticky;top:8px}
#player-shell .msg-left-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
#player-shell .msg-left-head h2{font-size:18px;margin:3px 0}
#player-shell .msg-left-head button{min-width:37px;min-height:37px;padding:5px 9px;font-size:20px}
#player-shell .msg-left label,#player-shell .msg-chat-options label{display:grid;gap:5px;font-size:11px;color:#c8e5e7;font-weight:750}
#player-shell .msg-left input,#player-shell .msg-left select,#player-shell .msg-chat-options input,#player-shell .msg-chat-options select,#player-shell .msg-label-control select{width:100%;min-width:0;min-height:37px;padding:7px 9px;border:1px solid #367b84;border-radius:9px;background:#052c39;color:#f2ffff;font-size:12px}
#player-shell .msg-filter{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
#player-shell .msg-filter button{min-height:37px;padding:7px 5px;border:1px solid #287884;border-radius:8px;background:#063645;color:#d3ebee;font:760 11px Inter,"Segoe UI",sans-serif;cursor:pointer}
#player-shell .msg-filter button.active{border-color:#18e2cb;background:linear-gradient(115deg,#06796f,#0b4b56);color:#fff}
#player-shell .msg-conversations{display:grid;gap:7px;max-height:min(610px,65vh);overflow:auto;scrollbar-width:thin;padding:2px}
#player-shell .msg-conversation{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:8px;width:100%;border:1px solid #286e7b;border-radius:11px;padding:10px 8px;background:#072e3a;color:#eaf6f8;text-align:left;cursor:pointer}
#player-shell .msg-conversation.active{border-color:#29e3c9;background:#075a60;box-shadow:inset 3px 0 0 #41e7ce}
#player-shell .msg-conversation:hover{border-color:#e0bd70}
#player-shell .msg-avatar{display:grid;place-items:center;width:38px;height:38px;border:1px solid #e1b96c;border-radius:50%;background:#05323e;color:#ffe2a1;font-size:17px;font-weight:900;flex:0 0 auto}
#player-shell .msg-conversation-info{min-width:0;display:grid;gap:5px}
#player-shell .msg-conversation-info strong{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff}
#player-shell .msg-conversation-info small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#aacbd0;font-size:10px}
#player-shell .msg-conversation-count{border-radius:20px;background:#f4d17e;color:#062c36;padding:4px 7px;font-size:10px;font-weight:900}
#player-shell .msg-left-footer{display:flex;gap:7px;flex-wrap:wrap}
#player-shell .msg-left-footer button{flex:1;min-height:36px;padding:6px;font-size:11px}
#player-shell .msg-right{display:grid;gap:11px;min-width:0}
#player-shell .msg-chat{display:grid;gap:10px}
#player-shell .msg-chat-head{display:flex;align-items:center;justify-content:space-between;gap:9px;border-bottom:1px solid #276b76;padding-bottom:11px}
#player-shell .msg-chat-person{display:flex;align-items:center;gap:10px;min-width:0}
#player-shell .msg-chat-person h2{font-size:18px;margin:4px 0;color:#fff}
#player-shell .msg-chat-person small{color:#a8d4d2;font-size:10px}
#player-shell .msg-chat-actions,#player-shell .msg-tools,#player-shell .msg-privacy-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
#player-shell .msg-chat-actions button,#player-shell .msg-tools button,#player-shell .msg-privacy-actions button{min-height:34px;padding:7px 10px;font-size:11px}
#player-shell .msg-chat-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
#player-shell .msg-tools{border:1px solid #265d6a;background:#052e39;padding:8px;border-radius:10px}
#player-shell .msg-label-control{display:flex;align-items:center;gap:7px;font-size:10px;color:#c6dfdf}
#player-shell .msg-label-control select{min-height:32px;width:110px}
#player-shell .msg-thread{min-height:280px;max-height:440px;overflow-y:auto;border:1px solid #296e76;border-radius:12px;padding:14px;background:radial-gradient(ellipse at center,#06495333,transparent 78%),#031f2d;scrollbar-width:thin}
#player-shell .msg-thread .social-bubble{max-width:min(84%,450px);overflow-wrap:anywhere}
#player-shell .msg-composer{border:1px solid #286a73;border-radius:12px;padding:10px;background:#052e3c}
#player-shell .msg-composer textarea{width:100%;resize:vertical;min-height:77px;max-height:180px;border:1px solid #31888c;border-radius:9px;padding:11px;background:#031f2d;color:#fff}
#player-shell .msg-compose-bottom{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
#player-shell .msg-compose-bottom span{font-size:10px;color:#a6cbd0}
#player-shell .msg-compose-bottom button{margin-left:auto;min-height:38px;padding:8px 17px}
#player-shell .msg-privacy{display:flex;justify-content:space-between;gap:12px;align-items:center}
#player-shell .msg-privacy h3{font-size:15px;margin:4px 0}
#player-shell .msg-privacy p:last-child{font-size:11px;line-height:1.6;color:#accbd0;margin:0}
#player-shell .msg-privacy .card-kicker{margin:0}
#player-shell .msg-empty{font-size:11px;color:#afcfd3;padding:14px;text-align:center}
#player-shell .msg-filter button:focus-visible,#player-shell .msg-conversation:focus-visible{outline:2px solid #ffdfa3;outline-offset:2px}
@media(max-width:1150px){#player-shell .msg-layout{grid-template-columns:minmax(210px,34%) minmax(0,1fr)}#player-shell .msg-chat-head{align-items:flex-start;flex-wrap:wrap}}
@media(max-width:850px){#player-shell .msg-layout{grid-template-columns:1fr}#player-shell .msg-left{position:static}#player-shell .msg-conversations{max-height:265px}#player-shell .msg-chat-options{grid-template-columns:1fr 1fr}}
@media(max-width:600px){#player-shell .msg-hero{padding:13px;min-height:104px}#player-shell .msg-hero-mark{width:55px;height:55px;font-size:24px}#player-shell .msg-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}#player-shell .msg-chat-options{grid-template-columns:1fr}#player-shell .msg-chat-actions{width:100%}#player-shell .msg-chat-actions button{flex:1;min-height:40px}#player-shell .msg-privacy{flex-wrap:wrap}#player-shell .msg-thread{min-height:220px;max-height:360px}#player-shell .msg-compose-bottom button{min-height:41px}}

/* Full Max Premium: farewell is displayed only after server-confirmed logout. */
.logout-farewell{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;
 padding:clamp(14px,3vw,28px);overflow-y:auto;
 background:radial-gradient(ellipse at 50% 34%,#0b6e68 0%,#053a40 37%,#021d29 76%,#010e19 100%);
 color:#fff5dd;text-align:center}
.logout-farewell-card{position:relative;width:min(100%,660px);padding:clamp(25px,5vw,54px) clamp(22px,5vw,60px);
 border:2px solid #edc473;border-radius:28px;
 background:radial-gradient(ellipse at 50% 0%,#0d68637d,transparent 61%),linear-gradient(150deg,#063e42 0%,#04272f 54%,#011926 100%);
 box-shadow:inset 0 0 0 1px #fff0b52e,0 0 28px #f2c06c59,0 20px 80px #000b}
.logout-farewell-crown{font:normal clamp(48px,6vw,67px)/1 Georgia,serif;
 color:#f7d484;text-shadow:0 1px #9b651c,0 0 14px #f8cf805e;margin-bottom:13px}
.logout-farewell-eyebrow{font-size:clamp(9px,1vw,12px);font-weight:850;letter-spacing:.16em;color:#ecca83;margin:0 0 22px}
.logout-farewell h2{font:750 clamp(29px,4.2vw,48px)/1.19 Georgia,"Times New Roman",serif;
 color:#fff2d4;margin:0 0 18px;overflow-wrap:anywhere}
.logout-farewell h2 span{color:#f6cf75}
.logout-farewell-message{font-size:clamp(16px,1.65vw,20px);line-height:1.55;color:#e8f7f2;margin:0 auto 15px;max-width:510px}
.logout-farewell-invite{font:700 clamp(23px,2.6vw,31px)/1.24 Georgia,serif;color:#f6d288;margin:0 0 32px}
.logout-farewell-login{display:flex;align-items:center;justify-content:center;gap:15px;
 min-height:58px;width:min(100%,390px);margin:0 auto;padding:12px 25px;border-radius:15px;
 border:1px solid #ffe7a5;background:linear-gradient(180deg,#ffe9a2,#f5c45d 57%,#dc9d36);
 box-shadow:inset 0 2px #fff5ce,0 0 19px #e7ba6380,0 8px 22px #0007;
 color:#091d24;font-size:19px;font-weight:900;text-decoration:none}
.logout-farewell-login:hover,.logout-farewell-login:focus-visible{filter:brightness(1.08);outline:2px solid #fff5c3;outline-offset:3px}
.logout-farewell-redirect{font-size:12px;color:#b9dbd6;margin:18px 0 0}
@media(max-width:600px){.logout-farewell-card{padding:30px 22px;border-radius:20px}
.logout-farewell-login{min-height:52px;font-size:17px}}


/* GRACZ.PL Full Max Premium Challenges: compact, functional and responsive */
#player-shell .chall-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
#player-shell .chall-metrics>div{min-width:0;padding:12px 13px;border:1px solid #237f87;border-radius:13px;background:linear-gradient(120deg,#07414d,#052633)}
#player-shell .chall-metrics small{display:block;font-size:9px;color:#f8d28c;font-weight:900;letter-spacing:.08em}
#player-shell .chall-metrics strong{display:block;font-size:clamp(19px,2vw,27px);line-height:1.1;color:#fff;margin:7px 0}
#player-shell .chall-metrics span{font-size:10px;color:#b0d2d6}
#player-shell .chall-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;padding:7px;border:1px solid #2b7480;background:#052b39;border-radius:13px}
#player-shell .chall-tabs button{min-height:39px;min-width:0;border:1px solid #316a76;background:#073543;border-radius:9px;color:#e5f4f4;font:800 11px Inter,"Segoe UI",sans-serif;padding:8px 5px;cursor:pointer}
#player-shell .chall-tabs button.active{border-color:#25e2ca;color:#fff;background:linear-gradient(120deg,#087e78,#084958);box-shadow:0 0 13px #16decc50}
#player-shell .chall-notice{margin:0;border:1px solid #297d84;background:#063846;color:#bde9e4;border-radius:11px;padding:9px 12px;font-size:11px}
#player-shell .chall-notice.friend-alert{color:#ffbdb6;border-color:#bb6872}
#player-shell .chall-workspace{display:grid;grid-template-columns:minmax(255px,32%) minmax(0,1fr);gap:12px;align-items:start}
#player-shell .chall-workspace[hidden],#player-shell .chall-settings[hidden],#player-shell .chall-note-overlay[hidden]{display:none!important}
#player-shell .chall-compose,#player-shell .chall-inbox{padding:15px;min-width:0}
#player-shell .chall-compose h2,#player-shell .chall-inbox h2{font-size:clamp(17px,1.6vw,23px);margin:5px 0}
#player-shell .chall-compose>p:not(.card-kicker){font-size:11px;line-height:1.55;color:#b6d0d6}
#player-shell .chall-form{display:grid;gap:11px;margin-top:12px}
#player-shell .chall-form label,#player-shell .chall-filters label{display:grid;gap:5px;font-size:11px;font-weight:800;color:#d7ecec}
#player-shell .chall-form select,#player-shell .chall-filters select,#player-shell .chall-filters input{width:100%;min-width:0;min-height:37px;border:1px solid #38818c;border-radius:9px;background:#052e3c;color:#fff;padding:8px;font-size:12px}
#player-shell .chall-time-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
#player-shell .chall-time-options[hidden]{display:none!important}
#player-shell .chall-time-options small{grid-column:1/-1;font-size:10px;line-height:1.5;color:#b1cfd2}
#player-shell .chall-preview{display:flex;align-items:center;gap:11px;background:linear-gradient(115deg,#064753,#052b3b);border:1px solid #40858d;border-radius:13px;padding:10px}
#player-shell .chall-preview-icon{display:grid;place-items:center;flex:0 0 auto;width:43px;height:43px;border:1px solid #edc878;border-radius:12px;color:#f9d898;font-size:23px;background:#052a38}
#player-shell .chall-preview strong{display:block;font-size:13px;color:#f7ffff}
#player-shell .chall-preview small{display:block;font-size:10px;color:#b7d3d6;margin-top:5px}
#player-shell .chall-form>.primary{width:100%;min-height:40px;border:1px solid #f5d68d;background:linear-gradient(130deg,#ffe2a0,#d6ab57);color:#092631;font-weight:900}
#player-shell .chall-shortcuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:11px}
#player-shell .chall-shortcuts button{min-height:35px;padding:7px;font-size:11px}
#player-shell .chall-fineprint{font-size:10px!important;margin:12px 0 0!important}
#player-shell .chall-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}
#player-shell .chall-heading button{min-height:34px;font-size:11px}
#player-shell .chall-filters{display:grid;grid-template-columns:minmax(125px,2fr) repeat(3,minmax(90px,1fr));gap:8px;margin:12px 0}
#player-shell .chall-list-summary{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10px;color:#abcfd2;padding:7px 0;border-bottom:1px solid #296976}
#player-shell .chall-list-summary span:first-child{color:#ffe09a;font-weight:850}
#player-shell .chall-list{display:grid;gap:9px;margin-top:10px}
#player-shell .chall-card{border:1px solid #2b7780;border-radius:13px;background:linear-gradient(125deg,#073b47,#042630);padding:12px;display:grid;gap:9px;min-width:0}
#player-shell .chall-card.is-new{border-color:#21d3bd;box-shadow:inset 3px 0 0 #32ebcd}
#player-shell .chall-card-top{display:flex;justify-content:space-between;align-items:start;gap:10px}
#player-shell .chall-card-title{font-size:13px;font-weight:900;color:#fff}
#player-shell .chall-card-sub{font-size:11px;color:#b4d4d8;line-height:1.5;overflow-wrap:anywhere;margin-top:5px}
#player-shell .chall-card-badge{white-space:nowrap;font-size:10px;padding:5px 8px;border:1px solid #3b9496;border-radius:16px;color:#d4efea;background:#08535b}
#player-shell .chall-card-badge.pending{border-color:#e8c67d;color:#ffe0a4;background:#3f3c25}
#player-shell .chall-card-details{display:flex;gap:9px;flex-wrap:wrap;font-size:10px;color:#bcd6d9}
#player-shell .chall-card-details span{padding:4px 7px;background:#083441;border:1px solid #2c6e78;border-radius:7px}
#player-shell .chall-card-note{font-size:11px;color:#ffdaa0;background:#133940;border-left:2px solid #e1bf77;padding:7px 9px;border-radius:6px}
#player-shell .chall-card-actions{display:flex;gap:7px;flex-wrap:wrap}
#player-shell .chall-card-actions button,#player-shell .chall-card-actions a{min-height:34px;padding:7px 10px;font-size:10px;border:1px solid #357780;background:#073b49;color:#e6f8f4;border-radius:8px;font-weight:850;text-decoration:none;cursor:pointer}
#player-shell .chall-card-actions button:hover,#player-shell .chall-card-actions a:hover{border-color:#f0d18c}
#player-shell .chall-card-actions .chall-important{border-color:#ebc77a;background:linear-gradient(115deg,#f8df9e,#d8af5f);color:#092b35}
#player-shell .chall-pagination{display:flex;justify-content:center;padding-top:10px}
#player-shell .chall-pagination button{min-height:36px;font-size:11px}
#player-shell .chall-settings{padding:16px}
#player-shell .chall-settings h2{font-size:21px}
#player-shell .chall-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
#player-shell .chall-settings-grid>div{border:1px solid #307780;border-radius:12px;background:#073744;padding:14px}
#player-shell .chall-settings-grid strong{font-size:13px;color:#ffe0a1}
#player-shell .chall-settings-grid p{font-size:11px;line-height:1.6;color:#b9d8d8}
#player-shell .chall-settings-grid button{min-height:36px;padding:7px 12px;font-size:11px}
#player-shell .chall-note-overlay{position:fixed;inset:0;z-index:9999;background:#000b;display:grid;place-items:center;padding:16px}
#player-shell .chall-note-dialog{width:min(450px,100%);padding:21px;border:1px solid #35d6c3;border-radius:18px;background:linear-gradient(145deg,#09444f,#032433);box-shadow:0 20px 60px #0009}
#player-shell .chall-note-dialog h2{font-size:21px;margin:7px 0}
#player-shell .chall-note-dialog p{font-size:12px;color:#c1d9db}
#player-shell .chall-note-dialog label{display:grid;gap:7px;font-size:11px;color:#f5d58a}
#player-shell .chall-note-dialog textarea{padding:10px;background:#052c38;border:1px solid #428c96;border-radius:9px;color:white;resize:vertical}
#player-shell .chall-dialog-actions{display:flex;justify-content:end;gap:8px;margin-top:15px}
#player-shell .chall-dialog-actions button{min-height:39px;padding:7px 15px;font-size:11px}
#player-shell .chall-tabs button:focus-visible,#player-shell .chall-card button:focus-visible{outline:2px solid #ffe2a9;outline-offset:2px}
@media(max-width:1180px){#player-shell .chall-workspace{grid-template-columns:minmax(230px,36%) minmax(0,1fr)}#player-shell .chall-filters{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:850px){#player-shell .chall-workspace{grid-template-columns:1fr}#player-shell .chall-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}#player-shell .chall-compose{position:static}}
@media(max-width:650px){#player-shell .chall-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}#player-shell .chall-filters{grid-template-columns:repeat(2,minmax(0,1fr))}#player-shell .chall-settings-grid{grid-template-columns:1fr}#player-shell .chall-list-summary{align-items:start;flex-wrap:wrap}#player-shell .chall-card-top{flex-wrap:wrap}}
`;
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
    if(action==='book'){void abOpenFriend(nickname);return;}
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
   [{action:'book',label:'Wizytówka'},{action:'message',label:'Napisz'},{action:'challenge',label:'Zaproś do gry'},{action:'remove',label:'Usuń'},{action:'block',label:'Zablokuj'}]);
  renderFriendList('friends-incoming',incoming,'Brak nowych zaproszeń.','Zaprasza Cię do znajomych',
   [{action:'accept',label:'Akceptuj'},{action:'decline',label:'Odrzuć'},{action:'block',label:'Zablokuj'}]);
  renderFriendList('friends-outgoing',outgoing,'Nie masz oczekujących zaproszeń.','Oczekuje na odpowiedź',
   [{action:'cancel',label:'Anuluj'}]);
  renderFriendList('friends-blocked',result.blocked,'Lista zablokowanych jest pusta.','Zablokowany użytkownik',
   [{action:'unblock',label:'Odblokuj'}]);
  friendsStatus('Znajomi: '+accepted.length+' · Zaproszenia: '+incoming.length+' · Wysłane: '+outgoing.length+'.');
  fhUpdateFromFriends(result);
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
// Full Max Premium Messenger — private inbox metadata over existing friend message API.
let msgState=null,msgView='all',msgRecords=[],msgCurrentLoading=false,msgSending=false;
let msgLastReload=0;
const msgLabels={'':'Bez grupy',priority:'Ważne',team:'Drużyna',family:'Rodzina',friends:'Znajomi'};
function msgCurrent(){
 const nick=$('message-recipient').value.toLowerCase();
 return msgState?.conversations.find(c=>c.nickname.toLowerCase()===nick)||null;
}
function msgNotice(message,error=false){socialNotice('messages-state',message,error)}
function msgApplyToolbar(){
 const selected=msgCurrent();
 $('msg-chat-name').textContent=selected?.nickname||'Wybierz znajomego';
 $('msg-chat-avatar').textContent=(selected?.nickname||'G').charAt(0).toUpperCase();
 $('msg-chat-status').textContent=selected?
  (selected.muted?'Wyciszona na Twoim koncie · ':'Rozmowa prywatna · ')+
  (selected.unread>0?selected.unread+' nieprzeczytanych':'wiadomości aktualne'):
  'Wiadomości tylko między zaakceptowanymi znajomymi';
 $('msg-pin').textContent=selected?.pinned?'Odepnij':'Przypnij';
 $('msg-mute').textContent=selected?.muted?'Włącz powiadomienia':'Wycisz';
 $('msg-archive').textContent=selected?.archived?'Przywróć':'Archiwizuj';
 $('msg-label').value=selected?.label||'';
 for(const id of ['msg-pin','msg-mute','msg-archive','msg-label','msg-export','msg-invite-game','msg-profile']){
  $(id).disabled=!selected;
 }
}
function msgRenderList(){
 if(!msgState)return;
 const rows=msgState.conversations;
 $('msg-count').textContent=String(rows.filter(c=>!c.archived).length);
 $('msg-unread').textContent=String(rows.filter(c=>!c.archived).reduce((sum,c)=>sum+c.unread,0));
 $('msg-pinned').textContent=String(rows.filter(c=>c.pinned&&!c.archived).length);
 $('msg-archived').textContent=String(rows.filter(c=>c.archived).length);
 const filter=$('msg-find').value.trim().toLowerCase();
 const label=$('msg-label-filter').value;
 const list=$('msg-conversations');list.replaceChildren();
 const displayed=rows.filter(c=>{
  if(msgView==='archive'){if(!c.archived)return false}
  else {
   if(c.archived)return false;
   if(msgView==='unread'&&c.unread===0)return false;
   if(msgView==='pinned'&&!c.pinned)return false;
  }
  return c.nickname.toLowerCase().includes(filter)&&
   (label==='all'||c.label===label);
 });
 for(const item of displayed){
  const row=document.createElement('button');row.type='button';row.className='msg-conversation';
  const active=$('message-recipient').value.toLowerCase()===item.nickname.toLowerCase();
  if(active)row.classList.add('active');
  row.setAttribute('aria-current',String(active));
  const avatar=document.createElement('span');avatar.className='msg-avatar';
  avatar.textContent=item.nickname.charAt(0).toUpperCase();
  const info=document.createElement('span');info.className='msg-conversation-info';
  const title=document.createElement('strong');title.textContent=
   (item.pinned?'★ ':'')+item.nickname+(item.muted?' · wyciszono':'');
  const last=document.createElement('small');
  const preview=item.lastMessage||(item.lastAt?'Wiadomość':'Rozpocznij rozmowę');
  last.textContent=(item.lastOwn?'Ty: ':'')+preview.slice(0,85);
  info.append(title,last);row.append(avatar,info);
  if(item.unread){
   const counter=document.createElement('span');counter.className='msg-conversation-count';
   counter.textContent=item.unread>99?'99+':String(item.unread);row.append(counter);
  }
  row.addEventListener('click',()=>void msgChoose(item.nickname));
  list.append(row);
 }
 if(!displayed.length){
  const empty=document.createElement('p');empty.className='msg-empty';
  empty.textContent=msgView==='archive'?'Archiwum rozmów jest puste.':
   msgView==='unread'?'Nie masz nieprzeczytanych wiadomości.':
   'Brak rozmów dla wybranego filtra. Znajomych znajdziesz w „Moi znajomi”.';
  list.append(empty);
 }
 msgApplyToolbar();
}
async function messageCenterLoad(){
 if(!sessionConfirmed||msgCurrentLoading)return;
 msgCurrentLoading=true;
 try{
  const result=await api('message-center');
  msgState=result;msgLastReload=Date.now();
  msgRenderList();
 }catch(error){msgNotice(error.message,true)}
 finally{msgCurrentLoading=false}
}
async function msgChoose(nick){
 msgRecords=[];
 await prepareSocial('messages');
 const select=$('message-recipient');select.value=nick;
 if(select.value!==nick){msgNotice('Ta znajomość nie jest już aktywna.',true);return;}
 $('msg-search-thread').value='';
 msgRenderList();await refreshThread();
}
async function msgChange(action,label=''){
 const current=msgCurrent();
 if(!current){msgNotice('Najpierw wybierz rozmowę.',true);return false}
 try{
  await api('message-center/state',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({nickname:current.nickname,action,...(action==='label'?{label}:{})})});
  await messageCenterLoad();
  return true;
 }catch(error){msgNotice(error.message,true);return false}
}
function msgFilterThread(){
 const term=$('msg-search-thread').value.trim().toLowerCase();
 const bubbles=$('message-thread').querySelectorAll('.social-bubble');
 let count=0;
 for(const el of bubbles){
  const found=el.textContent.toLowerCase().includes(term);
  el.hidden=!found;if(found)count++;
 }
 if(term)msgNotice('Znaleziono '+count+' wiadomości w ostatnich 60 pozycjach rozmowy.');
}
const msgControlActions=[
 ['msg-pin',()=>msgCurrent()?.pinned?'unpin':'pin'],
 ['msg-mute',()=>msgCurrent()?.muted?'unmute':'mute'],
 ['msg-archive',()=>msgCurrent()?.archived?'restore':'archive']
];
for(const [id,action] of msgControlActions)$(id).addEventListener('click',async()=>{
 const button=$(id);button.disabled=true;
 await msgChange(action());button.disabled=!msgCurrent();
});
$('msg-label').addEventListener('change',()=>void msgChange('label',$('msg-label').value));
document.querySelectorAll('[data-msg-filter]').forEach(button=>button.addEventListener('click',()=>{
 msgView=button.dataset.msgFilter;
 for(const b of document.querySelectorAll('[data-msg-filter]')){
  const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
 }
 msgRenderList();
}));
$('msg-find').addEventListener('input',msgRenderList);
$('msg-label-filter').addEventListener('change',msgRenderList);
$('msg-search-thread').addEventListener('input',msgFilterThread);
$('msg-refresh-all').addEventListener('click',async()=>{await messageCenterLoad();await refreshThread()});
$('msg-open-friends').addEventListener('click',()=>{switchSection('friends');fhTab('overview')});
$('msg-open-book').addEventListener('click',()=>{switchSection('friends');fhTab('book')});
$('msg-block-link').addEventListener('click',()=>{switchSection('friends');fhTab('blocked')});
$('msg-privacy-link').addEventListener('click',()=>switchSection('privacy'));
$('msg-invite-game').addEventListener('click',async()=>{
 const current=msgCurrent();if(!current)return;
 switchSection('challenges');await prepareSocial('challenges');
 $('challenge-friend').value=current.nickname;
});
$('msg-profile').addEventListener('click',()=>{
 const current=msgCurrent();if(!current)return;
 window.open('/konto/profil/'+encodeURIComponent(current.nickname),'_blank','noopener,noreferrer');
});
$('message-content').addEventListener('input',()=>{
 $('msg-counter').textContent=String($('message-content').value.length)+' / 1000 znaków';
});
$('message-content').addEventListener('keydown',event=>{
 if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){
  event.preventDefault();
  if(!msgSending&&$('message-recipient').value&&$('message-content').value.trim())
   $('message-form').requestSubmit();
 }
});
$('msg-export').addEventListener('click',()=>{
 const selected=msgCurrent();if(!selected)return;
 const payload={format:'gracz-messages-v1',friend:selected.nickname,
  scope:'Ostatnie maksymalnie 60 wiadomości widocznych w bieżącej rozmowie.',
  exportedAt:new Date().toISOString(),messages:msgRecords};
 const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='gracz-pl-rozmowa-'+selected.nickname+'.json';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 msgNotice('Pobrano maksymalnie 60 ostatnich wiadomości. Zachowaj prywatność pliku.');
});
if(typeof setInterval==='function')setInterval(()=>{
 if(!sessionConfirmed||msgSending||msgCurrentLoading)return;
 const section=typeof document.querySelector==='function'?
  document.querySelector('[data-panel="messages"]'):null;
 if(!section?.classList.contains('active'))return;
 if(typeof document.visibilityState!=='undefined'&&document.visibilityState!=='visible')return;
 if(Date.now()-msgLastReload<16000)return;
 void messageCenterLoad();
 if($('message-recipient').value)void refreshThread();
},20000);

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
 msgRecords=[];
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
  msgRecords=response.messages;
  response.messages.forEach(item=>{
   const bubble=document.createElement('div');bubble.className='social-bubble'+(item.own?' own':'');
   const text=document.createElement('p');text.textContent=item.body;
   const date=document.createElement('small');date.textContent=(item.own?'Ty':'Znajomy')+' · '+safeDate(item.createdAt);
   bubble.append(text,date);thread.append(bubble);
  });
  thread.scrollTop=thread.scrollHeight;
  msgFilterThread();
  const active=msgCurrent();
  if(active?.unread>0)void msgChange('read');
  else msgRenderList();
  socialNotice('messages-state','Wiadomości w rozmowie: '+response.messages.length+'.');
 }catch(error){socialNotice('messages-state',error.message,true);}
}
$('message-recipient').addEventListener('change',()=>{msgRecords=[];msgRenderList();void refreshThread()});
$('messages-refresh').addEventListener('click',()=>void refreshThread());
$('message-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const nick=$('message-recipient').value,body=$('message-content').value.trim();
 if(!nick||!body||body.length>1000){socialNotice('messages-state','Wybierz znajomego i wpisz wiadomość (maks. 1000 znaków).',true);return;}
 const button=$('message-send');button.disabled=true;msgSending=true;
 try{
  await api('social/messages',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({nickname:nick,message:body})});
  $('message-content').value='';$('msg-counter').textContent='0 / 1000 znaków';await refreshThread();
  await messageCenterLoad();
  socialNotice('messages-state','Wiadomość wysłana.');
 }catch(error){socialNotice('messages-state',error.message,true);}
 finally{msgSending=false;button.disabled=!$('message-recipient').value;}
});
// Full Max Premium Challenges — only existing game APIs execute invitations.
let challState=[],challTab='all',challDisplay=15,challLoading=false,challBusy=false,challNoteId=null,challLastFetch=0;
const challStatuses={pending:'Oczekuje',accepted:'Zaakceptowano',declined:'Odrzucono',cancelled:'Anulowano',expired:'Wygasło'};
const challTabs={all:'Twoje zaproszenia',incoming:'Otrzymane wyzwania',outgoing:'Wysłane zaproszenia',accepted:'Zaakceptowane partie',starred:'Ważne wyzwania',history:'Historia zaproszeń',archive:'Archiwum'};
function challUpdatePreview(){
 const game=$('challenge-game').value;
 $('chall-time-options').hidden=false;
 if($('challenge-time').value==='0')$('challenge-increment').value='0';
 $('challenge-increment').disabled=$('challenge-time').value==='0';
 $('chall-preview-icon').textContent=game==='gomoku'?'◉':game==='szachy'?'♔':'♟';
 $('chall-preview-name').textContent=game==='gomoku'?'Gomoku Online':game==='szachy'?'Szachy Online':'Warcaby Online';
 const minutes=Number($('challenge-time').value),increment=Number($('challenge-increment').value);
 $('chall-preview-details').textContent=minutes>0?
  minutes+' min na gracza'+(increment>0?' · +'+increment+' s za ruch':' · bez przyrostu'):
  'Klasyczna partia online · bez zegara';
 $('chall-clock-description').textContent=minutes>0?
  'Zegar uruchomi się po dołączeniu obu graczy.': 'Bez zegara przyrost czasu wynosi 0 sekund.';
}
function challTabSelect(tab){
 challTab=tab;challDisplay=15;
 document.querySelectorAll('[data-chall-tab]').forEach(button=>{
  const active=button.dataset.challTab===tab;
  button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
 });
 $('chall-workspace').hidden=tab==='settings';$('chall-settings').hidden=tab!=='settings';
 if(tab!=='settings')challRender();
}
function challRows(){
 const query=$('chall-search').value.trim().toLowerCase(),game=$('chall-filter-game').value,
  status=$('chall-filter-status').value;
 const items=challState.filter(item=>{
  if(challTab==='archive'){if(!item.archived)return false;}
  else{
   if(item.archived)return false;
   if(challTab==='incoming'&&(item.outgoing||item.status!=='pending'))return false;
   if(challTab==='outgoing'&&(!item.outgoing||item.status!=='pending'))return false;
   if(challTab==='accepted'&&item.status!=='accepted')return false;
   if(challTab==='starred'&&!item.starred)return false;
   if(challTab==='history'&&['pending','accepted'].includes(item.status))return false;
  }
  if(game!=='all'&&game!==item.game)return false;
  if(status!=='all'&&status!==item.status)return false;
  if(query&&!item.opponent.toLowerCase().includes(query)&&!item.note.toLowerCase().includes(query))return false;
  return true;
 });
 if($('chall-sort').value==='old')items.reverse();
 return items;
}
function challCounts(){
 const rows=challState.filter(x=>!x.archived);
 $('chall-incoming-count').textContent=String(rows.filter(x=>!x.outgoing&&x.status==='pending').length);
 $('chall-outgoing-count').textContent=String(rows.filter(x=>x.outgoing&&x.status==='pending').length);
 $('chall-accepted-count').textContent=String(rows.filter(x=>x.status==='accepted').length);
 $('chall-star-count').textContent=String(rows.filter(x=>x.starred).length);
}
function challButton(text,fn,emphasize=false){
 const button=document.createElement('button');button.type='button';button.textContent=text;
 if(emphasize)button.className='chall-important';
 button.addEventListener('click',async()=>{if(challBusy)return;button.disabled=true;try{await fn();}finally{button.disabled=false;}});
 return button;
}
function challReadDate(value){return safeDate(value)}
function challGameLabel(ch){return ch.game==='gomoku'?'◉ Gomoku':ch.game==='szachy'?'♔ Szachy':'♟ Warcaby'}
function challClockLabel(ch){return ch.timeLimitMinutes>0?
  ch.timeLimitMinutes+' min'+(ch.incrementSeconds?' + '+ch.incrementSeconds+' s':''): 'Bez zegara'}
function challRender(){
 challCounts();
 const rows=challRows(),list=$('challenge-list');list.replaceChildren();
 $('chall-list-heading').textContent=challTabs[challTab]||'Twoje zaproszenia';
 $('chall-result-count').textContent='Znaleziono: '+rows.length;
 for(const item of rows.slice(0,challDisplay)){
  const card=document.createElement('article');card.className='chall-card'+(!item.seen&&!item.outgoing&&item.status==='pending'?' is-new':'');
  const top=document.createElement('div');top.className='chall-card-top';
  const block=document.createElement('div');
  const title=document.createElement('div');title.className='chall-card-title';
  title.textContent=challGameLabel(item)+' · '+item.opponent+(item.starred?' ★':'');
  const sub=document.createElement('div');sub.className='chall-card-sub';
  sub.textContent=(item.outgoing?'Wysłane do znajomego':'Otrzymane od znajomego')+' · '+challReadDate(item.createdAt);
  block.append(title,sub);
  const badge=document.createElement('span');badge.className='chall-card-badge'+(item.status==='pending'?' pending':'');
  badge.textContent=challStatuses[item.status]||item.status;top.append(block,badge);
  const details=document.createElement('div');details.className='chall-card-details';
  for(const detail of [challClockLabel(item),item.status==='pending'?'Ważne do '+challReadDate(item.expiresAt):
   'Aktualizacja: '+challReadDate(item.updatedAt||item.createdAt)]){
   const el=document.createElement('span');el.textContent=detail;details.append(el);
  }
  card.append(top,details);
  if(item.note){const note=document.createElement('div');note.className='chall-card-note';note.textContent='Notatka prywatna: '+item.note;card.append(note);}
  const actions=document.createElement('div');actions.className='chall-card-actions';
  if(item.status==='pending'){
   if(item.outgoing){
    actions.append(challButton('Anuluj wyzwanie',()=>challRespond('cancel',item.id),true));
   }else{
    actions.append(challButton('Akceptuj',()=>challRespond('accept',item.id),true));
    actions.append(challButton('Odrzuć',()=>challRespond('decline',item.id)));
   }
  }
  if(item.status==='accepted'){
   const link=document.createElement('a');
   link.href=({gomoku:'/konto/gomoku/',warcaby:'/konto/warcaby/',szachy:'/konto/szachy/'})[item.game]+'?match='+encodeURIComponent(item.id);
   link.textContent='Graj online';link.className='chall-important';
   actions.append(link);
  }
  actions.append(challButton(item.starred?'Usuń gwiazdkę':'★ Ważne',
   ()=>challMeta(item.starred?'unstar':'star',item.id)));
  actions.append(challButton(item.archived?'Przywróć':'Archiwizuj',
   ()=>challMeta(item.archived?'restore':'archive',item.id)));
  actions.append(challButton('Notatka',()=>challOpenNote(item)));
  if(!item.seen)actions.append(challButton('Oznacz jako obejrzane',()=>challMeta('seen',item.id)));
  actions.append(challButton('Napisz',()=>openSocialContact('messages',item.opponent)));
  card.append(actions);list.append(card);
 }
 if(!rows.length){
  const message=document.createElement('p');message.className='friend-empty';
  message.textContent=challTab==='archive'?'Archiwum jest puste.':
   'Brak zaproszeń spełniających wybrane kryteria. Możesz wysłać nowe wyzwanie znajomemu.';
  list.append(message);
 }
 $('chall-more').hidden=rows.length<=challDisplay;
}
async function refreshChallenges(){
 if(challLoading||!sessionConfirmed)return;
 challLoading=true;
 socialNotice('challenges-state','Wczytywanie aktualnych wyzwań…');
 try{
  const result=await api('social/challenges');
  challState=result.challenges.map(c=>({...c,note:c.note||''}));
  challLastFetch=Date.now();
  challRender();
  socialNotice('challenges-state','Zaproszenia wczytane: '+challState.length+'. Akceptowanie i anulowanie zapisuje się na serwerze.');
 }catch(error){socialNotice('challenges-state',error.message,true);}
 finally{challLoading=false;}
}
async function challMeta(action,id,note=''){
 if(challBusy)return false;challBusy=true;
 try{
  await api('challenge-center/state',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({id,action,...(action==='note'?{note}:{})})});
  await refreshChallenges();
  socialNotice('challenges-state','Zapisano ustawienie zaproszenia na Twoim koncie.');
  return true;
 }catch(error){socialNotice('challenges-state',error.message,true);return false;}
 finally{challBusy=false}
}
async function challRespond(action,id){
 if(challBusy)return;challBusy=true;
 try{
  await api('social/challenges',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action,id})});
  await refreshChallenges();
  socialNotice('challenges-state',action==='accept'?'Zaproszenie przyjęte. Możesz uruchomić partię.':
   action==='decline'?'Odrzucono zaproszenie.':'Anulowano zaproszenie.');
 }catch(error){socialNotice('challenges-state',error.message,true)}
 finally{challBusy=false}
}
function challOpenNote(item){
 challNoteId=item.id;$('chall-note-input').value=item.note||'';
 $('chall-note-overlay').hidden=false;$('chall-note-input').focus();
}
function challCloseNote(){
 $('chall-note-overlay').hidden=true;challNoteId=null;
}
$('chall-note-cancel').addEventListener('click',challCloseNote);
$('chall-note-overlay').addEventListener('click',event=>{
 if(event.target===$('chall-note-overlay'))challCloseNote();
});
if(typeof document.addEventListener==='function')document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!$('chall-note-overlay').hidden)challCloseNote();
});
$('chall-note-save').addEventListener('click',async()=>{
 if(!challNoteId)return;
 const id=challNoteId,button=$('chall-note-save');button.disabled=true;
 const result=await challMeta('note',id,$('chall-note-input').value);
 if(result)challCloseNote();
 button.disabled=false;
});
document.querySelectorAll('[data-chall-tab]').forEach(button=>button.addEventListener('click',()=>challTabSelect(button.dataset.challTab)));
for(const id of ['chall-search','chall-filter-game','chall-filter-status','chall-sort']){
 $(id).addEventListener(id==='chall-search'?'input':'change',()=>{challDisplay=15;challRender();});
}
$('chall-more').addEventListener('click',()=>{challDisplay+=15;challRender()});
$('challenge-game').addEventListener('change',challUpdatePreview);
$('challenge-time').addEventListener('change',challUpdatePreview);
$('challenge-increment').addEventListener('change',challUpdatePreview);
$('challenge-friend').addEventListener('change',challUpdatePreview);
challUpdatePreview();
$('challenges-refresh').addEventListener('click',()=>void refreshChallenges());
$('chall-open-friends').addEventListener('click',()=>{switchSection('friends');fhTab('overview')});
$('chall-open-privacy').addEventListener('click',()=>{switchSection('privacy');privacyTab('trusted')});
$('chall-settings-privacy').addEventListener('click',()=>{switchSection('privacy');privacyTab('games')});
$('chall-settings-blocked').addEventListener('click',()=>{switchSection('friends');fhTab('blocked')});
$('challenge-form').addEventListener('submit',async event=>{
 event.preventDefault();
 if(challBusy)return;
 const nickname=$('challenge-friend').value,game=$('challenge-game').value;
 if(!nickname){socialNotice('challenges-state','Wybierz znajomego.',true);return}
 const timeLimitMinutes=Number($('challenge-time').value);
 const incrementSeconds=timeLimitMinutes>0?Number($('challenge-increment').value):0;
 const button=$('chall-submit');button.disabled=true;challBusy=true;
 try{
  await api('social/challenges',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'send',nickname,game,timeLimitMinutes,incrementSeconds})});
  challTabSelect('outgoing');await refreshChallenges();
  socialNotice('challenges-state','Wysłano zaproszenie do '+(game==='gomoku'?'Gomoku':game==='szachy'?'Szachów':'Warcabów')+' dla '+nickname+'.');
 }catch(error){socialNotice('challenges-state',error.message,true)}
 finally{button.disabled=false;challBusy=false}
});
if(typeof setInterval==='function')setInterval(()=>{
 if(!sessionConfirmed||challBusy||challLoading)return;
 const element=typeof document.querySelector==='function'?document.querySelector('[data-panel="challenges"]'):null;
 if(!element?.classList.contains('active'))return;
 if(typeof document.visibilityState!=='undefined'&&document.visibilityState!=='visible')return;
 if(Date.now()-challLastFetch<45000)return;
 void refreshChallenges();
},45000);

function notice(text,error=false){const n=$('notice');n.textContent=text;n.hidden=!text;n.classList.toggle('error',error);}
function switchSection(name){
 if(!sectionNames[name])return;
 document.querySelectorAll('[data-section]').forEach(e=>{e.classList.toggle('active',e.dataset.section===name);e.setAttribute('aria-current',e.dataset.section===name?'page':'false');});
 document.querySelectorAll('[data-panel]').forEach(e=>e.classList.toggle('active',e.dataset.panel===name));
 $('title').textContent=sectionNames[name][0];$('subtitle').textContent=sectionNames[name][1];
 if(name==='friends'&&sessionConfirmed)void refreshFriends();
 if(name==='security'&&sessionConfirmed)void securityLoad();
 if(name==='privacy'&&sessionConfirmed)void privacyLoad();
 if(name==='notifications'&&sessionConfirmed)void ntLoad();
 if(name==='messages'&&sessionConfirmed)void messageCenterLoad();
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
   HASLO_ZMIENIONE_PONOW_PROBE:'Hasło zostało zmienione w innej sesji. Odśwież stronę i spróbuj ponownie.',
   POPRAW_NICK:'Nick musi mieć 3–32 znaki, zaczynać się literą i zawierać tylko litery, cyfry, kropki, podkreślenia lub łączniki.',
   NICK_BEZ_ZMIAN:'To jest Twój obecny nick.',
   NICK_ZAJETY:'Ten nick jest już zajęty. Wybierz inny.'
  };
  const error=new Error(messages[body.error]||(response.status===401?'Sesja wygasła. Zaloguj się ponownie.':
   'Nie udało się wykonać operacji. Spróbuj ponownie.'));
  error.status=response.status;error.code=body.error;throw error;
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

function showPasswordSuccessModal(revokedCount){
 const overlay=$('pw-success-overlay');
 const count=Number.isSafeInteger(revokedCount)&&revokedCount>=0?revokedCount:0;
 $('pw-success-message').textContent=count>0
  ?'Twoje nowe hasło jest aktywne. Ze względów bezpieczeństwa wylogowano inne sesje: '+count+'.'
  :'Twoje nowe hasło jest aktywne. Konto zostało zabezpieczone.';
 overlay.hidden=false;
 document.body.classList.add('pw-success-open');
 $('pw-success-close').focus();
}
function closePasswordSuccessModal(){
 $('pw-success-overlay').hidden=true;
 document.body.classList.remove('pw-success-open');
 $('pw-change-submit').focus();
}
$('pw-success-close').addEventListener('click',closePasswordSuccessModal);
$('pw-success-overlay').addEventListener('click',event=>{
 if(event.target===$('pw-success-overlay'))closePasswordSuccessModal();
});
if(typeof document.addEventListener==='function')document.addEventListener('keydown',event=>{
 if($('pw-success-overlay').hidden)return;
 if(event.key==='Escape'){event.preventDefault();closePasswordSuccessModal();}
 if(event.key==='Tab'){event.preventDefault();$('pw-success-close').focus();}
});

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
  showPasswordSuccessModal(result.otherSessionsRevoked);
 }catch(error){label.textContent=error.message;}
 finally{save.disabled=false;}
});

$('nick-change-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const form=$('nick-change-form'),save=$('nick-change-submit'),label=$('nick-change-status');
 if(!sessionConfirmed){label.textContent='Zaloguj się ponownie, aby zmienić nick.';return;}
 const nickname=$('nick-next').value.trim(),currentPassword=$('nick-password').value;
 if(!/^[a-z][a-z0-9._-]{2,31}$/i.test(nickname)){label.textContent='Nick musi mieć 3–32 znaki, zaczynać się literą i zawierać tylko litery, cyfry, kropki, podkreślenia lub łączniki.';return;}
 if(nickname===profileSnapshot?.nickname){label.textContent='To jest Twój obecny nick.';return;}
 if(!currentPassword){label.textContent='Potwierdź zmianę obecnym hasłem.';return;}
 save.disabled=true;label.textContent='Bezpieczne zapisywanie nowego nicku…';
 try{
  const result=await api('change-nickname',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({nickname,currentPassword})});
  form.reset();$('nick-password').type='password';
  label.textContent='Nick zmieniono na '+result.nickname+'. Loguj się nowym nickiem albo adresem e-mail.';
  notice('Nick został zmieniony na '+result.nickname+'.');
  try{fill((await api('profile')).profile);}catch{}
 }catch(error){
  label.textContent=error.message;
  if(error.code==='BRAK_SESJI')accessState('Zaloguj się do konta','Sesja wygasła. Zaloguj się ponownie, aby zmienić nick.',{login:true});
 }
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
let logoutInProgress=false;
async function logout(){
 if(logoutInProgress)return;
 logoutInProgress=true;
 // Use the authenticated account nickname, never a query parameter or editable form value.
 const nickname=profileSnapshot?.nickname||'Graczu';
 try{
  await api('logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  sessionConfirmed=false;
  profileSnapshot=null;centerState=null;
  $('logout-farewell-nick').textContent=nickname;
  $('player-shell').hidden=true;
  $('access-screen').hidden=true;
  $('logout-farewell').hidden=false;
  $('logout-farewell-login').focus();
  setTimeout(()=>location.replace('https://gracz.pl/'),15000);
 }catch(error){
  logoutInProgress=false;
  notice(error.message,true);
 }
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


// Friends Hub Full Max Premium — account-scoped address book, lazy loaded.
let abState={contacts:[],groups:[],total:0,page:0,pageSize:60},abReady=false,abSearchTimer=null;
function fhUpdateFromFriends(result){
 const badge=$('fh-requests-badge');
 if(!badge)return;
 const incoming=(result.connections||[]).filter(x=>x.status==='pending'&&x.direction==='incoming').length;
 badge.textContent=incoming?'('+incoming+')':'';
}
function fhTab(tab,skipLoad=false){
 for(const b of document.querySelectorAll('[data-fh-tab]')){
  const active=b.dataset.fhTab===tab;b.classList.toggle('active',active);
  b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;
 }
 for(const pane of document.querySelectorAll('[data-fh-pane]'))pane.hidden=pane.dataset.fhPane!==tab;
 if(tab==='book'&&sessionConfirmed&&!skipLoad)void abLoad(0);
}
document.querySelectorAll('[data-fh-tab]').forEach(b=>b.addEventListener('click',()=>fhTab(b.dataset.fhTab)));
function abMessage(text){$('ab-status').textContent=text}
const abErrors={TYLKO_ZNAJOMI:'Powiązać można wyłącznie zaakceptowanego, niezablokowanego znajomego.',
 POPRAW_DANE_KONTAKTU:'Sprawdź dane: nazwa, etykiety, e-mail, telefon i maksymalną długość notatki.',
 KONTAKT_JUZ_ISTNIEJE:'Ten znajomy jest już w Twojej książce. Odszukaj go i edytuj wpis.',
 KONTAKT_NIE_ZNALEZIONY:'Kontakt został już usunięty lub jest niedostępny.',
 LIMIT_KONTAKTOW:'Osiągnięto limit 2000 kontaktów w książce.',
 BRAK_SESJI:'Sesja wygasła. Zaloguj się ponownie.',
 ZBYT_WIELE_PROB:'Zbyt wiele operacji. Spróbuj ponownie później.'};
async function abApi(path,options={}){
 const res=await fetch('/auth/'+path,{credentials:'same-origin',cache:'no-store',
  headers:{Accept:'application/json',...(options.headers||{})},...options});
 let data={};try{data=await res.json()}catch{}
 if(!res.ok||!data.ok)throw Error(abErrors[data.error]||'Nie udało się zapisać lub pobrać kontaktów.');
 return data;
}
function abValueText(id){return $(id).value.trim()}
function abReset(focus=false){
 $('ab-form').reset();$('ab-id').value='';$('ab-group').value='Bez grupy';
 $('ab-nickname').disabled=false;$('ab-delete').hidden=true;
 $('ab-form-title').textContent='Dodaj kontakt';$('ab-form-status').textContent='Twoja prywatna wizytówka.';
 if(focus)$('ab-name').focus();
}
function abPopulate(entry){
 $('ab-id').value=entry.id||'';
 $('ab-name').value=entry.name||'';
 $('ab-nickname').value=entry.nickname||'';
 $('ab-nickname').disabled=Boolean(entry.id);
 $('ab-email').value=entry.email||'';$('ab-phone').value=entry.phone||'';
 $('ab-note').value=entry.note||'';$('ab-group').value=entry.group||'Bez grupy';
 $('ab-tags').value=(entry.tags||[]).join(', ');
 $('ab-favorite').checked=entry.favorite===true;
 $('ab-delete').hidden=!entry.id;
 $('ab-form-title').textContent='Edytuj: '+(entry.name||'Kontakt');
 $('ab-form-status').textContent='Notatki i dane kontaktowe są prywatne.';
 $('ab-form').scrollIntoView({behavior:'smooth',block:'nearest'});
 $('ab-name').focus();
}
function abRead(){
 const tags=[...new Set(abValueText('ab-tags').split(',').map(x=>x.trim()).filter(Boolean))];
 if(tags.length>8||tags.some(x=>x.length>24))throw Error('Podaj maksymalnie 8 etykiet, każda do 24 znaków.');
 const item={name:abValueText('ab-name'),nickname:abValueText('ab-nickname'),
  email:abValueText('ab-email'),phone:abValueText('ab-phone'),
  note:abValueText('ab-note'),group:abValueText('ab-group')||'Bez grupy',
  tags,favorite:$('ab-favorite').checked};
 if(!item.name||item.name.length>64)throw Error('Podaj nazwę kontaktu do 64 znaków.');
 const id=$('ab-id').value;if(id)item.id=id;
 return item;
}
function abControl(label,callback,disabled=false){
 const btn=document.createElement('button');btn.type='button';btn.textContent=label;btn.disabled=disabled;
 if(!disabled)btn.addEventListener('click',callback);
 return btn;
}
function abTagChip(text){
 const chip=document.createElement('span');chip.textContent=text;return chip;
}
function abRender(){
 const container=$('ab-list');container.replaceChildren();
 $('ab-total').textContent=String(abState.total);
 $('ab-groups-count').textContent=String(abState.groups.length);
 $('ab-favorites-count').textContent=String(abState.favoritesTotal||0);
 $('ab-prev').disabled=abState.page<=0;
 $('ab-next').disabled=(abState.page+1)*abState.pageSize>=abState.total;
 $('ab-page-status').textContent=abState.total?'Strona '+(abState.page+1)+' / '+Math.ceil(abState.total/abState.pageSize):'Brak kontaktów';
 if(!abState.contacts.length){
  const p=document.createElement('p');p.className='friend-empty';p.textContent=
   'Nie znaleziono kontaktów. Dodaj pierwszy wpis lub zmień filtry.';container.append(p);
 }
 for(const item of abState.contacts){
  const card=document.createElement('article');card.className='friendshub-contact';
  const top=document.createElement('div');top.className='friendshub-contact-head';
  const title=document.createElement('strong');title.className='friendshub-contact-name';
  title.textContent=(item.favorite?'★ ':'')+item.name;top.append(title);
  const group=document.createElement('span');group.className='friendshub-contact-sub';group.textContent=item.group;
  top.append(group);card.append(top);
  const sub=document.createElement('div');sub.className='friendshub-contact-sub';
  sub.textContent=item.linked?
   '@'+item.nickname+(item.connected?' · Znajomy GRACZ.PL':' · Brak aktywnej znajomości'):
   'Prywatny kontakt · bez połączenia z kontem gracza';
  card.append(sub);
  if(item.tags.length){
   const tags=document.createElement('div');tags.className='friendshub-contact-badge';
   for(const label of item.tags)tags.append(abTagChip(label));
   card.append(tags);
  }
  const controls=document.createElement('div');controls.className='friendshub-contact-controls';
  controls.append(abControl('Edytuj',()=>abPopulate(item)));
  controls.append(abControl(item.favorite?'Usuń ★':'Ulubione ★',async()=>{
   try{
    await abApi('address-book',{method:'PUT',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({...item,id:item.id,group:item.group,favorite:!item.favorite})});
    await abLoad(abState.page);
   }catch(e){abMessage(e.message)}
  }));
  if(item.connected){
   controls.append(abControl('Napisz',()=>void openSocialContact('messages',item.nickname)));
   controls.append(abControl('Zaproś do gry',()=>void openSocialContact('challenges',item.nickname)));
  }
  card.append(controls);container.append(card);
 }
}
function abRenderGroups(){
 const select=$('ab-group-filter'),current=select.value;
 const fixed=document.createElement('option');fixed.value='';fixed.textContent='Wszystkie grupy';
 select.replaceChildren(fixed);
 const chips=$('ab-group-chips');chips.replaceChildren();
 for(const item of abState.groups){
  const opt=document.createElement('option');opt.value=item.name;opt.textContent=item.name+' ('+item.count+')';select.append(opt);
  const chip=abControl(item.name+' · '+item.count,()=>{select.value=item.name;void abLoad(0)});
  chip.setAttribute('aria-pressed',String(current===item.name));chips.append(chip);
 }
 select.value=abState.groups.some(x=>x.name===current)?current:'';
 for(const c of chips.children)c.setAttribute('aria-pressed',String(c.textContent.startsWith(select.value+' · ')&&select.value!==''));
}
async function abLoad(page=0){
 if(!sessionConfirmed)return;
 const query=new URLSearchParams({page:String(page),query:abValueText('ab-search'),
  group:$('ab-group-filter').value,favorites:$('ab-favorites-filter').checked?'1':'0'});
 abMessage('Wczytywanie prywatnej książki adresowej…');
 try{
  const data=await abApi('address-book?'+query.toString());
  abState=data;abReady=true;abRender();abRenderGroups();
  abMessage('Kontakty wczytane. Edycja wpisów nie zmienia listy znajomych ani ustawień innych graczy.');
 }catch(e){abMessage(e.message)}
}
async function abOpenFriend(nickname){
 $('ab-search').value=nickname;
 fhTab('book',true);
 $('ab-group-filter').value='';
 $('ab-favorites-filter').checked=false;
 await abLoad(0);
 const found=abState.contacts.find(x=>x.linked&&x.nickname.toLowerCase()===nickname.toLowerCase());
 if(found){abPopulate(found);return}
 abReset();
 $('ab-nickname').value=nickname;$('ab-name').value=nickname;
 $('ab-form-title').textContent='Dodaj znajomego: '+nickname;
 $('ab-name').focus();
}
$('ab-new').addEventListener('click',()=>{fhTab('book');abReset(true)});
$('ab-cancel').addEventListener('click',()=>abReset(true));
$('ab-refresh').addEventListener('click',()=>void abLoad(abState.page));
$('ab-prev').addEventListener('click',()=>void abLoad(Math.max(0,abState.page-1)));
$('ab-next').addEventListener('click',()=>void abLoad(abState.page+1));
$('ab-group-filter').addEventListener('change',()=>void abLoad(0));
$('ab-favorites-filter').addEventListener('change',()=>void abLoad(0));
$('ab-search').addEventListener('input',()=>{
 if(abSearchTimer)clearTimeout(abSearchTimer);
 abSearchTimer=setTimeout(()=>void abLoad(0),260);
});
$('ab-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const button=$('ab-save');if(!sessionConfirmed)return;
 let record;try{record=abRead()}catch(e){$('ab-form-status').textContent=e.message;return}
 button.disabled=true;$('ab-form-status').textContent='Zapisywanie…';
 try{
  await abApi('address-book',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)});
  abReset();$('ab-form-status').textContent='Kontakt zapisany. Tylko Ty widzisz te informacje.';
  await abLoad(0);
 }catch(e){$('ab-form-status').textContent=e.message}
 finally{button.disabled=false}
});
$('ab-delete').addEventListener('click',async()=>{
 const id=$('ab-id').value;if(!id)return;
 if(!window.confirm('Usunąć prywatną wizytówkę z książki adresowej? To nie usuwa znajomości ani wiadomości.'))return;
 const button=$('ab-delete');button.disabled=true;
 try{
  await abApi('address-book',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
  abReset();await abLoad(0);abMessage('Wpis został usunięty z Twojej książki.');
 }catch(e){$('ab-form-status').textContent=e.message}
 finally{button.disabled=false}
});
$('ab-export').addEventListener('click',async()=>{
 if(!window.confirm('Eksport zawiera prywatne dane, w tym notatki i telefony. Zapisz plik w bezpiecznym miejscu. Kontynuować?'))return;
 const button=$('ab-export');button.disabled=true;
 try{
  const contacts=[];
  for(let page=0;page<34;page++){
   const d=await abApi('address-book?page='+page);
   contacts.push(...d.contacts);
   if(contacts.length>=d.total||!d.contacts.length)break;
  }
  const data={format:'gracz-address-book-v1',exportedAt:new Date().toISOString(),contacts};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='gracz-pl-prywatna-ksiazka-adresowa.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  abMessage('Przygotowano prywatną kopię '+contacts.length+' kontaktów.');
 }catch(e){abMessage(e.message)}
 finally{button.disabled=false}
});
$('ab-import-trigger').addEventListener('click',()=>$('ab-import-file').click());
$('ab-import-file').addEventListener('change',async event=>{
 const file=event.target.files?.[0];event.target.value='';
 if(!file)return;
 if(file.size>2*1024*1024){abMessage('Plik jest za duży (maksymalnie 2 MB).');return}
 let items;
 try{
  const data=JSON.parse(await file.text());
  if(data.format!=='gracz-address-book-v1'||!Array.isArray(data.contacts))throw Error('Nieobsługiwany format');
  items=data.contacts.slice(0,40);
  if(!items.length)throw Error('Brak kontaktów w pliku');
 }catch(e){abMessage('Nieprawidłowy plik książki adresowej: '+e.message);return}
 if(!window.confirm('Zaimportować do 40 kontaktów? Istniejące wpisy nie będą nadpisywane. Dane z pliku zostaną zapisane wyłącznie na Twoim koncie.'))return;
 let ok=0,failed=0;
 for(const item of items){
  try{
   await abApi('address-book',{method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name:item.name,nickname:item.linked?item.nickname||'':'',
     email:item.email||'',phone:item.phone||'',note:item.note||'',
     group:item.group||'Bez grupy',tags:item.tags||[],favorite:item.favorite===true})});
   ok++;
  }catch{failed++}
 }
 await abLoad(0);abMessage('Import zakończony: '+ok+' zapisanych, '+failed+' pominiętych (duplikaty lub niedozwolone powiązania).');
});


// Full Max Premium Security Center — bound only to server-authenticated session data.
let secState=null,secLoading=false,secTab='overview';
const secLabels={
 login_success:'Udane logowanie',password_changed:'Hasło zostało zmienione',
 other_sessions_revoked:'Wylogowano inne urządzenia',session_revoked:'Zakończono sesję',
 preferences_updated:'Zmieniono ustawienia alertów'
};
function securityNotice(message,error=false){
 const el=$('sec-status');el.textContent=message;el.classList.toggle('sec-error',error);
}
function securityTab(name){
 secTab=name;
 document.querySelectorAll('[data-sec-tab]').forEach(button=>{
  const selected=button.dataset.secTab===name;
  button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));
  button.tabIndex=selected?0:-1;
 });
 document.querySelectorAll('[data-sec-pane]').forEach(p=>p.hidden=p.dataset.secPane!==name);
}
document.querySelectorAll('[data-sec-tab]').forEach(button=>button.addEventListener('click',()=>securityTab(button.dataset.secTab)));
function securityDate(value){
 if(!value)return 'Brak daty';
 const d=new Date(value);
 return Number.isFinite(d.getTime())?d.toLocaleString('pl-PL',{dateStyle:'medium',timeStyle:'short'}):'Brak daty';
}
function securityButton(label,run){
 const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=label;
 b.addEventListener('click',()=>void run(b));return b;
}
function securityRenderDevices(){
 const rows=secState?.sessions||[],out=$('sec-device-list');out.replaceChildren();
 $('sec-session-count').textContent=String(rows.length);
 const others=rows.filter(x=>!x.current);
 $('sec-revoke-quick').disabled=others.length===0;
 $('sec-revoke-others').disabled=others.length===0;
 if(!rows.length){const p=document.createElement('p');p.textContent='Nie znaleziono aktywnych sesji.';out.append(p);return}
 for(const session of rows){
  const item=document.createElement('article');item.className='sec-device-item';
  const body=document.createElement('div'),title=document.createElement('strong'),time=document.createElement('small');
  title.textContent=session.label||(session.current?'Bieżąca przeglądarka':'Inna przeglądarka');
  time.textContent='Utworzona: '+securityDate(session.createdAt)+' · ważna do: '+securityDate(session.expiresAt);
  body.append(title,time);item.append(body);
  if(session.current){
   const badge=document.createElement('span');badge.className='sec-device-current';
   badge.textContent='BIEŻĄCA SESJA';item.append(badge);
  }else{
   item.append(securityButton('Zakończ sesję',async button=>{
    button.disabled=true;
    try{
     await api('security-center/revoke-session',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:session.id})});
     await Promise.all([securityLoad(),refreshCenter()]);
     securityNotice('Wybrana sesja została zakończona.');
    }catch(error){securityNotice(error.message,true);}
    finally{button.disabled=false}
   }));
  }
  out.append(item);
 }
}
function securityRenderEvents(){
 const history=secState?.events||[],filter=$('sec-event-filter').value;
 const output=$('sec-event-list');output.replaceChildren();
 const visible=history.filter(event=>filter==='all'||event.code===filter);
 $('sec-last-event').textContent=history.length?(secLabels[history[0].code]||'Zdarzenie'):'Brak zdarzeń';
 $('sec-history-note').textContent=secState?.historyNote||'Historia wybranych zdarzeń od uruchomienia modułu.';
 if(!visible.length){
  const p=document.createElement('p');p.className='sec-inline-note';p.textContent='Brak zapisanych zdarzeń dla tego filtra.';output.append(p);return;
 }
 for(const event of visible){
  const item=document.createElement('article');item.className='sec-event-item';
  const isHighlighted=(event.code==='login_success'&&secState.preferences.newSessionAlert)||
   (event.code==='password_changed'&&secState.preferences.passwordAlert);
  if(isHighlighted)item.classList.add('sec-event-highlight');
  const body=document.createElement('div'),strong=document.createElement('strong'),time=document.createElement('small');
  strong.textContent=(isHighlighted?'◆ ':'')+(secLabels[event.code]||'Zdarzenie konta');
  time.textContent=securityDate(event.at);
  body.append(strong,time);item.append(body);output.append(item);
 }
}
function securityPaint(){
 if(!secState)return;
 $('sec-email-status').textContent=secState.verifiedEmail?'Potwierdzony':'Niepotwierdzony';
 $('sec-alert-logins').checked=secState.preferences.newSessionAlert;
 $('sec-alert-password').checked=secState.preferences.passwordAlert;
 $('sec-alert-note').textContent=secState.notificationsNote||'Alerty w panelu, bez e-mail i SMS.';
 securityRenderDevices();securityRenderEvents();
}
async function securityLoad(){
 if(!sessionConfirmed||secLoading)return;
 secLoading=true;securityNotice('Sprawdzanie ustawień bezpieczeństwa…');
 try{
  secState=await api('security-center');
  securityPaint();
  securityNotice('Dane bezpieczeństwa pobrano z Twojego konta.');
 }catch(error){securityNotice(error.message,true)}
 finally{secLoading=false}
}
async function securityRevokeOthers(button){
 if(!sessionConfirmed)return;
 button.disabled=true;
 try{
  const res=await api('security-center/revoke-others',{method:'POST',
   headers:{'Content-Type':'application/json'},body:'{}'});
  await Promise.all([securityLoad(),refreshCenter()]);
  securityNotice('Zakończono inne sesje: '+res.revoked+'. Bieżąca sesja pozostała aktywna.');
 }catch(error){securityNotice(error.message,true)}
 finally{button.disabled=false}
}
$('sec-revoke-quick').addEventListener('click',()=>void securityRevokeOthers($('sec-revoke-quick')));
$('sec-revoke-others').addEventListener('click',()=>void securityRevokeOthers($('sec-revoke-others')));
$('sec-devices-refresh').addEventListener('click',()=>void securityLoad());
$('sec-history-refresh').addEventListener('click',()=>void securityLoad());
$('sec-event-filter').addEventListener('change',securityRenderEvents);
function securityOpenPassword(){
 switchSection('profile');
 const target=$('profile-password-section');
 if(target){target.scrollIntoView({behavior:'smooth',block:'center'});$('pw-current').focus({preventScroll:true})}
}
$('sec-change-password').addEventListener('click',securityOpenPassword);
$('sec-recovery-password').addEventListener('click',securityOpenPassword);
$('sec-recovery-devices').addEventListener('click',()=>securityTab('devices'));
$('sec-alert-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!sessionConfirmed)return;
 const button=$('sec-alert-save'),status=$('sec-alert-status');
 button.disabled=true;status.textContent='Zapisywanie…';
 try{
  secState=await api('security-center',{method:'PUT',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({newSessionAlert:$('sec-alert-logins').checked,
    passwordAlert:$('sec-alert-password').checked})});
  securityPaint();status.textContent='Ustawienia zapisane na Twoim koncie.';
  securityNotice('Zaktualizowano ustawienia wyróżniania zdarzeń w panelu.');
 }catch(error){status.textContent=error.message}
 finally{button.disabled=false}
});
$('sec-export-events').addEventListener('click',()=>{
 if(!secState){securityNotice('Najpierw pobierz historię zdarzeń.',true);return;}
 const rows=[['Rodzaj','Data'],...secState.events.map(event=>
  [secLabels[event.code]||'Zdarzenie',securityDate(event.at)])];
 const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='gracz-pl-historia-bezpieczenstwa.csv';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 securityNotice('Wyeksportowano dostępne zdarzenia bezpieczeństwa.');
});


// Full Max Premium Privacy Center — one source of truth, server-enforced policies.
const privacyFields=['discoverable','friendRequests','friendMessages','gameInvites','showOnline',
 'exactSearchOnly','mutualFriendsOnlyRequests','trustedMessagesOnly','trustedInvitesOnly','trustedPresenceOnly',
 'publicProfile','showStats','showCountry','showBadges',
 'showDisplayName','showBio','showMotto','showJoined','showCity','showWinRate'];
let privacySource=null,privacyLoading=false,privacyTabName='overview',privacySaving=false;
function privacyTab(name){
 privacyTabName=name;
 for(const button of document.querySelectorAll('[data-priv-tab]')){
  const active=button.dataset.privTab===name;button.classList.toggle('active',active);
  button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
 }
 for(const pane of document.querySelectorAll('[data-priv-pane]'))pane.hidden=pane.dataset.privPane!==name;
}
function privacyNotice(message,error=false){
 const item=$('priv-status');item.textContent=message;item.classList.toggle('priv-error',error);
}
function privacyValues(){
 const out={};for(const key of privacyFields)out[key]=$('priv-'+key).checked;
 return out;
}
function privacyFill(values){
 for(const key of privacyFields)$('priv-'+key).checked=values[key]===true;
 privacyRepaint();
}
function privacyDirty(){
 if(!privacySource)return false;
 const current=privacyValues();
 return privacyFields.some(key=>privacySource[key]!==current[key]);
}
function privacyRepaint(){
 const x=privacyValues();
 $('priv-metric-profile').textContent=x.publicProfile?'Publiczny':'Prywatny';
 $('priv-metric-search').textContent=x.discoverable?'Widoczny':'Ukryty';
 $('priv-metric-online').textContent=x.showOnline?'Widoczny':'Niewidoczny';
 $('priv-metric-contact').textContent=
  [x.friendRequests,x.friendMessages,x.gameInvites].filter(Boolean).length+'/3 włączone';
 const state=$('priv-save-state');
 state.textContent=!privacySource?'Nie wczytano ustawień':privacyDirty()?'Masz niezapisane zmiany':'Wszystkie ustawienia zapisane';
 $('priv-save').disabled=!privacySource||!privacyDirty()||privacySaving;
 $('priv-reset').disabled=!privacySource||!privacyDirty()||privacySaving;
 const badge=$('priv-showBadges');
 badge.disabled=!x.showStats;
 badge.closest('.priv-option').title=!x.showStats?'Odznaki są publiczne tylko przy włączonych statystykach':'';
 $('priv-showCity').disabled=!x.showCountry;
 $('priv-showWinRate').disabled=!x.showStats;
 $('priv-showCity').closest('.priv-option').title=!x.showCountry?'Najpierw włącz ujawnianie kraju i lokalizacji':'';
 $('priv-showWinRate').closest('.priv-option').title=!x.showStats?'Najpierw włącz statystyki publiczne':'';
 document.querySelectorAll('[data-priv-tab]').forEach(b=>{
  const pane=b.dataset.privTab;
  if(pane==='trusted')b.title='Zaufane kontakty działają na podstawie gwiazdki w książce adresowej';
 });
}
async function privacyLoad(){
 if(!sessionConfirmed||privacyLoading||privacySaving)return;
 privacyLoading=true;privacyNotice('Wczytywanie ustawień z konta…');
 try{
  const result=await api('privacy-center');
  privacySource=result.preferences;privacyFill(privacySource);
  privacyNotice('Ustawienia wczytane z serwera. Wprowadź zmiany i wybierz „Zapisz ustawienia”.');
 }catch(error){privacyNotice(error.message,true)}
 finally{privacyLoading=false}
}
for(const key of privacyFields)$('priv-'+key).addEventListener('change',privacyRepaint);
document.querySelectorAll('[data-priv-tab]').forEach(button=>button.addEventListener('click',()=>privacyTab(button.dataset.privTab)));
document.querySelectorAll('[data-priv-goto]').forEach(button=>button.addEventListener('click',()=>privacyTab(button.dataset.privGoto)));
const privacyPresets={
 private:{discoverable:false,friendRequests:false,friendMessages:false,gameInvites:false,showOnline:false,
  exactSearchOnly:true,mutualFriendsOnlyRequests:true,trustedMessagesOnly:true,
  trustedInvitesOnly:true,trustedPresenceOnly:true,
  publicProfile:false,showStats:false,showCountry:false,showBadges:false,
  showDisplayName:false,showBio:false,showMotto:false,showJoined:false,showCity:false,showWinRate:false},
 friends:{discoverable:true,friendRequests:true,friendMessages:true,gameInvites:true,showOnline:true,
  exactSearchOnly:true,mutualFriendsOnlyRequests:false,trustedMessagesOnly:false,
  trustedInvitesOnly:false,trustedPresenceOnly:false,
  publicProfile:false,showStats:false,showCountry:false,showBadges:false,
  showDisplayName:true,showBio:false,showMotto:false,showJoined:false,showCity:false,showWinRate:false},
 open:{discoverable:true,friendRequests:true,friendMessages:true,gameInvites:true,showOnline:true,
  exactSearchOnly:false,mutualFriendsOnlyRequests:false,trustedMessagesOnly:false,
  trustedInvitesOnly:false,trustedPresenceOnly:false,
  publicProfile:true,showStats:true,showCountry:false,showBadges:true,
  showDisplayName:true,showBio:true,showMotto:true,showJoined:true,showCity:true,showWinRate:true}
};
document.querySelectorAll('[data-priv-preset]').forEach(button=>button.addEventListener('click',()=>{
 if(!privacySource){privacyNotice('Najpierw wczytaj zapisane ustawienia.',true);return;}
 privacyFill(privacyPresets[button.dataset.privPreset]);
 privacyNotice('Wybrano zestaw ustawień. Aby go włączyć, kliknij „Zapisz ustawienia”.');
}));
$('priv-reset').addEventListener('click',()=>{
 if(!privacySource)return;privacyFill(privacySource);
 privacyNotice('Przywrócono ostatnio zapisane ustawienia.');
});
$('priv-save').addEventListener('click',async()=>{
 if(!sessionConfirmed||!privacySource||privacySaving)return;
 privacySaving=true;privacyRepaint();privacyNotice('Bezpieczne zapisywanie ustawień…');
 try{
  const result=await api('privacy-center',{method:'PUT',headers:{'Content-Type':'application/json'},
   body:JSON.stringify(privacyValues())});
  privacySource=result.preferences;privacyFill(privacySource);
  if(typeof window!=='undefined')window.dispatchEvent(new Event('gracz:privacy-updated'));
  privacyNotice('Ustawienia prywatności zostały zapisane na Twoim koncie.');
 }catch(error){privacyNotice(error.message,true)}
 finally{privacySaving=false;privacyRepaint()}
});
function privacyFriends(tab){
 switchSection('friends');fhTab(tab);
}
$('priv-manage-friends').addEventListener('click',()=>privacyFriends('overview'));
$('priv-manage-blocks').addEventListener('click',()=>privacyFriends('blocked'));
$('priv-trusted-manage').addEventListener('click',()=>privacyFriends('book'));
$('priv-trusted-blocks').addEventListener('click',()=>privacyFriends('blocked'));
$('priv-open-addressbook').addEventListener('click',()=>privacyFriends('book'));
$('priv-open-friends').addEventListener('click',()=>privacyFriends('book'));
$('priv-open-security').addEventListener('click',()=>switchSection('security'));
$('priv-open-editor').addEventListener('click',()=>switchSection('profile'));
$('priv-edit-card').addEventListener('click',()=>switchSection('profile'));
$('priv-preview-profile').addEventListener('click',async()=>{
 if(!privacySource?.publicProfile){
  privacyNotice('Twój profil publiczny jest wyłączony. Najpierw włącz go i zapisz ustawienia.');return;
 }
 try{
  const data=await api('profile/premium');
  if(typeof data.publicUrl==='string'&&data.publicUrl.startsWith('/konto/profil/'))
   window.open(data.publicUrl,'_blank','noopener,noreferrer');
 }catch(error){privacyNotice(error.message,true)}
});
$('priv-export').addEventListener('click',async()=>{
 if(!sessionConfirmed)return;
 const status=$('priv-export-status'),button=$('priv-export');
 button.disabled=true;status.textContent='Przygotowywanie prywatnego eksportu…';
 try{
  const data=await api('privacy-center/export');
  const link=document.createElement('a');
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  link.href=url;link.download='gracz-pl-prywatnosc-ustawienia.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='Pobrano ustawienia i podstawowe dane profilu. Plik może zawierać adres e-mail — przechowuj go bezpiecznie.';
 }catch(error){status.textContent=error.message}
 finally{button.disabled=false}
});


// Full Max Premium Notifications Center — server-authorized feed and per-account state.
let ntData=null,ntSelected='all',ntShowing=20,ntBusy=false,ntSettingsDirty=false;
const ntCategories={messages:'Wiadomości',friends:'Znajomi',games:'Gry',security:'Bezpieczeństwo'};
const ntSymbols={messages:'✉',friends:'♙',games:'♟',security:'◇'};
const ntSettingsKeys=['messages','friends','games','highlightUnread','showNicknames','showDates','autoReadOnOpen'];
const ntTabTitles={all:'Wszystkie powiadomienia',unread:'Nieprzeczytane',messages:'Wiadomości',friends:'Znajomi',
 games:'Gry i wyzwania',security:'Bezpieczeństwo',archive:'Archiwum'};
const ntNav=typeof document.querySelector==='function'?
 document.querySelector('[data-section="notifications"]'):null;
const ntNavCount=ntNav&&typeof document.createElement==='function'?
 document.createElement('span'):null;
if(ntNavCount){
 ntNavCount.className='notif-nav-count';ntNavCount.hidden=true;
 ntNavCount.style.cssText='display:none;margin-left:7px;border-radius:12px;padding:3px 6px;color:#052c35;background:#f6ce7c;font-size:10px;font-weight:900';
 ntNav.append(ntNavCount);
}
function ntMessage(message,error=false){
 const target=$('nt-feedback');target.textContent=message;target.classList.toggle('error',error);
}
function ntDate(timestamp){
 const date=new Date(timestamp);
 return Number.isFinite(date.getTime())?date.toLocaleString('pl-PL',{dateStyle:'medium',timeStyle:'short'}):'';
}
function ntPrefsToForm(){
 if(!ntData)return;
 for(const key of ntSettingsKeys)$('nt-set-'+key).checked=ntData.preferences[key]===true;
 const until=ntData.preferences.mutedUntil?new Date(ntData.preferences.mutedUntil).getTime():0;
 const rem=Math.max(0,Math.ceil((until-Date.now())/60000));
 $('nt-mute').value=rem===0?'0':rem<=60?'60':rem<=480?'480':'1440';
 ntSettingsDirty=false;
 ntPaintMute();
}
function ntPaintMute(){
 const until=ntData?.preferences?.mutedUntil;
 $('nt-mute-note').textContent=until?
  'Wyciszenie obowiązuje do '+ntDate(until)+'. Zdarzenia nadal pozostają w skrzynce.':
  'Bez wyciszenia. Wyciszenie ogranicza wyłącznie podświetlenia, nie usuwa wiadomości.';
}
function ntSettingsFormValues(){
 const values={};for(const key of ntSettingsKeys)values[key]=$('nt-set-'+key).checked;
 values.muteMinutes=Number($('nt-mute').value);return values;
}
function ntTab(name){
 ntSelected=name;ntShowing=20;
 document.querySelectorAll('[data-nt-tab]').forEach(button=>{
  const active=button.dataset.ntTab===name;button.classList.toggle('active',active);
  button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
 });
 for(const pane of document.querySelectorAll('[data-nt-view]'))pane.hidden=pane.dataset.ntView!==(name==='settings'?'settings':'inbox');
 if(name!=='settings')ntRender();
}
function ntVisibleItems(){
 if(!ntData)return [];
 const text=$('nt-search').value.trim().toLowerCase();
 const days=Number($('nt-period').value);
 const threshold=Date.now()-days*86400000;
 const rows=ntData.items.filter(item=>{
  if(ntSelected==='archive'){if(!item.archived)return false}
  else{
   if(item.archived)return false;
   if(ntSelected==='unread'&&item.read)return false;
   if(ntCategories[ntSelected]&&item.category!==ntSelected)return false;
  }
  if(new Date(item.at).getTime()<threshold)return false;
  if(text&&!([item.title,item.actor,item.detail,ntCategories[item.category]||''].join(' ').toLowerCase().includes(text)))return false;
  return true;
 });
 if($('nt-sort').value==='old')rows.reverse();
 return rows;
}
function ntUpdateMetrics(){
 if(!ntData)return;
 const rows=ntData.items,inbox=rows.filter(x=>!x.archived);
 const unread=inbox.filter(x=>!x.read).length;
 $('nt-unread').textContent=String(unread);
 $('nt-inbox-total').textContent=String(inbox.length);
 $('nt-archive-total').textContent=String(rows.length-inbox.length);
 const start=new Date();start.setHours(0,0,0,0);
 $('nt-today').textContent=String(rows.filter(x=>new Date(x.at)>=start).length);
 if(ntNavCount){
  ntNavCount.textContent=unread>99?'99+':String(unread);
  ntNavCount.hidden=unread===0;
  ntNavCount.style.display=unread===0?'none':'inline-block';
 }
}
function ntButton(label,onClick){
 const button=document.createElement('button');button.type='button';button.textContent=label;
 button.addEventListener('click',onClick);return button;
}
function ntOpenTarget(item){
 if(!item)return;
 if(item.category==='messages'){
  switchSection('messages');
  if(item.actor)void openSocialContact('messages',item.actor);
 }else if(item.category==='friends'){
  switchSection('friends');fhTab(item.title==='Zaproszenie do znajomych'?'requests':'overview');
 }else if(item.category==='games'){
  switchSection('challenges');
 }else if(item.category==='security'){
  switchSection('security');securityTab('history');
 }
}
async function ntAction(action,id){
 if(!ntData||ntBusy)return false;
 ntBusy=true;
 try{
  const result=await api('notification-center/action',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action,ids:id?[id]:[]})});
  await ntLoad(true);
  ntMessage('Zaktualizowano '+result.changed+' powiadomień.');
  return true;
 }catch(error){ntMessage(error.message,true);return false}
 finally{ntBusy=false}
}
function ntRender(){
 if(!ntData)return;
 ntUpdateMetrics();
 $('nt-list-title').textContent=ntTabTitles[ntSelected]||'Twoje powiadomienia';
 const rows=ntVisibleItems();
 $('nt-list-count').textContent=rows.length+' pozycji';
 const list=$('nt-list');list.replaceChildren();
 const muted=Boolean(ntData.preferences.mutedUntil);
 for(const item of rows.slice(0,ntShowing)){
  const article=document.createElement('article');
  article.className='notif-item'+(!item.read&&ntData.preferences.highlightUnread&&!muted?' unread':'')+(muted?' muted':'');
  const icon=document.createElement('div');icon.className='notif-item-icon';icon.textContent=ntSymbols[item.category]||'✦';
  const main=document.createElement('div');main.className='notif-item-main';
  const title=document.createElement('div');title.className='notif-item-title';title.textContent=item.title;
  if(!item.read){const dot=document.createElement('span');dot.className='notif-unread-dot';dot.setAttribute('aria-label','Nieprzeczytane');title.append(dot)}
  const desc=document.createElement('span');desc.className='notif-item-info';
  desc.textContent=item.detail+(item.actor?' · '+item.actor:'');
  main.append(title,desc);
  if(ntData.preferences.showDates){
   const date=document.createElement('time');date.className='notif-item-date';date.textContent=ntDate(item.at);
   main.append(date);
  }
  const controls=document.createElement('div');controls.className='notif-item-controls';
  controls.append(ntButton('Otwórz',async()=>{
   if(ntData.preferences.autoReadOnOpen&&!item.read){
    const success=await ntAction('read',item.id);if(!success)return;
   }
   ntOpenTarget(item);
  }));
  controls.append(ntButton(item.read?'Nieprzeczytane':'Przeczytane',()=>void ntAction(item.read?'unread':'read',item.id)));
  controls.append(ntButton(item.archived?'Przywróć':'Archiwizuj',()=>void ntAction(item.archived?'restore':'archive',item.id)));
  article.append(icon,main,controls);list.append(article);
 }
 if(!rows.length){
  const empty=document.createElement('p');empty.className='notif-empty';
  empty.textContent=ntSelected==='archive'?'Archiwum jest puste.':'Brak powiadomień w wybranej kategorii i okresie.';
  list.append(empty);
 }
 $('nt-more').hidden=rows.length<=ntShowing;
 $('nt-mark-all').disabled=ntData.items.every(x=>x.read||x.archived);
 $('nt-archive-read').disabled=ntData.items.every(x=>!x.read||x.archived);
}
async function ntLoad(silent=false){
 if(!sessionConfirmed)return;
 if(!silent)ntMessage('Aktualizacja skrzynki powiadomień…');
 try{
  ntData=await api('notification-center');
  if(!ntSettingsDirty)ntPrefsToForm();
  ntRender();
  if(!silent)ntMessage('Skrzynka aktualna: '+ntData.meta.unread+' nieprzeczytanych. Dane z ostatnich 90 dni.');
 }catch(error){ntMessage(error.message,true)}
}
document.querySelectorAll('[data-nt-tab]').forEach(b=>b.addEventListener('click',()=>ntTab(b.dataset.ntTab)));
for(const id of ['nt-search','nt-period','nt-sort']){
 $(id).addEventListener(id==='nt-search'?'input':'change',()=>{ntShowing=20;ntRender()});
}
$('nt-more').addEventListener('click',()=>{ntShowing+=20;ntRender()});
$('nt-refresh').addEventListener('click',()=>void ntLoad());
$('nt-mark-all').addEventListener('click',()=>void ntAction('read-all'));
$('nt-archive-read').addEventListener('click',()=>void ntAction('archive-read'));
$('nt-settings-form').addEventListener('change',()=>{ntSettingsDirty=true});
$('nt-settings-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!sessionConfirmed)return;
 const button=$('nt-save');button.disabled=true;
 try{
  const values=ntSettingsFormValues();
  await api('notification-center',{method:'PUT',headers:{'Content-Type':'application/json'},
   body:JSON.stringify(values)});
  ntSettingsDirty=false;
  await ntLoad(true);
  ntMessage('Preferencje powiadomień zapisano na Twoim koncie.');
 }catch(error){ntMessage(error.message,true)}finally{button.disabled=false}
});
$('nt-cancel').addEventListener('click',()=>{ntPrefsToForm();ntMessage('Przywrócono zapisane ustawienia.')});
$('nt-export').addEventListener('click',()=>{
 if(!ntData){ntMessage('Najpierw wczytaj powiadomienia.',true);return}
 if(!window.confirm('Eksport może zawierać nicki znajomych i zdarzenia konta. Zachowaj plik prywatnie. Kontynuować?'))return;
 const clean=v=>'"'+String(v??'').replaceAll('"','""')+'"';
 const rows=[['Kategoria','Tytuł','Nick','Opis','Data','Przeczytane','Archiwum'],
  ...ntVisibleItems().map(x=>[ntCategories[x.category],x.title,x.actor,x.detail,ntDate(x.at),x.read?'Tak':'Nie',x.archived?'Tak':'Nie'])];
 const csv='\uFEFF'+rows.map(row=>row.map(clean).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='gracz-pl-powiadomienia.csv';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 ntMessage('Wyeksportowano wybrane powiadomienia z aktualnej listy.');
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
