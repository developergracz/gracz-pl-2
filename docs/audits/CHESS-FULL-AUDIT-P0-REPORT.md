# CHESS-FULL-AUDIT-P0 — RAPORT KOŃCOWY

**GRACZ.PL · Szachy (konsola `/konto/szachy/`) · audyt niezależny, READ-ONLY, evidence first**

| Pole | Wartość |
|---|---|
| Mandat | CHESS-FULL-AUDIT-P0 / STRICT |
| Repozytorium / gałąź audytowana | `developergracz/gracz-pl-2` · `main` |
| Commit (pełny SHA) | `36f9c7c3ebbf5ead11d5836bd66d5ecd47582765` (2026-11-15 22:10 +01:00) |
| Data audytu | 2026-11-16 |
| Wykonawca | Claude Code (audytor niezależny) |
| Dowody | [`docs/evidence/chess-full-audit-p0/`](../evidence/chess-full-audit-p0/) — wyniki JSON, zrzuty, logi, harness |
| **Werdykt** | **HOLD** — 1 usterka P0 (nieuczciwy wynik partii na czas), 5 × P1. Szczegóły: §18. |

---

## 1. Executive Summary — ocena gotowości gry

**Rdzeń jest bardzo dobry, warstwa prezentacji i limity — nie.**

* **Silnik reguł jest poprawny.** Perft 28/28 na 7 referencyjnych pozycjach (do głębokości 4, m.in. Kiwipete 4 085 603 węzłów), test różnicowy z niezależnym `chess.js 1.4.0`: 400 partii, **134 191 pozycji, 0 rozbieżności** (ruchy legalne, SAN, FEN, szach/mat/pat, brak materiału, 3-krotne powtórzenie, 50 ruchów). 65/65 scenariuszy reguł specjalnych i adaptera serwerowego PASS. Kopie silnika serwowane przeglądarce są bajt w bajt zgodne z modułami serwera.
* **Online jest spójne i autoryzowane.** Serwer (PostgreSQL + optymistyczna wersja) jest źródłem prawdy: 4 równoczesne żądania ruchu → dokładnie 1 przyjęte; duplikat, nieaktualna wersja, ruch za przeciwnika, cudza partia, CSRF, sfałszowana/wygasła sesja, cudza subskrypcja WebSocket — wszystkie odrzucone. Brak podwójnych ruchów i rozbieżnych plansz w 25+ scenariuszach awaryjnych (offline, zerwany WS, odświeżenie, dwie karty, wolne API, zamknięcie przeglądarki).
* **Komputer** zawsze gra legalnie (240/240), nie gra po końcu partii, poziomy realnie różnią się siłą. To własny lekki silnik (alfa-beta, głębokość 1–4) — **nie Stockfish**, co UI uczciwie komunikuje.
* **Responsywność:** 9/9 wymaganych rozdzielczości bez poziomego przewijania, nakładania i przycięć; plansza kwadratowa i w kadrze; fokus klawiatury widoczny na wszystkich 69 elementach.

**Usterki blokujące (potwierdzone, powtarzalne):**

1. **CHESS-001 (P0)** — limit 80 żądań ruchu na konto w stałym oknie 15 min (wspólny dla wszystkich gier). 81. ruch jest odrzucany `429`, zegar biegnie dalej → **gracz przegrywa na czas, choć grał** (odtworzone end-to-end w partii 1-minutowej). Realne przy 2–3 partiach blitz/bullet z rzędu.
2. **CHESS-002 (P1)** — w domyślnym układzie konsoli **gracz nie widzi** komunikatów: szach, wygrana, pat/remis, czyja tura (bez zegara), odrzucenie ruchu. Tekst istnieje tylko w ukrytym `#game-state` (`display:none!important`). Zwycięzca i remisujący nie dostają żadnej informacji o wyniku.
3. **CHESS-003 (P1)** — czarne w partii Online grają „do góry nogami” (plansza zawsze od strony białych; przycisk obrotu nie trafia do DOM).
4. **CHESS-004 (P1)** — wyświetlany zegar Online liczony z zegara urządzenia (bez korekty `serverTime`): przesunięcie zegara o 60 s = błąd wyświetlania o 60 s.
5. **CHESS-005 (P1)** — przekroczenie czasu przy samym królu przeciwnika daje mu wygraną (FIDE art. 6.9: remis).
6. **CHESS-006 (P1)** — bez WebSocket polling co 4 s po ~13–14 min przekracza limity GET; plansza i czat przestają się aktualizować.

**Brakujące funkcje (NOT IMPLEMENTED, nie błędy):** poddanie partii, propozycja remisu za zgodą, porzucenie partii bez zegara, okno wyniku dla wygranej/remisu, wybór/alternacja kolorów, import/eksport FEN, import PGN.

---

## 2. Dokładny commit SHA i środowisko audytu

| Element | Wartość |
|---|---|
| Kod | `main` @ `36f9c7c3ebbf5ead11d5836bd66d5ecd47582765` (zweryfikowane `git fetch` + `git rev-parse origin/main`) |
| Node.js | v22.23.4 (**uwaga:** `contact-api/package.json` wymaga `>=24.19.0 <25`; CI używa 24.21.0 — różnica nie wpłynęła na wyniki, testy projektu przeszły) |
| Przeglądarka | Chromium 153.0.8010.12 (Playwright 1.63), headless, konteksty izolowane |
| Baza | PostgreSQL 16.15 — jednorazowy klaster na `127.0.0.1:55432`, baza `gracz_test` (zaakceptowana przez `test-database-guard.mjs`) |
| Pub/Sub | Redis 7.0.15 na `127.0.0.1:56379` (protokół zgodny z Valkey 8 z CI) |
| Instancja aplikacji | `contact-api/scaling/browser-instance.mjs` — **produkcyjny** router `createPublicIdentityRouter`, produkcyjna konsola `serveChessConsole`, produkcyjny hub WS `createGomokuRealtime` |
| Niezależna referencja | `chess.js@1.4.0`, `axe-core@4.10.2` — zainstalowane **wyłącznie** w katalogu tymczasowym audytu, nie w repozytorium |
| Konta testowe | jednorazowe `Aud*@example.invalid`, tworzone i usuwane przez harness |
| Produkcja | **NOT TESTED** — `https://gracz.pl/konto/szachy/` zwraca **404** (2 próby, `text/plain`), a `gracz-contact-api.onrender.com` (cel linków ze strony głównej) jest zablokowany polityką sieci środowiska audytu. Stanu wdrożenia na Renderze nie zweryfikowano. |

**Bazowe testy projektu (punkt odniesienia, nie dowód):** jednostkowe 677/677, `chess-pieces` 2/2, `chess-drag` 2/2, `chess-owner-console` 6/6, `two-chromium-chess` 1/1, `chess-special-rules-acceptance` 4/4, `test:scaling` 4/4. Zielone CI nie wykryło żadnej z usterek z §15.

---

## 3. Architektura gry i mapa zależności

```
Interakcja (klik / drag / dotyk / klawiatura)
  └─► Konsola: /konto/szachy/app.js = 9 warstw sklejonych w serveChessConsole()
        js (rdzeń) → referenceLayout → ownerCompact → minimalChess → mobileChess →
        approvedOwnerChess → finalApprovedChessPanel → chessMobileTopbar → chessOwnerConsole
  └─► Kontroler (rdzeń js): choose() → commit() / performLocalMove() / scheduleComputer()
  └─► Reguły: /konto/szachy/rules.mjs (= auth/chess-rules.mjs, identyczne bajtowo)
        ├─ tryb Komputer: stan lokalny w przeglądarce (+ localStorage)  ── KONIEC
        └─ tryb Online: POST /auth/match {id, version, move:{uci}|{claimDraw}}
  └─► API: auth/public-identity.mjs  (sesja → limit → dostęp → zegar → reguły → zapis)
        reguły serwera: auth/chess-match.mjs → auth/chess-rules.mjs
  └─► Baza: gracz_public_identity.game_matches(state jsonb, version)  ◄── ŹRÓDŁO PRAWDY
        UPDATE … WHERE version=$n (optymistyczna współbieżność)
  └─► Powiadomienie: hub.notify(id) → Redis 'gracz:match:invalidate:v1' (tylko unieważnienie)
  └─► WebSocket: auth/gomoku-realtime.mjs → readRealtime() (ten sam router) → snapshot / delta
  └─► Drugi gracz: realtime-client (seq, watchdog 60 s, backoff ≤30 s, fallback: polling 4 s) → render()
```

