# ETAP 3 — Data Quality / Orphan / Collision — wynik

Data pomiaru: 28.08.2026
Status: **NO-GO dla produkcyjnego DDL wymagającego nowych UNIQUE/FK/NOT NULL**

## POTWIERDZONE

Read-only collector wykazał:
- `ORPHAN-FRIEND-REQUESTER`: 1 rekord,
- `DUP-ACCOUNT-EMAIL-NORMALIZED`: 3 grupy kolizyjne,
- `COLLISION-NEWSLETTER-CONSENT-TIMES`: 3 rekordy — REVIEW,
- pozostałe sprawdzone orphan/dead/timestamp/crypto structural checks: 0 naruszeń.

Sekwencje krytyczne nie wykazały przypadku `last_value < MAX(id)`. Gaps w sekwencjach są traktowane informacyjnie, nie jako błąd.

Załączniki mają kompletne pola crypto; obserwowane IV mają 12 bajtów, auth tag 16 bajtów. Jest to wyłącznie walidacja strukturalna — decryptability/AAD/key compatibility pozostaje osobną bramką.

## Aktywny stan

Collector wykazał:
- 0 aktywnych niewygasłych/niewycofanych sesji auth,
- 2 rekordy Warcaby game sessions,
- 29 rekordów Tysiąca,
- 0 otwartych apelacji moderacyjnych,
- 2 newslettery `pending_confirmation`,
- 0 nieterminalnych turniejów.

Same rekordy gry nie są automatycznie interpretowane jako aktualnie rozgrywane mecze; wymagają state/business profiling przed cutover.

## BLOCKERY

### DQ-001 — orphan friendship
Jeden `gracz_chat_friends.requester_id` nie ma odpowiadającego konta. Przyszły canonical social/FK mapping wymaga jawnej klasyfikacji tego rekordu.

### DQ-002 — normalized email collisions
Trzy grupy kont kolidują po `lower(trim(email))`. Nie wolno tworzyć docelowego V3 UNIQUE na normalized email ani automatycznie scalać kont bez drill-down i reguły Identity migration.

## REVIEW

### DQ-003 — newsletter consent timestamps
Trzy rekordy mają rozbieżność `consent_at` vs `consented_at` > 1s. Należy zachować provenance i ustalić canonical mapping, nie nadpisywać historii arbitralnie.

## Następny krok

Uruchomić `06-BLOCKER-DRILLDOWN-COLLECTOR.sql`, który nie wypisuje e-maili, nazw, treści ani tokenów. Wynik ma dostarczyć minimalne dane potrzebne do klasyfikacji DQ-001/DQ-002/DQ-003 i decyzji migracyjnej.

Produkcja pozostaje **NO-GO** do czasu zamknięcia blockerów preflight oraz pozostałych bramek backup/restore, writer inventory, crypto compatibility, credentials i końcowego GO/NO-GO.