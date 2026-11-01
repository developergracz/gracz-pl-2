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
<button class="nav" data-section="games" type="button"><span aria-hidden="true">♜</span> Gry i rozgrywka</button>
<button class="nav" data-section="appearance" type="button"><span aria-hidden="true">☼</span> Wygląd i dostępność</button>
<button class="nav" data-section="sessions" type="button"><span aria-hidden="true">▣</span> Sesje i urządzenia</button>
<button class="nav" data-section="data" type="button"><span aria-hidden="true">▤</span> Dane i konto</button>
</nav><button class="signout" id="side-logout" type="button">Wyloguj się <span aria-hidden="true">↗</span></button></aside>
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
<a class="primary link-button" href="https://gracz.pl/gry/">Przejdź do gier</a></div></div>
</section>
<section class="view" data-panel="profile">
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
<div class="detail"><span>Sesja</span><strong>Aktywna na tym urządzeniu</strong></div><div class="detail"><span>Zmiana hasła i 2FA</span><strong>W przygotowaniu</strong></div>
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
<p class="social-limitation">Ważne: aktualne strony Warcabów i Gomoku są treningowe. Przyjęte zaproszenie nie uruchamia jeszcze wspólnej partii online — synchronizacja rozgrywki jest osobnym etapem.</p>
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
<section class="view" data-panel="games">
<div class="card"><p class="card-kicker">MOJA BIBLIOTEKA</p><h2>Ulubione gry</h2>
<p>Wybierz ulubione tytuły. Gwiazdka zapisuje wybór w Twoim koncie i dodaje skrót na pulpicie.</p>
<div class="game-grid">
<div class="game-tile"><div class="game-emoji" aria-hidden="true">♟</div><h3>Warcaby</h3><p>Gra strategiczna</p><div class="game-actions"><a href="https://gracz.pl/gry/warcaby/">Otwórz</a><button type="button" data-favorite="warcaby" aria-pressed="false" aria-label="Dodaj Warcaby do ulubionych">☆ Ulubione</button></div></div>
<div class="game-tile"><div class="game-emoji" aria-hidden="true">◉</div><h3>Gomoku</h3><p>Pięć w rzędzie</p><div class="game-actions"><a href="https://gracz.pl/gry/gomoku/">Otwórz</a><button type="button" data-favorite="gomoku" aria-pressed="false" aria-label="Dodaj Gomoku do ulubionych">☆ Ulubione</button></div></div>
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
<footer class="footer">© gracz.pl · Polskie Centrum Gracza · Full Max Premium</footer></main></div></body></html>`;
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
@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation:none!important;transition:none!important}}`;
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
    const a=document.createElement('a');
    a.href=challenge.game==='warcaby'?'https://gracz.pl/gry/warcaby/':'https://gracz.pl/gry/gomoku/';
    a.className='secondary link-button';a.textContent='Otwórz trening '+(challenge.game==='warcaby'?'Warcabów':'Gomoku');
    a.title='Strona Academy, bez wspólnej rozgrywki online';
    controls.append(a);
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
   ZBYT_WIELE_PROB:'Zbyt wiele operacji. Spróbuj później.'
  };
  const error=new Error(response.status===401?'Sesja wygasła. Zaloguj się ponownie.':
   messages[body.error]||'Nie udało się wykonać operacji. Spróbuj ponownie.');
  error.status=response.status;throw error;
 }
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
 profileSnapshot=profile;
 $('dashboard-name').textContent=profile.displayName;
 $('dashboard-joined').textContent=formattedDate(profile.createdAt);
 const initial=profile.displayName.slice(0,1).toUpperCase()||'G';
 $('nav-avatar').textContent=initial;$('profile-avatar').textContent=initial;$('dashboard-avatar').textContent=initial;
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
