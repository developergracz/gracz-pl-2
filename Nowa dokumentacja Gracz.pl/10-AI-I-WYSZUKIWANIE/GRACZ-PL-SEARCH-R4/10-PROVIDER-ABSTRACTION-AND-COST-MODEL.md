# 10 — Provider Abstraction i neutralny model kosztowy SEARCH R4

Status: **TARGET DESIGN / PROVIDER NOT SELECTED**

## 1. Cel

R4 nie może być architektonicznie przywiązane do jednego dostawcy modeli. Provider jest adapterem infrastrukturalnym.

## 2. Typy providerów

System może korzystać z niezależnych providerów dla:

- embeddings,
- reranking,
- generative answer,
- optional classification.

Nie jest wymagane, aby wszystkie funkcje dostarczała jedna firma.

## 3. Interfejs generative provider

Logiczny kontrakt:

```ts
interface AiGenerateProvider {
  generate(request: {
    system: string;
    user: string;
    context: SourceChunk[];
    responseSchema: object;
    timeoutMs: number;
    maxOutputUnits: number;
  }): Promise<{
    output: unknown;
    usage: Usage;
    providerRequestId?: string;
  }>;
}
```

## 4. Embedding provider

```ts
interface EmbeddingProvider {
  embed(texts: string[]): Promise<{
    vectors: number[][];
    usage: Usage;
    modelVersion: string;
  }>;
}
```

## 5. Rerank provider

```ts
interface RerankProvider {
  rerank(query: string, candidates: Candidate[], topK: number): Promise<RankedCandidate[]>;
}
```

## 6. Provider capabilities registry

Przykład:

```json
{
  "provider": "provider-a",
  "capabilities": {
    "generation": true,
    "embeddings": true,
    "rerank": false,
    "structured_output": true
  },
  "policy": {
    "data_retention_reviewed": false,
    "dpa_reviewed": false,
    "transfer_reviewed": false
  }
}
```

Provider nie może zostać oznaczony `production_ready=true` bez review polityk danych.

## 7. Wybór modelu

Nie stosujemy jednej zasady „najmocniejszy model zawsze”.

Routing:

- klasyfikacja — mały/szybki,
- embedding — dedykowany embedding model,
- prosta odpowiedź — ekonomiczny model,
- trudna synteza — silniejszy model,
- reranking — dedykowany reranker, jeśli benchmark wykazuje wartość.

## 8. Neutralny koszt requestu

```text
request_cost =
  embedding_cost
+ rerank_cost
+ generation_input_cost
+ generation_output_cost
+ infrastructure_cost
```

Miesięcznie:

```text
monthly_cost =
  requests_per_month
× ai_route_ratio
× average_ai_request_cost
+ fixed_infrastructure
```

## 9. Najważniejszy parametr: AI route ratio

Jeżeli 80% zapytań obsłuży R2/semantic bez generation, tylko 20% generuje koszt modelu odpowiedzi.

Dlatego architektura optymalizuje najpierw:

```text
R2 hit rate
semantic-only hit rate
cache hit rate
AI route ratio
```

a dopiero później cenę pojedynczego modelu.

## 10. Symulacja kosztu

Przed produkcją tworzymy scenariusze:

```text
S1: 10k searches / month
S2: 100k searches / month
S3: 1M searches / month
```

Dla każdego:

- % R2 only,
- % semantic only,
- % AI generation,
- avg input,
- avg output,
- cache ratio,
- koszt dzienny,
- koszt miesięczny,
- peak budget.

Bez aktualnego cennika providerów dokument nie wpisuje stałych kwot.

## 11. Cost guardrails

- max output units,
- max retrieved context,
- top-K cap,
- no multi-model fanout by default,
- rerank only when useful,
- cache,
- daily hard limit,
- monthly hard limit,
- emergency AI off switch.

## 12. Provider failover

Możliwe strategie:

### A. Single provider + R2 fallback

Najprostsza. Awaria AI => R2.

### B. Primary + secondary provider

Droższa operacyjnie. Używać tylko, jeśli SLA uzasadnia.

### C. Different providers per capability

Może dać lepszy koszt/jakość, ale zwiększa Privacy i operational complexity.

Baseline R4 nie wymaga multi-provider failover.

## 13. Lock-in controls

- własny format chunk metadata,
- własny index manifest,
- provider-neutral interfaces,
- brak provider-specific IDs jako kluczy domenowych,
- wersjonowane adaptery,
- eksportowalny korpus,
- możliwość przebudowania embedding index.

## 14. Provider review checklist

Przed produkcją:

- API terms,
- data usage/training settings,
- retention,
- DPA,
- subprocessors,
- transfer,
- region,
- quotas,
- rate limits,
- model lifecycle/deprecation,
- logging,
- SLA/status page,
- pricing,
- structured output support.

## 15. Decyzja o płatnym AI

R4 może zostać zbudowane etapowo bez opłacania generation na początku:

- R4.1 corpus,
- R4.2 lokalne/hybrydowe retrieval,
- R4.3 deterministic routing,
- offline test fixtures.

Płatny inference staje się potrzebny dopiero, gdy wdrażamy modelowe embeddings/rerank/generation zależnie od wybranej technologii i providera.

## 16. Status

```text
PROVIDER = NOT SELECTED
PRICING = NOT LOCKED
BUDGET = NOT APPROVED
API KEY = NOT CREATED / NOT CONFIGURED BY THIS DOCUMENT
PURCHASE = NOT AUTHORIZED
```
