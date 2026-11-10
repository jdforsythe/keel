# ADR-0096: the evidence bundle is an offline, Ed25519-signed directory built from the k.cli operations (RFC 0083)

**Status:** accepted (2026-11-10), user decisions D1 and D3, under the WORKFLOW RFC defaults 3, 4 and 5.

**Context.** S6's exit hands an outside accessibility auditor and pen tester evidence the framework produced. No command gathered the ledger, accessibility results, the policy served, the personal-data inventory and the dependencies, and `stdCommand` reserved only `session`, so a stdlib package could not add one.

**Decision.** A new kernel section, k.evidence, and a k.cli row. `keel evidence [--out] [--audit]` runs the `check`, `test` and `ledger` operations in process and writes `evidence/<date>/`: `manifest.json`, `manifest.sig`, `check.ndjson`, `ledger.ndjson`, `a11y.json`, `security.json`, `pii.json`, `deps.json`, each parsed by a schema `@keel/cli/evidence` exports and none holding an app value. The manifest is signed with Ed25519 under `KEEL_EVIDENCE_KEY`, read only from the environment, and carries the public key and a 16-hex `keyId`. `--verify <dir> [--key <keyId>]` re-hashes, checks for unlisted files, verifies the signature and parses each file. The command makes no network request: advisories come from a `pnpm audit --json` file CI passes (D3). Failing runs still produce a bundle that records them, and the command exits 1 (E1060).

**Alternatives.**
- Sigstore or cosign, rejected (D3): an outside transparency log and identity provider.
- A `@keel/std-evidence` package, rejected: it needs kernel operations in process and `stdCommand` reserves `session`.
- Running `pnpm audit` inside the command, rejected (D3): a network call from a command CI may run offline.

**Consequences.**
- A signature proves the bundle is unchanged since a key holder signed it; who holds the key is the project's process, published as the `keyId`.
- Two runs under one sim seed and clock are byte-equal, since Ed25519 signatures are deterministic.
- k.cli reaches 1,500 tokens; its next change needs a split first.
