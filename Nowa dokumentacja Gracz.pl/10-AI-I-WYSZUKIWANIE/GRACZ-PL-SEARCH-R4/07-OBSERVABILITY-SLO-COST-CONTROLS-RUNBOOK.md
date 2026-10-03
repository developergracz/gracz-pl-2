# 07 — Observability, SLO, Cost Controls i Runbook SEARCH R4

Status: **TARGET OPERATIONS DESIGN**

## 1. Cele operacyjne

R4 ma być mierzalne w czterech wymiarach:

- dostępność,
- opóźnienie,
- jakość odpowiedzi,
- koszt.

## 2. Metryki

### R2 / retrieval

- `search_requests_total`
- `search_results_zero_total`
- `search_latency_ms`
- `semantic_retrieval_latency_ms`
- `rerank_latency_ms`
- `index_version_active`

### AI

- `ai_requests_total`
- `ai_success_total`
- `ai_timeout_total`
- `ai_fallback_total`
- `ai_no_answer_total`
- `ai_confidence_high_total`
- `ai_confidence_medium_total`
- `ai_confidence_insufficient_total`

### Koszt

- `ai_input_units_total`
- `ai_output_units_total`
- `ai_estimated_cost_daily`
- `ai_estimated_cost_monthly`
- `ai_budget_utilization_ratio`

### Jakość produktu

- result open rate,
- source open rate,
- follow-up usage,
- trainer action completion,
- explicit answer helpful/not helpful — jeśli wdrożone dobrowolnie.

## 3. SLO projektowe

Wartości finalne muszą wynikać z benchmarków. Baseline projektowy:

| Obszar | Cel |
|---|---|
| R2 response p95 | < 150 ms po stronie aplikacyjnej |
| semantic retrieval p95 | < 500 ms |
| AI first useful response p95 | < 5 s |
| R2 availability | >= 99.9% |
| AI mode availability | >= 99.0% z fallbackiem |
| source coverage dla rules answers | 100% |
| cross-user cache leak | 0 |

## 4. Budżety latency

Przykład:

```text
gateway        50 ms
retrieval     300 ms
rerank        700 ms optional
generation   3000 ms
verification  150 ms
-------------------
target       ~4200 ms
```

Rerank może zostać pominięty przy przeciążeniu.

## 5. Cost router

Routing klas:

```text
CLASS 0 = R2 only
CLASS 1 = semantic only
CLASS 2 = semantic + small/fast model
CLASS 3 = semantic + rerank + stronger model
```

Domyślnie najtańsza klasa spełniająca kryteria jakości.

## 6. Limity budżetowe

Konfiguracja:

```text
AI_DAILY_SOFT_LIMIT
AI_DAILY_HARD_LIMIT
AI_MONTHLY_SOFT_LIMIT
AI_MONTHLY_HARD_LIMIT
AI_MAX_REQUESTS_PER_IP
AI_MAX_REQUESTS_PER_ACCOUNT
AI_MAX_OUTPUT_UNITS
AI_MAX_CONTEXT_UNITS
```

Po soft limit:

- ograniczenie expensive rerank,
- preferencja tańszego modelu,
- większe wykorzystanie cache.

Po hard limit:

- AI disabled,
- R2 remains available.

## 7. Cache strategy

Warstwy:

- exact normalized query cache,
- retrieval cache,
- rerank cache,
- grounded answer cache dla niespersonalizowanych pytań.

Invalidation po:

- zmianie index version,
- zmianie canonical content,
- zmianie prompt contract,
- zmianie model class,
- zmianie source policy.

## 8. Alerty

P1:

- cross-user leak,
- secret leakage,
- brak źródła przy odpowiedzi rules,
- hard budget unexpectedly exceeded,
- index corrupted.

P2:

- AI error rate > threshold,
- fallback spike,
- latency p95 regression,
- zero-result spike.

P3:

- wzrost kosztu jednostkowego,
- pogorszenie answer helpful rate,
- trend no-answer.

## 9. Runbook — provider AI down

1. circuit breaker opens,
2. disable generation,
3. keep R2 + semantic if available,
4. UI pokazuje „Tryb AI chwilowo niedostępny”,
5. monitor provider,
6. half-open probes,
7. restore automatically after success window.

## 10. Runbook — semantic index failure

1. do not serve partial corrupted index,
2. switch to previous active index,
3. if unavailable, disable semantic layer,
4. serve R2,
5. rebuild shadow index,
6. run quality suite,
7. activate only after PASS.

## 11. Runbook — budget threshold

Soft:
- alert owner,
- reduce expensive classes,
- inspect abnormal traffic.

Hard:
- block new AI inference,
- keep classical search live,
- preserve observability,
- require owner decision before budget increase.

## 12. Runbook — quality regression

Trigger:
- rule answer with wrong source,
- canonical conflict,
- benchmark score below gate.

Action:
- disable affected game specialist or AI mode,
- fallback to R2,
- freeze index/prompt version,
- reproduce on evaluation set,
- patch and rerun full suite.

## 13. Dashboard

Minimal dashboard:

```text
Traffic
Latency
AI success/fallback
Top intents
Top games
Zero-result rate
No-answer rate
Confidence distribution
Source coverage
Index version
Estimated spend
Budget remaining
Provider status
```