| Etap | Źródło prawdy | Odpowiedzialność | Główne punkty awarii (stwierdzone) |
|---|---|---|---|
| Interakcja | — | zaznaczenie, drag, promocja | brak (B01–B11, B20, M01 PASS) |
| Konsola (warstwy) | DOM | układ, ikony, arkusze | ukrycie paska stanu (CHESS-002), brak obrotu (CHESS-003); 9 warstw przestawiających DOM przez `MutationObserver` = wysokie ryzyko regresji |
| Kontroler lokalny | `states[]` + `localStorage` | partia z komputerem / 2 osoby | AI w wątku UI (CHESS-007), bilans (CHESS-013) |
| Reguły | `chess-rules.mjs` | legalność, SAN, wynik | brak usterek |
| API ruchu | PostgreSQL `state`+`version` | autoryzacja, wersja, zegar, zapis | limit 15-min (CHESS-001, -006), FIDE 6.9 (CHESS-005) |
| Zegar | `state.clock` (serwer) | `since`, `remaining`, `ready` | wyświetlanie z zegara urządzenia (CHESS-004) |
| Redis | brak (tylko sygnał) | unieważnienie między instancjami | utrata sygnału naprawiana rekonsyliacją (60 s) |
| WebSocket | odczyt z routera | snapshot/delta, termin zegara | duża delta (CHESS-017); zerwanie → poprawny fallback (OE03) |
| Czat Online | `game_match_messages` | treść tylko jako tekst | brak usterek bezpieczeństwa |

---

## 4. Inwentaryzacja funkcji

| Obszar | Funkcja | Stan |
|---|---|---|
| Tryby | Komputer (z komputerem / dwie osoby lokalnie), Online | zaimplementowane |
| Komputer | 4 poziomy: Początkujący / Normalny (domyślny) / Zaawansowany / Najmocniejszy lokalny | zaimplementowane (głęb. 1/2/3/4) |
| Zegary | 0 (∞), 1–30 min, bonus 0/2/3/5/10 s — lokalnie i Online | zaimplementowane |
| Akcje | Nowa gra, Rewanż, Zaproś, Cofnij (lokalnie natychmiast; Online za zgodą przeciwnika) | zaimplementowane |
| Remis | zgłoszenie (3-krotne powtórzenie, 50 ruchów); automatyczny (pat, brak materiału, 5-krotne, 75 ruchów) | zaimplementowane |
| Remis | propozycja remisu za zgodą przeciwnika | **NOT IMPLEMENTED** |
| Koniec | poddanie partii, porzucenie partii bez zegara | **NOT IMPLEMENTED** |
| Plansza | klik, przeciąganie (mysz/dotyk/pióro), tryb sterowania, promocja 4 figur, współrzędne | zaimplementowane |
| Plansza | obrót planszy | kod istnieje, **niedostępny w UI** (CHESS-003) |
| Historia | lista Nr/Białe/Czarne, przegląd pozycji, nawigacja ⏮ ‹ › ⏭, „Do gry”, kopiowanie ruchów PGN | zaimplementowane |
| Historia | FEN (import/eksport), import PGN, nagłówki PGN | **NOT IMPLEMENTED** |
| Czat | Online (uczestnicy), lokalnie GRACZ AI (Groq) lub notatki | zaimplementowane |
| Ikony | Ustawienia, Plansza (4 motywy), Figury (3), Motyw panelu (2), Pełny ekran (+fallback „Sama gra”) | zaimplementowane |
| Konto | koperta z licznikiem nieprzeczytanych (`/auth/message-center`), profil | zaimplementowane |
| Online | zaproszenia ze statusem obecności, zaproszenia terminowe (data/godzina/notatka/przypomnienie), lista przyjętych partii | zaimplementowane |
| Wynik | okno przegranej (lokalnie vs komputer, Online) | zaimplementowane |
| Wynik | okno/komunikat wygranej i remisu | **NOT IMPLEMENTED** (por. CHESS-002) |
| Inne | studio układu konsoli (15 kafli), poradnik „Jak grać”, zakładka Info, menu mobilne | zaimplementowane |

Inwentaryzacja elementów prawej konsoli (tryb Komputer, 1600×900): 18 widocznych kontrolek, każda z nazwą dostępną, żadna przycięta — `results/console-inventory-local.json`.

---

## 5. Ocena silnika szachowego — **GO**

| Test | Wynik | Dowód |
|---|---|---|
| Perft 7 pozycji (startpos, Kiwipete, pos3–pos6, lustro pos4) do głęb. 4 | **28/28 PASS** | `results/engine-diff-d4.json` |
| Różnicowo vs `chess.js 1.4.0`: 400 partii losowych (z premią dla promocji/roszad/e.p.), 134 191 pozycji | **0 rozbieżności** w 7 własnościach | jw. (1 080 promocji, 84 e.p., 204 roszady, 7 582 szachy, 52 maty, 16 patów, 165 × brak materiału) |
| Scenariusze §4.1–4.3 (ruchy, związania, roszady przez szach/utrata praw, e.p. z odsłonięciem szacha, promocje H/W/G/S, podwójny szach, maty, pat, 50/75 ruchów, 3/4/5-krotne powtórzenie, różne prawa roszady, stan po ruchu, cofanie, złośliwe dane, uszkodzony stan) | **65/65 PASS** | `results/rules-scenarios.json` |
| Spójność kopii przeglądarkowej z serwerową | identyczne (`rules.mjs`); `computer.mjs` różni się wyłącznie ścieżką importu | `harness/drift.mjs` |

Stan po każdym ruchu (pozycja, tura, roszady, e.p., półruchy/pełne ruchy, historia pozycji, szach/mat/remis, status zakończenia) aktualizowany poprawnie (M01–M10, U01–U04). Remis zgłaszany (3-krotne, 50) jest rozdzielony od automatycznego (5-krotne, 75, pat, brak materiału) zgodnie z FIDE. Klucz powtórzeń uwzględnia e.p. tylko przy legalnym biciu — zgodnie z FIDE.

Ograniczenia (nie usterki): wydajność generatora ~320 tys. węzłów/s (wystarczająca dla gry, ogranicza siłę AI); historia Online przycinana do 300 półruchów (skutki: CHESS-014); brak walidacji pozycji niemożliwych w `parseFen` (nieistotne — gra nie przyjmuje FEN od użytkownika).

---

## 6. Ocena gry z komputerem — **CONDITIONAL GO**

| Wymaganie §5 | Wynik | Dowód |
|---|---|---|
| 1. Zawsze legalne ruchy | PASS — 0/240 nielegalnych (4 poziomy × 60 pozycji) | `results/ai-quick.json` |
| 2. Brak wielokrotnego ruchu | PASS — podwójne kliknięcie = 1 ruch + 1 odpowiedź (B07) | `browser-local.json` |
| 3. Brak ruchów po końcu partii | PASS — po macie liczba ruchów stała (A05, A07); `chooseComputerMove` zwraca `null` przy pacie | jw. |
| 4. Reakcja na szach/mat/promocję/pat | PASS — ucieczka z szachu, mat w 1 (wszystkie poziomy), promocja na hetmana | `ai-quick.json` |
| 5. Poziom wpływa na silnik | PASS — mat w 2: Zaawansowany/Najmocniejszy 6/6, niższe 1/6; widełki: tylko 2 wyższe; turniej 12 partii: hierarchia zachowana (11/12 zgodnie, 1 remis przez powtórzenie) | `ai-mate2.json`, `ai-match.json` |
| 6. Nie blokuje interfejsu | **FAIL** — długie zadania 756–762 ms na ruch (Najmocniejszy), ~210 ms (Zaawansowany) | CHESS-007 |
| 7. Bezpieczna nowa partia | PASS — „Nowa gra” w trakcie myślenia: spóźniony ruch odrzucony (A02) | |
| 8. Zmiana trybu bez aktywnych procesów | PASS — przełączenie na Online w trakcie myślenia (A03) | |
| 9. Zegary, cofanie | PASS — przekroczenie czasu, bonus, cofnięcie 2 półruchów (Z01, Z02, K03); **FAIL** bilans po cofnięciu zakończonej partii (CHESS-013) | |
| 10. Komunikaty AI zgodne z grą | **FAIL** — prompt systemowy zawiera `NaN`, gubi instrukcję o braku planszy (CHESS-008); odpowiedzi rzeczywistego modelu: NOT TESTED | |

**Silnik:** własny, deterministyczny (`auth/chess-computer.mjs`): negamax z alfa-beta, iteracyjne pogłębianie, sortowanie MVV-LVA, ewaluacja materiał + centrum + postęp pionów. Brak quiescence i świadomości powtórzeń/50 ruchów. **Stockfish nie jest zintegrowany**; UI uczciwie podaje „Najmocniejszy lokalny” i „Lokalny silnik szachowy. Najmocniejszy poziom nie jest Stockfishem.” (pierwotna etykieta HTML „Arcymistrz — maksymalna siła” jest nadpisywana przez JS).

