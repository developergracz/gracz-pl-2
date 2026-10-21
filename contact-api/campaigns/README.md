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

## Wysyłka próbna — kandydat R1, WSTRZYMANY produkcyjnie

Kod jednorazowej wysyłki testowej działa **wyłącznie po osobnym uruchomieniu**:
- Tylko zalogowany OWNER, same-origin + CSRF, ręczne potwierdzenie w panelu.
- Tylko istniejąca zapisana wersja robocza, bez zatwierdzania kampanii.
- Odbiorca ustalony na serwerze z istniejącego `CONTACT_TO` (adres obsługi gracz.pl). Panel nie pozwala wpisać dowolnego odbiorcy.
- Przed próbą: gotowa obsługa wypisań, PostgreSQL z wymaganymi uprawnieniami oraz osobny `NEWSLETTER_CAMPAIGN_TEST_SEND_ENABLED=1` (domyślnie OFF).
- Ręczny, osobno zatwierdzany skrypt `test-send-manual-r1.sql` tworzy jedynie `newsletter_campaigns.test_attempts`. Nie jest uruchamiany automatycznie. **Nie stosować bez aktualnej kopii bazy**.
- Trwała rezerwacja w PostgreSQL przed Resend, jeden test na niezmienioną treść kampanii, limit pięciu prób w 24 godziny. Wynik niepewny = brak ponowienia.
- Odpowiedź `accepted` oznacza wyłącznie, że Resend przyjął wiadomość, a nie jej doręczenie.

**Samo scalenie PR nie uruchamia wysyłki.** Bez migracji i przełączenia flagi API odmawia testu, a przycisk w panelu pozostaje nieaktywny.

## Kontrola kwalifikacji pojedynczego odbiorcy — R1 (tylko dowody)

Moduł `recipient-evidence-review.mjs` porównuje wyłącznie nowy zapis z dowodem
aktualnego DOI oraz niezależnie zaszyfrowaną historią wypisań. Weryfikuje
poprawność AES-256-GCM i HMAC bez ujawniania odbiorcy ani jego adresu.
W przypadku niepotwierdzonego wyłączenia u dostawcy, innego historycznego
zgłoszenia lub zobowiązania no-send wynik jest odmowny dla wszystkich.
Potwierdzone wypisanie danego adresu wyklucza go także wtedy, gdy w nowym
rejestrze nie ma jeszcze odpowiadającego mu `revocations`.

**Wynik służy tylko przeglądowi dowodów. Nie jest zgodą na wysłanie.**
Brak publicznego endpointu, harmonogramu, wywołania Resend i przełącznika
pozwalającego ominąć `withdrawal-send-fence.mjs`. Przy przyszłej wysyłce
konieczna jest ponowna walidacja we wspólnej transakcji z blokadami
wycofania zgody, deduplikacja trwałej rezerwacji oraz odrębna akceptacja OWNER.

## Obowiązkowa bramka tuż przed doręczeniem — adapter wewnętrzny

`dispatch-coordinator.mjs` pozostaje domyślnie wyłączony i nie ma trasy HTTP.
Nie przyjmuje już jako kompletnej konfiguracji samej rezerwacji i transportu.
Każda przyszła próba wymaga trwałego jednokrotnego `claim`, istniejącej globalnej
blokady `withSendPermit` oraz świeżego `reviewRecipient(emailTag,to)`.
Ostatni warunek potwierdza AES-GCM/HMAC, aktywny DOI, brak wycofania i dokładny
adres docelowy. Sprawdzenie i wywołanie Resend muszą wykonać się **wewnątrz**
globalnej blokady. Niespełnienie warunku nie może dotrzeć do transportu.

Po trwałej rezerwacji nie wolno ponawiać próby nawet przy niedostępności
bramki. Niepewny wynik pozostaje niepewny. Ten adapter jest wyłącznie
fundamentem przyszłego połączenia; nie instaluje funkcji wysyłkowej, nie
zmienia historycznego globalnego HOLD ani nie uruchamia wysyłek.

## Warunki przed przyszłą wysyłką

1. Dowieść w testach produkcyjnego przepływu: aktualna zgoda DOI, cel przetwarzania, wycofanie zgody i weryfikacja adresu tuż przed próbą doręczenia; nie wykorzystywać listy historycznej.
2. Dokończyć i przejrzeć schemat rezerwacji wysyłek, idempotentność, zapis niepewnego wyniku oraz bezpieczne postępowanie po błędzie Resend. Nie wznawiać automatycznie niepewnych prób.
3. Udostępnić wyłącznie OWNER osobne zatwierdzanie, wysyłkę testową i finalną, pod osobnymi zabezpieczeniami. Potwierdzić poprawność wypisania i zgodność celu zgody.
4. Wykonać testy integracyjne i otrzymać odrębne zatwierdzenie wdrożenia wysyłki. Domyślnie pozostawić funkcję wysyłania wyłączoną.

Rejestr subskrybentów w OWNER pozostaje tylko do odczytu; operacje zapisu obejmują wyłącznie własne wersje robocze kampanii.
