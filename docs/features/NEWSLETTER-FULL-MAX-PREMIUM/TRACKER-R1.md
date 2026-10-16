# FULL MAX NEWSLETTER — REJESTR POSTĘPU R1
Stan bazowy: 2026-10-16. Ten rejestr nie jest dowodem wykonania; wszelkie oceny wymagają przypisanego PR/HEAD/CI/audytu.
Legenda: PLANNED / IN PROGRESS / PASS / HOLD / FAIL / NOT VERIFIED. PASS tylko z identyfikowalnym dowodem.

| Moduł | Pakiet | Status bazowy | Dowód/uwaga | Bramka |
|---|---|---|---|---|
| M1 Bezpieczeństwo OWNER | A | HOLD | #258: wyłącznie 403 + demo syntetyczne; WebAuthn niezaimplementowany, niezależny audyt wymagany | G1/G2 |
| M2 Centrum Subskrybentów | A | IN PROGRESS | #258: izolowane listy/filtry/cursor/demo; produkcyjne odczyty i autoryzacja niewdrożone | G2 |
| M3 RODO/zgody/DOI/frontend | A | NOT VERIFIED | istnieją moduły newslettera, lecz końcowy status produkcji i dowody E2E trzeba sprawdzić | G2 |
| M4 Dashboard/statystyki | B | PLANNED | istnieją wybrane zdarzenia lifecycle; globalne liczby niezweryfikowane | G3 |
| M5 Newsletter→konto konwersje | B | PLANNED | brak udowodnionego pełnego łańcucha attribution | G3 |
| M6 Własne kampanie | C | PLANNED | bez aktywnej produkcyjnej wysyłki masowej w R1 | G4/G5 |
| M7 Kreator Premium | C | PLANNED | plan i warunki szablonów | G4 |
| M8 Monitoring/Resend/kolejka | C | PLANNED | trzeba zweryfikować provider/webhooks/retry/suppression | G4/G5 |

## Zależności i kolizje
- #258 DRAFT; nie łączyć z main przed przejściem WebAuthn security gate.
- #259 DRAFT master spec. Niniejszy rejestr i plan wykonania przygotowano na gałęzi pochodnej od #259; **najpierw zintegrować #259, potem dokumentację wykonawczą**, lub uzgodnić alternatywne bezkolizyjne scalenie.
- Migracja 005 HARD HOLD; żadnych zmian SQL/produkcyjnych bez osobnego mandatu. Panel Reklamodawcy i e-mail.pl: HOLD.
- Po PASS A+B+C, G5/G6, pełnej akceptacji OWNER -> Gracz Next L6/podwarstwy.

## Szablon kontroli dla każdej iteracji (kopiować pod tym nagłówkiem)
### Audit YYYY-MM-DD HH:MM Europe/Warsaw
- Repo/main SHA:
- PR/branch/HEAD:
- Zakres M#/pakiet:
- Zmiana od poprzedniej kontroli:
- Testy (nazwa, link, exact SHA, PASS/FAIL):
- Niezależny audyt (kto, dowód, data):
- Bezpieczeństwo/RODO/sekrety/migracje/DR:
- Produkt/UX i akceptacja:
- Blokery:
- Status PASS/HOLD/FAIL + uzasadnienie:
- Następny najmniejszy bezpieczny krok:
- Owner GO (jeśli wymagany): TAK/NIE, dowód:

## Weryfikacja ukończenia
[ ] G0 AS-IS i konflikty; [ ] G1 OWNER auth review; [ ] G2 pakiet A; [ ] G3 pakiet B; [ ] G4 pakiet C; [ ] G5 final independent+production; [ ] G6 Owner acceptance; [ ] CLOSED -> L6.

Powyższe pola celowo pozostają niezaznaczone. Nie przypisywać PASS na podstawie samego istnienia plików lub deklaracji wykonawcy.