| Poziom UI | Silnik | Budżet | p50 | p95 | max | % ruchów na limicie |
|---|---|---:|---:|---:|---:|---:|
| Początkujący | głęb. 1 | 450 ms | 4 ms | 6 ms | 7 ms | 0 |
| Normalny (domyślny) | głęb. 2 | 450 ms | 11 ms | 19 ms | 23 ms | 0 |
| Zaawansowany | głęb. 3 | 450 ms | 120 ms | 221 ms | 306 ms | 0 |
| Najmocniejszy lokalny | głęb. 4 | 750 ms | 464 ms | 753 ms | 756 ms | 15 |

Ocena siły (szacunkowa, bez pomiaru Elo): poziom klubowy początkujący–średni; wygrywa z grą losową i pojedynczymi błędami, przeoczy dłuższe kombinacje (efekt horyzontu). **Wymiany silnika nie rekomenduję** — brak wykazanej potrzeby; jedyny problem techniczny to wątek UI (CHESS-007).

---

## 7. Ocena rozgrywek Online — **HOLD (CHESS-001, -006)**, integralność: **GO**

Pełny cykl na dwóch uwierzytelnionych kontach w niezależnych kontekstach Chromium (`results/browser-online.json`, 3 przebiegi):

| Krok §6 | Wynik | Dowód |
|---|---|---|
| 1–4 Logowanie, zaproszenie przez UI (3 min + 2 s), odbiór, akceptacja, obaj w tej samej partii | PASS (OB01) | zrzuty 20, 21 |
| 5 Kolory | PASS — zapraszający zawsze białe (OB02); brak wyboru/alternacji (NOT IMPLEMENTED) | |
| 6 Start odliczania | PASS — dopiero po wejściu obu (O02–O04, OZ01) | |
| 7–10 Ruchy, aktualizacja u przeciwnika, tura, zegary | PASS — opóźnienie klik→plansza przeciwnika ~0,2 s przez WS (OB04–OB06) | |
| 11–12 Koniec, wynik u obu | wynik **zgodny** na serwerze i u obu (OR01, OD01, OZ03); **niewidoczny** dla zwycięzcy i przy remisie (CHESS-002) | zrzuty 28, 29, 62 |
| 13 Rewanż / nowa partia | PASS — Rewanż otwiera zaproszenie z prawdziwym przeciwnikiem; „Nowa gra” = arkusz rzeczywistych przyjętych partii (OR01, K20) | zrzuty 30, 43 |

| Scenariusz awaryjny | Wynik | Dowód |
|---|---|---|
| Utrata i powrót internetu | PASS — resynchronizacja 25–36 ms po powrocie (OE01) | |
| Zerwanie WS / auto-reconnect | PASS — nowe połączenie, ruch dociera po ~6 s (OE03) | |
| Odświeżenie strony | PASS (OE02) | |
| Ta sama partia w dwóch kartach | PASS — serwer przyjmuje 1 ruch, druga karta dostaje `ODSWIEZ_PARTIE` i resynchronizuje (OE04) | |
| Spóźniona odpowiedź API (2,5 s) + szybkie kliknięcia | PASS — dokładnie 1 POST (OE05) | |
| Zdublowany ruch / 4 równoczesne żądania | PASS — 1×200 + 3×409, historia = 1 (S06, S07) | `online-api.json` |
| Nieaktualna wersja | PASS — 409 (S05) | |
| Zamknięcie i ponowne otwarcie przeglądarki | PASS (OE07) | |
| Cudza partia (UI i API) | PASS — 404, brak danych graczy w DOM (S01, S02, OS01) | zrzut 24 |
| Utrata sesji w trakcie gry | PASS — ruch 401, WS zamknięty 1008 przy rekonsyliacji, stan bez zmian (S15, W07, OE06) | |
| Limit ruchów | **FAIL** — CHESS-001 (L01, L10) | zrzuty 50, 51 |
| Brak WebSocket (polling) | **FAIL** — CHESS-006 (L11) | zrzut 53 |

Źródłem prawdy Online jest serwer — potwierdzone: stan klienta nigdy nie jest wysyłany, ruch to wyłącznie `uci` + `version`, a każda niezgodność kończy się pobraniem stanu z serwera.

---

## 8. Ocena synchronizacji i zegarów — **CONDITIONAL GO**

| Wymaganie §7 | Wynik |
|---|---|
| Czas początkowy obu graczy | PASS (O04, OZ01; lokalnie Z02) |
| Moment startu | PASS — po wejściu obu (Online), po 1. ruchu białych (lokalnie) |
| Zatrzymanie po końcu | PASS — `since=null`, zegary stoją (D01, OZ03, Z01) |
| Zmiana aktywnego zegara | PASS — u obu graczy (OB04) |
| Bonus Fischera | PASS — serwer +2 s (Z01, OB05); lokalnie +2 s (Z02); odebranie bonusu przy cofnięciu (U04) |
| Upływ czasu podczas rozłączenia | PASS — liczony przez serwer od `since` (Z02, OE01) |
| Odświeżenie | PASS (OE02); lokalnie zegar zatrzymany na czas zamknięcia strony (zgodnie z opisem) |
| Synchronizacja obu graczy | PASS przy poprawnym zegarze urządzeń; **FAIL** przy przesuniętym zegarze (CHESS-004) |
| Czas = 0, ustalenie wyniku | PASS — naturalny upływ 60 s: wynik u obu, okno przegranej u przegranego (OZ03); **FAIL** FIDE 6.9 (CHESS-005) |
| Kolor aktywnego zegara, czytelność | PASS — podkreślenie aktywnego, ostrzeżenie ≤30 s (pomarańcz), krytyczny ≤10 s; cyfry 23–30 px, kontrast zgodny z axe (Z10) — zrzuty 40, 41 |
| Zegary mobilne | PASS — 23 px, brak nakładania (M04, R-*) |
| Prośba o cofnięcie | PASS — wstrzymuje zegar, wygasa po 3 min, czas liczony od chwili wygaśnięcia (U01, U05) |

**Źródła czasu nie są zgodne:** serwer liczy z własnego zegara (`Date.now()` w `advanceGomokuClock`/`clockAfterMove`), klient wyświetla `remaining − (Date.now()_urządzenia − since_serwera)` i ignoruje przesyłane `serverTime` (CHESS-004). Wynik partii jest uczciwy (rozstrzyga serwer), ale wyświetlany czas może być fałszywy.

---

## 9. Ocena szachownicy i obsługi figur — **CONDITIONAL GO**

| Wymaganie §8 | Wynik |
|---|---|
| 8×8, proporcje | PASS — kwadrat na 9/9 rozdzielczościach (od 320 px do 1024 px boku) |
| Oryginalne figury SVG | PASS — 32 SVG, 0 zewnętrznych grafik (B01) |
| Położenie figur | PASS (B02) |
| Litery/cyfry wewnątrz pól | PASS — 8 + 8 etykiet w granicach pól (B03) |
| Zgodność oznaczeń po obróceniu | **NOT TESTABLE w UI** — obrót niedostępny (CHESS-003) |
| Brak wyciągnięcia figury poza planszę | PASS — „duch” ograniczony do planszy, powrót figury (B08) |
| Aktywacja jednym kliknięciem, legalne pola | PASS (B04) |
| Przeciąganie myszą | PASS (B09, OB05, B20 ×3 zoom) |
| Dotyk | PASS — tap-tap na 390×844 (M01) |
| Cofnięcie figury po nielegalnym ruchu | PASS (B05, B09) |
| Brak przypadkowego przemieszczenia | PASS — figura przeciwnika nie do zaznaczenia (B06), podwójny klik (B07) |
| Powiększenie 125/150/200 % i pełny ekran | PASS (B20 ×3, I-fullscreen, M03) |
| Kolor i kolejka gracza | PASS — plansza zablokowana na turze przeciwnika (OB06); **FAIL** orientacja czarnych (CHESS-003) |
| Szybkie/podwójne kliknięcia, zwolnienie poza polem, zmiana rozmiaru w trakcie przeciągania | PASS (B07, B08, B10) |

---

## 10. Ocena prawej konsoli — element po elemencie

