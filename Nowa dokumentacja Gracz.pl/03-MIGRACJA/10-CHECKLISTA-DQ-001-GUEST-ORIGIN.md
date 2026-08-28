# ETAP 3 — DQ-001: pochodzenie `guest-*`

Data: 28.08.2026  
Status: **ANALIZA PRZYCZYNY ZAMKNIĘTA — DECISION-READY / BEZ DML / DDL V3 NO-GO**

## 1. Wynik

DQ-001 został domknięty na poziomie kodu i historii Git. Principal `guest-*` jest **EPHEMERAL-GUEST**: techniczną, krótkotrwałą tożsamością do demonstracji gry, która z założenia nie ma rekordu w `gracz_accounts` ani trwałej sesji konta w PostgreSQL.

Dokument nie autoryzuje żadnego DML ani DDL.

## 2. POTWIERDZONE — generator i lifecycle

1. Commit `a377bfc151914ba8bc448cf6e55ffb9598f522eb` z 24.08.2026 03:09:05 UTC dodał `AuthService.issueGuest()` jako „tymczasowe sesje gościa do podglądu gier”.
2. Token guest ma domyślny TTL 1800 s i maksymalnie 3600 s.
3. Token guest celowo nie ma `jti` ani wersji v2; komentarz w kodzie wprost stwierdza, że nie jest zapisywany jako normalna sesja konta w PostgreSQL i nie wymaga rekordu `gracz_accounts`.
4. Commit `06b6352499332c35fcf836d1dac5b0b9a21469aa` z 24.08.2026 03:09:28 UTC dodał `POST /auth/guest`.
5. Endpoint generuje po stronie serwera `randomBytes(4).toString('hex')` i identyfikator `guest-${suffix}` — dokładnie `guest-` + 8 znaków hex.
6. Produkcyjny requester `guest-24ea096d` pasuje dokładnie do tego formatu.
7. Commit `2b8821088dd7025bd4c97680d1b84650288eae90` dodał UI „WEJDŹ JAKO GOŚĆ — ZOBACZ TYSIĄCA”, opisane jako tryb demonstracyjny bez zakładania konta i bez wpływu na ranking.

## 3. POTWIERDZONE — droga do persistent friendship

`trustedChatUser()` akceptuje poprawnie podpisany token i sprawdza rejestr `authSessions` tylko wtedy, gdy token ma `tokenId`. Guest token ma `tokenId = null`, więc nie wymaga rekordu w `gracz_auth_sessions`. Handler przekazuje dalej `userId` i `displayName`, nie odrzucając flagi `guest`.

`requestFriend()` następnie:

- używa `user.userId` jako requestera,
- nie wykonuje lookupu requestera w `gracz_accounts`,
- nie wykonuje lookupu addressee w `gracz_accounts`,
- zapisuje relację bezpośrednio do `gracz_chat_friends`.

Historia `global-chat.js` nie wykazuje zmiany tego writera pomiędzy wprowadzeniem sesji guest a timestampem problematycznej relacji. Oznacza to, że ephemeral guest mógł wejść do trwałego writera Social.

## 4. Klasyfikacja root cause

**ROOT CAUSE: AUTHORIZATION / BOUNDED-CONTEXT GAP.**

Funkcja guest była zamierzona dla krótkotrwałego preview/demo, ale capability guest nie zostało ograniczone na granicy Global Chat / Social. Persistent friendship zaakceptowało ephemeral principal, a schemat nie posiadał FK ani równoważnej walidacji canonical identity.

To nie jest dowód, że `guest-24ea096d` był kiedyś kontem usuniętym. Wręcz przeciwnie: mechanizm guest był zaprojektowany tak, aby konta nie wymagać.

## 5. Decision record DQ-001

| Pole | Wynik |
|---|---|
| Typ principalu | **EPHEMERAL-GUEST** |
| Generator | `POST /auth/guest` + `randomBytes(4).hex` |
| Format ID | `guest-` + 8 znaków hex |
| TTL | 1800 s domyślnie |
| `gracz_accounts` | Celowo brak |
| `gracz_auth_sessions` | Guest nie wymaga trwałego wpisu |
| Friendship przez guest | Możliwe wskutek luki authz/writera; niepotwierdzone jako wymaganie biznesowe |
| Canonical account mapping | **Brak dowodu — nie wykonywać mapowania** |
| Klasyfikacja problemu | Persistent Social write przez ephemeral principal |
| Decyzja remediation | **LEGACY-QUARANTINE** |
| Alternatywa późniejsza | `DELETE-AS-INVALID` tylko po zachowaniu provenance i osobnej autoryzacji DML |
| `MAP-TO-CANONICAL` | Odrzucone przy obecnym evidence |

## 6. Decyzja remediation

Dla migracji V3 rekord nie może wejść do aktywnego canonical Social graph. Bezpieczna decyzja to **LEGACY-QUARANTINE**:

1. zachować provenance problematycznej relacji,
2. wyłączyć ją z aktywnego backfillu Social V3,
3. nie przypinać guest do żadnego konta bez niezależnego, jednoznacznego dowodu,
4. ewentualne fizyczne usunięcie rozpatrywać dopiero jako osobno zatwierdzony DML.

## 7. Wymaganie dla writera docelowego

Przed Social V3 cutover należy usunąć przyczynę, nie tylko rekord:

- persistent social writes muszą wymagać canonical registered identity,
- guest token/capability musi być jawnie odrzucany dla friendship i innych trwałych operacji Social, chyba że produkt świadomie dopuści konkretną funkcję,
- requester i addressee muszą być walidowani względem canonical Identity,
- docelowe constraints/FK można egzekwować dopiero po remediation danych.

## 8. Elementy niewymagane do decyzji LEGACY-QUARANTINE

Nie jest potrzebne zgadywanie, kto korzystał z konkretnej sesji guest ani próba korelacji jej z późniejszym kontem. Takie dochodzenie byłoby wymagane tylko przy wariancie `MAP-TO-CANONICAL`, którego obecny evidence nie uzasadnia.

## 9. Status gate

**DQ-001: DECISION-READY — przyczyna i klasyfikacja zamknięte.**

Nie oznacza to wykonania remediation. Rekord nadal istnieje w AS-IS do czasu kontrolowanego DML lub mechanizmu quarantine w backfillu.

**DDL V3 pozostaje NO-GO**, ponieważ DQ-002 oraz pozostałe bramki preflight nadal są otwarte.