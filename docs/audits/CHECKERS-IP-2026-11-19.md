# GRACZ.PL — audit Warcabów, prawa autorskie i zasoby zewnętrzne

**Data:** 2026-11-19  
**Zakres:** `developergracz/gracz-pl-2`, bazowy `main` `b238301a9476c6e6b733ede55a5cc8e47ef1b5e6`  
**Rodzaj:** audyt kodu, deklaracji licencyjnych i porównanie funkcjonalne, bez dostępu do pełnych praw własności oraz bez renderowania produkcyjnej strony w przeglądarce.  
**Wniosek:** niski poziom widocznych oznak bezpośredniego kopiowania Chess.com w **aktualnym katalogu czterech botów**; nie można wydać bezwarunkowego poświadczenia zgodności prawnej całego historycznego repozytorium.

## Weryfikowalne ustalenia

1. **Boty / styl:** `contact-api/auth/checkers-bots-picker.mjs` zawiera cztery profile Mila, Bruno, Nela, Leon. Awatary są kolorowymi inicjałami w HTML/CSS, bez osadzonych portretów, zdjęć, ELO ani zewnętrznych URL obrazów. Układ to autorska lista profili plus konfiguracja, z turkusowo-kremową paletą Gracz.pl. `contact-api/auth/checkers-training-ai.mjs` zawiera lokalne przeszukiwanie alfa-beta (głębokości 1/2/3/5, ograniczenia węzłów/czasu). Nie wykryto importów silnika lub assetów Chess.com w tych modułach. Brak wykrycia nie dowodzi automatycznie pełnej niezależności ani przeniesienia praw przez twórców.
2. **Aktualna konsola:** `contact-api/server.mjs` obsługuje `/konto/warcaby/` przez `contact-api/auth/checkers-console.mjs`. Pionki i korona są przedstawione przez DOM/CSS/SVG. Zbadane pliki `checkers-console.mjs`, `checkers-chess-shell.mjs`, `checkers-ui-parity.mjs` oraz `checkers-bots-picker.mjs` nie odwołują się do plików `flash-*.png`. Moduł `modern/checkers-engine/web/styles.css` używa historycznych assetów Flash, ale to **odrębny** interfejs; nie należy na tej podstawie zakładać, że działa jako obecna produkcyjna konsola.
3. **Historyczne zasoby:** ścieżka `games-dev/Checkers/Checkers Client/` zawiera grafiki/Flash, które zostały w części skopiowane do `modern/checkers-engine/web/assets/`. Identyczne Git blob SHA dla `ornament.png` / `flash-ornament.png`: `c4202c94b41d47f6990a3974ace919d9a01d89e3`; `black-piece.png` / `flash-piece-black.png`: `3783c4979f533d1da2cd27a13f9085c6eab2f79e`; `black-queen-star.png` / `flash-queen-star.png`: `8706d5c9ad540dfe7ad6754157ec9272f6fa1eda`. To dowód tożsamości plików, **nie** dowód praw autorskich. Nie znaleziono w repo dokumentów przenoszących prawa do tych grafik.
4. **SmartFoxServer:** w archiwalnej ścieżce `games-dev/Checkers/Checkers Smartfox Server Extension/library/` znajduje się **38 plików JAR**, w tym `sfs2x.jar`, `sfs2x-core.jar` i biblioteki zewnętrzne. Publiczna dostępność kodu na GitHub nie oznacza licencji na redystrybucję binariów. Nie znaleziono w tej ścieżce umowy ani praw potwierdzających uprawnienie do publicznego udostępnienia tych składników. Nie usuwać bez odrębnej kontroli zależności i historii, nie wznawiać wykorzystania archiwum bez potwierdzenia praw.
5. **QR:** biblioteka `contact-api/auth/assets/qrcode.mjs` zawiera copyright Kazuhiko Arase (2009). Pełny tekst MIT istnieje w `contact-api/auth/assets/QR-CODE-LICENSE.txt`. Dotychczas endpoint `/konto/warcaby/qr.mjs` podawał jedynie kod z nagłówkiem skróconym. W tym PR pełne zawiadomienie MIT jest prefiksem komentarza dystrybuowanego JS, bez modyfikowania algorytmu QR; istniejący test sprawdza zgodność 1:1 treści licencji i kodu dostarczanego przez endpoint.
6. **Porównanie Chess.com:** oficjalna dokumentacja z 2026-08-18: https://support.chess.com/en/articles/8614091-how-can-i-play-against-the-chess-com-bots — oferta osobowości botów, awatarów, rankingów i koronek. Gracz.pl nie zawiera w zbadanym katalogu tych konkretnych postaci, ilustracji ani koronek przypisywanych za zwycięstwa. Podobieństwo ogólnych czynności (wybór bota, koloru, czasu, start) to funkcje typowe. Dyrektywa 2009/24/WE: https://eur-lex.europa.eu/eli/dir/2009/24/oj?locale=pl — idee i zasady nie są chronione jako kod, natomiast konkretne twórcze wykonanie podlega ocenie.

## Gates / dowody do zewnętrznego potwierdzenia

| Kontrola | Status | Co pozostaje |
| --- | --- | --- |
| Katalog botów, silnik i prezentacja — statyczny przegląd kodu | PASS w badanym zakresie | Dowód autorstwa / umów współpracowników przy formalnej certyfikacji |
| Nieosadzanie historycznych bitmap w bieżącej konsoli | PASS w badanych modułach | Zobaczyć dokładny bundle/prod deployment |
| QR MIT notice w JS | PATCH W PR | Sprawdzić wynik wymaganej CI, merge i ewentualne wdrożenie |
| Prawa do Flash i SmartFoxServer | HOLD | Umowy, licencje, faktury, potwierdzenie sublicencji i redystrybucji; przy braku dowodu decyzja o wycofaniu z publicznej historii repozytorium po ocenie wpływu |
| Wizualna kontrola LIVE desktop/mobile | HOLD | Zrzuty/inspekcja bieżącej wersji produkcyjnej. Próba odczytu https://gracz.pl/konto/warcaby/ przez narzędzie web zwróciła błąd; porównanie przeprowadzono z kodem i oficjalnym opisem Chess.com, nie za pomocą aktualnych zrzutów stron. |

## Zalecana decyzja

- **Nie usuwać czterech botów** ani nie zmieniać ich zasad tylko z obawy przed podobieństwem funkcjonalnym.
- **Nie włączać** starszych zasobów Flash/SmartFoxServer do nowego wdrożenia, dopóki nie ma dokumentów potwierdzających uprawnienie.
- **Utrzymać HOLD formalnego audytu prawnego** do otrzymania źródeł praw i wizualnego porównania aktualnej strony. Wymaga ewentualnej oceny prawnika IP; ta notatka nie jest opinią prawną.
- **Bez nowych usług, kosztów i produkcyjnego deployu** w ramach tego PR. Zakres techniczny: tylko wymagane poprawki licencyjne i pojedynczy istniejący test kontraktowy.
