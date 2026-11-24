# RFC 0227: k.check-cache: a std rule is left out only when `deps` loaded it and dropped it

Status: accepted (ADR-0249), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Amends k.check-cache (In one process, Conformance). From the 0963 whole test run (D144).

## Decisions
- D1: a `@keel/std-*` package's formats (E1108) stay scoped by the `deps` of the call, as they are.
- D2: a std package's rules run on every call, except when the package was first imported in the process by `importDeps` for an earlier call's `deps` and the app manifests at this call do not list it.
- D3: a rule the caller registered itself (by importing its package before any `importDeps` call did, or by calling `defineRule`) runs on every call whatever `deps` lists. A fresh process does exactly that with it.
- D4: who registered a rule is fixed by the package's first import in the process. A caller that imports a package after `importDeps` loaded it registers nothing new (Node holds one copy), so the rule stays one `deps` brought in.

## Problem
k.check-cache In one process says a std package's "formats (E1108) and rules apply to a module only while the project's app manifests list the package in `deps`". `check()` builds that scope from the `deps` of `modules/<id>/module.ts` alone (`packages/check/src/internal/stdInScope.ts`) and filters every registered rule through it (`check.ts`, `ruleInScope`). A rule whose caller registered it, by importing `@keel/std-db/tools` in a test or a tool, now runs only when some manifest lists its package. Nine std suites get no findings (std-brands, std-db, std-i18n, std-jobs, std-offline, std-postgres, std-sessions, std-tokens, std-workflows), among them conformance cases with no `deps` that expect a finding: `packages/std-db/conformance/e2151.test.ts` (E2151) and `packages/std-brands/conformance/brands.test.ts` (three cases). Those cases are right.

The sentence also breaks the law it serves. A fresh process whose caller registered a rule runs that rule: `check()` reads no `deps` to register anything (`keel check` imports the listed packages first, through `importDeps`, and `check()` imports nothing). So filtering a caller's rule by `deps` makes `check()` answer as no process would.

What RFC 0226 wanted is narrower: in a long-lived process (dev, editor, `keel mcp`), a package one call loaded because `deps` listed it keeps its rules registered after `deps` drop it, and a fresh `keel check` of the new tree would not load it. Only that package's rules must be left out.

## Proposal
k.check-cache In one process, its last sentence replaced by three:

> A `@keel/std-*` package's formats (E1108) apply to a module only while the project's app manifests list the package in `deps` at the time of the call. Its rules run on every call, except when the package was first imported in the process by `importDeps` (`@keel/compiler/std/importDeps`, which the `keel` commands call with the project's files before they check) for an earlier call's `deps` and the app manifests at this call do not list it. A rule the caller registered itself, by importing its package before any `importDeps` call did or by calling `defineRule`, runs on every call whatever `deps` lists, as it does in a fresh process whose caller registered it.

Why this wording and not the diagnosing lane's ("a package an earlier call imported through `deps` that they no longer list is not consulted, for formats or rules"):
- "imported through `deps`" did not say what happens when the caller had already imported the package and `deps` listed it later. Then the caller registered the rule, a fresh process with that caller runs it, and leaving it out would let an earlier call change a later answer. "First imported ... by `importDeps`" decides it.
- It names the function, so a conformance test can make "imported through `deps`" happen in-process without the CLI, and the formats sentence keeps its own clause, unchanged in meaning, so a header quotes it whole.
- It says what a fresh process does with a caller's rule (runs it), which the brief asked be stated; the opening law ("nothing an earlier call parsed, loaded or registered changes a later call's answer") stays true as written.

Formats keep their scope because E1108 judges a literal against the formats the project can reach, and a fresh `keel check` registers formats only through `deps`; `check-deps-dropped.test.ts` covers it with the package imported by the test itself, and it still reports E1108.

## Alternatives
- **Keep the sentence and add `deps` to every case.** About 80 cases across nine packages would gain a manifest entry that says nothing about what they test, and a rule a tool registers would still be silenced. Rejected (D144).
- **Scope rules by `deps` only for packages loaded from `node_modules` by path.** The same package resolves to one file whether a test or `importDeps` imported it; the path does not tell who registered it. The first import does.
- **Drop the scope for rules entirely.** Leaves RFC 0226's case: a dev server whose app drops `@keel/std-db` keeps reporting E2151 a fresh `keel check` does not.

## Spec diff
Applied in this commit.
- k.check-cache (stays `implemented`): In one process, the last sentence replaced as above; Conformance gains two bullets, #12 (a rule the caller registered runs with `deps: []`, before and after an `importDeps` that listed its package) and #13 (a rule `importDeps` loaded first is left out once `deps` drop it, as a fresh `keel check` reports).
- Map unchanged: k.check-cache's row reads `implemented`. No code, no glossary term, no section.
- Ledger: k.check-cache has no rows; `keel ledger` writes them, nothing here is hand-edited.

## Conformance diff
By the `conformance-writer`, from the spec text. Both in `packages/std-db/conformance/` (they import `@keel/std-db` and `@keel/compiler/std/importDeps`; kernel tests import no std package):
- `check-caller-rule.test.ts`: k.check-cache#12.
- `check-deps-dropped-rule.test.ts`: k.check-cache#13. This file must not import `@keel/std-db` or its `./tools` (statically or through a shared fixture), so `importDeps` makes the first import; the fresh run is `keel check --format=json` over a scratch project, as `check-deps-dropped.test.ts` does.
- `packages/std-temporal/conformance/check-deps-dropped.test.ts` needs no rules case: it imports the package itself, so its rules are the caller's and #13 is the case for rules.
- Existing cases (`e2151.test.ts`, `brands.test.ts`) stay as written and pass again.

## Migration
None. Nothing is released.

## Token impact
- k.check-cache grows by about 330 tokens to about 2,570, under 3,100. k.check and the map are untouched.
- `@keel/check` and `@keel/compiler`: one set of package names and one membership test; size to measure in the build.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: #12 and #13. 3. Build:
- `packages/compiler/src/std/importDeps.ts`: record each `@keel/std-*` package whose entry or `./tools` it imported first in the process (a package already in Node's module cache before its import is the caller's), exported for `@keel/check` (`tooling/deps.json` puts compiler before check).
- `packages/check/src/check.ts`, `internal/ruleInScope.ts`: leave a rule out only when its owner is in that set and not in `stdInScope`; formats (`judgeFormat.ts`) unchanged.
- `packages/check/test/type-cache-session.test.ts`: the case at line 82 ("a rule a @keel/std-* package defined runs only while the project's deps reach that package") asserts the old behaviour; rewrite it to the caller case (E2999 with `deps: []` reported) and a case through `importDeps`; update the `ruleInScope` unit case after it.
- Docs: the `@keel/check` README if it states the scope, a changeset, `tasks/BACKLOG.md`.

## For the operator
1. **Caller-registered rules always run.** Recommended: yes; it is what a fresh process does and what nine suites expect.
2. **Registration is fixed by first import.** A caller importing a package after `importDeps` loaded it does not make its rules the caller's. Recommended: yes; the other reading cannot be observed (one module copy) and only matters in a process that does both.
