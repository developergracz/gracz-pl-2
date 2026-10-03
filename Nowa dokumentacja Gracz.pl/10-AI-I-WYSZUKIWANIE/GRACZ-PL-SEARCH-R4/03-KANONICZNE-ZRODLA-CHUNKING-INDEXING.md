# 03 — Kanoniczne źródła, chunking i indeksowanie

Status: **TARGET DESIGN**

## 1. Cel

Indeks R4 musi umożliwiać dokładne wyszukiwanie semantyczne, ale jednocześnie zachować pełną identyfikowalność źródła i wersji treści.

## 2. Klasy źródeł

| Klasa | Priorytet | Przykład |
|---|---:|---|
| `CANONICAL_RULES` | 1 | oficjalne zasady Tysiąca |
| `ACADEMY_CORE` | 2 | moduły Poker Academy |
| `GUIDE_APPROVED` | 3 | zatwierdzone poradniki |
| `PORTAL_INFO` | 4 | Regulamin, Polityka prywatności |
| `SUPPORTING_CONTENT` | 5 | materiały pomocnicze |

## 3. Manifest gry

Każda gra powinna mieć manifest:

```yaml
game_id: tysiac
display_name: Tysiąc
locale: pl-PL
canonical_rules:
  - /gry/tysiac/zasady/
academy:
  - /gry/tysiac/
topics:
  - licytacja
  - musik
  - meldunki
  - atut
  - lewy
  - punktacja
aliases:
  - tysiac
  - tysiąc
  - "1000"
```

## 4. Document record

```json
{
  "document_id": "tysiac-rules-v4",
  "source_class": "CANONICAL_RULES",
  "game_id": "tysiac",
  "title": "Zasady gry w Tysiąca",
  "url": "/gry/tysiac/zasady/",
  "content_hash": "sha256:...",
  "content_version": "2026-10-03",
  "published": true,
  "canonical": true
}
```

## 5. Chunking

Preferowany chunk odpowiada logicznej sekcji, a nie arbitralnej liczbie znaków.

Dobra jednostka:

- jeden nagłówek + związane akapity,
- jedna reguła,
- jedna definicja,
- jeden etap lekcji,
- jeden FAQ entry.

Chunk nie powinien łączyć kilku niezależnych zasad.

## 6. Chunk metadata

Każdy chunk:

```json
{
  "chunk_id": "tysiac-rules-meldunki-001",
  "document_id": "tysiac-rules-v4",
  "anchor": "meldunki",
  "heading": "Meldunki i ustanowienie atutu",
  "topic": "meldunki",
  "difficulty": "foundation",
  "source_class": "CANONICAL_RULES",
  "canonical_priority": 1,
  "content_hash": "sha256:...",
  "text": "..."
}
```

## 7. Chunk size

Wartość docelowa jest ustalana testami. Projektowo:

- mały chunk: lepsza precyzja,
- duży chunk: więcej kontekstu,
- overlap wyłącznie tam, gdzie granica sekcji może urwać znaczenie.

Nie wolno kopiować całych stron jako pojedynczych embeddingów.

## 8. Wersjonowanie

Każdy rebuild indeksu ma:

- `index_version`,
- timestamp,
- commit SHA źródła,
- listę document hashes,
- model embedding version,
- schema version.

Przykład:

```text
search-index-r4-2026-10-03.1
source_commit = abc123...
embedding_model_version = provider-neutral-v1
schema_version = 1
```

## 9. Reindex

Pipeline:

```text
extract
→ sanitize
→ classify source
→ chunk
→ enrich metadata
→ validate
→ embed
→ build shadow index
→ run quality suite
→ atomically switch alias
```

Nie aktualizujemy aktywnego indeksu częściowo.

## 10. Deletion and update

Po zmianie treści:

- stare chunk IDs zostają oznaczone superseded,
- nowy indeks powstaje w shadow mode,
- odpowiedzi nie mogą mieszać różnych wersji tego samego dokumentu,
- rollback wskazuje poprzedni kompletny index version.

## 11. Prompt injection w treści

Indeksowane treści są traktowane jako **data, nie instructions**.

Importer musi:

- usuwać skrypty i niewidoczne instrukcje,
- ignorować komentarze techniczne,
- nie indeksować sekretów,
- klasyfikować źródła po allowliście,
- odrzucać treści spoza zatwierdzonego korpusu.

## 12. Jakość indeksu

Testy muszą zawierać:

- exact section lookup,
- paraphrase lookup,
- typo lookup,
- no-diacritic lookup,
- natural-language questions,
- ambiguous game terms,
- conflicting source test,
- stale source rejection,
- deep-link correctness.

## 13. 20+ gier

Nowa gra wymaga:

1. manifestu,
2. canonical rules,
3. mapy topiców,
4. aliasów,
5. test questions,
6. indeksacji,
7. review jakości.

Nie wymaga zmiany architektury R4.
