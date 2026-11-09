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
