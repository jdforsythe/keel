# RFC 0229: k.unsafe: `unsafe` counts runtime escapes; a negative type test is a test

Status: accepted (ADR-0251), accepted by the orchestrator on 2026-11-25, for the operator to confirm. Adds k.unsafe (`proposed`). Amends k.check (Rules: E1754's wording, E1757's scope), k.ledger (File), k.escapes (R1050's row), the map, `docs/GLOSSARY.md` (negative type test), `docs/TESTING.md` (Rungs, Conformance rules). From the operator's question: should type fixtures count as `unsafe` at all.

## Decisions
- D1: a negative type test is a file named `*.test-d.ts` or `*.test-d.tsx` under a `test/` or `conformance/` folder, type-checked, never run, imported by no file. Its expectations are `@ts-expect-error` comments with a description. They are no E1757 there; everything else E1757 reads is still E1757 there, and `@ts-expect-error` in any other test file stays E1757.
- D2: E1761 holds the home: a `*.test-d.*` file elsewhere, an import of one, or an `unsafe(` call in one.
- D3: the ledger writes `negativeTypes`, the count of expectations, after `hostElements`, written and never compared. A negative type test gives no item evidence: `proven` stays "a passing type-level test" (`expectTypeOf`, `assertType`), so one rule decides each rung.
- D4: `unsafe` counts what it counts today (k.unsafe now defines it): calls in `packages/*/{src,unsafe}`, `apps/*` and the root `modules/**`. The 14 fixture calls leave the count by leaving `unsafe/`, not by a counting exception.
- D5: in a package, `unsafe/` holds type-system escapes. Structure-lint enforces only E1757 of the lifted codes there, so a call whose function holds no cast, `!`, `any` or suppression lifts nothing that is enforced: S0014. A runtime technique with no type escape is ordinary code in `src/`, its hazard stated in a comment where it lives. In app code `unsafe` also lifts the runtime codes (E1601, E1603 and the rest), as k.check says.
- D6: E1760, a justification string of fewer than 8 words. That is the one strengthening `keel check` can make without a judgment call. Whether the reason argues safety is `keel review`'s (R1001 and the `keel-escapes` skill).

## Problem
`buildLedger` (`packages/cli/src/internal/buildLedger.ts`) counts every `unsafe(` call in `packages/<pkg>/{src,unsafe}`, the root `modules/**` and `apps/*`: 35 today. Of those, 14 are in 12 type-only fixtures, 88 `@ts-expect-error` lines in all, that never run: `router/conformanceNegativeTypes.ts`, `router/negativeTypes.ts`, `runtime-dom/conformanceNegativeTypes.ts`, `runtime-dom/jsx-match.tsx` (3 calls), `server`, `services`, `std-channels` (2 files), `std-offline`, `std-text`, `testing`, `ui`. They sit in `unsafe/` only because E1757 reports a suppression comment everywhere else. RFC 0216 then wrapped them in `unsafe(` calls so the directives fall in a lifted range. So 40% of the number that says how much running code steps outside the type system counts tests of the type surface. A number that measures things that do not matter does not matter.

Read the other way, several of the remaining 21 are not needed:
- `testing/unsafe/currentTestBound.ts`, `currentTestMeta.ts` and `onTestEnd.ts` each cast `Reflect.get(globalThis, "__vitest_worker__")`; one reader with `typeof` guards replaces all three casts.
- `testing/unsafe/axeRuleList.ts` casts axe's `_audit`; a guard on `rules` being an array of objects with `id`, `tags` and `enabled` replaces it.
- `testing/unsafe/withCallbacks.ts` casts parsed props to the full props type. That cast hides a real hole: a missing callback prop fails at run time, not at compile time. `render` taking its props generically closes it.
- `std-workflows/unsafe/asEvents.ts` casts `as unknown as E` over an unconstrained `T`, beside std-statecharts' constrained `asEvents`.
- `testing/unsafe/fullCollection.ts` holds no cast. In a package only E1757 of the lifted codes is enforced, so its `unsafe(` call escapes nothing that is checked (it lifts E1451 and E1759, which structure-lint does not read for packages).
- `check/unsafe/unsafe.ts` and `std-headless/unsafe/unsafe.ts` are unused helpers, and 21 more `unsafe/` folders hold only `.gitkeep`.

The spec never defined the `unsafe` count; it lived in `buildLedger` alone. E1754 asks only for a non-blank literal (`unsafe('r', ...)` passes). `evalOnHeap`'s "z3-solver types its Emscripten module as any" (7 words) says what the code does, not why it is safe.

## Proposal
### Negative type tests
One form, one home. The form is vitest's own name for type tests, `*.test-d.ts` (and `.tsx` for JSX cases). vitest's run globs (`*.test.{ts,tsx}` in every package config and in the scaffolded `vitest.config.ts`) do not match it, so it is never run without a rule. The home is a `test/` or `conformance/` folder: in a package `test/` or `conformance/`, in an app the root `test/` or `modules/<id>/test/`, where the scaffold already puts tests. Each package's `tsconfig.json` includes both folders, and its `check` runs `tsc` over them. `keel check` type-checks every code file of a project. An expectation that stops erroring is TS2578, which is `@ts-expect-error`'s own behaviour: a failed package `check`, E1751 in an app.

An expectation is a comment whose text, leading white space aside, starts `@ts-expect-error`, then white space, then a description holding a letter. Every expectation in the tree already has one (`// @ts-expect-error a layout guard needs a redirect`). The description is the claim: a reviewer reads what must not compile without reading the types. A bare directive, `@ts-ignore`, `@ts-nocheck`, a cast, `!` and `any` stay E1757 in the file, so a negative type test can assert only that something fails, and cannot make something pass.

E1761 keeps the home exact:
- a `*.test-d.ts(x)` file outside a `test/` or `conformance/` folder, at line 1: in `src/` it would compile into `dist`, beside app code it would read as app code;
- an import, `export ... from` or `import()` naming one, at the specifier: an imported file runs (`jsx-match.tsx` builds its three negative nodes at import time today);
- an `unsafe(` call in one, at the call: a negative type test needs none, and it would count.

### The ledger
`negativeTypes` is the count of expectations in negative type tests of `packages/*`, `apps/*` and an app's root `test/**` and `modules/**`, written after `hostElements`. It is not compared: adding one is no regression, and removing one is a deleted test, which `keel review` already reports (R1060 for a test file, R1061 under `conformance/`).

There is no rung. Rungs come from tests the runner reports passing. A negative type test holds none, and its proof is that the type check is green, which `keel ledger` does not observe. Giving it `proven` would need a second meaning of `proven`, "the gate was green when the ledger ran". The clause it asserts already has its run-time half in a conformance file that runs (`docs/TESTING.md` Conformance rules), which carries its rung. A `// Spec:` header in a `.test-d.ts` gives nothing.

### What `unsafe` is
k.unsafe states the count `buildLedger` makes, and that a call stands for code that ships or runs. In a package, `unsafe/` holds type-system escapes. A runtime technique with no type escape belongs where it is used, with its hazard in a comment. That is the lead's view, made exact by S0014: structure-lint reports an `unsafe(` call in `packages/*` whose lifted range holds no E1757 finding. The rule is a tooling S-code, not a kernel code: in an app, `unsafe` also lifts the runtime codes (a `Date.now()` in a wrapped library call is a real escape from E1601). So "lifts nothing" in app code is no type-only question, and no app rule is added for it.

### The reason
E1760: a justification string of fewer than 8 words, a word being a run of non-space characters holding a letter or digit, counted over the literal's value or the template's cooked text. Eight is the shortest length that fits a claim, its invariant and where the invariant holds. Every reason in the tree after the build meets it but `evalOnHeap`'s (7), which the build rewrites to argue the invariant. E1760 is a separate code from E1754: the justification string, which decides the lifted range, is unchanged, so `unsafe('r', ...)` in k.check's clauses still lifts and reports one E1760 beside.

A word floor rejects labels ("vitest global", "types are wrong"), not bad arguments. Rules that need a judgment call, such as "names the invariant" or "says where it is enforced", stay in review: `keel review` lists every call with its reason (R1001), marks an edited reason `changed` (k.review), and the `keel-escapes` skill judges whether it holds. Check enforces the form, review the substance.

### App authors
Everything above reads app paths: the same homes (`test/`, `modules/<id>/test/`), E1757's carve-out, E1761, E1760, and `negativeTypes` per app under `--scope`. An app with no negative type test sees no change. The `keel` and `keel-testing` skills gain the form.

## Alternatives
- **Keep fixtures in `unsafe/` and subtract them from the count by name.** Two meanings of `unsafe/`, and the count would hold an exception list.
- **`packages/<pkg>/test/types/**`.** A folder for the home, but `conformance/` needs the same, and an app's tests sit in two folders already. A suffix works in every test folder and is vitest's own.
- **Allow `@ts-expect-error` in every test file.** A test that runs would then call with wrong types at run time, and the claim would not have one place.
- **`proven` for a cited negative type test.** Rejected above: a second notion of passing.
- **Gate `negativeTypes` (E1706 on a drop).** Removal is already reviewed (R1060, R1061, the conformance guard).
- **A kernel code for an `unsafe(` call that lifts nothing.** In app code the lifted set holds runtime codes, and nearly every wrapped call lifts something. The type-only question is a repository one: S0014.
- **Change E1754 to require 8 words.** It would move lifted ranges and rewrite every k.check clause written with `unsafe('r', ...)`.

## Spec diff
Applied in this commit.
- k.unsafe (new, `proposed`): Unsafe, Reason, Negative type tests, Ledger (`unsafe`, `negativeTypes`, no evidence), Rules (E1760, E1761, S0014), Conformance (9 clauses).
- k.check (stays `conformance-covered`, no clause changes): E1754's entry points at App code's definition of a justification string (its parenthesis repeated that definition), and E1757's scope leaves out a negative type test's expectations.
- k.ledger (stays): File lists `negativeTypes` after `hostElements` and points at k.unsafe for both counts.
- k.escapes (stays): R1050's row leaves out a negative type test's expectation.
- Map: the E175x block adds k.unsafe; a k.unsafe row. `tooling/docs-owners.json`: k.unsafe under `@keel/cli`.
- Glossary: **negative type test**. `unsafe` keeps its name and definition.
- `docs/TESTING.md`: `proven` names the type-level tests that run; a "does not compile" claim is a negative type test in `conformance/`.

## Conformance diff
By the `conformance-writer`, from k.unsafe's text, in an `rfc:0229` commit.
- `packages/check/conformance/unsafe-negative-type-tests.test.ts`: k.unsafe#1 to #4 (E1757 carve-out, TS2578, E1761).
- `packages/check/conformance/unsafe-reason-words.test.ts`: k.unsafe#5 (E1760).
- `packages/cli/conformance/ledger-negative-types.test.ts`: k.unsafe#6, #7.
- `packages/cli/conformance/review-negative-types.test.ts`: k.unsafe#8.
- `packages/cli/conformance/structure-lint-s0014.test.ts`: k.unsafe#9, running `tooling/structure-lint.mjs --root` over a temporary root.
- `fixtures-by-code.ts` and `fix-diffs.test.ts` in `packages/check/conformance`: an E1760 and an E1761 fixture (no fixes).
- The moves: each `packages/<pkg>/unsafe/conformanceNegativeTypes.ts` becomes `packages/<pkg>/conformance/negative-types.test-d.ts` (router, runtime-dom, server, services, std-channels, std-offline, std-text, testing, ui), its `unsafe(` wrapper dropped and the expectations unchanged. The "Compile-time half" header lines of the conformance files that name `../unsafe/conformanceNegativeTypes.ts` name the new file.
- Existing cases: k.check's clauses use `unsafe('r', ...)`, which now also reports E1760 at the string. The tests select by code (`codesOf`). The writer confirms none asserts a whole clean check over such a fixture.

## Migration
None. No app is released; no app or example calls `unsafe` or holds a type fixture.

## Token impact
- Spec: k.unsafe about 1,420 tokens; k.check falls from 3,104 to about 3,073; k.ledger and k.escapes about +15 each. Map 1,543 to 1,558, re-based to 1,560 (`spec.map` 1,545 to 1,560); `docs.map` 1,590 to 1,600 for the new row.
- `keel explain`: two entries (E1760, E1761) under 120 tokens each.
- `@keel/check`: one literal word count and one path test; size measured in the build.

## Build plan
1. This commit: RFC, ADR, spec text, glossary, TESTING.md, map and budgets. 2. `conformance-writer`: the 9 clauses and the conformance moves above. 3. Build:
- `@keel/check`: E1757 (`noUnsafeSyntax.ts`) skips a described expectation in a `*.test-d.ts(x)` file; new rules E1760 (`unsafeReasonWords.ts`) and E1761 (`negativeTypeTestHome.ts`); `PIPELINE_CODES.ts`, `EXPLANATIONS.ts`.
- `@keel/cli`: `buildLedger` counts expectations (`negativeTypes`, per app too); `ledgerCommand` writes it after `hostElements`; `LedgerFileSchema`; `tooling/ledger-compare.mjs` and `pnpm evidence:report` carry it. `keel review`: R1050 skips a described expectation in a negative type test.
- `tooling/structure-lint.mjs`: passes E1760 and E1761 through; S0014.
- Moves out of `unsafe/` (test, not conformance): `router/unsafe/negativeTypes.ts` to `router/test/negativeTypes.test-d.ts`; `std-channels/unsafe/negativeTypes.ts` to `std-channels/test/negativeTypes.test-d.ts`; `runtime-dom/unsafe/jsx-match.tsx` splits: its three negatives to `runtime-dom/test/match.test-d.tsx`, its two positive nodes into `test/match.test.ts`. The `test/*.test.ts` comments that name `unsafe/negativeTypes.ts` name the new file.
- Removed escapes: `testing/unsafe/currentTestBound.ts`, `currentTestMeta.ts`, `onTestEnd.ts` read the task through one guarded `testing/src/internal/currentTask.ts`; `testing/unsafe/axeRuleList.ts` becomes `testing/src/internal/axeRuleList.ts` with a guard; `testing/unsafe/withCallbacks.ts` goes, `render` taking its props generically; `testing/unsafe/fullCollection.ts` becomes `testing/src/internal/fullCollection.ts` with no call, its comment stating the flag's hazard; `std-workflows/unsafe/asEvents.ts` goes, std-workflows importing std-statecharts' `asEvents` through a `@keel/std-statecharts/internal` entry (k.parity allows a stdlib internal entry). If its types do not fit, it takes std-statecharts' constrained signature instead and the count below is 15.
- `testing/unsafe/evalOnHeap.ts`: a reason of 8 words or more that argues the invariant.
- Removed helpers and folders: `check/unsafe/`, `std-headless/unsafe/`, and every `unsafe/` left holding only `.gitkeep` or an unused `unsafe.ts` (cli, reactive, router, scaffold, schema, server, services, std-brands, std-capacitor, std-channels, std-conflicts, std-db, std-geo, std-health, std-i18n, std-jobs, std-live, std-money, std-postgres, std-report, std-schedules, std-tauri, std-temporal, std-text, std-timings, std-tokens, ui); those packages' `check` scripts drop `unsafe` from `biome check`, and their `tsconfig.json` includes keep or drop it. The `.gitkeep` in each kept `unsafe/` goes. Coverage (`tooling/coverage-config.ts`) leaves `*.test-d.*` out.
- Docs: the `keel`, `keel-testing` and `keel-package-dev` skills, the `@keel/check`, `@keel/cli`, `@keel/testing` READMEs, a changeset, `tasks/BACKLOG.md`.
- After: `unsafe` 14 (compiler `runCommonJs`; ctx `asId`, `narrowAccessor`; forms `asSchemaValue`; runtime-dom `narrow`; std-messages `asEntry`; std-offline `asResult`; std-statecharts `asEvents`, `loosen`; std-tables `asQuerySchema`; std-workflows `looseChart`; store `sourcesFor`; testing `axeSync`, `evalOnHeap`). `negativeTypes` 88. 11 packages keep an `unsafe/` folder.

## For the operator
1. **The form is `*.test-d.ts(x)` under `test/` or `conformance/`.** Recommended: vitest's own name, never matched by a run glob, one rule for packages and apps.
2. **No rung for a negative type test.** Recommended: `proven` keeps one meaning; the clause's rung comes from its run-time half.
3. **`negativeTypes` is not gated.** Recommended: removal is already reviewed.
4. **E1760 at 8 words, an error.** Recommended: the one exact strengthening; judgment stays in review.
5. **S0014 is repository tooling, not a kernel code.** Recommended: in app code `unsafe` lifts runtime codes too, so "no type escape" is only a package question.
