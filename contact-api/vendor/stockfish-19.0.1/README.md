# Stockfish.js 19.0.1 — vendored engine (CHESS-STOCKFISH-P1)

Unmodified third-party files served same-origin to the chess console as a Web Worker.
Licence: **GPL-3.0** (`COPYING.txt`). Source directions for users: `ZRODLA.txt`
(served at `/konto/szachy/stockfish/19.0.1/ZRODLA.txt`).

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `stockfish-19-lite-single.js` | 28 230 | `ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a` |
| `stockfish-19-lite-single.wasm` | 1 845 971 | `ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de` |
| `COPYING.txt` (package `Copying.txt`) | 35 821 | `0b383d5a63da644f628d99c33976ea6487ed89aaa59f0b3257992deac1171e6b` |

## Provenance (verified 2026-11-11)

1. npm tarball `https://registry.npmjs.org/stockfish/-/stockfish-19.0.1.tgz`
   (published 2026-10-10), files `package/bin/stockfish-19-lite-single.{js,wasm}` and `package/Copying.txt`.
   - `sha512` matches the registry `dist.integrity`
     `sha512-bTwsO4e9HAwPBKls1+szcfibmaWRNzTF20rQE/XPdB3LOSoT6XTZDr1zYwriwSRRFT5MkvqrglPmJrKEVXGnyQ==`.
   - npm registry ECDSA signature (key `SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U`)
     over `stockfish@19.0.1:<integrity>` verified against `https://registry.npmjs.org/-/npm/v1/keys`.
   - The package publishes no provenance attestation.
2. Independent cross-check: the GitHub release assets
   `https://github.com/nmrugg/stockfish.js/releases/download/v19.0.1/stockfish-19-lite-single.{js,wasm}`
   have the same SHA-256 as the npm files.

The server (`auth/chess-stockfish.mjs`) re-hashes the files at start-up and refuses to serve
any file whose SHA-256 differs; the console then uses its existing local engine.

## Why this flavour

`lite, single-threaded`: about 1.9 MB, no `SharedArrayBuffer`, so no COOP/COEP headers or other
page-wide isolation changes. The full NNUE build is about 94 MB.

## Updating

Repeat both verifications for the new version, replace the files in a new `stockfish-<version>/`
directory, update the hashes in `auth/chess-stockfish.mjs`, `ZRODLA.txt` and this file, and keep the
versioned URL so browsers' immutable cache never mixes versions.
