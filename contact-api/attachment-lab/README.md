# gracz.pl — laboratorium załączników Full Max Premium

**Tylko przygotowanie i ręczne testy, nie obsługa załączników w produkcji.**

Dwa niezależne zadania w GitHub Actions, uruchamiane wyłącznie na polecenie
właściciela i na tymczasowych maszynach GitHub:

- ClamAV: instalacja darmowego silnika, pobranie oficjalnych sygnatur
  FreshClam, skanowanie czystego syntetycznego pliku oraz nieszkodliwego
  wzorca testowego EICAR. Nieudana aktualizacja sygnatur oznacza FAIL.
- Konwerter: ImageMagick testuje PNG → JPG → PNG; Pandoc generuje
  HTML i DOCX z testowego Markdown; Ghostscript tworzy PDF z kontrolowanego
  PostScriptu. Nie ma prób konwersji prawdziwych plików użytkowników.

## Uruchomienie na żądanie

1. Otwórz GitHub: developergracz/gracz-pl-2 → Actions.
2. Wybierz "gracz.pl - test ClamAV i konwersji (recznie)".
3. Kliknij Run workflow, wybierz main i ponownie Run workflow.
4. Sprawdź osobno wyniki antivirus i conversion — oba muszą być PASS.

Laboratorium nie uruchamia się samo przy push, PR ani wdrożeniu i nie
otrzymuje produkcyjnych sekretów. Nie tworzy usług ani nie instaluje
pakietów na Render. Testy zużywają minuty GitHub Actions; koszt zależy
od dostępnej darmowej puli na koncie. Bazy ClamAV mogą zostać czasowo
ograniczone dla współdzielonych adresów IP GitHub — wtedy wynik FAIL
zamiast pozornego powodzenia.

## Granica produkcyjna

Formularz OWNER wyświetla wybór lokalnego pliku, ale blokuje wysyłkę,
gdy plik jest wybrany. Backend nie przyjmuje dodatkowego pola załącznika.
Wysyłka wiadomości tekstowych działa niezależnie.

Testy nie uruchamiają rzeczywistego skanowania załączników w API, nie
gwarantują bezpieczeństwa złośliwych formatów, makr, archiwów ZIP ani
wierności konwersji XLSX i DOCX. Przed przyszłym włączeniem plików
potrzebne będą izolacja, skaner z aktualnymi sygnaturami, kontrola MIME,
limity rozpakowania, kwarantanna, bezpieczna konwersja, ponowny skan
wyników, szyfrowany magazyn oraz rygorystyczny status PASS.

**Produkcja: załączniki OFF, dopóki właściciel nie wyda osobnej zgody.**
