<?php
/**
 * Publiczna strona startowa Gracz.pl dla niezalogowanych użytkowników.
 * Układ jest celowo samowystarczalny i scoped przez klasę .gracz-launch,
 * aby nie ingerować w starsze style pozostałych ekranów serwisu.
 */
?>

<style>
.gracz-launch,
.gracz-launch * { box-sizing: border-box; }

.gracz-launch {
  --gl-bg: #061013;
  --gl-panel: rgba(10, 28, 31, .88);
  --gl-panel-2: rgba(12, 34, 35, .72);
  --gl-line: rgba(76, 230, 153, .18);
  --gl-line-soft: rgba(255, 255, 255, .08);
  --gl-text: #f5faf8;
  --gl-muted: #a9bbb6;
  --gl-green: #42e990;
  --gl-green-2: #18c96a;
  --gl-red: #ff7581;
  position: relative;
  width: 100%;
  overflow: hidden;
  background:
    radial-gradient(circle at 68% 24%, rgba(19, 133, 74, .19), transparent 34%),
    radial-gradient(circle at 16% 60%, rgba(17, 92, 105, .11), transparent 35%),
    linear-gradient(135deg, #071216 0%, #03090c 72%);
  color: var(--gl-text);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  border-radius: 0;
  min-height: 760px;
}

.gracz-launch a { color: inherit; text-decoration: none; }

.gracz-launch__shell {
  width: min(1440px, calc(100% - 72px));
  margin: 0 auto;
}

.gracz-launch__topbar {
  min-height: 92px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  border-bottom: 1px solid rgba(255,255,255,.04);
}

.gracz-launch__brand {
  display: inline-flex;
  align-items: baseline;
  font-size: 28px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: -.045em;
}

.gracz-launch__brand span { color: var(--gl-green); }

.gracz-launch__nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 34px;
  color: #c8d7d2;
  font-size: 15px;
  font-weight: 650;
}

.gracz-launch__nav a { transition: color .2s ease; }
.gracz-launch__nav a:hover { color: var(--gl-green); }

.gracz-launch__status {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: var(--gl-green);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .13em;
  text-transform: uppercase;
  white-space: nowrap;
}

.gracz-launch__status::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--gl-green);
  box-shadow: 0 0 18px rgba(66,233,144,.8);
}

.gracz-launch__hero {
  min-height: 550px;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(410px, .85fr);
  align-items: center;
  gap: clamp(52px, 7vw, 110px);
  padding: 66px 0 54px;
}

.gracz-launch__eyebrow {
  margin: 0 0 18px;
  color: var(--gl-green);
  font-size: 12px;
  line-height: 1.4;
  font-weight: 850;
  letter-spacing: .16em;
  text-transform: uppercase;
}

.gracz-launch__title {
  max-width: 850px;
  margin: 0;
  color: #f7fbfa;
  font-size: clamp(52px, 5.25vw, 82px);
  line-height: .98;
  letter-spacing: -.055em;
  font-weight: 860;
}

.gracz-launch__title span {
  color: var(--gl-green);
  text-shadow: 0 0 42px rgba(66,233,144,.12);
}

.gracz-launch__lead {
  max-width: 770px;
  margin: 26px 0 0;
  color: #d3dfdc;
  font-size: clamp(19px, 1.55vw, 24px);
  line-height: 1.48;
  font-weight: 520;
}

.gracz-launch__copy {
  max-width: 720px;
  margin: 20px 0 0;
  color: var(--gl-muted);
  font-size: 16px;
  line-height: 1.72;
}

.gracz-launch__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 28px;
}

.gracz-launch__chip {
  display: inline-flex;
  align-items: center;
  min-height: 37px;
  padding: 0 14px;
  border: 1px solid var(--gl-line);
  border-radius: 999px;
  background: rgba(16, 47, 38, .46);
  color: #cce0d9;
  font-size: 13px;
  font-weight: 700;
}

.gracz-launch__panel {
  width: 100%;
  max-width: 500px;
  justify-self: end;
  padding: 34px;
  border: 1px solid var(--gl-line);
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(12,30,33,.96), rgba(8,22,25,.94));
  box-shadow: 0 26px 75px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.035);
}

.gracz-launch__panel h2 {
  margin: 0;
  font-size: clamp(26px, 2vw, 34px);
  line-height: 1.1;
  letter-spacing: -.035em;
  color: #fff;
}

.gracz-launch__panel p {
  margin: 14px 0 0;
  color: var(--gl-muted);
  font-size: 15px;
  line-height: 1.62;
}

.gracz-launch__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 27px;
}

.gracz-launch__button {
  min-height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  border-radius: 11px;
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 850;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}

.gracz-launch__button:hover { transform: translateY(-1px); }

.gracz-launch__button--primary {
  color: #03120a;
  background: linear-gradient(180deg, #4ef29b, #1fce70);
  box-shadow: 0 12px 30px rgba(28,205,109,.16);
}

.gracz-launch__button--secondary {
  color: #e9f4f0;
  border-color: rgba(255,255,255,.12);
  background: rgba(255,255,255,.045);
}

.gracz-launch__note {
  margin-top: 22px !important;
  padding: 14px 15px;
  border: 1px solid rgba(66,233,144,.12);
  border-radius: 10px;
  background: rgba(66,233,144,.045);
  color: #b8cac4 !important;
  font-size: 13px !important;
}

.gracz-launch__steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 0 0 54px;
}

.gracz-launch__step {
  min-height: 132px;
  padding: 24px 26px;
  border: 1px solid var(--gl-line-soft);
  border-radius: 14px;
  background: var(--gl-panel-2);
}

