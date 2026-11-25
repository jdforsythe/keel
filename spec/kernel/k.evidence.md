# k.evidence: Evidence bundle
status: conformance-covered

**Purpose.** One dated, signed directory that an auditor checks without the source: the ledger, the accessibility results, the headers and policy served, where personal data is and how each sink redacts it, and the dependencies.

**Command.** `keel evidence [--out <dir>] [--audit <file>]` runs `check`, `test` and `ledger` on the project (the k.cli operations), reads `topology.ts`, imports each module's `*.schema.ts` files once in Node as the build evaluates `routes.ts` (k.compiler), and writes `<dir>` (default `evidence/<date>`, the UTC date of `ctx.clock.now()`):

| file | holds |
| --- | --- |
| `manifest.json` | `{ v: 1, app, at, source, keel, key, keyId, runs, files }`: `source` `{ commit, dirty }` from git, else `null`; `keel` each `@keel/*` version; `runs` the check error and failed test counts; `files` `{ path, sha256, bytes }` per other file |
| `manifest.sig` | the Ed25519 signature of `manifest.json`'s bytes, base64 |
| `check.ndjson`, `ledger.ndjson` | the records of those runs; the ledger holds the a11y claims (k.a11y) |
| `a11y.json` | per page route and criterion its rung and rules (k.a11y Claims); the criteria no rule maps to, for a person; `contrastTable(tokens)` |
| `security.json` | per `node` deployable the headers and policy k.security sends, with `<nonce>`; per `client` or `static` one its `csp.txt`; each with its declared `origins` (k.origins) |
| `pii.json` | per `.pii()` path (file, export, path, class), each sink (k.privacy) and the rung of its clause, by item (k.ledger-items; shown here by position: sessions `std.sessions#2`, inputs `k.privacy#7`, log `k.privacy#6`, bundle `k.evidence#5`): the project ledger's when it holds that item, else the kernel ledger's that `@keel/cli` ships; `coverage`, the share of (path, sink) pairs at `probabilistic` or higher; `caller` (k.user) |
| `deps.json` | each production dependency from `pnpm list --prod --json --depth Infinity` as a CycloneDX 1.5 component (name, version, integrity, license); `advisories` from `--audit` (`pnpm audit --json` output), else `null` |

Each `security.json` entry (`adapter`, `name`, then `headers` and `policy`, or `csp`) carries `origins`: `{ directive, origin, reason }` per declared origin (k.origins), directives in the order `img`, `media`, `font`, `connect`, `frame`, origins in declaration order; `[]` with none.

Every file parses with a schema `@keel/cli/evidence` exports. No file holds an app value: records carry ids, codes, paths, counts and hashes. The command makes no network request.

**Signing.** The key is `KEEL_EVIDENCE_KEY`, an Ed25519 private key as PKCS#8 PEM, read only from the environment. `key` is its raw public key in base64, `keyId` the first 16 hex characters of that key's SHA-256. The bundle is written whether runs fail or not; failing runs exit 1 with E1060.

**Verify.** `keel evidence --verify <dir> --key <keyId>` checks that the SHA-256 id of the manifest's `key` and its `keyId` equal `--key` and that the signature verifies with that key, then re-hashes every listed file, finds no unlisted file, and parses each file with its schema. It emits one `evidence` record `{ kind, dir, at, keyId, files }`; compact `ok evidence evidence/2026-11-10 6 files key 3f2a9c01d2e4b5a6`.

**Rules.** E1060 the bundle records a check error or a failed test · E1061 `KEEL_EVIDENCE_KEY` absent or not Ed25519; nothing is written · E1062 a listed file missing, changed or not parsing with its schema, or an unlisted file present (names it) · E1063 `--key` absent, the key's id or `keyId` not `--key`, or signature invalid · E1064 `--audit` file is not `pnpm audit --json` output.

**Conformance.**
- On a fixture project with `KEEL_EVIDENCE_KEY` set, `keel evidence` writes exactly the eight files above, and `--verify` of the result emits one `evidence` record and exits 0.
- Changing a byte of any bundle file, adding a file or removing one makes `--verify` report E1062 naming it; a manifest signed by another key, a `--key` naming another keyId, or no `--key`, is E1063.
- Without `KEEL_EVIDENCE_KEY`, or with an RSA key, the command writes nothing and reports E1061.
- Under one sim seed and clock, two runs on an unchanged project write byte-equal bundles.
- No bundle file of a fixture whose stores and tests hold generated `.pii()` values contains any of them.
- `pii.json` lists every `.pii()` path of the fixture's schema exports with its class; `coverage` is 1 when every sink clause is `probabilistic` or higher, and drops when one is lower.
- `security.json` holds the k.security policy with `<nonce>` for each `node` deployable and the `csp.txt` text for each `client` one.
- A fixture with a failing test still gets a verifying bundle whose `runs` counts it; the command exits 1 with E1060.
- An `--audit` file that is not `pnpm audit --json` output is E1064; without `--audit`, `deps.json` has `advisories: null`.
- In a fixture with no `spec/` and no conformance files, each `pii.json` sink carries the rung `@keel/cli` ships for its clause, and `coverage` is 1 when those are all `probabilistic` or higher.
