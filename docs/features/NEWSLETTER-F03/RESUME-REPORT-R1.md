# #257 — raport kontynuacji i propozycja TRACKER-R1

2026-10-16, Europe/Warsaw. Zakres: F-03 / część M3 pakietu A, bez zmian panelu OWNER.
#257 jest issue, nie numerem PR. Nowy PR jest odrębnym DRAFT opartym na #254.

## Odzyskany stan

- Repo: developergracz/gracz-pl-2.
- Main po ponownym fetch: `bfbd5da5acd088430c2c3cb9d9b9fbc653bad30e`.
- Baza implementacji: #254 `7ecb81af6a73d0eedb0340a65c880010caca0075`.
- Gałąź: `codex/257-newsletter-migration`.
- Odzyskany commit implementacji: `5ad9985087eb6c32f967392e55a063b10e1eb6be`.
- W chwili wznowienia: czysty katalog roboczy, żadnej przerwanej edycji; commit był
  wyłącznie lokalny. Push nie wykonał się z powodu limitu kontroli zatwierdzania.
- Po mandacie RESUME ponowiono normalną kontrolę: push tej samej gałęzi zakończył
  się sukcesem. Bez odtwarzania kodu, rebase lub zmiany cudzych gałęzi.
- Końcowy SHA dokumentacji/PR oraz dokładne linki CI: w opisie DRAFT PR.

## Przeczytane źródła i granice dowodów

- #257 i komentarz Ownera o niezależnym publicznym newsletterze.
- #254 R5.2, #255 `5c1d37338b31ee75b65e688b8ba155102a9a6780`.
- #258 `a0d71debb4697c3576d058f889565924592bd7f5`: inert/synthetic OWNER R1;
  brak wdrożonego WebAuthn i odczytów produkcyjnych.
- #259 `16a06b8323fe68285171f31d4ec2016d9f48218b`: MASTER SPEC.
- #260 `31b35f64a511e13ef58f26ca728a92e94916ffb8`: EXECUTION-PLAN-R1,
  TRACKER-R1 i CODEX-AUDIT-MANDATE-R1.
- Lokalne runbooki newslettera, migracje001–004, CONTACT CONTRACT prep,
  PRODUCTION_BACKFILL_RUNBOOK, zasady DR oraz A1-RECONCILIATION-2026-10-08.
- Pełne ZIP1 Architecture & Quality i ZIP2 Execution & Audit Program nie zostały
  odnalezione w checkout ani wyszukiwaniu repozytorium. Poproszono o lokalizację.
  Podsumowanie A1 nie jest dowodem przeczytania pełnych pakietów ani zastępczą
  akceptacją ich bramek. Weryfikacja zgodności z pełnymi ZIP pozostaje NOT VERIFIED.

## Zmiana i kompatybilność

Oddzielna tożsamość `newsletter/001_opt_in_requests` i ledger
`newsletter_schema_migrations`; atomowe utworzenie tabeli/seal/ledger, checksumy,
kontrola rzeczywistego połączenia i trwałości tabel, odmowa przy częściowym lub
nieznanym stanie. Preflight dokumentuje świadectwa operatora; nie weryfikuje sam
żywych faktów Render/DR. Automatyczny migrator, kandydacki SQL, 001–004 i runtime
B1/B2 nie zmienione. CONTACT005 nie wykonano i nie przejęto jego numeru.

Model expand → migrate → contract: izolowany addytywny expand, następnie istniejący
fenced import historii po pełnym zatrzymaniu writerów, następnie nowe API z pauzą.
CONTACT CONTRACT jest osobnym przyszłym etapem, nie warunkiem uruchomienia
newslettera. Rollback aplikacji wyłącznie do inert API; bez odwracania SQL lub
odtwarzania starego snapshotu nad nowszymi zgodami. Dokładne kroki i komendy:
`contact-api/NEWSLETTER_F03_RELEASE.md`.

Nie tworzono nowego kanonicznego zbioru adresów, kampanii, statystyk ani kontraktów
atrybucji. Propozycje danych z #259 są logiczne, a nie zgodą na zastąpienie
istniejącego HMAC/consent store. Przyszły OWNER/kampanie mają korzystać z istniejącej
semantyki zgód i suppression; brak stanu lub dowodu musi pozostać unknown/HOLD.
Osiem modułów A+B+C pozostaje docelowym zakresem produktu, ale ta zmiana nie
przypisuje im końcowego PASS i nie rozpoczyna L6.

## Testy i review

Odzyskane pełne logi sprawdzone ponownie przy wznowieniu:

