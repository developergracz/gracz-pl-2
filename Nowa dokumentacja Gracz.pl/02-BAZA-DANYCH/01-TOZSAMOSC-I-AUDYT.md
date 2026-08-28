# PostgreSQL — tożsamość i audyt

## Status

Pierwsza część mapowania PostgreSQL objęła:

- **7 tabel obszaru tożsamości**,
- **1 tabelę obszaru audytu**.

Łącznie stanowi to 8 z 26 tabel objętych pełną mapą audytową.

## Standard dokumentowania

Szczegółowe definicje tabel, kolumny, ograniczenia, indeksy i operacje aplikacyjne mogą być wpisywane do tego dokumentu wyłącznie po ponownym wskazaniu odpowiadających im dowodów DDL/DML w repozytorium lub rzeczywistym schemacie środowiska.

Nie należy uzupełniać brakujących szczegółów z pamięci ani przez analogię do typowych systemów uwierzytelniania.

## Stan potwierdzony na poziomie zakresu

- część „tożsamość” obejmuje 7 tabel,
- część „audyt” obejmuje 1 tabelę,
- te obszary zostały wydzielone jako pierwsze partie ETAPU 1B,
- pełny ETAP 1B pozostaje otwarty do czasu opracowania pozostałych 18 tabel i końcowej weryfikacji.

## Następny krok

Kontynuować mapę od kolejnego obszaru — gier — zachowując rozdzielenie dowodów DDL i DML oraz zasadę braku niepotwierdzonych nazw kolumn/metod.