| Element | Działanie | Stan aktywny / błędy | Dostępność | Responsywność | Ocena |
|---|---|---|---|---|---|
| Zegary Czarne/Białe | czas, aktywny, ostrzeżenia | PASS | `aria-label` z czasem | PASS | PASS (CHESS-004 dot. Online) |
| Koperta | licznik 0/1/2/9/99/100+/150, archiwum pominięte, odczyt → 0, błąd sieci zachowuje ostatni stan, inny użytkownik nie widzi, niezalogowany: „zaloguj się” | PASS (13 testów E-*) | etykieta: odmiana „2 nieprzeczytanych” (CHESS-015) | PASS | PASS |
| Profil | link `/konto/panel/?sekcja=profile` | PASS | nazwa | PASS | PASS |
| Komputer / Online | przełączanie, `aria-pressed`, arkusz Online otwierany automatycznie bez partii | PASS (K01, A03, OT03) | PASS | PASS | PASS |
| Nowa gra | lokalnie: reset; Online: arkusz przyjętych partii | PASS (A02, K20) | PASS | PASS | PASS |
| Rewanż | nieaktywny przed końcem; lokalnie = nowa partia; Online = zaproszenie z przeciwnikiem | PASS (K02, A08, OR01) | PASS | PASS | PASS |
| Zaproś | okno zaproszeń; bez logowania: komunikat logowania; Escape zamyka | PASS (K04, OB01) | PASS | PASS | PASS |
| Cofnij | lokalnie 2 półruchy; Online prośba za zgodą | PASS (K03, U01–U05) | PASS | PASS | PASS (CHESS-013) |
| Zgłoś remis | pojawia się tylko gdy dostępny; lokalnie i Online | PASS (D11–D14, OD01) | PASS | PASS | PASS |
| Zakładki Czat / Ruchy / Info | przełączanie bez utraty wiadomości; Info z danymi partii | PASS (OT02, K21) | role `tab` | PASS | PASS |
| Ustawienia | poziom AI, czas, bonus, przeciwnik, studio układu, większy czat | PASS (I-settings) | fokus wraca | PASS | PASS |
| Plansza | 4 motywy, zapis po odświeżeniu, reset, brak wpływu na stan gry | PASS (I-persist) | radio | PASS | PASS |
| Figury | 3 zestawy, jw. | PASS | radio | PASS | PASS |
| Motyw | jasny/ciemny panel, jw. | PASS | radio | PASS | PASS |
| Pełny ekran | wejście/wyjście, zmiana etykiety; telefon/fallback | PASS (I-fullscreen, M03) | `aria-pressed` | PASS | PASS |
| **Pasek stanu (`#game-state`)** | szach / wynik / tura / błędy / „komputer myśli” | **niewidoczny** poza trybem „Sama gra” i wyborem promocji | treść niedostępna wzrokowo | jw. | **FAIL** (CHESS-002) |

Żaden widoczny przycisk nie jest martwy ani nie wykonuje innej operacji niż deklaruje. Przyciski ukryte (`remove-player`, `block-player`, `replay-game`) są celowo ukryte i nieaktywne.

---

## 11. Ocena historii ruchów i czatu

**Historia (§9.3):** automatyczny zapis, SAN (100% zgodny z `chess.js`), numeracja, kolumny Nr/Białe/Czarne, wyróżnienie bieżącego ruchu (H01); przegląd pozycji tylko do odczytu i powrót „Do gry” (H02, także Online po macie); spójność po ponownym wczytaniu (H05, OE02). Usterki: PGN bez wyniku i nagłówków (CHESS-011), fokus klawiatury po „Home” (CHESS-012), partie >300 półruchów (CHESS-014). FEN i import PGN: **NOT IMPLEMENTED**.

**Czat (§9.4):** wysyłanie/odbiór, kolejność, tożsamość („Ty:” / nick przeciwnika), rozdzielenie czatu Online od notatek/GRACZ AI, brak utraty przy przełączaniu zakładek (OT01–OT03, T01–T04). **XSS: brak** — `<img onerror>`, `<script>`, `<b>` zapisane i wyświetlone jako tekst (`textContent`), brak wykonania (T01 API, OT01, T02 lokalnie). Limity: 600 znaków, znaki sterujące odrzucone. Odpowiedzi rzeczywistego modelu GRACZ AI: NOT TESTED (brak klucza; w izolowanej instancji czytelny komunikat „GRACZ AI jest chwilowo niedostępny.”).

---

## 12. Ocena mobilna i dostępność

| Rozdzielczość | Bok planszy | Min. pole | Poziomy scroll | Nakładanie / przycięcia | Arkusz w kadrze | Zrzut |
|---|---:|---:|---|---|---|---|
| 1920×1080 | 1024 px | 128 px | nie | brak | tak | 10 |
| 1600×900 | 844 | 106 | nie | brak | tak | 10 |
| 1366×768 | 712 | 89 | nie | brak | tak | 10 |
| 1280×720 | 664 | 83 | nie | brak | tak | 10 |
| 1024×768 | 596 | 75 | nie | brak | tak | 10 |
| 768×1024 | 768 | 96 | nie | brak | tak | 10 |
| 390×844 | 390 | 49 | nie | brak | tak | 10 |
| 375×667 | 375 | 47 | nie | brak | tak | 10, 14 |
| 320×568 | 320 | 40 | nie | brak | tak | 10 |

Dodatkowo: zmiana orientacji 390×844→844×390 bez utraty stanu (M02), dotyk (M01), pełny ekran na telefonie (M03), Online 375×667 (M04). Klawiatura: 69 elementów osiągalnych Tabem, **wskaźnik fokusu widoczny na wszystkich** (1600/390/320 px); modale i arkusze zamykane Escape z powrotem fokusu; ruch z klawiatury (Enter) działa (W03). Cele dotykowe ≥24×24 px (WCAG 2.5.8) — brak naruszeń.

**WCAG 2.2 AA (axe-core, desktop i telefon):** jedyne naruszenia to `aria-required-children` (1) i `aria-required-parent` (64) — struktura ARIA planszy (CHESS-009). Brak naruszeń kontrastu, nazw, języka. Dodatkowe odstępstwa poza axe: komunikaty stanu niewidoczne i bez `aria-live` w widocznej części (CHESS-002 → WCAG 4.1.3 Status Messages), fokus gubiony w historii (CHESS-012 → 2.4.3). Czytnik ekranu i fizyczne urządzenia iOS/Safari: NOT TESTED.

---

## 13. Ocena bezpieczeństwa — **GO**

| §12 | Wynik | Dowód |
|---|---|---|
| 1 Autoryzacja ruchów | PASS — sesja `__Host-` + konto zweryfikowane; ruch tylko uczestnika na swojej turze | S03, S04, S10, S11 |
| 2 Dostęp do partii | PASS — warunek `sender_id OR recipient_id` w każdym zapytaniu; 404 dla obcych | S01, S02, T04, OS01 |
| 3 Ruch za przeciwnika | PASS — `NIE_TWOJA_TURA` | S03 |
| 4 Walidacja wejścia | PASS — `uci` regex + legalność serwera; identyfikator UUID; JSON; rozmiar body (połączenie zrywane powyżej limitu, stan bez zmian) | M06, S12–S14 |
| 5 Wersja stanu | PASS — `UPDATE … WHERE version` | S05–S07 |
| 6 WebSocket | PASS — Origin, sesja, subskrypcja tylko własnej partii (1008), limit 8 wiad./10 s, `maxPayload` 1 KB, zamknięcie przy wylogowaniu/wygaśnięciu | W01–W07 |
| 7 Powtórzenie żądania | PASS | S07 |
| 8 XSS czat/zaproszenia | PASS — wyłącznie `textContent`; CSP `script-src 'self'` (zablokowała nawet wstrzyknięcie skanera axe) | T01, OT01, T02 |
| 9 Prywatne wiadomości | PASS — licznik wyłącznie z własnych rozmów; inne konto widzi 0 | E-other |
| 10 Weryfikacja sesji | PASS | S10, S11, S15 |
| 11 Limity | działają (L01–L03), ale **zbyt agresywne dla ruchów i pollingu** → CHESS-001, CHESS-006 | |
| 12 Ujawnianie danych w błędach/logach | PASS — kody błędów bez danych; logi serwera tylko kody (`MATCH_ERROR {code}`) | |
| 13 Wygaśnięcie sesji | PASS | S15, W07, OE06 |
| 14 Spójność zapisów | PASS — wstawienie partii `ON CONFLICT DO NOTHING`, optymistyczna wersja; blokada znajomego blokuje ruchy i czat | S16 |
| CSRF | PASS — POST wymaga dokładnego Origin; brak/obcy Origin → 403 | S08, S09 |

Nie stwierdzono obejścia autoryzacji, wycieku danych ani możliwości nieuprawnionej zmiany stanu.

---

## 14. Ocena stabilności i wydajności

