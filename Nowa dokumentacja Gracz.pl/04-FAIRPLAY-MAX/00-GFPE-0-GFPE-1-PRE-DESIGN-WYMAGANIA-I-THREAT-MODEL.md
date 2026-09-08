# GRACZ.PL FAIRPLAY MAX
## GFPE-0 + GFPE-1 — PRE-DESIGN

**GFPE:** Gracz FairPlay Engine  
**Status:** PRE-DESIGN  
**Data:** 08.09.2026  
**Implementation:** NOT AUTHORIZED  
**Specification freeze:** NO  
**Production use:** NO  
**Version:** Draft 0.1

---

# 1. Cel

Gracz.pl FairPlay MAX ma być wspólnym systemem kryptograficznej uczciwości dla gier karcianych Gracz.pl.

Pierwsze planowane integracje:

- Tysiąc,
- Poker,
- Blackjack,
- Wojna.

Każda gra ma używać jednego wspólnego FairPlay Core. Silnik gry nie może posiadać własnego niezależnego generatora losowania kart.

Koncepcyjna architektura:

```text
Game Engine
    ↓
FairPlay Adapter
    ↓
GFPE Core
    ↓
PostgreSQL / FairPlay Ledger / Proofs
```

---

# 2. Główna zasada bezpieczeństwa

```text
NO FAIRPLAY = NO DEAL
```

Jeżeli system nie może bezpiecznie utworzyć, zapisać lub zweryfikować stanu FairPlay, rozdanie nie może przejść do zwykłego deal.

Zakazane fallbacki:

- `Math.random()`,
- seed tylko z timestamp,
- seed oparty na UUID jako źródle losowości,
- hard-coded production seed,
- awaryjne drugie tasowanie poza committed protocol,
- ręczna podmiana karty,
- losowanie „następnej innej karty”.

---

# 3. Docelowa ścieżka FairPlay

```text
Entropy
  ↓
Commit / Reveal
  ↓
Seed Derivation
  ↓
Deterministic CSPRNG / PRF Stream
  ↓
Uniform Fisher-Yates Shuffle
  ↓
Frozen Deck / Frozen Shoe
  ↓
Cryptographic Commitment
  ↓
Authoritative Deal
  ↓
Player-specific Projection
  ↓
Signed Audit Proof
  ↓
FairPlay Ledger
  ↓
Verify Hand
```

---

# 4. Jedna odpowiedzialność za losowanie

GFPE jest jedynym subsystemem, który ma prawo:

- pobierać/łączyć entropy,
- tworzyć shuffle key,
- generować deterministyczny random stream,
- tworzyć permutation,
- zamrażać talię/shoe,
- kontrolować cursor wydawanych pozycji.

Silnik gry może wyłącznie konsumować committed sequence zgodnie z regułami gry.

---

# 5. Wspólny Core, adaptery gier

```text
              GFPE CORE
                 │
      ┌──────────┼──────────┐
      │          │          │
   Poker      Tysiąc    Blackjack
      │          │          │
      └──────────┼──────────┘
                 │
               Wojna
```

Adapter gry definiuje tylko to, co jest właściwością reguł gry, np.:

- skład talii,
- liczbę graczy,
- reguły deal,
- private/public card semantics,
- musik/talon/burn/community cards,
- shoe lifecycle,
- moment dopuszczalnego reveal.

Adapter nie definiuje własnej kryptografii.

---

# 6. Identyfikatory i protocol version

Każda sesja FairPlay musi posiadać niepowtarzalny identyfikator i jednoznaczny kontekst, np.:

- `fairPlaySessionId`,
- `handId`,
- `matchId`,
- `tableId`,
- `shoeId`,
- `roundId`.

Nie wolno ponownie używać identyfikatora zakończonej/przerwanej sesji.

Każdy proof musi wskazywać wersję protokołu i algorytmów, m.in.:

- `protocolVersion`,
- `gameType`,
- `gameRulesVersion`,
- `hashAlgorithm`,
- `kdfAlgorithm`,
- `prfAlgorithm`,
- `shuffleAlgorithm`,
- `signatureAlgorithm`,
- `proofFormatVersion`,
- `buildGitSha`,
- `keyId`.

Planowana pierwsza rodzina protokołu:

`GFPE-1.x`

---

# 7. Entropy i commit–reveal

Docelowy Full MAX ma wspierać multi-party commit–reveal.

Koncepcja:

```text
SERVER ENTROPY
 + PLAYER 1 ENTROPY
 + PLAYER 2 ENTROPY
 + ...
 + HAND ID
 + PROTOCOL VERSION
 → FINAL SHUFFLE KEY
```

Wstępny porządek:

1. immutable `handId` + context,
2. klient generuje świeży per-hand seed,
3. klient przesyła commitment,
4. commitments są durable,
5. serwer generuje świeży server seed,
6. serwer zapisuje server commitment,
7. gracze revealują seedy,
8. commitments są dokładnie weryfikowane,
9. powstaje canonical transcript,
10. z transcriptu wyprowadzany jest shuffle key.

Żadna strona nie może zmienić wkładu po jego committed state.

---

# 8. Planowane prymitywy

Nie implementujemy własnych prymitywów kryptograficznych.

Kierunek pre-design:

- OS CSPRNG,
- SHA-256,
- HMAC-SHA-256,
- HKDF-SHA-256,
- Ed25519,
- AES-256-GCM dla wybranych sekretów at-rest,
- RFC 8785 JCS lub równie precyzyjny kanoniczny format do hashing/signing,
- PostgreSQL.

Docelowo warstwa integracyjna ma pozostać zgodna z Node.js 24+ / ESM, a crypto-critical core jest rozważany w Rust z możliwością kompilacji tego samego verifier logic do WASM.

---

# 9. Deterministyczny shuffle

Po utworzeniu shuffle key talia musi być generowana deterministycznie i reprodukowalnie.

Planowany random stream:

```text
R_i = HMAC-SHA-256(shuffleKey, domain || handId || counter_i)
```

Dokładny format bajtów i domain separation zostanie zamrożony dopiero w GFPE-2.

Tasowanie:

- Fisher-Yates,
- od końca do początku,
- wybór indeksu w zakresie `[0, i]`,
- rejection sampling / równoważne bounded sampling,
- brak naiwnego `% n`, jeżeli powoduje modulo bias.

---

# 10. Immutable deck / shoe

Po tasowaniu powstaje pełna kolejność kart.

Przed pierwszym deal:

```text
DECK_FROZEN
DECK_COMMITTED
```

Po tym etapie zabronione:

- zmiana karty,
- zamiana pozycji,
- reshuffle aktywnego hand,
- wygenerowanie losowej replacement card,
- cofnięcie cursor,
- powtórne użycie jednej pozycji.

Każda karta musi pochodzić z `deck[position]` / `shoe[position]`.

---

# 11. Commitment i podpisy

Przed pierwszym deal system tworzy commitment do zamrożonego deck/shoe lub jego precyzyjnej struktury commitments.

Zmiana choć jednej chronionej pozycji musi zmienić commitment.

GFPE ma posiadać osobny signing key.

Zakazane:

- `AUTH_SECRET` jako klucz FairPlay,
- reuse klucza MFA,
- reuse klucza wiadomości/załączników,
- reuse sesyjnego secretu.

Planowany podpis:

`Ed25519`

---

# 12. Key separation i lifecycle

Klucze FairPlay muszą być osobną domeną bezpieczeństwa.

Koncepcyjnie:

- signing key,
- seed encryption key,
- ledger/checkpoint key lub jasno zdefiniowany osobny model podpisu.

Każdy klucz powinien mieć:

- `keyId`,
- createdAt,
- status,
- rotationVersion,
- revocation/lifecycle policy.

