# NEWSLETTER + ADMIN FULL MAX PREMIUM R1 — pakiet projektowy

Data: 2026-10-12
Repozytorium: developergracz/gracz-pl-2
Status: **PROPOZYCJA / DOCUMENTATION ONLY / IMPLEMENTATION HOLD**
Baza źródłowa audytu: main 4fa9b909667651a2580e28b404539dfe4306b950

## Cel

Naprawić wielokrotne zgłaszanie tego samego adresu do newslettera; zaprojektować spójne, dostępne okno powiadomień Premium oraz pierwszy bezpieczny moduł administracyjny właściciela z listą subskrybentów i dowodami zgód.

## Pakiet dokumentów

1. [00-ARCHITECTURE-AND-SCOPE.md](00-ARCHITECTURE-AND-SCOPE.md) — stan zastany, decyzje, model danych i plan PR.
2. [01-DUPLICATE-OPT-IN-AND-PREMIUM-UX.md](01-DUPLICATE-OPT-IN-AND-PREMIUM-UX.md) — przypadki użycia, API, antyspam, stany i komunikaty.
3. [02-ADMIN-CONTROL-CENTER.md](02-ADMIN-CONTROL-CENTER.md) — panel Full Max, backend, autoryzacja, prywatność i operacje.
4. [03-TEST-AUDIT-RELEASE-GATES.md](03-TEST-AUDIT-RELEASE-GATES.md) — matryca testów, audyty, akceptacja, rollback.

## Zasady nienaruszalne

- Nie tworzymy równoległego silnika newslettera ani drugiej bazy jawnych adresów. **Resend** jest źródłem prawdy dla aktywności subskrypcji i adresów; **Render PostgreSQL** przechowuje własny rejestr dowodów zgód/ochrony przed replayem, identyfikowany przez HMAC.
- Nie wolno publicznie potwierdzać, czy dowolny cudzy e-mail jest zapisany. Wyraźny komunikat „już zapisany” wolno wyświetlić dopiero po udowodnieniu kontroli nad adresem lub w autoryzowanej sesji administratora.
- PR wyłącznie dokumentacyjny. Bez dotykania kodu wykonywalnego, zmian bazy, migracji, wysyłki, DNS, Render, Resend, sekretów, aktywacji, deploymentu lub płatności.
- Przyjęcie tej specyfikacji, implementacja obu części, wdrożenie i scalanie wymagają odrębnych decyzji właściciela oraz przewidzianych audytów. Nic tutaj nie stanowi raportu PASS działającego nowego rozwiązania.

## Powiązana dokumentacja

- [Aktualny kontakt/newsletter — README](../../../contact-api/README.md)
- [Migracja PostgreSQL 001](../../../contact-api/persistence/migrations/001_persistent_state.sql)
- [Runbook recovery](../../../contact-api/RENDER_POSTGRES_UPGRADE_RUNBOOK.md)
- [Backups i Disaster Recovery](../../operations/BACKUP_DISASTER_RECOVERY_R1_2026-10-09.md)
- [Reconciliation A1](../../governance/A1-RECONCILIATION-2026-10-08.md)

**Nie wprowadzać wdrożenia tego pakietu do L6 Gracz Next.** To zadanie repozytorium gracz.pl; granice projektów pozostają odrębne.
