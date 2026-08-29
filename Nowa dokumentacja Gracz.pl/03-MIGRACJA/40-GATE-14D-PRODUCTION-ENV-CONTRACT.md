# ETAP 3 — Gate 14D: Production Environment Contract

Data: 29.08.2026  
Status: **DESIGN ONLY / NOT APPLIED / PRODUCTION NO-GO**

## 1. Cel

Ten dokument jest kanonicznym kontraktem zmiennych środowiskowych dla docelowego runtime V3. Nie zawiera wartości sekretów i nie może być używany jako plik `.env`.

## 2. Required — runtime production

| Zmienna | Typ | Wymóg | Uwagi |
|---|---|---|---|
| `NODE_ENV` | non-secret | `production` | aktywuje production security paths |
| `AUTH_SECRET` | secret | present, >=32 | wyłącznie auth/signing po pełnym cutover |
| `DATABASE_URL` | secret | present | credential `gracz_runtime_v3`, nie owner/admin |
| `PUBLIC_BASE_URL` | non-secret | `https://gracz.pl` | jawny canonical origin |
| `TURNSTILE_SITE_KEY` | non-secret | present | public site key |
| `TURNSTILE_SECRET_KEY` | secret | present | para z site key |
| `TURNSTILE_HOSTNAME` | non-secret | `gracz.pl` | hostname binding |
| `RESEND_API_KEY` | secret | present, jeśli mail flows aktywne | provider credential |
| `EMAIL_FROM` | non-secret | explicit | verified sender domain |
| `AUDIT_HASH_SALT` | secret | present, >=32 | distinct od AUTH i crypto roots |

## 3. Required po implementacji Gate 14C

| Zmienna | Typ | Wymóg | Uwagi |
|---|---|---|---|
| `LEGACY_CRYPTO_ROOT_V1` | secret | present podczas compatibility/rekey | usuwany dopiero po v1=0 i fresh proof |
| `MESSAGE_ENCRYPTION_KEY_V2` | secret | present, >=32 | distinct |
| `ATTACHMENT_ENCRYPTION_KEY_V2` | secret | present, >=32 | distinct |
| `MFA_ENCRYPTION_KEY_V2` | secret | present, >=32 | distinct |
| `CRYPTO_WRITE_VERSION` | non-secret | `2` dopiero po preconditions | nie ustawiać przed keyring-ready build |

Wszystkie cztery roots/salts (`AUTH_SECRET`, audit salt i trzy v2 roots; legacy root w okresie przejściowym) muszą być logicznie rozdzielone zgodnie z Gate 14C. Verifier może raportować wyłącznie pairwise-distinct booleans, nigdy wartości/fingerprinti sekretów.

## 4. Migration-only

| Zmienna | Typ | Gdzie | Wymóg |
|---|---|---|---|
| `MIGRATOR_DATABASE_URL` | secret | migration job/cutover | credential `gracz_migrator_v3`; różny od `DATABASE_URL` |

`MIGRATOR_DATABASE_URL` nie powinien być stale obecny w zwykłym runtime environment po zakończeniu migracji.

## 5. Conditional — database transport

| Zmienna | Typ | Kiedy |
|---|---|---|
| `DATABASE_SSL_CA_BASE64` | secret/config-sensitive | tylko gdy publiczny endpoint wymaga custom CA |

Dopuszczalne transport modes:

- `PRIVATE_RENDER_NETWORK`,
- `VERIFIED_TLS`.

Niedopuszczalne:

- publiczny endpoint z wyłączoną weryfikacją certyfikatu,
- pominięcie `pg-secure-preload.cjs`.

## 6. Conditional — Twilio

Twilio może być całkowicie wyłączone.

### Disabled contract

- `TWILIO_ACCOUNT_SID` absent,
- `TWILIO_AUTH_TOKEN` absent,
- `TWILIO_FROM_NUMBER` absent.

### Enabled contract

- wszystkie trzy present,
- `TWILIO_AUTH_TOKEN` traktowany jako secret,
- controlled send test PASS.

Partial config = FAIL.

## 7. Trusted proxy flags

Domyślne target values przed topology proof:

- `TRUST_CLOUDFLARE_HEADERS=false`,
- `TRUST_PROXY_HEADERS=false`.

Zmiana na `true` wymaga osobnego dowodu infrastrukturalnego, że odpowiedni header nie może być wiarygodnie spoofowany przez klienta docierającego do origin.

## 8. Runtime infrastructural values

- `HOST` — Render/runtime binding; zwykle `0.0.0.0`,
- `PORT` — platform supplied,
- `DATA_DIR` — tylko jeśli file/dev mode; production PostgreSQL path nie powinien zależeć od trwałości lokalnego filesystemu.

## 9. Compatibility names — nie używać jako nowy keyring

Obecne nazwy:

- `MESSAGE_ENCRYPTION_KEY`,
- `ATTACHMENT_ENCRYPTION_KEY`,
- `MFA_ENCRYPTION_KEY`

należą do obecnego kodu i nie mogą być bezpośrednio zastąpione nowymi v2 roots przed implementacją keyringu.

Po zakończonym cutover powinny zostać usunięte z target contract albo pozostawione wyłącznie jako kontrolowany compatibility alias, jeśli implementacja formalnie tego wymaga.

## 10. Secret storage contract

Sekrety muszą być przechowywane wyłącznie w zatwierdzonym provider secret/environment store.

Zakazane miejsca:

- repozytorium,
- pliki dokumentacji,
- PR/issue comments,
- GitHub Actions plaintext output,
- aplikacyjne logi,
- screenshoty,
- test fixtures z realnymi sekretami.

## 11. Rotation contract

Każdy secret ma mieć:

- określonego ownera operacyjnego,
- procedurę rotacji,
- procedurę rollback,
- dowód, że rotacja nie wymaga publikowania wartości,
- dla crypto — zgodność z Gate 14C key-version/rekey runbook.

## 12. Applied PASS

Ten manifest uzyskuje applied PASS dopiero, gdy fresh verifier na docelowym runtime pokaże zgodność konfiguracji bez ujawnienia wartości oraz behavior tests potwierdzą właściwe działanie production-only security paths.