| §13 | Wynik |
|---|---|
| Zbędne odświeżenia / przebudowa 64 pól | `render()` odtwarza 64 przyciski + SVG przy każdym zaznaczeniu i ruchu (128 pól na zaznaczenie+ruch, P03). Koszt mierzalny, ale akceptowalny: klik→render 72 ms w partii 330 półruchów. Obserwacja, nie usterka. |
| Polling | Przy działającym WS brak pollingu partii; koperta co 50 s. Fallback co 4 s — **przekracza limity** (CHESS-006). |
| Wycieki pamięci / listenery | PASS — 300 przejść po historii: DOM 1893→1893, listenery 586→586, sterta 2,8→3,1 MB (P02) |
| Timery | PASS — CPU wątku głównego w spoczynku 1,6% (długa partia) vs 1,3% (krótka) (P01) |
| Zawieszanie przy AI | **FAIL** — CHESS-007 |
| Duża historia | PASS wydajnościowo; funkcjonalnie CHESS-014 |
| Transfer WS | Delta ruchu w krótkiej partii ~1 KB, w długiej ~41,6 KB (tablica `positions`), pełny stan 57 KB JSON (CHESS-017) |
| PostgreSQL / Redis | Każdy ruch = 1 SELECT sesji + 1 SELECT partii (z `NOT EXISTS` blokad) + 1 UPDATE pełnego JSONB; JSONB po kompresji TOAST ~4 KB (161 półruchów). Redis tylko jako sygnał. Limity `activeGameRequests ≤ 32` i `pendingGameBodies ≤ 64` na proces chronią pulę. Limiter in-memory per proces (przy wielu instancjach efektywne limity rosną nieprzewidywalnie). |
| Skalowanie | Brak testów obciążeniowych (zakazane na produkcji). **Nie deklaruję obsługi 30 000 graczy** — brak dowodów. Wąskie gardła teoretyczne: pełny zapis JSONB na ruch, odczyt pełnego stanu przez WS dla każdego klienta przy każdej zmianie, limiter w pamięci procesu. |
| Stabilność JS | 0 wyjątków `pageerror` we wszystkich sesjach (X01, OX01) |

**Architektura (ryzyko utrzymaniowe, nie usterka):** `chess-console.mjs` (2 119 linii) skleja 9 warstw JS/CSS, które kolejno przenoszą te same węzły DOM i nadpisują style `!important`; stan konsoli przekazywany przez atrybuty `data-console-*` i `MutationObserver`. Dwie usterki P1 (CHESS-002, -003) wynikają wprost z tej warstwowości. Martwy kod: `$('.premium-quick-links')` (wyszukiwanie klasy przez `getElementById`).

---

## 15. Rejestr wykrytych błędów P0–P3

Każda usterka odtworzona co najmniej dwukrotnie (powtórzenia w `results/*-run1.json` lub wielokrotne przebiegi).

### CHESS-001 · **P0 — CRITICAL** · Limit ruchów powoduje przegraną na czas
| Pole | Treść |
|---|---|
| Moduł / lokalizacja | `contact-api/auth/public-identity.mjs:49-55` (`allow()` — stałe okno 900 000 ms = 15 min), `:611-613` (`game-POST:<konto>` = 80) |
| Warunki | Jedno konto wysyła ≥ 81 żądań POST `/auth/match` (ruchy, zgłoszenia remisu; szachy + warcaby + gomoku łącznie) w oknie 15 min liczonym od pierwszego żądania |
| Kroki | 1) Konta P i Q, partia bez zegara: P wykonuje 80 ruchów. 2) Nowa partia 1 min P–Q, obaj wchodzą. 3) P próbuje 1.e4. 4) Czekać 60 s. |
| Oczekiwany | Legalny ruch w aktywnej partii przyjęty; limit nie wpływa na normalną grę |
| Rzeczywisty | `429 ZBYT_WIELE_PROB`, ruch nie zapisany (historia 0), komunikat niewidoczny (CHESS-002), zegar biegnie → „Partia zakończona — wygrywają czarne”, `timeoutLoser=1`, okno przegranej u P |
| Dowód | `results/online-api.json` + `online-api-run1.json` (L01: 81. ruch odrzucony, ×2), `results/browser-limit-history.json` + `-run1.json` (L10, ×2), zrzuty 50, 51 |
| Częstotliwość | 100% po przekroczeniu progu; realne przy 2–3 partiach blitz/bullet (dostępne 1–3 min) w ciągu 15 min |
| Przyczyna | Ogólny limiter anty-nadużyciowy (15 min, stałe okno) zastosowany do legalnych ruchów, które i tak są walidowane wersją i turą |
| Najmniejsza poprawka | Dla `game-POST` krótkie okno (np. 60 s) i próg powyżej maksymalnego tempa gry, lub klucz per partia; pozostałe limity bez zmian |
| Ryzyko regresji | Niskie (jedna ścieżka; walidacja tury/wersji pozostaje) |
| Test potwierdzający | Integracyjny: 2 konta rozgrywają 200 półruchów w < 15 min + kolejna partia — wszystkie ruchy 200; nadal 429 przy zalewie > progu/min |

### CHESS-002 · **P1 — HIGH** · Komunikaty stanu gry niewidoczne
| Pole | Treść |
|---|---|
| Moduł / lokalizacja | `contact-api/auth/chess-console.mjs:1310-1312` (warstwa `approvedOwnerChessCss`: `.side-dock>#game-state:not(:has(.chess-promote)){display:none!important}`); treść ustawiana w `render()` (stała `js`, `chess-console.mjs:15`) |
| Warunki | Domyślny układ (nie „Sama gra”), desktop i telefon, tryb Komputer i Online |
| Kroki | a) 1.e4 f6 2.Hh5+ (szach); b) mat szewczyka z komputerem (wygrana); c) pat Loyda; d) partia bez zegara — czyja tura?; e) Online: ruch odrzucony przez serwer; f) Online: zgłoszony remis |
| Oczekiwany | Gracz widzi: „SZACH”, wynik („Mat — białe wygrywają”, „Pat — remis”, „Partia zakończona — remis”), turę, przyczynę odrzucenia ruchu |
| Rzeczywisty | Teksty są wyłącznie w ukrytym DOM; widoczne tylko w trybie „Sama gra” (V05) i w zakładce Info. Przegrany dostaje okno; zwycięzca i obie strony remisu — nic poza `#` w historii |
| Dowód | `results/browser-visibility.json` (V01–V04 desktop i telefon, V06, V07 — 3 przebiegi), zrzuty 03, 29, 50, 60, 61, 62 |
| Częstotliwość | 100% |
| Przyczyna | Reguła CSS zatwierdzonego kompaktowego układu ukrywa jedyny kanał komunikatów; brak zastępczego wskaźnika (podświetlenie króla w szachu, okno wygranej/remisu, `aria-live`) |
| Najmniejsza poprawka | **Decyzja Ownera co do formy.** Bez zmiany planszy: pokazywać `#game-state` (lub istniejące okno wyniku) dla stanów: szach, koniec partii, błąd ruchu; ewentualnie klasa na polu króla w szachu |
| Ryzyko regresji | Niskie–średnie (układ konsoli) |
| Test potwierdzający | Playwright „widoczności” (harness `browser-visibility.mjs`) na 1600×900 i 390×844 |

### CHESS-003 · **P1 — HIGH** · Czarne w Online grają z planszą odwróconą; obrót niedostępny
| Pole | Treść |
|---|---|
| Moduł / lokalizacja | `chess-console.mjs:15` (stała `js`; serwowane `app.js:9` `orientation=false`, `:31` `toolbar.append(…flip)` — `toolbar` nigdy nie trafia do DOM, `:848` obsługa `flip`) |
| Warunki | Partia Online, gracz 2 (czarne) |
| Kroki | Zaproszenie A→B, B akceptuje, B otwiera partię |
| Oczekiwany | Czarne figury na dole (lub dostępny obrót) |
| Rzeczywisty | Dolny rząd u czarnych: `RNBQKBNR`; w DOM brak przycisku „Obróć szachownicę” |
| Dowód | `browser-online.json` OB03 (3 przebiegi), `browser-local.json` B11 (2 przebiegi), zrzut 22 |
| Częstotliwość | 100% partii Online dla czarnych |
| Przyczyna | Pasek narzędzi z rdzenia nie jest montowany przez warstwy konsoli; orientacja nie zależy od koloru |
| Najmniejsza poprawka | Ustawić `orientation = (online.player===2)` przy wczytaniu partii (render, współrzędne i hit-test przeciągania już obsługują orientację) |
| Ryzyko regresji | Niskie |
| Test potwierdzający | Dwa konteksty: u czarnych lewy dolny róg = h8, etykiety „1..8” odwrócone; przeciąganie trafia w poprawne pola |

