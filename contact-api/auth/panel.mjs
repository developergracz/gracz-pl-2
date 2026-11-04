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
 <button type="button" role="tab" aria-selected="false" data-priv-tab="contacts">◇ Znajomi i kontakt</button>
 <button type="button" role="tab" aria-selected="false" data-priv-tab="games">♟ Gry i aktywność</button>
 <button type="button" role="tab" aria-selected="false" data-priv-tab="data">▤ Moje dane</button>
 <button type="button" role="tab" aria-selected="false" data-priv-tab="future">✧ Forum i przyszłość</button>
</nav>
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
.profile-password-form .form-actions #pw-change-status{max-width:470px;line-height:1.5;font-size:13px}
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
#player-shell .priv-tabs{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;border:1px solid #246c74;padding:7px;border-radius:15px;background:#052b39;position:sticky;top:0;z-index:5}
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
 if(name==='security'&&sessionConfirmed)void securityLoad();
 if(name==='privacy'&&sessionConfirmed)void privacyLoad();
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
 'publicProfile','showStats','showCountry','showBadges'];
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
  publicProfile:false,showStats:false,showCountry:false,showBadges:false},
 friends:{discoverable:true,friendRequests:true,friendMessages:true,gameInvites:true,showOnline:true,
  publicProfile:false,showStats:false,showCountry:false,showBadges:false},
 open:{discoverable:true,friendRequests:true,friendMessages:true,gameInvites:true,showOnline:true,
  publicProfile:true,showStats:true,showCountry:false,showBadges:true}
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
