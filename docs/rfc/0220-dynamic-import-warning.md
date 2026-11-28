# RFC 0220: k.ctx: an `import()` in app code is W1608

Status: accepted (ADR-0242) by the orchestrator on 2026-11-24. Amends k.ctx (Rules, Conformance), k.check (App code), the map. From the operator's D137 (backlog 1090).

## Decisions
- D1: one new code, W1608, a warning: an `import()` expression in app code, at `import`, whatever its specifier and however its result is used.
- D2: "app code" is k.check's App code, unchanged: test code, tool configs, `.keel/` and `node_modules/` are not judged.
- D3: two positions in app code are not reported, each one whose form a rule already fixes: a `Host`'s `code` in E1824's form, and a message set's `load` given to `messages` from `@keel/std-messages` (E2401). An `import()` that is E1603 is that code only.
- D4: W1608 joins the codes a lifted range does not report (k.check App code), as E1601 and E1603, its neighbours, do.
- D5: no fix, and no new severity switch: a W code never fails `keel check` (k.check Diagnostics), locally or in CI.

## Problem
`simulate` (k.sim) runs a scenario under many seeded schedules and waits for the work the run started before it steps the clock. A module load started by `import()` is I/O that no ctx owns: the run does not wait for it, and when it finishes depends on the module cache and the machine, not on the seed. Code that runs after the load can then interleave differently with the run's other work, and one seed can give two traces. `keel check` reports every other ambient effect of that kind (E1601) and says nothing about this one.

What the tree holds today (`grep -rn 'import(' apps examples`, `node_modules`, `.keel/` and `dist/` aside):
- `apps/household/test/household.ts:27`: `renderRoute(..., { routes: () => import("./webRoutes.ts"), ... })`, the harness's `routes` loader (k.testing). Test code.
- `apps/household/modules/receipts/ReceiptsText.schema.ts:26`, `apps/golden-2/modules/accounts/AccountsText.schema.ts:25`, `apps/golden-2/modules/recipes/RecipesText.schema.ts:86`: a message set's `load`, ``(locale) => import(`./<Set>/${locale}.ts`)``, the form E2401 requires (std.messages).
- `examples/host-component/modules/app/HomePage.tsx:22`: a `Host`'s `code={() => import("./barChart.ts").then((m) => m.barChart)}`, the form E1824 requires (k.host-element).

No route definition takes a loader: `createApp` and `routeTable` take tables. The one `routes` loader is the harness's `RoutesImport` (`@keel/testing`), written in tests.

## Proposal
### The rule
k.ctx Rules gains:

> W1608 an `import()` expression in app code, at `import`, whatever its specifier (a literal, a template, any expression) and however its result is used (`await`, `.then`, discarded): a module load is I/O no ctx owns, so a `simulate` run (k.sim) neither waits for it nor orders it by seed.

One finding per `import()` expression. A static `import`, `export ... from` and `import type` are not `import()` expressions; nor is a type query, `typeof import('./a.ts')`, which loads nothing.

### App code
k.check's App code, as `isAppPath` reads it: a project's code files that are not test code (`*.test.*`, `*.spec.*`, under `test/`, `tests/`, `conformance/`, `__tests__/`), not `*.config.*`, not under `.keel/` or `node_modules/`. So the harness's `routes: () => import(path)` is not judged, nor any `import()` a scenario makes: a test decides its own module graph, and the harness's `routes` loader is the one way a test asks for a fresh one (k.testing).

### Positions not reported
- An `import()` that is E1603 (a `data:` or `blob:` URL): one diagnostic, the error.
- A `Host`'s `code` written as its prop value in E1824's form, `() => import('<path>').then((m) => m.<export>)`, the `Host` from `@keel/ui`. The harness never runs `code` (k.host-element Harness and replay), so its load cannot reach a `simulate` run. The same arrow function held in a `const` and passed as `code={load}` is E1824 and W1608.
- A message set's `load`: the arrow function whose body is the `import()`, written as the third argument of a call whose callee is the `messages` import of `@keel/std-messages`. E2401 fixes its form, and `Set.load` is awaited by the loader that returns the text, so the load sits inside work the run already waits for. A locally declared `messages`, or the function held in a `const`, gives W1608.