Architektura powinna umożliwiać późniejsze przejście do Vault/KMS/HSM bez przeprojektowania formatu proof.

---

# 13. Privacy i projection

GFPE Core może znać pełny authoritative deck.

Klient nie może automatycznie otrzymać pełnego deck.

```text
Authoritative FairPlay State
        ↓
project(viewerId)
        ↓
Client
```

Realtime nie może być nośnikiem authoritative private deck state.

---

# 14. Verify Hand

Publiczny verifier ma docelowo umożliwiać sprawdzenie tego, co faktycznie można bezpiecznie udowodnić dla konkretnej gry.

Możliwe elementy:

- protocol version,
- server signature,
- commitments,
- deck/root commitment,
- own-card proof,
- public-card proof,
- ledger checkpoint integrity,
- build/protocol identity.

UI nie może wyświetlać ogólnego „fairness fully proven”, jeśli nie wszystkie prywatne elementy były publicznie weryfikowalne.

---

# 15. Poker — ograniczenie prywatności

Pełne ujawnienie wszystkich seedów po każdym pokerowym hand może ujawnić folded/mucked cards.

Kierunek pre-design:

- per-position salted Merkle commitment,
- losowy salt per leaf,
- selective reveal tylko tych pozycji, które mogą zostać ujawnione,
- własne hole cards mogą otrzymać proof,
- public board otrzymuje public proofs.

Ważne:

prosty Merkle root nie dowodzi publicznie, że wszystkie ukryte leafs tworzą poprawną bezstronną permutację pełnej talii.

Pełny publiczny proof bez ujawnienia hidden cards wymaga bardziej zaawansowanych verifiable-shuffle/ZK technik.

To pozostaje poza GFPE v1, dopóki nie przejdzie osobnego design/review.

---

# 16. Tamper-evident FairPlay Ledger

Planowany ledger ma zapisywać istotne zdarzenia, np.:

- `SESSION_CREATED`,
- `PLAYER_COMMIT`,
- `SERVER_COMMIT`,
- `PLAYER_REVEAL`,
- `DECK_FROZEN`,
- `DECK_COMMITTED`,
- `CARD_DEALT`,
- `HAND_COMPLETED`,
- `HAND_ABORTED`,
- `PROOF_CREATED`.

Kierunek:

```text
recordHash_n = SHA256(prevHash || canonicalRecord_n)
```

oraz okresowo podpisywane checkpointy.

Uwaga bezpieczeństwa:

hash-chain przechowywany wyłącznie w tej samej bazie kontrolowanej przez operatora nie daje magicznej niezależnej niezmienności. Mocniejsze kotwiczenie checkpointów może być osobnym przyszłym rozszerzeniem.

---

# 17. Abort protection

Selective abort/grinding jest częścią threat modelu.

Po committed state abort nie może usuwać historii.

Wymagane:

- `ABORTED` jako durable state,
- reason,
- phase,
- timestamps,
- relevant commitments,
- node/build context,
- handId nigdy nie jest ponownie użyty,
- późniejsza analiza statystyczna abortów.

---

# 18. Integracja z MatchRuntime

GFPE ma wykorzystywać fundament P7:

- server-authoritative MatchRuntime,
- `expectedVersion`,
- PostgreSQL CAS,
- `ownershipEpoch` fencing,
- durable idempotency,
- restart recovery,
- mandatory fail-closed player projection,
- signal-only realtime.

Własność krytyczna:

```text
Node A deal position N = COMMIT
Node B competing deal position N = CONFLICT / FENCED
```

Nigdy dwa różne wyniki dla tej samej pozycji.

---

# 19. Restart recovery

Restart nie może generować nowej talii dla istniejącej aktywnej sesji.

System ma odtwarzać co najmniej:

