# 05 — API, model danych i zdarzenia SEARCH R4

Status: **TARGET DESIGN / PROVIDER-NEUTRAL**

## 1. Endpointy logiczne

```text
POST /api/search/v4/query
POST /api/search/v4/ask
POST /api/search/v4/trainer
GET  /api/search/v4/sources/:sourceId
GET  /api/search/v4/health
GET  /api/search/v4/capabilities
```

Nie oznacza to, że wszystkie endpointy muszą być fizycznie osobnymi handlerami.

## 2. Query API

```json
{
  "query": "meldunki w tysiącu",
  "mode": "search",
  "filters": {
    "game_id": "tysiac",
    "source_class": null
  },
  "limit": 20,
  "locale": "pl-PL"
}
```

Odpowiedź:

```json
{
  "request_id": "uuid",
  "mode": "search",
  "results": [
    {
      "title": "Meldunki i ustanowienie atutu",
      "url": "/gry/tysiac/zasady/#meldunki",
      "source_class": "CANONICAL_RULES",
      "score": 0.95,
      "snippet": "..."
    }
  ],
  "fallback": false
}
```

## 3. Ask API

```json
{
  "query": "Kiedy w Tysiącu meldunek ustanawia atut?",
  "mode": "ask_ai",
  "conversation_id": "ephemeral-session-id",
  "game_id": "tysiac",
  "locale": "pl-PL"
}
```

Odpowiedź:

```json
{
  "request_id": "uuid",
  "answer": "...",
  "confidence": "HIGH",
  "sources": [
    {
      "source_id": "tysiac-rules-meldunki-001",
      "title": "Meldunki i ustanowienie atutu",
      "url": "/gry/tysiac/zasady/#meldunki"
    }
  ],
  "follow_up": [],
  "actions": [],
  "fallback": false
}
```

## 4. Trainer API

Wymaga sesji użytkownika.

```json
{
  "query": "Co mam teraz ćwiczyć?",
  "mode": "trainer",
  "game_id": "poker",
  "locale": "pl-PL"
}
```

Backend sam pobiera minimalny Player Context. Klient nie powinien wysyłać dowolnych pól profilu jako zaufanych danych.

## 5. Error contract

```json
{
  "request_id": "uuid",
  "error": {
    "code": "AI_TEMPORARILY_UNAVAILABLE",
    "message": "Tryb AI jest chwilowo niedostępny. Pokazujemy zwykłe wyniki wyszukiwania."
  },
  "fallback": true
}
```

Kody:

- `INVALID_QUERY`
- `RATE_LIMITED`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `SEMANTIC_INDEX_UNAVAILABLE`
- `AI_TEMPORARILY_UNAVAILABLE`
- `AI_BUDGET_LIMIT_REACHED`
- `NO_GROUNDED_ANSWER`
- `INTERNAL_ERROR`

## 6. Encje danych

### search_document

```text
id
game_id
source_class
title
canonical_url
content_version
content_hash
canonical_priority
published
created_at
updated_at
```

### search_chunk

```text
id
document_id
anchor
heading
topic
difficulty
text
content_hash
embedding_ref
index_version
created_at
```

### search_index_version

```text
id
version
source_commit_sha
embedding_model_version
schema_version
status
built_at
activated_at
```

### learning_topic

```text
id
game_id
slug
title
difficulty
canonical_source_id
```

### learning_edge

```text
from_topic_id
to_topic_id
relation_type
weight
```

### player_learning_state

```text
player_id
game_id
topic_id
status
mastery_bucket
attempt_count
last_result
updated_at
```

## 7. Rozdzielenie danych

Indeks treści publicznych i dane użytkownika powinny być logicznie rozdzielone.

Nie należy umieszczać PII użytkownika w vector store przeznaczonym dla publicznego korpusu.

## 8. Eventy

Przykładowe zdarzenia domenowe:

```text
SearchQueryIssued
SearchResultOpened
AiAnswerRequested
AiAnswerDelivered
AiAnswerFallbackUsed
AiAnswerRejectedByConfidenceGate
TrainerRecommendationGenerated
LearningModuleCompleted
QuizCompleted
SearchIndexBuilt
SearchIndexActivated
SearchBudgetThresholdReached
```

## 9. Telemetria eventów

Zdarzenie nie powinno domyślnie zawierać pełnego tekstu query. Preferowane:

- request id,
- klasyfikacja intencji,
- game id,
- liczba wyników,
- latency bucket,
- provider/model class,
- token/cost units,
- confidence class,
- source IDs,
- outcome.

Pełny tekst query wymaga osobnej decyzji privacy/retention.

## 10. Idempotencja

Operacje generatywne są read-like i mogą być retryowane, ale:

- nie mogą tworzyć wielokrotnie zapisów postępu,
- action engine musi mieć własne idempotency keys,
- samo kliknięcie „uruchom quiz” nie może być side effectem modelu bez potwierdzonego requestu aplikacyjnego.

## 11. Cache

Klucze cache powinny uwzględniać:

- normalized query,
- mode,
- game scope,
- index version,
- locale,
- provider/model class,
- personalizacja yes/no.

Odpowiedzi spersonalizowanych nie wolno współdzielić między użytkownikami.