.gracz-launch__step strong {
  display: block;
  margin-bottom: 12px;
  color: var(--gl-green);
  font-size: 13px;
  letter-spacing: .08em;
}

.gracz-launch__step h3 {
  margin: 0 0 7px;
  color: #f8fbfa;
  font-size: 18px;
  line-height: 1.2;
}

.gracz-launch__step p {
  margin: 0;
  color: #91aaa2;
  font-size: 13px;
  line-height: 1.55;
}

.gracz-launch__games {
  padding: 20px 0 64px;
}

.gracz-launch__games-title {
  margin: 0 0 22px;
  color: #edf6f3;
  font-size: 24px;
  letter-spacing: -.025em;
}

.gracz-launch__legacy-games {
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 16px;
  background: rgba(7,18,21,.58);
  padding: 22px;
}

@media (max-width: 1050px) {
  .gracz-launch__shell { width: min(100% - 40px, 900px); }
  .gracz-launch__topbar { min-height: 80px; }
  .gracz-launch__status { display: none; }
  .gracz-launch__hero {
    grid-template-columns: 1fr;
    min-height: auto;
    gap: 42px;
    padding: 56px 0 44px;
  }
  .gracz-launch__panel { max-width: none; justify-self: stretch; }
}

@media (max-width: 720px) {
  .gracz-launch__shell { width: min(100% - 28px, 620px); }
  .gracz-launch__topbar { align-items: flex-start; flex-direction: column; padding: 22px 0 18px; gap: 17px; }
  .gracz-launch__nav { gap: 18px; flex-wrap: wrap; justify-content: flex-start; font-size: 13px; }
  .gracz-launch__hero { padding-top: 40px; }
  .gracz-launch__title { font-size: clamp(44px, 13vw, 62px); }
  .gracz-launch__lead { font-size: 18px; }
  .gracz-launch__panel { padding: 24px 20px; }
  .gracz-launch__actions { grid-template-columns: 1fr; }
  .gracz-launch__steps { grid-template-columns: 1fr; padding-bottom: 38px; }
}
</style>

<section class="gracz-launch" aria-label="Gracz.pl - strona startowa">
  <div class="gracz-launch__shell">
    <header class="gracz-launch__topbar">
      <a class="gracz-launch__brand" href="/" aria-label="Gracz.pl">gracz<span>.pl</span></a>
      <nav class="gracz-launch__nav" aria-label="Nawigacja główna">
        <a href="/">Aktualności</a>
        <a href="/regulamin.php">Regulamin</a>
        <a href="/polityka_prywatnosci.php">Polityka prywatności</a>
      </nav>
      <div class="gracz-launch__status">Platformę budujemy</div>
    </header>

    <div class="gracz-launch__hero">
      <div class="gracz-launch__intro">
        <p class="gracz-launch__eyebrow">Nowa polska platforma gier online</p>
        <h1 class="gracz-launch__title">Witamy na <span>Gracz.pl</span></h1>
        <p class="gracz-launch__lead">Budujemy nowoczesne miejsce do grania online — z naciskiem na multiplayer, czytelną obsługę i stabilną rozgrywkę.</p>
        <p class="gracz-launch__copy">Rozwijamy serwis etapami. Warcaby i Gomoku są pierwszymi grami, a kolejne funkcje obejmą pokoje graczy, rankingi, turnieje, historię rozgrywek oraz komunikację między użytkownikami.</p>
        <div class="gracz-launch__chips" aria-label="Najważniejsze funkcje">
          <span class="gracz-launch__chip">♟ Warcaby online</span>
          <span class="gracz-launch__chip">● Gomoku</span>
          <span class="gracz-launch__chip">🏆 Rankingi i turnieje</span>
          <span class="gracz-launch__chip">♟ Multiplayer</span>
        </div>
      </div>

      <aside class="gracz-launch__panel">
        <p class="gracz-launch__eyebrow">Pierwsi gracze</p>
        <h2>Wejdź do świata Gracz.pl</h2>
        <p>Załóż konto lub zaloguj się, aby korzystać z funkcji dostępnych w aktualnej wersji serwisu.</p>
        <div class="gracz-launch__actions">
          <a class="gracz-launch__button gracz-launch__button--primary" href="/rejestracja.php">Załóż konto</a>
          <a class="gracz-launch__button gracz-launch__button--secondary" href="/logowanie.php">Zaloguj się</a>
        </div>
        <p class="gracz-launch__note">Platforma jest rozwijana i testowana. Układ strony został przygotowany tak, aby poprawnie skalował się od telefonów po duże monitory.</p>
      </aside>
    </div>

    <div class="gracz-launch__steps" aria-label="Etapy rozwoju platformy">
      <article class="gracz-launch__step">
        <strong>01</strong>
        <h3>Budujemy</h3>
        <p>Silniki gier, multiplayer i bezpieczną infrastrukturę.</p>
      </article>
      <article class="gracz-launch__step">
        <strong>02</strong>
        <h3>Testujemy</h3>
        <p>Sprawdzamy rozgrywkę, interfejs i zachowanie serwisu na różnych ekranach.</p>
      </article>
      <article class="gracz-launch__step">
        <strong>03</strong>
        <h3>Rozwijamy</h3>
        <p>Dodajemy kolejne gry, rankingi, turnieje i funkcje społecznościowe.</p>
      </article>
    </div>

    <div class="gracz-launch__games">
      <h2 class="gracz-launch__games-title">Popularne gry</h2>
      <div class="gracz-launch__legacy-games">
        <?php GryWyswietlNajpopularniejsze(4); ?>
      </div>
    </div>
  </div>
</section>