### CHESS-004 · **P1 — HIGH** · Zegar Online wyświetlany z zegara urządzenia
| Pole | Treść |
|---|---|
| Moduł / lokalizacja | serwowane `app.js:133` (`Date.now()-Date.parse(source.since)`, źródło `chess-console.mjs:15`); `serverTime` wysyłane (`public-identity.mjs:772,857`, `gomoku-realtime.mjs:70,82`) i nieużywane |
| Warunki | Zegar systemowy urządzenia przesunięty względem serwera |
| Kroki | Kontekst B z `Date.now()+60 s`; porównać zegar aktywnej strony u A i u B |
| Oczekiwany | Oba ekrany pokazują ten sam czas (±1 s) |
| Rzeczywisty | A: 02:54, B: 01:54 (różnica 60 s); przy zegarze opóźnionym gracz widzi więcej czasu, niż ma |
| Dowód | `browser-online.json` OZ02 (3 przebiegi), zrzut 25 |
| Częstotliwość | Każde urządzenie z przesunięciem zegara (skala błędu = przesunięcie) |
| Przyczyna | Brak przesunięcia `serverTime − Date.now()` po stronie klienta |
| Najmniejsza poprawka | Przy każdym snapshot/delta/odpowiedzi zapisać offset (z korektą RTT/2) i stosować w `updateClocks()` |
| Ryzyko regresji | Niskie |
| Test potwierdzający | Playwright z przesunięciem ±60 s → różnica wyświetlania ≤ 1 s |

### CHESS-005 · **P1 — HIGH** · Wygrana na czas przy braku materiału matującego (FIDE 6.9)
| Pole | Treść |
|---|---|
| Moduł / lokalizacja | `public-identity.mjs:153-165` (`advanceGomokuClock`: `winner = przeciwnik` bezwarunkowo); lokalnie serwowane `app.js:143-146` |
| Warunki | Strona na ruchu przekracza czas, przeciwnik ma tylko króla (lub K+S / K+G) |
| Kroki | Partia 1 min; pozycja: białe K+H, czarne sam K, białe na ruchu; czas białych upływa |
| Oczekiwany | Remis (`winner=3`) |
| Rzeczywisty | `winner=2` — czarne (sam król) wygrywają |
| Dowód | `online-api.json` i `online-api-run1.json`, Z04 |
| Częstotliwość | 100% w tej klasie pozycji (rzadkie) |
| Przyczyna | Funkcja zegara wspólna dla gomoku/warcabów/szachów, bez reguły szachowej |
| Najmniejsza poprawka | Dla `game==='szachy'`: przy timeout sprawdzić materiał strony wygrywającej (logika `result()` z `chess-rules.mjs`) → remis |
| Ryzyko regresji | Niskie (gałąź tylko dla szachów) |
| Test potwierdzający | Test API jak Z04 + przypadek odwrotny (przeciwnik z wieżą wygrywa) |

### CHESS-006 · **P1 — HIGH** · Polling awaryjny przekracza limity GET
| Pole | Treść |
|---|---|
| Moduł / lokalizacja | serwowane `app.js:1048` (co 4 s `refreshMatch()+refreshChat()` gdy WS nie działa) vs `public-identity.mjs:611-613` (czat GET 180/15 min, partia GET 240/15 min) |
| Warunki | WebSocket niedostępny (np. proxy blokujące WS); karta aktywna ≥ ~13 min |
| Kroki | Zablokować `/auth/match/realtime`, otworzyć partię, odczekać 14 min (w teście: zegar strony przyspieszony `page.clock`) |
| Oczekiwany | Polling w granicach limitów, plansza aktualna |
| Rzeczywisty | czat: 214 żądań, 34 × 429; partia: 246 żądań, 6 × 429; „Połączenie: ZBYT_WIELE_PROB”, „Czat: ZBYT_WIELE_PROB” — plansza przestaje się aktualizować |
| Dowód | `browser-fallback.json` + `-run1.json` (L11, ×2), `online-api.json` L02/L03 (progi 181/241), zrzut 53 |
| Częstotliwość | 100% przy braku WS |
| Przyczyna | Częstotliwość pollingu (225/15 min na endpoint + wymuszone odświeżenia) nie uwzględnia 15-min limitów |
| Najmniejsza poprawka | W trybie awaryjnym jeden GET (serwer już potrafi zwrócić wiadomości razem z partią) i/lub interwał ≥ 6 s; albo osobny, łagodniejszy limit dla odczytów |
| Ryzyko regresji | Niskie |
| Test potwierdzający | Jak L11: 15 min pollingu bez WS → 0 × 429 |

### CHESS-007 · **P2 — MEDIUM** · Obliczenia komputera blokują wątek UI
| Pole | Treść |
|---|---|
| Moduł / lokalizacja | serwowane `app.js:750-765` (`scheduleComputer` → synchroniczne `chooseComputerMove`), `auth/chess-computer.mjs:24-59` |
| Kroki | Poziom „Najmocniejszy lokalny”, 3 ruchy; `PerformanceObserver('longtask')` |
| Oczekiwany | Brak zadań > 200 ms (INP) |
| Rzeczywisty | 756–762 ms na ruch; przerwa timera 761–772 ms |
| Dowód | `browser-local.json` A04 (3 przebiegi) |
| Częstotliwość | Każdy ruch komputera na poziomie Najmocniejszy (~210 ms na Zaawansowanym) |
| Najmniejsza poprawka | Uruchomić istniejący `computer.mjs` w Web Workerze (CSP `script-src 'self'` na to pozwala) |
| Ryzyko regresji | Niskie–średnie |
| Test potwierdzający | Jak A04: maks. long task < 100 ms |

### CHESS-008 · **P2 — MEDIUM** · Prompt GRACZ AI zawiera „NaN”
| Pole | Treść |
|---|---|
| Moduł / lokalizacja | `contact-api/routes/gomoku-ai-chat-route.mjs:168-169` (`…wyników. '+` i w nowej linii `+'W Szachach…'` → jednoargumentowy `+` → `NaN`) |
| Kroki | Wywołać trasę `/konto/szachy/ai-chat` z atrapą dostawcy, odczytać `messages[0]` |
| Oczekiwany | Prompt zawiera „W Szachach i Warcabach nie otrzymujesz bieżącej planszy…” |
| Rzeczywisty | „…ani wyników. NaNJeśli partiaZakonczona…”; zdanie utracone (łagodzone drugim komunikatem systemowym) |
| Dowód | `results/ai-prompt-nan.json` (2 przebiegi), `harness/ai-prompt.mjs` |
| Częstotliwość | 100% (Szachy, Warcaby, Gomoku) |
| Najmniejsza poprawka | Usunąć jeden znak `+` |
| Ryzyko regresji | Minimalne |
| Test potwierdzający | Jednostkowy: prompt zawiera zdanie o Szachach i nie zawiera „NaN” |

### CHESS-009 · **P2 — MEDIUM** · Nieprawidłowa struktura ARIA planszy
| Pole | Treść |
|---|---|
| Lokalizacja | `#board` `role="grid"` (HTML) + `role="gridcell"` w `render()` (serwowane `app.js:485`) |
| Rzeczywisty | axe: `aria-required-children` (critical, 1), `aria-required-parent` (critical, 64) — WCAG 1.3.1/4.1.2 |
| Dowód | `results/axe-desktop.json`, `axe-telefon.json`, `browser-local.json` W04 (2 przebiegi) |
| Najmniejsza poprawka | Zamienić role na `group` + przyciski z istniejącymi etykietami (bez zmian wizualnych) lub dodać wiersze `role="row"` |
| Ryzyko / test | Niskie / axe 0 naruszeń |

### CHESS-010 · **P3 — LOW** · Wynik Online bez przyczyny
Lokalizacja: serwowane `app.js:466`, `:376-379`. Komunikat „Partia zakończona — wygrywają białe” i okno „Przeciwnik wygrał partię online.” są identyczne dla mata i przekroczenia czasu; remis bez rodzaju. Oczekiwane: „mat”, „koniec czasu”, rodzaj remisu (dane są w stanie: `timeoutLoser`, `drawReason`). Dowód: OR01, OZ03, OZ04 (3 przebiegi). Poprawka: dołączyć przyczynę do tekstu. Ryzyko minimalne. Test: oczekiwany tekst w obu scenariuszach.

### CHESS-011 · **P3 — LOW** · PGN bez wyniku i nagłówków
Lokalizacja: serwowane `app.js:274-276`. Po macie: `1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# *` (oczekiwane `1-0` i nagłówki Seven Tag Roster). Dowód: H03/H04 (3 przebiegi). Poprawka: token wyniku z `result()`/`winner` + minimalne nagłówki. Test: schowek po macie kończy się `1-0`.

