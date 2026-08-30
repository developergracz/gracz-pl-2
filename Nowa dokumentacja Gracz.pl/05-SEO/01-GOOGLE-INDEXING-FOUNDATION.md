# Gracz.pl — profesjonalny fundament indeksacji Google

Data przygotowania: 30.08.2026  
Domena kanoniczna: `https://gracz.pl/`  
Status: **PREPARED ON SEO BRANCH / NOT DEPLOYED DURING E4 FREEZE**

## 1. Korekta zakresu

Raport wejściowy Copilota używał domeny `graj.pl`. Właściwą domeną projektu i jedyną domeną kanoniczną jest `gracz.pl`. Wszystkie artefakty SEO muszą wskazywać wyłącznie `https://gracz.pl/`.

## 2. Ustalenia audytu

- publiczna domena `gracz.pl` odpowiada i jest wykrywana przez wyszukiwarki,
- źródłowa strona maintenance zawierała dyrektywę `noindex,follow`,
- w repozytorium nie było plików `maintenance-site/robots.txt` ani `maintenance-site/sitemap.xml`,
- prosta sitemap obejmująca nieopublikowane API, panel użytkownika lub prywatne trasy byłaby błędem.

## 3. Przygotowane zmiany

### `maintenance-site/index.html`

- unikalny, opisowy `title`,
- meta description,
- `robots=index,follow`,
- canonical `https://gracz.pl/`,
- `hreflang=pl-PL` i `x-default`,
- Open Graph i Twitter Card,
- dane strukturalne JSON-LD: `WebSite` + `Organization`,
- opis strony zgodny z rzeczywistym stanem platformy,
- zachowane zabezpieczenia CSP i brak skryptów aplikacyjnych/formularzy.

### `maintenance-site/robots.txt`

- zezwolenie na crawl publicznej strony,
- wskazanie kanonicznej mapy `https://gracz.pl/sitemap.xml`.

### `maintenance-site/sitemap.xml`

- zawiera wyłącznie aktualnie publikowany, kanoniczny i indeksowalny adres `https://gracz.pl/`,
- nie zawiera fikcyjnych ani prywatnych tras,
- nie używa ignorowanych przez Google pól `priority` i `changefreq`.

## 4. Polityka przyszłej mapy witryny

Do mapy dodawać dopiero opublikowane strony, które:

1. zwracają HTTP 200,
2. są publiczne i wartościowe z wyszukiwarki,
3. mają self-canonical,
4. nie mają `noindex`,
5. nie są duplikatami ani adresami z parametrami sesji.

Docelowi kandydaci po uruchomieniu V3:

- strona główna,
- publiczne strony Warcabów i Gomoku,
- publiczne strony rankingów i turniejów,
- aktualności/pomoc,
- ewentualnie publiczne regulaminy.

Nigdy nie dodawać do sitemapy:

- API,
- logowania, rejestracji i resetu hasła,
- panelu użytkownika, ustawień i wiadomości prywatnych,
- administracji,
- sesji rozgrywek i adresów z tokenami/parametrami,
- tras zwracających redirect, 4xx lub 5xx.

## 5. Kontrolowany rollout po zwolnieniu freeze

1. Zrecenzować i scalić pakiet SEO.
2. Wykonać kontrolowany deploy wyłącznie statycznej strony.
3. Potwierdzić HTTP 200 i poprawny typ treści dla:
   - `https://gracz.pl/`,
   - `https://gracz.pl/robots.txt`,
   - `https://gracz.pl/sitemap.xml`.
4. Potwierdzić canonical, meta robots i brak nagłówka `X-Robots-Tag: noindex`.
5. Potwierdzić jedno przekierowanie wariantu `www` na `https://gracz.pl/`.
6. Dodać w Google Search Console wyłącznie `sitemap.xml`.
7. Przeprowadzić Inspekcję adresu URL i poprosić o indeksowanie strony głównej.
8. Monitorować raport indeksowania, Core Web Vitals i ręczne działania.

## 6. Zasada bezpieczeństwa

Ten pakiet nie zmienia bazy danych, Rendera, Cloudflare ani produkcji. Deploy jest celowo wstrzymany, aby nie naruszyć aktywnego E4 freeze i dowodów migracyjnych.
