# GRACZ-CONSOLE-PARITY-01 — agent geometrii konsol

## Mandat Ownera
Gomoku to **jedyny wzorzec układu** dla konsol Warcabów i Szachów. Zmierzyć i dopasować **rzeczywiste wyrenderowane prostokąty** (x, y, szerokość, wysokość) elementów, zamiast kopiować deklaracje CSS na oko. Celem jest wizualne 1:1 przy tym samym rozmiarze przeglądarki; różnica 15×15 / 8×8, figury i treści tekstowe są zamierzone.

## Stan architektury na starcie
- Repo aktywnych konsol: developergracz/gracz-pl-2; pliki contact-api/auth/gomoku-console.mjs, checkers-console.mjs, chess-console.mjs.
- Warcaby i Szachy importują getSharedGameConsoleHtml() z Gomoku i główny /konto/gomoku/styl.css, ale dodają własne style geometrii. **Nie tworzyć kolejnego niezależnego szablonu.**
- Kanały gry, matchmaking, czat i zegary są poza zakresem tej poprawki.
- GRACZ NEXT ma oddzielną architekturę i migrację. Nie zmieniać go w tym zadaniu.

## Operacyjna procedura agenta
1. Uruchom node contact-api/console-layout-agent/measure.mjs w Chromium. Nie potrzebuje logowania, bazy ani działającego Render: lokalny serwer serwuje **faktyczne HTML/CSS/JS** generowane przez moduły trzech konsol.
2. Odczytaj contact-api/console-layout-agent/reports/report.md oraz measurements.json, otwórz 24 zrzuty referencyjne / docelowe (8 rozdzielczości × 3 gry).
3. Dla każdego rozmiaru 1920×1080, 1440×900, 1366×768, 1181×820, 1024×768, 768×1024, 390×844 i 375×667 porównaj .layout, .sidebar, .boardarea, .board-center, .boardframe, #board, .side-dock, .match-panel, .dock-tabs, .bottom oraz pozostałe elementy z raportu.
4. Rozróżnij: **a)** różnice układu do usunięcia; **b)** różnice zamierzone (figury/siatka 8×8, zawartość gry); **c)** elementy celowo niedostępne dla danej gry. Dla grupy c podaj krótkie uzasadnienie, bez tworzenia imitacji.
5. Popraw niezbędne reguły CSS/HTML **w Warcabach i Szachach**, preferując wspólne tokeny geometrii w kodzie Gomoku, jeśli ograniczy to duplikację i nie zmieni wyglądu Gomoku. Bez redesignu, neonów, nowych usług, baz i kosztów.
6. Powtórz pomiar. Kryteria odbioru: brak odchyleń > 2 CSS px dla kluczowych wspólnych elementów na desktop/tablet, na mobile zgodne x/szerokości i zachowana kolejność bloków (różne wysokości wynikają z liczby dostępnych opcji gry), brak poziomego przewijania, plansza kwadratowa, elementy nieucięte. Treści i dostępne funkcje gry muszą zostać zachowane.
7. Przygotuj jedną PR ze zmianami CSS/HTML, raport przed/po oraz linkami do screenshotów. Wdrożenie dopiero po odbiorze PR.

## Analiza dynamiczna (CONSOLE-INTERACTION-1TO1-03)
Pomiar statyczny sprawdza tylko świeżo załadowane konsole. scenarios.mjs odtwarza w Gomoku, Warcabach i Szachach tę samą ścieżkę gracza (29 kroków) i dla każdego kroku mierzy getBoundingClientRect() **przed kliknięciem, 2 klatki po kliknięciu i po ustabilizowaniu** (cisza DOM, odpowiedź AI, modale):

- ruchy 1–3 z odpowiedzią komputera, zakładki Czat/Historia, 4 wiadomości z odpowiedzią GRACZ AI (lokalny mock trasy ai-chat, bez kosztów i API), cofnięcie ruchu i komunikat „brak ruchu”, nowa rozgrywka;
- poziom komputera, czas bez limitu, czas z bonusem, tryb online, czas pokoju, zaproszenia (otwarcie/zamknięcie), powrót do gry z komputerem, tooltipy;
- konfigurator: otwarcie, ukrycie i ponowne dodanie lewego oraz prawego panelu, zamknięcie;
- „Sama gra” i wyjście, pełny ekran (z emulacją większego okna) i wyjście, zmiana szerokości okna i powrót.

Reguły odbioru (desktop: x, y, szerokość, wysokość; telefony: x i szerokość, a w trybie „Sama gra” — stała wysokość 100dvh — pełny prostokąt):
1. Zwykłe kliknięcie nie przesuwa wspólnych elementów (SHARED_PARTS + rama i plansza) o > 2 px, chyba że Gomoku w tym samym kroku wykonuje identyczny ruch.
2. Po każdym kroku wspólne elementy Warcabów i Szachów pokrywają się z Gomoku w tym samym stanie funkcjonalnym (±2 px).
3. Stopka lewego panelu (Jak grać?, odnośniki, „Skonfiguruj wygląd konsoli”) ma rozmiar Gomoku i nie skacze bardziej niż w Gomoku; lewy panel nie wypycha kontrolek poza widok.
4. Kroki „restore” wracają do geometrii początkowej; pełny ekran dotyczy dokumentu (jak w Gomoku), nie elementu .layout.
5. Brak poziomego przewijania, plansza 8×8 kwadratowa i w pełni widoczna, czat zawija i przewija treść wewnątrz panelu, brak nowych obciętych kontrolek.

