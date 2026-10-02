# GRACZ.PL SEO GAMES HUB MAX R1

Status: IMPLEMENTED ON FEATURE BRANCH  
Target: `maintenance-site/gry/index.html`  
Canonical: `https://gracz.pl/gry/`

## Cel

Wzmocnić dział Gry jako centralny hub tematyczny dla czterech głównych tytułów gracz.pl bez przebudowy zatwierdzonego layoutu.

## Zakres

- precyzyjny title i meta description dla intencji „gry online”;
- H1 zmieniony z ogólnego „Gry” na opisowe „Gry online”;
- widoczny hero opisuje Poker Academy, Tysiąca, Warcaby i Gomoku;
- jawny favicon dla spójnego brandingu w wynikach wyszukiwania;
- preload hero WebP i `fetchpriority="high"` dla głównego obrazu;
- dwa wcześniejsze bloki JSON-LD zostały scalone w jeden spójny graph;
- `CollectionPage` wskazuje `ItemList`, breadcrumb i obraz główny;
- `ItemList` obejmuje 4 główne gry / Academy;
- schema zawiera także WebSite, Organization i ImageObject;
- automatyczny SEO gate rozszerzony z homepage również na `/gry/`;
- gate pilnuje linków do wszystkich czterech gier i ich zasad.

## Guardrails

- bez keyword stuffing;
- bez SearchAction;
- bez zmian backendu, API, bazy i runtime;
- bez sztucznych ratingów, review schema i liczników;
- canonical pozostaje `https://gracz.pl/gry/`;
- robots pozostaje `index,follow`.

## Podstawa

Google Search Central podkreśla, że tytuły i główne nagłówki powinny być opisowe i pomocne, a treść powinna być tworzona przede wszystkim dla użytkownika. Page experience obejmuje m.in. Core Web Vitals, dlatego główny obraz hero otrzymał jawny priorytet ładowania.

## Następny etap po PASS

Po scaleniu: osobne SEO MAX dla Poker Academy, Tysiąca, Warcabów i Gomoku, następnie dla stron zasad.