- protocol version,
- deck/shoe commitment,
- cursor,
- sequence,
- authoritative state,
- ownership epoch,
- idempotency history,
- keyId/build identity wymagane do dalszej poprawnej walidacji.

Przed kontynuacją persisted deck musi przejść integrity check.

---

# 20. Pierwsze adaptery gier

## Tysiąc

Pierwsza pełna gra walidacyjna GFPE.

Zakres:

- canonical 24-card deck,
- private hands,
- musik/talon,
- 2/3/4 players,
- jedna frozen deck,
- brak osobnego RNG dla musika,
- reconnect/restart/concurrency/projection/proof.

## Poker

Najbardziej wymagający pod kątem private cards i publicznej verifiability.

## Blackjack

FairPlay dotyczy całego shoe, nie pojedynczego hand.

Przykładowo multi-deck shoe pozostaje frozen z monotonicznym cursor aż do legalnego zakończenia/reshuffle point.

## Wojna

Najprostszy adapter z punktu widzenia prywatności i pełnego reveal po zakończeniu.

---

# 21. Test Laboratory

Planowane kategorie:

- unit,
- integration,
- property-based,
- known-answer vectors,
- cross-language equivalence,
- fuzzing,
- PostgreSQL,
- concurrency,
- multi-node,
- restart,
- corruption,
- replay,
- rollback,
- fault injection,
- statistical regression,
- browser/WASM verifier,
- npm/cargo audit,
- CodeQL,
- gitleaks,
- dependency review,
- SBOM.

Statystyka ma być dowodem regresyjnym/detekcyjnym, nie substytutem kryptograficznej analizy.

---

# 22. GFPE-1 — Threat Model

## Chronione aktywa

- kolejność deck/shoe,
- entropy/seeds,
- private cards,
- commitments,
- signing keys,
- audit ledger,
- authoritative match state,
- idempotency state,
- proof bundles.

## Główne klasy przeciwników i awarii

### Cheating client

Ataki:

- seed manipulation,
- reveal mismatch,
- replay request,
- spoofed seat/player,
- out-of-order deal attempt,
- próba odczytu cudzych kart.

Kontrole:

- auth,
- commit–reveal,
- server validation,
- idempotency,
- player projection,
- version/fencing.

### Colluding clients

System nie może pozwalać uczestnikom na zmianę committed wkładów po poznaniu cudzych wkładów.

### Compromised frontend

Frontend jest untrusted. Nie jest źródłem prawdy dla deck, turn, cursor ani wyniku proof.

### Compromised / buggy app node

Kontrole:

- persistence,
- CAS,
- fencing,
- signed/auditable state,
- least-privilege key access w późniejszej finalnej architekturze.

### Concurrent writers

Tylko jeden writer może wykonać daną mutację.

### Database rollback

Ryzyko przywrócenia starszego stanu i ponownego wykonania rozdania.

Kierunek kontroli:

- monotonic sequence,
- unique hand/session identity,
- durable idempotency,
- ledger/checkpoints,
- duplicate/reuse detection.

### Seed reuse

Seed/session context nie może zostać ponownie użyty.

### Selective abort / grinding

Committed hand nie znika. Abort pozostaje durable i audytowalny.

### Weak RNG

Brak bezpiecznego entropy = fail closed.

### Modulo bias

Bounded random integer musi być bezstronny.

### Code tampering

Kontrole:

- code review,
- Owner + Lead governance,
- CI,
- CodeQL,
- gitleaks,
- signed/reviewed release identity,
- `buildGitSha` w proof.

### Signing key compromise

Wymaga osobnego key lifecycle, keyId, rotation i historical verification.

### Supply-chain compromise

Minimalne dependencies, pinning/lockfiles, audit, SBOM, review aktualizacji.

### Private-card proof leak

Szczególnie Poker: verifier nie może ujawniać hidden opponents cards.

### Realtime leak

Realtime ma sygnalizować zmianę, a klient pobiera własną projekcję.

### Log leak

