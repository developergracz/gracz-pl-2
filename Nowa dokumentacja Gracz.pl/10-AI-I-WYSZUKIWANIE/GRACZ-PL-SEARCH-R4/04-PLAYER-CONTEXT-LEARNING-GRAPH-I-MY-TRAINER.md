# 04 — Player Context, Learning Graph i „Mój trener”

Status: **TARGET DESIGN / LOGIN-DEPENDENT FEATURE**

## 1. Cel

Tryb „Mój trener” ma zamieniać wyszukiwarkę AI w kontrolowanego asystenta edukacyjnego. Nie jest to swobodna pamięć rozmów, lecz jawny model danych produktowych związanych z nauką.

## 2. Zakres Player Context

Dozwolone pola kontekstowe:

- `player_id`,
- `preferred_game`,
- `last_active_module`,
- `completed_modules`,
- `quiz_attempts`,
- `quiz_scores`,
- `skill_topics`,
- `error_topics`,
- `saved_content`,
- `learning_streak` — wyłącznie jeśli produkt faktycznie ją wdroży,
- `learning_level`,
- `updated_at`.

Niedozwolone jako domyślny kontekst AI:

- pełna historia prywatnych wiadomości,
- pełna historia czatu,
- dane innych użytkowników,
- hasła, tokeny, MFA secrets,
- dane płatnicze,
- prywatne pola profilu niezwiązane z nauką,
- nieograniczona historia promptów.

## 3. Minimalny kontrakt

```json
{
  "player_id": "uuid",
  "game_id": "poker",
  "level": "foundation",
  "last_active_module": "pozycje-poker",
  "completed_modules": ["poker-5-minut", "ranking-ukladow"],
  "weak_topics": ["position", "pot_odds"],
  "recent_quiz": {
    "quiz_id": "quiz-poker",
    "score": 3,
    "max_score": 5,
    "wrong_topics": ["position", "blinds"]
  }
}
```

## 4. Zasada minimalizacji

Do promptu trafia tylko kontekst potrzebny do konkretnego zadania.

Przykład:
- pytanie o zasady Gomoku nie wymaga danych o postępie w Pokerze,
- pytanie „co mam ćwiczyć?” wymaga Player Context i Learning Graph,
- pytanie „co to jest pot odds?” może działać bez profilu.

## 5. Learning Graph

Learning Graph opisuje zależności edukacyjne, a nie zachowanie użytkownika.

Przykład:

```yaml
topic: pot_odds
game_id: poker
prerequisites:
  - betting_rounds
  - actions
recommended_before:
  - positions
practice:
  - pot_odds_calculator
assessment:
  - quiz_poker
remediation:
  - poker_5_minut
next:
  - decision_arena
```

## 6. Typy węzłów

- `CONCEPT`
- `RULE`
- `LESSON`
- `PRACTICE`
- `QUIZ`
- `REMEDIATION`
- `MILESTONE`

## 7. Typy relacji

- `REQUIRES`
- `RECOMMENDS`
- `PRACTICES`
- `ASSESSES`
- `REMEDIATES`
- `UNLOCKS`
- `RELATED_TO`

## 8. Recommendation Engine

Dla pytania „co mam dziś ćwiczyć?” silnik powinien:

1. odczytać ostatni aktywny obszar,
2. sprawdzić nieukończone prerequisites,
3. znaleźć słabe tematy,
4. unikać powtarzania świeżo ukończonych materiałów,
5. dobrać małą, wykonalną jednostkę,
6. zaproponować kolejny krok po wykonaniu.

## 9. Priorytet rekomendacji

Przykładowy scoring:

```text
remediation_need      0.35
prerequisite_gap      0.25
recent_activity       0.15
difficulty_fit        0.15
novelty               0.10
```

Wagi są walidowane testami i telemetrycznie, nie dobierane pod maksymalizację czasu w serwisie.

## 10. Brak manipulacyjnego designu

Mój trener nie powinien:

- nakłaniać do niekończących się sesji,
- karać użytkownika za przerwy,
- generować fałszywego poczucia presji,
- używać rankingów lub streaków jako warunku dostępu do nauki,
- ukrywać łatwiejszych materiałów tylko po to, by zwiększać zaangażowanie.

## 11. Explainability

Każda rekomendacja powinna mieć krótkie uzasadnienie, np.:

> Polecam teraz „Pozycje, button i blindy”, ponieważ w ostatnim quizie dwa błędy dotyczyły pozycji przy stole.

Uzasadnienie musi wynikać z jawnych danych Player Context.

## 12. Reset i kontrola użytkownika

Docelowy produkt powinien umożliwiać:

- wyłączenie personalizacji,
- reset postępu edukacyjnego zgodnie z zasadami produktu,
- usunięcie zapisanych materiałów,
- przejście do zwykłego trybu AI bez Player Context.

## 13. Tryb anonimowy

Niezalogowany użytkownik:

- ma Search i Ask AI,
- nie ma trwałego Player Context,
- nie otrzymuje rekomendacji opartych na historii konta.

## 14. Kryteria akceptacji

PASS, jeśli:

- rekomendacja jest oparta wyłącznie na dozwolonych polach,
- źródła rekomendacji są audytowalne,
- AI nie odczytuje niepowiązanych danych profilu,
- bez Player Context funkcja degraduje się bezpiecznie,
- użytkownik może rozpoznać, że działa personalizacja.