| Zestaw lokalny | Wynik |
|---|---|
| Node24.19.0 backend |84 PASS,0 FAIL,0 SKIP|
| PostgreSQL16 integracje |111 PASS,0 FAIL,0 SKIP|
| PostgreSQL18 integracje |111 PASS,0 FAIL,0 SKIP|
| Footer Premium |5 PASS,0 FAIL|
| Syntax/SEO/CSP/diff |PASS|

PG totals obejmują rodziców/nested i adaptery pamięci; dziewięć nowych przypadków
F-03 działa na rzeczywistych jednorazowych PG obu wersji. Provider jest lokalnym
fixture, nie live Resend. UI newslettera pozostał identyczny z #254; nie wykonano
nowego produkcyjnego smoke ani pełnego przeglądu każdej opublikowanej podstrony.

Jeden niezależny delta-review wykrył P1: akceptację UNLOGGED. Regresję odtworzono
RED, wymaganie permanent relations poprawiono i oba pełne zestawy powtórzono GREEN.
Test podstawionego rzeczywistego portu także PASS. F-03 testuje zabicie procesu przed
COMMIT i odczyt po COMMIT przez świeży pool; nie deklaruje wstrzyknięcia utraty
odpowiedzi COMMIT. R5 transportowe regresje są zachowane w pełnym zestawie.

## Kolizje

- #254: zależność bazowa; osobny stacked PR, gałąź #254 nietknięta.
- #255, #258 i #260: lokalne `git merge-tree --write-tree <ref> HEAD` nie wykazały
  konfliktów tekstowych. To analiza drzewa, nie merge gałęzi, test zintegrowanego
  runtime ani autoryzacja wdrożenia #258.
- #259 jest bazą #260. Nie nadpisano dokumentacji/trackerów tych PR.
- #253 Premium validation jest już w finalnym kontrolerze #254; nie wolno go
  zastąpić starszym frontendem. #248 jest wcześniejszą alternatywą, nie zależnością.
- CONTACT005: przetestowano osobną przestrzeń ledgerów z symulowaną przyszłą
  tożsamością. Finalnego destructive SQL CONTACT nie ma w checkout; jego
  kompatybilności nie oznaczono jako przetestowanej.

## TRACKER-R1.md — proponowana aktualizacja, bez zmiany cudzej gałęzi

| Moduł | Proponowany status | Dowód i rozróżnienie |
|---|---|---|
| M1 |HOLD — bez zmiany|#258; WebAuthn gate pozostaje otwarta; F-03 nie implementuje auth|
| M2 |IN PROGRESS — bez zmiany|#258 synthetic; F-03 nie uruchamia czytników ani UI OWNER|
| M3 |IN PROGRESS; F-03 IMPLEMENTED/TESTED; produkcja HOLD|commit5ad9985, backend84, PG16/18 po111, footer5; delta-review poprawiony; exact-HEAD CI w nowym DRAFT PR; brak live smoke/DR/GO|
| M4 |PLANNED — bez zmiany|brak nowych agregacji/globalnych liczników|
| M5 |PLANNED — bez zmiany|brak nowej atrybucji; rejestracja bez zmian|
| M6 |PLANNED — bez zmiany|brak kampanii lub bulk-send|
| M7 |PLANNED — bez zmiany|brak edytora/szablonów kampanii|
| M8 |PLANNED — bez zmiany|testy istniejących błędów/restartów B1/B2 nie dowodzą kompletnej kolejki/webhooków kampanii|

G0: wąska inwentaryzacja F-03 wykonana, pełne ZIP NOT VERIFIED. G1–G6 oraz CLOSED
pozostają niezaznaczone. Nie zastępować statusu całego M3 przez PASS jedynie z
powodu gotowej migracji. Zachować nowe wpisy innych wykonawców podczas późniejszej
aktualizacji TRACKER-R1.

## Werdykt i następny krok

PASS: lokalna implementacja F-03 i wskazane testy. HOLD: finalna zgodność ZIP,
exact-HEAD CI dopóki brak zakończonych wyników, zintegrowana akceptacja, rzeczywiste
Render freeze/all-writer retirement, produkcyjny registry/schema, restore/escrow,
provider uncertain inventory i boundary importu, osobne Owner GO na merge/SQL/
release/enable. Brak produkcyjnych operacji, wysyłek, DNS, sekretów lub zakupów.

Najmniejszy kolejny krok: zakończyć jeden DRAFT PR F-03 z CI i niniejszą propozycją
statusów; następnie przekazać dokładny HEAD do odbioru. Nie rozpoczynać kolejnej
przebudowy admina ani L6 w tym zadaniu.