### CHESS-012 · **P3 — LOW** · Klawiatura w historii gubi fokus na pozycji 0
Lokalizacja: serwowane `app.js:283-288` — po `Home` fokus ustawiany na `[data-ply="0"]`, który nie istnieje → fokus na `BODY`, dalsze strzałki ignorowane. Dowód: H06 (3 przebiegi: ←,← działają; po Home `focus: BODY`). Poprawka: dla pozycji 0 fokus na przycisku ⏮ lub liście. Test: Home → ArrowRight → pozycja 1.

### CHESS-013 · **P3 — LOW** · Bilans partii z komputerem zawyżany
Lokalizacja: serwowane `app.js:866` (`recorded=false` przy Cofnij) + `recordFinish()` `:148-163`. Wygrana → Cofnij → ten sam mat ×3: bilans 1→2→3→4. Dowód: A09 + `repeat-a09.json` (3 przebiegi). Wpływ: tylko lokalny bilans sesji (bez rankingu). Poprawka: nie zerować `recorded`, jeśli cofnięto ruch kończący już policzoną partię. Test: jak A09 → bilans stały.

### CHESS-014 · **P3 — LOW** · Partie Online > 300 półruchów
Lokalizacja: `auth/chess-match.mjs:37,40` (przycinanie do 300) + serwowane `app.js:241-257, 515-528`. Lista zaczyna się „1. Nf3”, choć to ruch 16.; 300/300 przycisków przeglądu nieaktywnych; PGN z błędną numeracją. Dowód: H10 (2 przebiegi), zrzut 52. Poprawka: numeracja z pola `number`, replay od ostatniej pełnej pozycji (lub brak przycinania przy ~4 KB JSONB). Test: partia 330 półruchów — pierwszy wiersz „16.”.

### CHESS-015 · **P3 — LOW** · Odmiana w etykiecie koperty
Lokalizacja: `auth/chess-owner-console.mjs:636`. „Wiadomości — 2 nieprzeczytanych” (powinno: „2 nieprzeczytane”; 5+ „nieprzeczytanych”). Dowód: E-plural (2 przebiegi). Poprawka: polska reguła liczby mnogiej. Test: 1/2/5/22/25.

### CHESS-016 · **P3 — LOW** · Surowe kody błędów i nieaktualny status sesji
Widoczne/dostępne teksty „Lista pokoi: BRAK_SESJI”, „Połączenie: PARTIA_NIEDOSTEPNA”, „Połączenie: BRAK_SESJI”, „Ruch nieprzyjęty: ODSWIEZ_PARTIE”, „Czat: ZBYT_WIELE_PROB”; `#account-note` pozostaje „Sprawdzanie sesji gracza…” (nigdzie nie aktualizowany). Lokalizacja: serwowane `app.js:621, 772, 817, 313`. Dowód: A03, K04, OS01, OE06, V06, L11 (≥2 przebiegi każdy). Poprawka: mapowanie kodów na komunikaty PL. Test: brak wzorca `[A-Z_]{6,}` w tekstach UI.

### CHESS-017 · **P3 — LOW** · Nadmiarowy transfer stanu przez WebSocket
Lokalizacja: `auth/gomoku-realtime.mjs:80-82` (delta zawiera cały stan poza `board`/`history`, w tym `positions`), `chess-match.mjs:37`. Delta ruchu w partii 330 półruchów: ~41,6 KB (zmiana planszy: 2 pola); stan JSON 57 KB. Dowód: pomiar `long-game.json` (deterministyczny, 2 obliczenia) + W06 (~1 KB w krótkiej partii). Poprawka: pomijać `positions` w delcie (klient używa ich tylko do przycisku remisu — można wysyłać flagę `claimable`). Test: delta < 2 KB niezależnie od długości partii.

### CHESS-018 · **P3 — LOW** · Adres z mandatu zwraca 404
`https://gracz.pl/konto/szachy/` → HTTP 404 `text/plain` (2 próby, 2026-11-16). Strona główna linkuje poprawnie do `https://gracz-contact-api.onrender.com/konto/szachy/`. Informacyjne — do decyzji Ownera (przekierowanie lub korekta dokumentacji).

---

## 16. Funkcje niezaimplementowane lub niezweryfikowane

**NOT IMPLEMENTED (brak funkcji ≠ błąd):**

| Funkcja | Wpływ |
|---|---|
| Poddanie partii (Online i lokalnie) | gracz chcący zakończyć musi czekać na upływ czasu |
| Porzucenie / przerwanie partii bez zegara, wykrywanie nieaktywności | partia bez zegara może pozostać otwarta bezterminowo |
| Propozycja remisu za zgodą przeciwnika | dostępne tylko zgłoszenie 3-krotne/50 ruchów |
| Okno wyniku dla wygranej i remisu | zob. CHESS-002 |
| Wybór lub alternacja kolorów | zapraszający zawsze białymi |
| Obrót planszy w UI | zob. CHESS-003 |
| Import/eksport FEN, import PGN, nagłówki PGN | tylko kopiowanie ruchów |
| Stockfish | świadomie: własny lżejszy silnik |

**NOT TESTED (z przyczyną):**

| Obszar | Przyczyna |
|---|---|
| Produkcja (`gracz-contact-api.onrender.com`, `gracz.pl/konto/szachy/`) | sieć środowiska blokuje host; adres z mandatu = 404; mandat zakazuje ingerencji w produkcję |
| Odpowiedzi rzeczywistego modelu GRACZ AI | brak klucza, usługa zewnętrzna |
| Fizyczne urządzenia iOS/Android, Safari (fallback pełnego ekranu iPhone) | dostępny wyłącznie Chromium |
| Czytnik ekranu (NVDA/VoiceOver) | brak w środowisku; wykonano automatyczny axe |
| Testy obciążeniowe / pojemność | zakazane na produkcji; brak deklaracji pojemności |
| Wieloinstancyjna szyna Redis — scenariusz niezależny | pokryta tylko bazowym `test:scaling` projektu (4/4) |
| Zaproszenia terminowe i przypomnienia e-mail — scenariusz niezależny | pokryte tylko bazowym `two-chromium-chess` (1/1); wysyłka e-mail wymaga zewnętrznego dostawcy |

---

## 17. Plan minimalnych poprawek (ryzyko × korzyść)

Najpierw błędy istniejących funkcji; propozycje nowych funkcji osobno. Żadna poprawka nie wymaga zmiany wyglądu planszy ani figur; pozycja 2 wymaga decyzji Ownera co do formy komunikatu.

| Kol. | ID | Prio | Zakres | Nakład | Ryzyko |
|---:|---|---|---|---|---|
| 1 | CHESS-001 | P0 | Krótkie okno / próg dla `game-POST` (per partia lub per minuta) | XS | niskie |
| 2 | CHESS-002 | P1 | Widoczny komunikat dla szachu, końca partii i błędu ruchu (forma — decyzja Ownera) | S | niskie–średnie |
| 3 | CHESS-003 | P1 | `orientation` zależne od koloru gracza Online | XS | niskie |
| 4 | CHESS-006 | P1 | Jeden GET w fallbacku / dłuższy interwał / osobny limit odczytów | S | niskie |
| 5 | CHESS-004 | P1 | Offset `serverTime` w `updateClocks()` | S | niskie |
| 6 | CHESS-005 | P1 | Reguła FIDE 6.9 w timeoucie szachów (serwer + lokalnie) | S | niskie |
| 7 | CHESS-008 | P2 | Usunięcie jednego `+` w prompcie | XS | minimalne |
| 8 | CHESS-007 | P2 | AI w Web Workerze | M | niskie–średnie |
| 9 | CHESS-009 | P2 | Role ARIA planszy | S | niskie |
| 10 | CHESS-010…017 | P3 | Pakiet: przyczyna wyniku, PGN, fokus historii, bilans, historia >300, odmiana, kody błędów, delta WS | S–M | niskie |

Każda poprawka powinna wejść z testem z kolumny „Test potwierdzający” (harness audytowy można bezpośrednio zaadaptować).

**Propozycje nowych funkcji (do decyzji Ownera, poza zakresem napraw):** poddanie partii; propozycja remisu; przerwanie/porzucenie partii bez zegara; okno wygranej/remisu; alternacja kolorów przy rewanżu; FEN/PGN; ewentualne konsolidowanie 9 warstw konsoli w jeden moduł (redukcja ryzyka regresji — tylko jeśli Owner przewiduje dalszy rozwój konsoli).

---

