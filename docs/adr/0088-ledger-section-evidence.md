# ADR-0088: the ledger is its own kernel section, and every rung has a producer (RFC 0082)

**Status:** accepted (2026-11-10), user decisions D1 and D4, under the WORKFLOW RFC defaults 2, 6 and 7.

**Context.** The committed ledger held `example`, `probabilistic` and `none` items only. The ledger read test sources for examples and property runs; nothing produced `exhaustive`, `proven` or `monitored`. k.testing was at 1,485 of 1,500 tokens, with no room for new evidence kinds.

**Decision.** k.ledger, a new kernel section implemented in `@keel/testing` and `@keel/cli`, takes k.testing's Ledger paragraph, its E1706, E1707 and W1706 entries and three clauses verbatim (k.testing goes to 1,122 tokens). Evidence from tests: `example`; property runs, now including `simulate`; `explore` with `from`, `payloads` or `depth` (`exhaustive`); closed-form `explore` and type-level tests, a passing body that asserts with `expectTypeOf` or `assertType` (`proven`, D4). Evidence from production: an app's `.keel/monitored.json` (`monitored`; E1711 when malformed). The ledger file counts, per rung, the items holding any evidence on it, and `keel ledger --diff` without `--scope` reports E1712 when a rung the committed file counts above 0 is held by no item.

**Alternatives.**
- Keeping the ledger in k.testing, rejected: the new evidence needs about 900 more tokens than the section has.
- `proven` from closed-form `explore` alone, rejected by the user (D4): docs/TESTING.md lists types, model checking and SMT under `proven`.
- Writing evidence at test run time, rejected: the ledger stays a static read of sources and files, as `keel ledger` is today.

**Consequences.**
- Eight conformance headers change section id from `k.testing` to `k.ledger` under `rfc:0082`, with no assertion change; clause items renumber and the orchestrator rewrites `tooling/ledger/ledger.json` in the same batch.
- E1712 makes the S5 exit (every rung populated) a standing CI gate.
- RFC 0083's ledger edits apply to k.ledger, not k.testing.
