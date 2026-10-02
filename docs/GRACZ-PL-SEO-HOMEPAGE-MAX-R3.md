# GRACZ.PL SEO HOMEPAGE MAX R3

Status: IMPLEMENTED ON FEATURE BRANCH  
Target: `maintenance-site/index.html`  
Canonical: `https://gracz.pl/`

## Cel

Wzmocnić stronę główną bez przebudowy zatwierdzonego layoutu. Zmiany dotyczą metadanych, semantyki, brandingu w wynikach wyszukiwania, wydajności LCP i kontroli regresji.

## Zmiany R3

- title i meta description zostały skrócone i przesunięte w stronę naturalnych tematów: `gracz.pl`, `gry online`, `gry karciane`, `Academy`;
- Open Graph i Twitter metadata są spójne z nowym opisem strony;
- dodano stabilny kwadratowy favicon PNG 192×192 oraz `rel="icon"` i `apple-touch-icon`;
- Organization JSON-LD otrzymał `alternateName` oraz crawlable `logo`;
- WebPage JSON-LD wskazuje główny zestaw gier przez ItemList;
- ItemList opisuje Poker Academy, Tysiąc, Warcaby i Gomoku wraz z kanonicznymi URL;
- hero ma jawny preload obrazu WebP z `fetchpriority="high"`;
- widoczny tekst hero naturalnie opisuje gracz.pl jako rozwijany portal gier online i karcianych;
- nie dodano `SearchAction`, ponieważ sitelinks search box został wycofany przez Google;
- dodano automatyczny `Maintenance SEO Gate` dla pull requestów i zmian na `main`.

## Guardrails

Gate blokuje regresje w zakresie:

- title 30–60 znaków;
- description 120–160 znaków;
- dokładnie jeden H1;
- canonical `https://gracz.pl/`;
- `index,follow`;
- favicon i preload hero;
- kluczowe linki wewnętrzne;
- poprawny JSON-LD i wymagane typy;
- brak przestarzałego `SearchAction`;
- robots.txt i sitemap.xml.

## Źródła Google Search Central

- Favicon in Search: https://developers.google.com/search/docs/appearance/favicon-in-search
- Organization structured data: https://developers.google.com/search/docs/appearance/structured-data/organization
- Structured data guidelines: https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- Sitelinks search box retirement: https://developers.google.com/search/blog/2024/10/sitelinks-search-box

## Następny etap po PASS

Po przejściu CI można przenieść ten sam standard na podstrony gier, zasady i poradniki, z unikalnymi title, descriptions, canonicalami, breadcrumbami i treścią odpowiadającą intencji każdej podstrony.
