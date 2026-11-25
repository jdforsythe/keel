# ADR-0255: k.a11y: a11y items per page route of a project, with the project's artifacts by default (RFC 0233)

**Status:** accepted (orchestrator, 2026-11-25), to be confirmed by the operator.

**Context.** The a11y item `a11y:<routeId>#<criterion>` named no project, and four route ids exist in more than one, so the ledger held 80 keys twice and a kept rung could come from another app. `keel test` passed no artifacts although k.a11y said it did, so E1702, E1804 and E1820 ran only where a test handed them in, and fifteen projects copied a `test/artifacts.ts`. Layouts and API entries got items that `renderRoute` refuses to render (E1501).

**Decision.**
- The item is `a11y:<project>:<routeId>#<criterion>`, `<project>` the project's directory relative to the one `keel ledger` runs in, `.` for that directory.
- Items exist per page route: a `routes.json` entry with a non-null `path` and no `api: true`. A layout is checked in the `renderRoute` runs of the pages it wraps, static codes count over the modules of a page's chain, and a layout no page route's chain holds is W1731 from `keel ledger`.
- A criterion is `example` when, over the route's `renderRoute` runs in passing tests, every render rule mapped to it (at least one) ran in some run, none is violated in any, and `keel check` reports none of its static codes in the chain's modules.
- Under `keel test`, a harness render given no `artifacts` takes the project's `.keel/a11y.json` and the `tokens` export of `tokens.ts`, each if present; a broken `tokens.ts` is E1807. Explicit `artifacts` replace the defaults; `{}` opts out. Outside `keel test` nothing is defaulted.
- `keel ledger --write` drops committed items that are not a current page route's item; no migration.

**Alternatives.** The folder name as project (not unique across `apps/` and `examples/`, checkout-dependent in an app's own run); items per layout (double counting); merging explicit artifacts over the defaults (two sources, no "none"); defaulting in every vitest run (a package has no project); a check error for a pageless layout (the concern is evidence).

**Consequences.** 31 page routes give 620 items, every key distinct. Every copied `test/artifacts.ts` goes. The household's runs run E1702, E1804 and E1820 for the first time. `ledger-fresh --a11y` fails until the ledger is regenerated on the main line. k.a11y and k.ledger read `implemented` until their clauses are covered.
