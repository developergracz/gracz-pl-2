# 02 — AI Router, RAG i Retrieval Contract

Status: **TARGET DESIGN**  
Wersja: 1.0

## 1. Pipeline

```text
normalize
→ parse commands
→ classify intent
→ R2 retrieve
→ semantic retrieve
→ merge
→ canonical filter
→ optional rerank
→ answerability check
→ generate grounded answer
→ verify citations
→ confidence gate
→ response
```

## 2. Search request

```json
{
  "query": "czy bicie w warcabach jest obowiązkowe?",
  "mode": "ask_ai",
  "scope": {
    "game_id": "warcaby",
    "category": "rules"
  },
  "locale": "pl-PL",
  "session_id": "ephemeral-id",
  "player_context": false
}
```

## 3. Retrieval candidate

```json
{
  "chunk_id": "warcaby-rules-bicie-v3-001",
  "document_id": "warcaby-rules-v3",
  "title": "Bicie pionków przeciwnika",
  "url": "/gry/warcaby/zasady/#bicie",
  "source_class": "CANONICAL_RULES",
  "game_id": "warcaby",
  "topic": "capture",
  "content_version": "2026-10-02",
  "keyword_score": 0.91,
  "semantic_score": 0.94,
  "canonical_priority": 1,
  "text": "..."
}
```

## 4. Intent router

Router zwraca co najmniej:

```json
{
  "intent": "RULES_QUESTION",
  "game_id": "warcaby",
  "needs_ai": true,
  "needs_player_context": false,
  "expected_source_classes": ["CANONICAL_RULES"],
  "confidence": 0.97
}
```

### Zasada R2-first

Jeżeli query jest:

- nazwą gry,
- nazwą sekcji,
- krótkim hasłem,
- bezpośrednim deep-link lookup,

router powinien zwrócić `needs_ai=false`.

## 5. Hybrid retrieval

Minimalne źródła sygnału:

- BM25/keyword score lub odpowiednik,
- semantic vector similarity,
- canonical source weight,
- game/topic scope,
- freshness/version,
- exact title boost,
- anchor boost.

Do rankingu nie wolno włączać niekontrolowanych danych profilu poza „Mój trener”.

## 6. Query expansion

Dozwolone:

- synonimy,
- polskie znaki / bez znaków,
- warianty odmiany,
- nazwy potoczne,
- skróty domenowe,
- aliasy gier.

Niedozwolone:

- rozszerzanie pytania na temat niepowiązany,
- wprowadzanie faktów nieobecnych w korpusie,
- automatyczne tłumaczenie znaczenia w sposób zmieniający intencję bez kontroli.

## 7. Reranking

Reranker otrzymuje maksymalnie top-N kandydatów i ma odpowiedzieć wyłącznie rankingiem.

Przykładowy kontrakt:

```json
{
  "query": "...",
  "candidates": [
    {"chunk_id":"...", "title":"...", "text":"..."}
  ],
  "return_top_k": 6
}
```

Nie może wykonywać side effects ani wywoływać narzędzi.

## 8. Answerability gate

Przed generacją odpowiedzi system sprawdza:

- czy istnieje co najmniej jedno źródło odpowiedniej klasy,
- czy top source przekracza minimalny retrieval threshold,
- czy źródła nie są jawnie sprzeczne,
- czy temat mieści się w zakresie produktu,
- czy odpowiedź nie wymaga danych, których system nie posiada.

Jeśli którykolwiek krytyczny warunek nie jest spełniony:

```text
answerable = false
→ no generative answer
→ show sources/results only
```

## 9. Grounded generation contract

Model otrzymuje:

- system instruction,
- pytanie użytkownika,
- maksymalnie kilka zatwierdzonych chunków,
- metadata źródeł,
- opcjonalny bezpieczny Player Context,
- format odpowiedzi.

Model nie otrzymuje:

- sekretów,
- pełnych rekordów konta,
- danych innych użytkowników,
- connection stringów,
- logów produkcyjnych,
- całej historii konta.

## 10. Oczekiwany wynik modelu

```json
{
  "answer": "Tak. W wariancie opisanym na gracz.pl bicie jest obowiązkowe...",
  "source_ids": [
    "warcaby-rules-bicie-v3-001"
  ],
  "follow_up": [
    "Jak działa wielokrotne bicie?",
    "Kiedy pionek staje się damką?"
  ],
  "actions": [
    {
      "type": "OPEN_CONTENT",
      "label": "Przejdź do zasad bicia",
      "url": "/gry/warcaby/zasady/#bicie"
    }
  ]
}
```

Backend musi zweryfikować, że wszystkie `source_ids` rzeczywiście pochodzą z dostarczonego retrieval set.

## 11. Citation verification

Po generacji:

1. każdy source id musi istnieć,
2. każda odpowiedź faktograficzna o zasadach musi mieć source coverage,
3. link musi być z allowlisty gracz.pl,
4. odpowiedź nie może cytować ukrytych promptów,
5. brak source coverage obniża confidence lub blokuje odpowiedź.

## 12. Confidence

Proponowany scoring:

```text
retrieval_quality
+ canonical_strength
+ source_agreement
+ intent_confidence
+ citation_coverage
- contradiction_penalty
- unsupported_claim_penalty
```

Progi są kalibrowane na zbiorze testowym, nie wybierane arbitralnie w produkcji.

## 13. Multi-turn

Dopuszczalny jest krótki kontekst rozmowy w ramach sesji.

Przykład:

```text
Q1: Co to jest meldunek?
Q2: A ile ma kier?
```

System może rozumieć Q2 w kontekście Q1, ale kontekst sesyjny nie staje się automatycznie trwałym profilem użytkownika.

## 14. Guardrails

- maksymalna długość query,
- maksymalna liczba chunków,
- timeout inference,
- timeout rerank,
- maksymalna liczba follow-up,
- allowlista action types,
- brak dynamicznych tool calls na podstawie tekstu retrieved,
- brak HTML od modelu bez sanityzacji.
