# Gracz.pl — statyczna strona informacyjna podczas freeze

Cel: wyświetlać prostą stronę informacyjną pod `gracz.pl` bez uruchamiania właściwego runtime i bez połączenia z produkcyjną PostgreSQL.

## Właściwości bezpieczeństwa

- tylko statyczny `index.html`,
- brak JavaScriptu,
- brak formularzy,
- brak API,
- brak zmiennych środowiskowych,
- brak `DATABASE_URL`,
- brak dostępu do PostgreSQL,
- brak DDL/DCL/DML,
- obecny produkcyjny Web Service ma pozostać `Suspended`,
- `Auto-Deploy` dla istniejącego Web Service pozostaje `Off`.

## Render Static Site — Blueprint

Gotowa konfiguracja znajduje się w:

`maintenance-site/render.yaml`

Blueprint tworzy osobny Static Site:

- Name: `gracz-pl-maintenance`
- Runtime: `static`
- Plan: `free`
- Branch: `main`
- Build Command: brak realnego builda — tylko komunikat kontrolny
- Publish Directory: `.` względem `maintenance-site`
- Auto-Deploy: `Off`
- Environment variables: brak

W Render utwórz Blueprint z repozytorium `developergracz/gracz-pl-2` i wskaż ścieżkę Blueprint Path:

`maintenance-site/render.yaml`

Najpierw zweryfikuj wygenerowany adres `*.onrender.com`. Dopiero po poprawnym smoke teście przepnij custom domain `gracz.pl` z zawieszonego Web Service do osobnego Static Site.

## Warunek freeze

Przepięcie domeny jest wyłącznie zmianą routingu do statycznej strony. Nie wolno przy tym:

- wznawiać produkcyjnego Web Service,
- uruchamiać deployu aplikacji,
- zmieniać `DATABASE_URL`,
- dodawać sekretów,
- włączać writera,
- wykonywać migracji ani mutacji produkcyjnej bazy.

## Powrót po E4.10

Po końcowym GO dla V3:

1. odłącz `gracz.pl` od Static Site,
2. podłącz `gracz.pl` do zatwierdzonego docelowego Web Service,
3. wykonaj końcowy smoke test HTTPS i aplikacji,
4. pozostaw stronę statyczną jako awaryjną stronę maintenance lub usuń ją po formalnym zamknięciu rollback window.