Widoczność zegarów jest funkcją gry (Szachy pokazują ∞ i podgląd czasu pokoju), więc nie jest błędem układu — gdy zegary są widoczne w obu grach, ich geometria musi być zgodna.

Stany odrębne funkcjonalnie i kolizje (P1, PR #774):
- „Sama gra” i pełny ekran w Gomoku to widok wyłącznie planszy (`gomoku-board-only`, tylko Gomoku). Kroki `focus` i `fullscreen` nie są więc porównywane 1:1 z Gomoku; w Warcabach i Szachach muszą spełnić niezmienniki: włączone `game-focus`, ukryte panele boczne, kwadratowa i widoczna plansza, VS z pudełkiem, brak kolizji. Kroki powrotu (`focus-exit`, `fullscreen-exit`) nadal muszą odtworzyć geometrię początkową i zgadzać się z Gomoku.
- Bezwzględnie w Warcabach i Szachach: brak nakładania się nawigacji górnej, przycisku przywracania panelu, zegarów, kart graczy, VS i statusu; zegar w obrębie karty gracza; VS ma pudełko zawsze, gdy widoczny jest pasek graczy (Chrome 145 gubił je po wejściu w „Sama gra”).
- Przycisk przywracania ma położenie zależne od gry (Warcaby i Szachy: prawa krawędź, kontrakt `modern/checkers-engine/e2e/warcaby-layout.browser.mjs`), dlatego jest sprawdzany pod kątem kolizji, a nie równości z Gomoku. Gdy wzorzec Gomoku sam nakłada nawigację na kartę gracza lub zegar (ukryty czat), jego pozycja nawigacji nie jest wiążąca, a status porównuje się w x, y i wysokości.

Uruchomienie: node contact-api/console-layout-agent/measure.mjs [--strict] [--static-only|--dynamic-only] [--viewports=1366x768,1280x720,...]. Flaga --viewports zawęża przebieg albo dodaje rozmiary spoza ośmiu wymaganych. Raport: sekcja „Analiza dynamiczna” w report.md, pełne dane w measurements.json (pole dynamic), zrzuty dynamic-*.png dla 1366×768 i 390×844.

## Granice
- Nie zmieniać silników reguł, 15×15/8×8, WebSocket, API, AI, sesji, płatności, bazy, SEO ani deploymentu.
- Bez nowych kosztów. Agent jest **wywoływany na żądanie/PR**, nie uruchamia ciągłego pollingu.
- Nie deklaruj 1:1 PASS, jeśli mierzone odchylenia nie przeszły. Lokalne pomiary nie dowodzą jeszcze, że ten sam commit jest wdrożony na Render.
- Żadnych zbędnych audytów lub szkiców. Jeden raport geometrii, punktowe korekty, jeden powtórny pomiar.

## Uruchomienie lokalne
Zainstaluj zależności już używane w istniejących workflow projektu, bez zmiany lockfile:

    npm --prefix contact-api ci --ignore-scripts --no-fund --no-audit
    npm --prefix contact-api install --no-save --no-package-lock --ignore-scripts --no-fund --no-audit playwright@1.58.2
    ./contact-api/node_modules/.bin/playwright install chromium
    node contact-api/console-layout-agent/measure.mjs

Domyślnie skrypt zbiera raport nawet przy różnicach. Parametr --strict włącza niezerowy kod wyjścia przy odchyleniach. Można wskazać CONSOLE_LAYOUT_BASE_URL do analizy działającego środowiska, **wyłącznie gdy strony są osiągalne i autoryzacja została rozwiązana**. Nie mieszać raportu lokalnego z produkcyjnym.

## Synchronizacja z main
Przed scaleniem PR należy uwzględnić bieżący HEAD main, uruchomić ponownie wymagane kontrole GitHub i nie omijać ochrony gałęzi produkcyjnej. Test geometrii w CI musi być zielony na tej samej rewizji, którą scalamy.

## Wyjątek Szachów — mandat Ownera PR #800 (2026-11-13)

Dla Szachów nowszy zaakceptowany szkic zastępuje równość geometrii z Gomoku:
plansza bez ramy po lewej, ustawienia/zegary/status/czat/narzędzia po prawej,
a przy szerokości ≤800 px panel poniżej planszy. `chess-contract.mjs` sprawdza
rzeczywiste wymiary i relacje tych elementów, stabilność po interakcjach i powrocie,
kwadratową dużą planszę, oznaczenia w polach, widoczne zegary, wysokość historii
>100 px, brak kolizji, overflow i obciętych kontrolek. Przewijanie strony, panelu
oraz ustawień jest odejmowane przy porównywaniu pozycji. VS jest celowo ukryte
w zwykłym widoku Szachów; w „Sama gra” nadal jest wymagane.
Kontrakt Gomoku i Warcabów pozostaje bez zmian. Pracować w istniejącym PR #800.