Logi nie mogą zawierać raw seeds, signing secrets ani prywatnych kart.

### Admin abuse

Admin/Owner console ma służyć audytowi i obserwowalności, a nie ręcznej kontroli talii.

### Replay proof

Proof musi być związany z unikalnym hand/session/protocol/build context.

### Protocol downgrade

Nieobsługiwana/słabsza wersja protokołu jest odrzucana.

### Missing player reveal

Nie wolno zastępować brakującego reveal przewidywalnym fallbackiem. GFPE-2 musi zamrozić timeout/no-reveal policy.

### Reveal mismatch

Commit mismatch = protocol failure / fail closed.

### Persisted deck corruption

Integrity mismatch po restarcie = fail closed.

### Cursor manipulation

Cursor nie może cofać się ani wydawać jednej pozycji wielokrotnie.

### Invalid deck composition / duplicate card

Przed freeze musi istnieć walidacja dokładnego multiset talii/shoe.

---

# 23. Security invariants

`I-01` Jedna logical session = jedna committed deck/shoe.  
`I-02` Commitment istnieje przed pierwszym deal.  
`I-03` Po freeze deck jest immutable.  
`I-04` Każda karta pochodzi z dokładnie jednej pozycji committed deck.  
`I-05` Cursor jest monotoniczny.  
`I-06` Każda pozycja może zostać użyta najwyżej raz.  
`I-07` Nie ma fallback RNG.  
`I-08` Nie ma silent default FairPlay.  
`I-09` Nie ma secret reuse między subsystemami.  
`I-10` Realtime nie jest authoritative.  
`I-11` Private cards wychodzą tylko przez właściwą projekcję.  
`I-12` Replay nie wykonuje ponownie mutacji.  
`I-13` Concurrent writers nie mogą obaj wygrać.  
`I-14` Abort nie usuwa śladu rozdania.  
`I-15` Historyczny proof pozostaje weryfikowalny po rotacji kluczy.

---

# 24. Trust boundaries

```text
UNTRUSTED
Browser / Mobile Client
        │
        ▼
AUTHENTICATED API BOUNDARY
        │
        ▼
MATCH RUNTIME
        │
        ▼
GFPE ADAPTER
        │
        ▼
FAIRPLAY CORE
        │
        ▼
POSTGRESQL / KEY BOUNDARY
```

FairPlay Core ma być możliwie małą trusted computing base.

---

# 25. Czego GFPE v1 nie obiecuje

Poza aktualnym zakresem pre-design:

- formalna certyfikacja kasynowa,
- gry za prawdziwe pieniądze,
- blockchain jako wymagany fundament,
- własny token,
- własne prymitywy kryptograficzne,
- pełny Zero-Knowledge verifiable shuffle v1,
- Mental Poker v1,
- hardware RNG jako obowiązkowy wymóg v1.

---

# 26. Acceptance Gate dla GFPE-0 / GFPE-1

Dokument nie może zostać oznaczony jako final/frozen tylko dlatego, że został zapisany w repo.

Przed freeze wymagane będą co najmniej:

- formalne zamknięcie P8,
- pełny audyt całego Gracz.pl,
- weryfikacja wszystkich findingów przez Lead,
- controlled corrections,
- full CI i re-audit,
- clean `main`,
- porównanie MatchRuntime/storage/security z wymaganiami GFPE,
- niezależny review threat modelu/protokołu,
- dokładny mapping `threat → control → test`.

---

# 27. Aktualny werdykt

```text
GFPE-0 REQUIREMENTS = PRE-DESIGN COMPLETE
GFPE-1 THREAT MODEL = PRE-DESIGN COMPLETE
SPECIFICATION FREEZE = NOT AUTHORIZED
IMPLEMENTATION = NOT AUTHORIZED
PRODUCTION USE = NO
NEXT DESIGN PHASE = GFPE-2 CRYPTOGRAPHIC PROTOCOL
```
