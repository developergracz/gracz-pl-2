# Kampanie newslettera — etap wersji roboczych aktywny; wysyłka wyłączona

## Działający zakres produkcyjny

- Tabela `newsletter_campaigns.campaigns` zainstalowana ręcznie z `draft-only-manual-r1.sql`; ta migracja **nie** jest częścią automatycznego migratora.
- Panel OWNER umożliwia przygotowanie podglądu, zapis, listę, ponowne otwarcie i korektę **wyłącznie wersji roboczych**.
- Wszystkie prywatne operacje OWNER wymagają aktywnej sesji, poprawnego Origin i CSRF. Polecenia modyfikujące inne stany kampanii nie istnieją.
- Odczyt i modyfikacja są ograniczone do `state='draft'`. Lista nie zwraca treści wiadomości; treść pobierana jest dopiero po wybraniu zapisanej wersji roboczej.
- Włączenie możliwości zapisu wymaga `NEWSLETTER_CAMPAIGN_DRAFTS_ENABLED=1`, dostępnej tabeli oraz wymaganych uprawnień PostgreSQL.

## Granice bezpieczeństwa

**Wysyłanie kampanii jest wyłączone.** Wersje robocze nie rezerwują odbiorców, nie odczytują ich adresów, nie tworzą rekordów wysyłki i nie wywołują Resend. Zmiany w tym etapie nie wymagają kolejnej migracji bazy.

`schema-r1.sql` zawiera kandydackie tabele i procedury wysyłki. **Nie są zainstalowane w produkcji**. `dispatch-coordinator.mjs`, `pg-dispatch-store.mjs` i `resend-transport.mjs` są tylko niepodłączonymi adapterami; ich obecność nie oznacza gotowości funkcji wysyłkowej.

## Warunki przed przyszłą wysyłką

1. Dowieść w testach produkcyjnego przepływu: aktualna zgoda DOI, cel przetwarzania, wycofanie zgody i weryfikacja adresu tuż przed próbą doręczenia; nie wykorzystywać listy historycznej.
2. Dokończyć i przejrzeć schemat rezerwacji wysyłek, idempotentność, zapis niepewnego wyniku oraz bezpieczne postępowanie po błędzie Resend. Nie wznawiać automatycznie niepewnych prób.
3. Udostępnić wyłącznie OWNER osobne zatwierdzanie, wysyłkę testową i finalną, pod osobnymi zabezpieczeniami. Potwierdzić poprawność wypisania i zgodność celu zgody.
4. Wykonać testy integracyjne i otrzymać odrębne zatwierdzenie wdrożenia wysyłki. Domyślnie pozostawić funkcję wysyłania wyłączoną.

Rejestr subskrybentów w OWNER pozostaje tylko do odczytu; operacje zapisu obejmują wyłącznie własne wersje robocze kampanii.
