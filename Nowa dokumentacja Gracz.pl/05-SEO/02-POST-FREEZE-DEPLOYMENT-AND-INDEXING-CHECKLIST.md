# Gracz.pl — checklista wdrożenia SEO po zdjęciu freeze

Data przygotowania: 31.08.2026  
Domena kanoniczna: `https://gracz.pl/`  
Powiązany PR: `#28`  
Status: **PREPARED / DO NOT EXECUTE WHILE FREEZE IS ACTIVE**

## 1. Warunek wejścia

Nie rozpoczynać wdrożenia, dopóki wszystkie warunki nie są jawnie potwierdzone:

- [ ] E4 freeze został formalnie zdjęty.
- [ ] właściciel projektu zatwierdził wdrożenie SEO.
- [ ] PR #28 nadal zawiera wyłącznie oczekiwane cztery pliki.
- [ ] PR #28 nie ma konfliktów z aktualnym `main`.
- [ ] istnieje zatwierdzony rollback do poprzedniej wersji statycznej strony.
- [ ] Render i Cloudflare nie mają trwającej zmiany/deployu.

Jeśli dowolny punkt jest niespełniony: **HOLD**.

## 2. Review PR #28 przed scaleniem

- [ ] potwierdzić właściwą domenę `gracz.pl`, nie `graj.pl`,
- [ ] potwierdzić dokładnie jeden `title`,
- [ ] potwierdzić dokładnie jeden meta description,
- [ ] potwierdzić `robots=index,follow`,
- [ ] potwierdzić canonical `https://gracz.pl/`,
- [ ] potwierdzić poprawny JSON-LD: `WebSite` i `Organization`,
- [ ] potwierdzić brak `meta keywords`,
- [ ] potwierdzić brak fikcyjnych URL-i w sitemapie,
- [ ] potwierdzić, że CSP i brak formularzy/skryptów maintenance pozostają zachowane.

## 3. Kontrolowane wdrożenie

1. Scalić PR #28 dopiero po spełnieniu warunku wejścia.
2. Zapisać merge SHA.
3. Uruchomić jeden kontrolowany deploy statycznej strony.
4. Zapisać identyfikator i czas deployu.
5. Nie wznawiać właściwego Web Service i nie dotykać bazy danych.
6. W razie błędu wycofać statyczny deploy do poprzedniego SHA.

## 4. Smoke test HTTP po deployu

Dla każdego adresu potwierdzić kod HTTP, typ treści i treść:

| Adres | Oczekiwany wynik |
|---|---|
| `https://gracz.pl/` | 200, HTML, strona Gracz.pl |
| `https://gracz.pl/robots.txt` | 200, plain text, właściwa sitemap |
| `https://gracz.pl/sitemap.xml` | 200, XML, tylko kanoniczna strona główna |
| `http://gracz.pl/` | trwałe przekierowanie do HTTPS |
| `https://www.gracz.pl/` | 301/308 do `https://gracz.pl/` |

Dodatkowo:

- [ ] brak łańcucha wielu przekierowań,
- [ ] brak pętli przekierowań,
- [ ] brak `X-Robots-Tag: noindex`,
- [ ] self-canonical wskazuje `https://gracz.pl/`,
- [ ] widok mobilny działa poprawnie,
- [ ] strona nie wymaga JavaScriptu do wyświetlenia treści SEO.

## 5. Walidacja techniczna SEO

- [ ] Rich Results Test: brak błędów Organization.
- [ ] Schema Markup Validator: poprawny WebSite/Organization.
- [ ] robots.txt nie blokuje strony głównej ani sitemapy.
- [ ] sitemap.xml jest poprawnym UTF-8 XML.
- [ ] tylko kanoniczne, publiczne URL-e trafiają do sitemapy.
- [ ] tytuł i opis odpowiadają widocznej treści strony.
- [ ] brak mieszanego HTTP/HTTPS.
- [ ] certyfikat TLS obejmuje domenę główną i `www`.

## 6. Google Search Console

Status wejściowy GSC należy traktować jako **zgłoszony jako zweryfikowany**, dopóki nie zostanie potwierdzony bezpośrednio w panelu.

Po udanym deployu:

1. Otworzyć właściwość domenową `gracz.pl`.
2. Potwierdzić status weryfikacji — bez zmiany istniejącego rekordu TXT, jeśli działa.
3. W „Mapy witryn” przesłać wyłącznie `sitemap.xml`.
4. Potwierdzić status „Sukces”.
5. W Inspekcji adresu sprawdzić `https://gracz.pl/`.
6. Uruchomić test strony opublikowanej.
7. Jeśli test przejdzie, poprosić o zindeksowanie.

Prośba o indeksowanie nie gwarantuje obecności ani terminu pojawienia się strony w wynikach.

## 7. Monitoring po wdrożeniu

### Dzień 0

- [ ] zapisać status deployu i testów HTTP,
- [ ] przesłać sitemapę,
- [ ] poprosić o indeksowanie strony głównej.

### Dni 1–3

- [ ] sprawdzić przetworzenie sitemapy,
- [ ] sprawdzić indeksowanie strony,
- [ ] sprawdzić błędy crawl i canonical,
- [ ] nie wysyłać wielokrotnie tej samej prośby.

### Dni 4–7

- [ ] sprawdzić raport indeksowania,
- [ ] sprawdzić wybrany przez Google canonical,
- [ ] sprawdzić wyszukiwanie marki `Gracz.pl`,
- [ ] zapisać wykryte problemy i decyzję PASS/HOLD.

Google wskazuje, że ponowne crawl może potrwać od kilku dni do kilku tygodni; brak wyniku po 72 godzinach nie jest automatycznie błędem.

## 8. Kryterium zakończenia

**SEO rollout PASS**, gdy:

- produkcyjna strona główna jest dostępna i indeksowalna,
- robots i sitemap zwracają HTTP 200,
- canonical i redirect `www` są poprawne,
- GSC akceptuje sitemapę,
- test opublikowanego URL-a nie wykrywa blokady,
- nie naruszono bazy, aplikacyjnego Web Service ani bezpieczeństwa.

Do czasu formalnego zdjęcia freeze: **NICZEGO Z TEJ CHECKLISTY NIE WYKONYWAĆ**.