## 18. Końcowa decyzja techniczna

# **HOLD**

Uzasadnienie zgodne z §15 mandatu: istnieje odtworzona usterka **P0 (CHESS-001)**, która w normalnym użytkowaniu (seria partii 1–3 min) **przesądza o wyniku partii na niekorzyść gracza** — serwer odrzuca jego legalne ruchy, a zegar biegnie do porażki. Dodatkowo 5 × P1 dotyczy rdzenia doświadczenia gry: gracz nie widzi szachu ani wyniku (CHESS-002), czarne grają z odwróconą planszą (CHESS-003), wyświetlany czas może być fałszywy (CHESS-004), wynik na czas bywa niezgodny z FIDE (CHESS-005), a bez WebSocket plansza przestaje się aktualizować po ~13 min (CHESS-006).

Jednocześnie potwierdzam, że **silnik reguł, integralność rozgrywki Online, autoryzacja, odporność na awarie sieci i responsywność są na poziomie produkcyjnym** — fundament nie wymaga przebudowy. Po usunięciu CHESS-001 (zmiana rzędu kilku linii) werdykt zmienia się na **CONDITIONAL GO** z warunkiem naprawy CHESS-002…006 przed kolejnym wydaniem; po ich naprawie i retestach — **GO**.

### Wykaz wyłącznie niezbędnych prac naprawczych (kolejność)
1. CHESS-001 — limit ruchów (P0).
2. CHESS-002 — widoczność komunikatów stanu (P1, forma do decyzji Ownera).
3. CHESS-003 — orientacja planszy dla czarnych (P1).
4. CHESS-006 — polling awaryjny vs limity (P1).
5. CHESS-004 — korekta czasu serwera (P1).
6. CHESS-005 — FIDE 6.9 przy przekroczeniu czasu (P1).

### Oświadczenie o zgodności z §2 i §17
* Nie zmieniono kodu produkcyjnego, wyglądu planszy, figur ani konsoli; nie scalono PR; nic nie wdrożono; nie łączono się z produkcyjną bazą ani kontami.
* Jedyne zmiany w repozytorium: ten raport i katalog dowodów `docs/evidence/chess-full-audit-p0/` (wyniki, zrzuty, logi, harness audytowy — niepodłączony do aplikacji ani CI).
* Zależności `contact-api` zainstalowano z lockfile do ignorowanego `node_modules/`; narzędzia referencyjne (`chess.js`, `axe-core`) wyłącznie poza repozytorium. Testy z jednorazowymi kontami na lokalnym PostgreSQL/Redis; konta usuwane po każdym przebiegu. Koszt dodatkowy: 0 zł.

---

## Indeks dowodów

**Zrzuty** (`docs/evidence/chess-full-audit-p0/screenshots/`):

| Nr | Plik | Treść |
|---|---|---|
| 01 | `01-local-1600x900.jpg` | konsola, tryb Komputer |
| 02 | `02-local-loss-popup.jpg` | automatyczne okno przegranej po macie komputera |
| 03 | `03-local-win.jpg` | wygrana z komputerem — brak komunikatu (CHESS-002) |
| 04 | `04-promotion-picker.jpg` | wybór promocji (jedyny moment widoczności paska stanu) |
| 05 | `05-sheet-*.jpg` | arkusze Ustawienia / Plansza / Figury / Motyw |
| 06 | `06-appearance-walnut-wood-dark.jpg` | Orzech + Drewniane + Ciemny |
| 07 | `07-fullscreen.jpg` | pełny ekran |
| 08 | `08-invite-anonymous.jpg` | Zaproś bez logowania |
| 10 | `10-viewport-*.jpg` | 9 rozdzielczości (pełna strona) |
| 11–14 | `11…14-*.jpg` | dotyk, orientacja pozioma, pełny ekran telefonu, Online 375×667 |
| 20–21 | `20-invite-window.jpg`, `21-invite-received.jpg` | zaproszenie wysłane / odebrane |
| 22 | `22-black-player-view.jpg` | widok czarnych od strony białych (CHESS-003) |
| 23 | `23-online-chat.jpg` | czat z HTML wyświetlonym jako tekst |
| 24 | `24-foreign-match.jpg` | próba otwarcia cudzej partii |
| 25 | `25-clock-skew.jpg` | zegar urządzenia +60 s (CHESS-004) |
| 26–27 | `26/27-online-timeout-*.jpg` | przekroczenie czasu: przegrany / zwycięzca |
| 28–29 | `28/29-online-mate-*.jpg` | mat Online: okno u przegranego / brak komunikatu u zwycięzcy |
| 30 | `30-online-rematch.jpg` | rewanż z prawdziwym przeciwnikiem |
| 40–41 | `40/41-clock-*.jpg` | zegar ostrzeżenie / krytyczny |
| 42 | `42-zoom-*.jpg` | powiększenie 125/150/200 % |
| 43–44 | `43-online-new-game-sheet.jpg`, `44-info-tab.jpg` | arkusz partii Online, zakładka Info |
| 50–51 | `50-move-rate-limited.jpg`, `51-rate-limited-time-loss.jpg` | CHESS-001: ruch odrzucony bez komunikatu → przegrana na czas |
| 52 | `52-online-history-300.jpg` | CHESS-014 |
| 53 | `53-fallback-polling-limit.jpg` | CHESS-006 |
| 60–62 | `60-check-*.jpg`, `61-stalemate-*.jpg`, `62-online-draw-no-visible-result.jpg` | CHESS-002 |

**Wyniki** (`docs/evidence/chess-full-audit-p0/results/`): `engine-diff-d4.json` (perft + różnicowy), `rules-scenarios.json` (65), `ai-quick.json`, `ai-mate2.json`, `ai-match.json`, `ai-prompt-nan.json`, `online-api.json` + `online-api-run1.json` (47), `browser-local.json` (64), `browser-responsive.json` (27), `browser-online.json` (25), `browser-visibility.json` (11), `browser-misc.json`, `browser-zoom.json`, `browser-limit-history*.json`, `browser-fallback*.json`, `repeat-a09.json`, `axe-*.json`, `console-inventory-local.json`, `long-game.json` (330 półruchów), `summary-table.json`.

**Logi** (`logs/`): bazowe testy projektu (jednostkowe 677/677, przeglądarkowe 15/15, `test:scaling` 4/4), log harnessu API, partie AI.

**Uwagi metodyczne:** W dwóch miejscach wynik FAIL okazał się błędem harnessu i został zastąpiony poprawnym pomiarem (B20 w `browser-misc.json` — pole poza oknem; zastąpione przez `browser-zoom.json` 3/3 PASS; pierwsze przebiegi OE04/OZ03 — wyścig i parametr limitu czasu w harnessie, poprawione i powtórzone). Testy L01/L02 mają asercje potwierdzające istnienie limitu — w tabeli liczone jako niespełnienie wymagania. FAIL liczony per wykonanie (z powtórzeniami).

---

## Zbiorcza tabela wyników

| Obszar | Testy PASS | Testy FAIL | NOT TESTED | Ocena |
|---|---:|---:|---:|---|
| Silnik szachowy | 99 | 0 | 0 | **GO** — 0 rozbieżności z referencją |
| Komputer | 20 | 5 | 0 | CONDITIONAL GO (CHESS-007, -008, -013) |
| Online | 27 | 4 | 3 | **HOLD** (CHESS-001, -006); integralność GO |
| Zegary | 8 | 3 | 0 | CONDITIONAL GO (CHESS-004, -005, -010) |
| Plansza i figury | 17 | 2 | 0 | CONDITIONAL GO (CHESS-003) |
| Ruchy i historia | 5 | 3 | 0 | CONDITIONAL GO (CHESS-011, -012, -014) |
| Czat | 9 | 0 | 1 | **GO** |
| Przyciski i konfiguracja | 32 | 11 | 0 | CONDITIONAL GO (CHESS-002, -015) |
| Mobile | 21 | 0 | 1 | **GO** |
| Dostępność (WCAG 2.2) — wiersz dodatkowy | 2 | 3 | 1 | CONDITIONAL GO (CHESS-009, -002, -012) |
| Bezpieczeństwo | 23 | 0 | 0 | **GO** |
| Wydajność | 6 | 0 | 1 | GO z uwagami (CHESS-007, -017) |
| **Razem** | **269** | **31** | **7** | **HOLD** |

Dodatkowo 6 pozycji NOT IMPLEMENTED: poddanie (API), propozycja remisu (API), poddanie/propozycja remisu w UI Online, okno wygranej/remisu, FEN/import PGN, Stockfish. Unikalnych usterek: 18 (P0: 1, P1: 5, P2: 3, P3: 9).