The kernel names `@keel/std-messages` as a specifier string to recognise the call, as R1053 (k.escapes) names std.messages' `load`; it imports nothing from it (`tooling/deps.json` order holds).

### Lifted ranges
W1608 is not reported inside a lifted range of an `unsafe/` file (k.check App code), as E1601 and E1603 are not: a justified `unsafe(` call is the one escape for an ambient effect, and a load that must be dynamic (a large optional dependency) takes it with its reason.

### Severity and output
A warning, per D137. W codes never affect the exit code (k.check Diagnostics); no `--strict` flag exists and none is added, so CI's `keel check` passes with W1608 shown. No fix: which static import replaces the load is the author's call.
```
W1608 modules/report/Export.ts:12:22 import() in app code is a load simulate does not track; use a static import
ok check 0 errors
```
The message is 76 characters. `keel explain W1608`:
```
W1608 import() in app code is a load simulate does not track; use a static import
A module load is I/O no ctx owns: a simulate run neither waits for it nor orders it by seed, so one seed can give two traces. A Host's code (E1824) and a message set's load (E2401) are not reported.
const { a } = await import('./a.ts') -> import { a } from './a.ts'
see k.ctx
```

## Alternatives
- **An error (E1608).** The operator chose a warning (D137). A load the code awaits inside a loader changes a trace only through timing; the warning names it without blocking a build.
- **Judge test files too.** A scenario's own `import()` is the test's choice of module graph, and the harness's `routes` loader is written there; judging tests would need an exception for it and for fixtures.
- **Exempt every `import()` with a literal specifier.** A literal load is still I/O the run does not wait for; the specifier's form does not change when it finishes.
- **Report the message set's `load` and Host's `code` too.** The repo's golden apps and example would carry warnings for forms two rules require, with no form left to write.
- **Track loads in the runtime instead.** Wrapping `import()` needs a loader hook in every host (vite, node, the browser) and still leaves the load's timing to the machine.

## Spec diff
Applied in this commit.
- k.ctx (to `implemented` until its five new clauses are covered and built): Rules gains W1608; Conformance gains five clauses.
- k.check (stays `conformance-covered`): App code's lifted list gains W1608.
- Map: the k.ctx row reads `implemented`. The `E160x` block's owners already include k.ctx.
- No glossary term is added; no section is added.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/check/conformance/ctx-W1608-dynamic-import.test.ts`: the five k.ctx clauses, over file maps as the E1601 and E1603 tests build them.
- `packages/check/conformance/fixtures-by-code.ts`: a W1608 fixture, since every code `check()` reports needs one (k.check Conformance), and the explain-entry test then covers W1608.

## Migration
None. No app is released, and no app or example in the repo reports W1608 (Problem lists each `import()` and why it is clean).

## Token impact
- Spec: k.ctx grows by about 545 tokens to about 2,110 of 3,100; k.check by about 2 to about 2,770. The map shrinks by one token.
- `keel explain W1608`: one catalog entry, under the 120-token limit.
- `@keel/check`: one rule, a visitor over `ImportExpression`; size to measure in the build.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the five clauses and the fixture. 3. Build:
- `packages/check/src/rules/dynamicImport.ts` (new): `isAppPath` files; each `ImportExpression` not E1603's (`noCodeFromString`'s URL test), not the `code` prop value `hostUses` and `hostCodeSpecifier` accept, not the third argument of a `messages` call bound to `@keel/std-messages`. Registered with the kernel rules; `EXPLANATIONS.ts` gains the entry above; `dropLifted.ts`'s `LIFTED` gains W1608.
- Docs: the `keel` skill's code list and the `keel-testing` skill's `simulate` notes (`packages/cli/skills/`, copied to `.claude/skills`), the `@keel/check` README, a changeset, `tasks/BACKLOG.md` (1090).
- No app or example changes.

## For the operator
1. **The `routes` loader lives in tests, so tests are not judged.** No route definition takes a loader; the harness's `routes: () => import(path)` is the one, and it is test code. Recommended: keep the rule to app code as D137 says.
2. **A message set's `load` is not reported.** Its load is awaited inside a loader the run waits for, and E2401 requires its form. If you want it reported, std.messages needs a load through `ctx` first.
3. **W1608 is lifted inside a justified `unsafe(` call,** as E1601 and E1603 are.
