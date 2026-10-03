# 08 — UI/UX i Accessibility Specification SEARCH R4

Status: **TARGET DESIGN / PRODUCT SPEC**
Wersja: 1.0

## 1. Cel interfejsu

SEARCH R4 ma zachować szybkość obecnej wyszukiwarki, a jednocześnie dodać AI bez zamieniania wyszukiwania w nieprzewidywalny chatbot.

Interfejs ma być:

- prosty przy pierwszym kontakcie,
- zaawansowany po rozwinięciu,
- dostępny klawiaturą,
- czytelny na mobile,
- jasny co do źródeł i działania AI.

## 2. Trzy tryby

Główne przełączniki:

```text
[Szukaj] [Zapytaj AI] [Mój trener]
```

### Szukaj

- szybkie wyniki R2/semantic,
- brak generowania, jeśli niepotrzebne,
- filtry i liczniki,
- deep-links.

### Zapytaj AI

- pytania naturalnym językiem,
- odpowiedź źródłowa,
- jawne źródła,
- follow-up questions,
- CTA do materiałów.

### Mój trener

- tylko dla zalogowanego użytkownika,
- rekomendacje oparte na Player Context,
- jasny komunikat, że odpowiedź wykorzystuje postęp Academy.

## 3. Główne pole

Placeholder zależny od trybu:

Szukaj:
`Szukaj gry, zasad, Academy lub poradnika…`

Zapytaj AI:
`Zapytaj o zasady, strategię lub pojęcie…`

Mój trener:
`Zapytaj, co ćwiczyć dalej…`

## 4. Odpowiedź AI

Sekcje:

1. **Odpowiedź**
2. **Źródła gracz.pl**
3. **Co dalej?**
4. opcjonalnie **Powiązane pytania**

Przykład:

```text
Odpowiedź AI
W wariancie opisanym na gracz.pl bicie w Warcabach jest obowiązkowe...

Źródła gracz.pl
[Zasady Warcabów → Bicie pionków przeciwnika]

Co dalej?
[Wielokrotne bicie] [Uruchom quiz]
```

## 5. Jawność AI

Interfejs musi odróżniać:

- zwykły wynik wyszukiwania,
- odpowiedź wygenerowaną przez AI,
- rekomendację trenera,
- treść źródłową.

AI nie może być wizualnie przedstawiane jako „oficjalny tekst zasad”.

## 6. Confidence UI

Nie pokazujemy surowych procentów modelu.

Dozwolone:

- `Odpowiedź oparta na oficjalnych zasadach gracz.pl`
- `Odpowiedź oparta na materiałach Academy`
- `Nie znaleźliśmy wystarczająco pewnego źródła`

## 7. Loading states

Szybka sekwencja:

```text
Szukam w gracz.pl…
→ Sprawdzam najlepsze źródła…
→ Przygotowuję odpowiedź…
```

Nie należy symulować sztucznego „pisania”, jeśli odpowiedź jest już gotowa.

## 8. Fallback UX

Przy awarii AI:

> Tryb AI jest chwilowo niedostępny. Nadal możesz korzystać z normalnego wyszukiwania gracz.pl.

Pod spodem od razu zwykłe wyniki.

## 9. Brak odpowiedzi

> Nie znalazłem wystarczająco pewnej odpowiedzi w zatwierdzonych materiałach gracz.pl.

Następnie:

- top search results,
- sugestie fraz,
- możliwość zawężenia gry.

## 10. Źródła

Każde źródło pokazuje:

- tytuł,
- typ,
- grę,
- deep-link,
- opcjonalny krótki fragment.

Kliknięcie źródła zawsze prowadzi do strony gracz.pl, nie do model providera.

## 11. Mój trener

Karta rekomendacji:

```text
Następny krok
Pozycje, button i blindy

Dlaczego?
W ostatnim quizie błędy dotyczyły pozycji przy stole.

[Ćwicz teraz] [Zobacz materiał]
```

## 12. Mobile

Na ekranach mobilnych:

- przełączniki trybów scrollowalne poziomo lub segmentowane,
- źródła pod odpowiedzią,
- brak stałych szerokich paneli bocznych,
- przyciski minimum 44×44 px,
- sticky close/back,
- odpowiedź bez poziomego scrolla.

## 13. Keyboard

Wymagane:

- `Ctrl/Cmd + K` otwiera search,
- `Esc` zamyka modal,
- `↑/↓` poruszają po wynikach,
- `Enter` otwiera wynik,
- Tab zachowuje logiczną kolejność,
- focus indicator pozostaje widoczny dla elementów interaktywnych.

Pole input może nie mieć wewnętrznej przeglądarkowej ramki, jeśli zewnętrzny kontener zapewnia wyraźny stan focus.

## 14. Accessibility

Minimum:

- semantyczne role,
- `aria-live` dla wyniku i statusu AI,
- brak informacji wyłącznie kolorem,
- kontrast zgodny z WCAG AA,
- prefer-reduced-motion,
- etykiety dla ikon,
- logiczne heading levels,
- źródła dostępne bez myszy.

## 15. Historia

Historia lokalna:

- widoczna tylko użytkownikowi urządzenia,
- przycisk „Wyczyść historię”,
- brak wymogu logowania,
- brak automatycznej synchronizacji do konta w R4 baseline.

## 16. Feature flags

UI respektuje:

```text
SEARCH_R4_ENABLED
SEARCH_AI_ENABLED
SEARCH_TRAINER_ENABLED
SEARCH_SEMANTIC_ENABLED
```

Jeżeli AI jest wyłączone, zakładka `Zapytaj AI` nie powinna prowadzić do martwego interfejsu.

## 17. Empty state

Po otwarciu:

- popularne wyszukiwania,
- ostatnie wyszukiwania,
- rekomendowane sekcje,
- kontekstowa opcja „Szukaj tylko w tej grze”.

## 18. Analytics

UI nie powinien wysyłać pełnej treści query do analityki frontendu bez osobnej decyzji Privacy.

Dozwolone eventy mogą obejmować:

- mode opened,
- result selected,
- source selected,
- fallback shown,
- trainer action selected.
