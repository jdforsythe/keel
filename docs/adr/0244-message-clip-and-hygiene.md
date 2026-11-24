# ADR-0244: a diagnostic's message is clipped by one exact rule; `replay` and `minimize` take `mount`; std.db conformance-covered (RFC 0222)

**Status:** accepted (orchestrator, 2026-11-24, for the operator to confirm).

**Context.** The spec said only "under 90 chars". Three clip functions in the build disagreed (89 with whitespace folding, 89 without, 90), all cut UTF-16 code units and could split a surrogate pair, and the formatters relied on each producer to clip. std.sessions stated `replay` and `minimize` with `mount` in prose only. std.db stayed `proposed` after CI's `postgres` job began running its Postgres 17 cases.

**Decision.**
- k.check Diagnostics: a message is one line of at most 89 UTF-16 code units; each whitespace run holding a line feed becomes one space and the ends are trimmed; a longer one keeps 86 code units, or 85 when the 86th is a high surrogate, then `...`. Every `diag` record is clipped so before it is rendered, so every format and surface carries the same message. T0001 follows the same rule.
- std.sessions: two clauses, `mount` without `serve` changes nothing a guard-free replay returns, and with `serve` both calls reject E1722 after one call of `serve`.
- docs/TESTING.md: a conformance case running `check` in process or a `keel` command passes its own timeout, at least 30 s, at least 60 s when it runs app code under `keel test`.
- Conformance tests own their fixtures; the k.check budget case on golden app 1 stays, by its clause.
- std.db is `conformance-covered`.
- k.ledger: an `a11y` item keeps its committed rung while its project has no `reports/a11y.json` (counted as `keptNoReport`), is recomputed when the report is present and is dropped when its route is gone; a mutation report file with no scored mutant drops its claim. The gate's `ledger-fresh --a11y`, after `keel test` in every app, bounds how long a kept rung can outlive its page.
- k.test-run: a clause asserts T0001's clip.
- The clip is a safety net (D143): each message is written to fit; an edit suggestion goes to `fix`, any other to `keel explain`; a path is shortened from its front. E1004 names its chain's ends and elides the middle; E1580, E1587, E1589 and E1108 are rewritten, E1589 and E1108 gaining fixes. No record field is added.

**Alternatives.** Counting code points or graphemes; allowing a split pair; clipping only at producers; keeping T0001 at 90; stating the rule in k.errors.

**Consequences.** k.check, k.test-run and k.ledger read `implemented` until their new clauses are covered. `normalize` in `@keel/cli` clips; `@keel/check`'s and `@keel/testing`'s clips gain the surrogate step. `@keel/check` gains `@keel/router` as a devDependency for one fixture root.
