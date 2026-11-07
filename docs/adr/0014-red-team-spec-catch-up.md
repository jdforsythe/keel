# ADR-0014: One URL policy, capped bodies, stable form ids (RFC 0024)

**Status:** accepted
**Context.** Red-team batch 2 (2abd442) fixed drift between the compiler's E1003 and the runtime URL guard, unbounded action bodies, counter-based form ids that differ between server and client, and inspect writes without an `Origin`. The spec lagged the code (backlog 0099).
**Decision.** k.compiler holds the single URL policy (seven URL attributes, `srcdoc` always blanked, http/https/mailto/tel) that `@keel/runtime-dom/url` implements and the compiler, runtime and `@keel/ui` share. `createApp` caps action bodies at `maxBodyBytes` (1 MiB) with 413 `keel.payloadTooLarge`. Form ids derive from an explicit `id` or the schema shape. Inspect admits an absent `Origin` for GET only.
**Alternatives.** Per-layer URL lists: they drifted (0084). Streaming parse without a cap: memory exhaustion. Process counters for ids: mismatch across processes.
**Consequences.** URL agreement tests run one case table against compiler and runtime; adding an attribute is one edit. Node rendering needs no DOM global. Conformance suites gain RFC 0024 cases; the ledger flags `// Clause:` headers (W1706).
