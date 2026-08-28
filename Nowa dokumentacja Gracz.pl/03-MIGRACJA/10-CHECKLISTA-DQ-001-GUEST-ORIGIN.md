# ETAP 3 — Checklista DQ-001: pochodzenie `guest-*`

Data: 28.08.2026  
Status: **ARTEFAKT ANALITYCZNY — DQ-001 W TOKU / BEZ DML / DDL V3 NO-GO**

## 1. Cel

Domknąć pochodzenie principalu `guest-*` występującego w orphan friendship i podjąć audytowalną decyzję remediation DQ-001 przed przygotowaniem wykonywalnego DML.

Dokument nie autoryzuje żadnego `UPDATE`, `DELETE`, przepięcia relacji ani DDL.

## 2. Stan potwierdzony

- istnieje 1 orphan friendship,
- requester ma identyfikator typu `guest-*` i nie istnieje w `gracz_accounts`,
- addressee istnieje w `gracz_accounts`,
- `gracz_chat_friends` nie ma FK do `gracz_accounts`,
- historyczny writer friendship pozwalał wykonać INSERT bez account-existence check,
- luka istniała od momentu wprowadzenia friendship,
- brak jeszcze dowodu pozwalającego przypisać konkretny `guest-*` do canonical account.

## 3. Checklista źródła principalu

### A. Generowanie identyfikatora

- [ ] znaleźć wszystkie historyczne wystąpienia literalne i konstrukcje tworzące `guest-*`,
- [ ] sprawdzić frontend, backend, testy, fixtures i skrypty pomocnicze,
- [ ] sprawdzić historię commitów z okresu przed utworzeniem orphan friendship,
- [ ] ustalić format/sposób generowania suffixu guest ID,
- [ ] ustalić, czy ID pochodziło z klienta, serwera, sesji, cookie, local/session storage lub test harness.

### B. Lifecycle guest

- [ ] ustalić moment utworzenia guest principal,
- [ ] ustalić TTL/lifetime,
- [ ] ustalić, czy principal przetrwa restart procesu/przeglądarki,
- [ ] ustalić, czy guest był zapisywany w PostgreSQL lub tylko w pamięci/kliencie,
- [ ] ustalić, czy istniała promocja guest -> registered account,
- [ ] ustalić, czy promocja zachowywała/mapowała guest ID,
- [ ] ustalić, czy guest był tylko tożsamością techniczną czy świadomą tożsamością produktową.

### C. Authentication / session evidence

- [ ] sprawdzić historyczne ścieżki `trustedUser` / `trustedChatUser` / auth/session,
- [ ] ustalić, czy endpoint friendship wymagał authenticated account,
- [ ] ustalić, czy nagłówki/parametry użytkownika mogły być przyjęte bez canonical account lookup,
- [ ] sprawdzić, czy guest mógł uzyskać trwałą `gracz_auth_sessions` — nie zakładać tego bez dowodu,
- [ ] skorelować czas orphan friendship z audit/session evidence bez ujawniania PII.

### D. Friendship writer

- [ ] potwierdzić dokładną wersję writera działającą w czasie utworzenia rekordu,
- [ ] potwierdzić źródło requester ID przekazywanego do `requestFriend()`,
- [ ] potwierdzić źródło addressee ID,
- [ ] sprawdzić, czy istniał bypass/test endpoint,
- [ ] sprawdzić, czy writer dopuszczał guest przez zamierzony kontrakt czy wyłącznie przez brak walidacji.

### E. Evidence produkcyjne

- [ ] sprawdzić audit log wokół timestampu utworzenia relacji,
- [ ] sprawdzić, czy ten sam guest ID występuje w innych tabelach/zdarzeniach,
- [ ] sprawdzić, czy istnieje późniejsze konto możliwe do powiązania przez silny dowód techniczny,
- [ ] nie używać samego display name, czasu ani podobieństwa identyfikatora jako dowodu mapowania,
- [ ] nie zapisywać PII do dokumentacji migracyjnej.

## 4. Klasyfikacja końcowa guest

Po zebraniu evidence principal musi otrzymać dokładnie jedną klasyfikację:

- **EPHEMERAL-GUEST** — techniczna, nietrwała tożsamość bez canonical account,
- **TRANSITIONAL-GUEST** — principal poprzedzający rejestrację, z udowodnionym lub nieudowodnionym mapowaniem,
- **PERSISTENT-GUEST** — świadomie trwała tożsamość produktowa,
- **INVALID/TEST PRINCIPAL** — artefakt błędu/testu/bypassu,
- **UNRESOLVED-HISTORICAL** — brak wystarczającego dowodu do bardziej szczegółowej klasyfikacji.

## 5. Decision record DQ-001

Do uzupełnienia po evidence:

| Pole | Wynik |
|---|---|
| Typ guest principal | TBD |
| Generator / writer | TBD |
| Persistence | TBD |
| Authentication semantics | TBD |
| Guest friendship zamierzone? | TBD |
| Canonical account mapping | TBD |
| Siła dowodu mapowania | TBD |
| Decyzja remediation | TBD |
| Uzasadnienie | TBD |
| Ryzyko | TBD |
| Wymagany postcheck | TBD |

## 6. Dozwolone decyzje remediation

1. **MAP-TO-CANONICAL** — tylko przy jednoznacznym, audytowalnym dowodzie.
2. **LEGACY-QUARANTINE** — bezpieczny default, jeśli brak jednoznacznego mapowania; rekord zachowany jako provenance, ale nie trafia do aktywnego canonical Social V3.
3. **DELETE-AS-INVALID** — dopiero po formalnym potwierdzeniu braku wartości historycznej i osobnej autoryzacji DML.
4. **PERSISTENT-GUEST-IDENTITY** — tylko jeśli wymaganie biznesowe świadomie utrzymuje trwałych guestów w V3.

## 7. Kryteria zamknięcia DQ-001

DQ-001 można oznaczyć jako **DECISION-READY**, gdy:

- znana jest historyczna ścieżka tworzenia lub wiarygodnie udokumentowano jej brak w repo,
- ustalono lifecycle guest,
- ustalono kontrakt friendship wobec guestów,
- zebrano produkcyjne evidence wystarczające do decyzji,
- wybrano jedną decyzję remediation,
- decyzja została wpisana do `08-MACIERZ-DECYZJI-DQ-001-DQ-002.md`,
- decyzja została przeniesiona do `09-PLAN-DML-REMEDIATION.md`, nadal bez wykonania.

## 8. STOP conditions

Natychmiast zatrzymać decyzję `MAP-TO-CANONICAL`, jeśli:

- mapowanie opiera się tylko na podobnej nazwie/display name,
- istnieje więcej niż jedno możliwe konto,
- brak spójnego audit/session evidence,
- dane z kodu i produkcji są sprzeczne,
- wymagane byłoby ujawnienie lub zgadywanie tożsamości użytkownika.

W takim przypadku bezpieczny kierunek pozostaje `LEGACY-QUARANTINE` do czasu uzyskania lepszego dowodu.

## 9. Relacja do GO/NO-GO

Zamknięcie DQ-001 usuwa tylko jeden blocker Data Quality. **Nie oznacza automatycznego GO dla V3 DDL.** Nadal wymagane są m.in. DQ-002, rerun data-quality po remediation, backup + restore test, fresh schema diff, writer/reader/worker inventory, crypto compatibility, active-state/cutover, credential/least-privilege gate oraz finalne GO/NO-GO.