# RFC 0216: k.check: an `unsafe/` file is app code outside its `unsafe(` calls

Status: implemented (ADR-0238), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Amends k.check (App code, Rules, Conformance), k.persist (E1551's file scope), k.escapes (R1050's row, wording only), std.copy (Files, Conformance), the map. From backlog 1026.

## Decisions
- D1: option (a). A file under `unsafe/` is app code but for its lifted ranges: the arrow function or function expression written as the second argument of an `unsafe(` call with a justification string. Every other line of the file is checked as `modules/<id>/a.ts` is.
- D2: a lifted range lifts a closed list of kernel codes: E1252, E1451, E1452, E1601, E1603, E1651, E1757, E1758, E1759. Every other code, kernel or stdlib, reads the range as the rest of the file.
- D3: everything E1757 reports is written inside the range. A cast, `!` and a suppression are expressions or comments and fit; a type holding `any` is declared inside the function; a signature outside takes `unknown` or a type parameter.
- D4: no new code and no new R code. E1757's message names the call in an `unsafe/` file; its fixes are unchanged. `keel review` is unchanged: the lines outside the calls are check errors now, so review has nothing new to list.
- D5: kernel and stdlib packages follow the same rule through `tooling/structure-lint.mjs` (S0004 is E1757). The 12 type-only fixtures under `packages/*/unsafe/` wrap their expected-error lines in `unsafe(reason, () => ...)`, 14 calls in all, and the ledger's `unsafe` count rises by 14. `packages/cli/conformance/unsafe/review-fixtures/` (fixture text for `keel review`, copied, never imported) leaves structure-lint's scan, as `tooling/fixtures` has.

## Problem
`isAppPath` (`packages/check/src/internal/isAppPath.ts`) drops every file under `unsafe/` from app code, and `noUnsafeSyntax` (E1757) drops the same paths. So a file under `unsafe/` holding one justified `unsafe(` call is exempt, on every line, from E1757, E1601, E1252, E1603 and every other in-app-code rule: about 50 kernel codes in all (E1752's one export, E1551's server-only `commitStores`, E1570 and E1571's declared origins, E1451, E1452 and the rest), and the stdlib's rules that filter `unsafe/` out (std.copy E2406, std.channels E2601 and E2602). `keel review` lists the call (R1001, with its reason) and a file with no call (R1058), and a cast anywhere in the file (R1050), but not a bare `fetch`, `Date.now()`, `document` or `throw` on a line outside the call. One justified escape opens the whole file, and no reason names the other lines.

The spec does not define app code: k.escapes says "app code is k.check's", and k.check never says it. The scope lives in `isAppPath` alone.

## The tree
`apps/*`, `examples/*`, `tooling/fixtures/*` and the std-sessions fixtures hold no file under `unsafe/`. The rule costs no app anything.

`packages/*/unsafe/`, read through `check()` with each file moved to `modules/m/<name>` and each finding placed in or out of a call's second argument:
- 19 files with one `unsafe(` call: `compiler/runCommonJs.ts` (E1603), `ctx/asId.ts`, `ctx/narrowAccessor.ts`, `forms/asSchemaValue.ts`, `runtime-dom/narrow.ts`, `std-messages/asEntry.ts`, `std-offline/asResult.ts`, `std-statecharts/asEvents.ts`, `std-statecharts/loosen.ts`, `std-tables/asQuerySchema.ts`, `std-workflows/asEvents.ts`, `std-workflows/looseChart.ts`, `store/sourcesFor.ts` (two casts), `testing/axeRuleList.ts`, `testing/axeSync.ts` (a cast and a `try`), `testing/currentTestMeta.ts`, `testing/evalOnHeap.ts`, `testing/onTestEnd.ts`, `testing/withCallbacks.ts`. Outside the call each holds imports, a doc comment and a typed signature (`sourcesFor(_t: Transaction<T, P>, entry: { readonly fn: object; ... })`), with no cast, `any`, `!`, suppression or ambient read. Every finding is inside the callback: the tree meets D1 as written.
- 14 `unsafe.ts` files, each the helper `unsafe<T>(reason: string, fn: () => T): T` with a `throw` (E1451, which structure-lint does not read for packages). No call, nothing E1757 reads.
- 12 type-only fixtures with no call: `router/conformanceNegativeTypes.ts` (35 `@ts-expect-error`), `router/negativeTypes.ts` (19), `runtime-dom/conformanceNegativeTypes.ts` (3), `runtime-dom/jsx-match.tsx` (3, in three exported consts), `server/conformanceNegativeTypes.ts` (2), `services/conformanceNegativeTypes.ts` (5), `std-channels/conformanceNegativeTypes.ts` (9), `std-channels/negativeTypes.ts` (3), `std-offline/conformanceNegativeTypes.ts` (3), `std-text/conformanceNegativeTypes.ts` (3), `testing/conformanceNegativeTypes.ts` (1), `ui/conformanceNegativeTypes.ts` (2). Each is one exported function (jsx-match three consts) whose lines are expected-error directives; they sit in `unsafe/` only so that E1757 skips the directives. Under D1 each directive is S0004.
- `packages/cli/conformance/unsafe/review-fixtures/` (18 files): the text `keel review`'s conformance copies into a fixture repository, a bare cast, `any`, `!` and suppression each. Test code, so no in-app-code rule reads it, but E1757 reads test code.

## Proposal
### App code
k.check gains the definition the other sections point at. The rules "in app code" read a project's code files (`.d.ts` aside) that are not test code, not `*.config.*` and not under `.keel/` or `node_modules/`. That is `isAppPath` less its `unsafe/` clause. A file under `unsafe/` is app code but for its lifted ranges.

### Lifted ranges
A lifted range is the arrow function or function expression written as the second argument of an `unsafe(` call whose first argument is a justification string (E1754's test: a string literal or a template without substitutions holding a non-space character), in a file under `unsafe/`. It runs from the function's first character to its last: its parameters, its return type, the comments inside it and the functions nested in it. Three forms give no range:
- a second argument that is a name or a call (`unsafe('r', g)`): the function `g` names is written elsewhere, where no reason sits beside it;
- a call without a justification string, which is already E1754; lifting on it would give a call that fails check an effect;
- a call in a file outside `unsafe/`. R1001 still lists it, and it lifts nothing, so the directory stays the one place a reviewer looks for escapes (R1058 keeps a file there honest).

### What a range lifts
Inside a range these codes are not reported: E1252 (`document`, `window`), E1451 (`throw`), E1452 (`try`/`catch`), E1601 (ambient effects: `Date`, `Math.random`, `fetch`, storage, timers), E1603 (code from strings), E1651 (`ctx.net.fetch`), E1757 (cast, `!`, `any`, suppression), E1758 (ambient locale and zone), E1759 (Node globals in a browser file). These are the guarantees a wrapped library breaks: its types, its reads of the host and the clock, its throws. Every other code reads the range: one export per file (E1752), server-only code (E1551), declared origins (E1570, E1571, which have their own sanctioned path, R1010), `reveal` (E1105, E1112, their own path, R1012), schemas, routes, a11y, copy. Each of those has a Keel seam, and an `unsafe(` reason does not stand in for it.

The list is closed and kernel only. A stdlib rule that reads app code reads an `unsafe/` file whole, ranges included: `@keel/std-messages`' E2406 and `@keel/std-channels`' E2601 and E2602 drop their `unsafe/` filters. A library's rules (k.parity) read it on the same terms. A registered rule's findings in a range are reported; the pipeline drops only the listed kernel codes.

### Outside a range
The rest of the file is app code. What a type-only construct may do there:
- imports, `import type`, interfaces, type aliases, `declare const`, function signatures and helper code: allowed, checked as anywhere in `modules/<id>/`;
- a cast or `!` is an expression, and always fits in the range: `() => raw as Id<B>`;
- a suppression comment is placed in the range, on the line before the expression it covers;
- `any` in a type position outside is E1757. A type alias that needs it is declared inside the function (`() => { type L = Chart<any>; return c as L }`); a signature takes `unknown` or a type parameter, and the range casts.

So every line E1757 or an ambient code would report sits inside a function that one reason names, and R1001 shows that reason with the call. One way to write it.

### The diagnostic
E1757's code, fixes and position are unchanged; in a file under `unsafe/` its message names the call:
```
E1757 modules/charts/unsafe/canvas.ts:9:10 type cast outside an unsafe() call; use a guard or move it into the call
fail check 1 errors
```
Outside `unsafe/` it reads as now (`type cast outside unsafe/; use a guard or move it to unsafe/`). The longest kind, `ts suppression comment`, gives 85 characters. The fixes stay: `x!` to `x`, `any` to `unknown`, delete the comment; a cast has none, and no fix wraps a line in a call, since a fix cannot write the reason. The other lifted codes keep their messages and fixes (E1601's `ctx` equivalent, E1451's `return err(...)`): outside a range the right move is usually to stop doing it, not to wrap it. `keel explain E1757`:
```
E1757 cast, non-null assertion, any, or ts-suppression outside an unsafe() call
These defeat the type system; narrow with a guard, or put the one expression in unsafe(reason, () => ...) in a file under unsafe/.
x! -> x (after a guard); any -> unknown
```

### `keel review`
Unchanged. R1001 lists each call and its reason; R1058 a file under `unsafe/` with no call; R1050 a cast anywhere under `unsafe/`, inside a range or not (outside one it is also E1757). R1057's "global `fetch` under `unsafe/`" stays: inside a range it is the justified one. R1050's row is reworded to list files rather than say "outside app code", since app code now includes `unsafe/` files; what it reads does not change.

### Kernel and stdlib packages
CLAUDE.md rule 6 says no cast, `any`, `!` or `@ts-ignore` outside `unsafe/`, and every `unsafe` use carries a justification string. In this repository E1757 reaches the packages through `tooling/structure-lint.mjs`, which runs `check()` on `packages/*/{src,unsafe,test,conformance}` and keeps E1757 as S0004. The same rule applies there with no exception, so rule 6's second clause holds everywhere the first does:
- the 19 files with a call need nothing;
- the 12 type-only fixtures wrap their bodies: each exported function's body becomes `return unsafe('<what the directives assert>', () => { ... })` (a `void` function: `unsafe(...)` as a statement), and `jsx-match.tsx`'s three consts that hold a directive each take `unsafe('...', () => (...))`. That is 14 calls. Router, server, ui, std-channels and std-text gain the package's `unsafe/unsafe.ts` helper the others have. The fixtures are never run, so the helper never runs either; `tsc` reads the directives exactly as before. A test that reads a directive's line (`runtime-dom/test/match.test.ts` runs `tsc` over `jsx-match.tsx`) is updated with the file;
- the ledger's `unsafe` count (calls in `packages/*/{src,unsafe}`) rises by 14 when the orchestrator regenerates it: each new call is a directive that was in `unsafe/` with no reason a counter could see;
- `packages/cli/conformance/unsafe/review-fixtures/` is fixture text for k.escapes, the evasions under test; it joins `tooling/fixtures` and `evals/results` in structure-lint's skip list. Its files stay where they are, so no conformance file moves.

### Freeze cost
No app, example or fixture project has a file under `unsafe/`, so no existing app gains an error. The new errors are in the repository's own type fixtures, fixed in the build. The kernel stays provisionally frozen; this is the RFC that changes it.

## Alternatives
- **(b) The file stays lifted; `keel review` lists each lifted violation outside a call.** Every such line becomes a review row with no reason beside it, a reviewer accepts each into `keel-review.json` one by one, and `keel check` stays green on a bare `fetch`. It keeps two ways to escape (a call, or a line in the right file) and puts the cost on the reviewer.
- **(c) A file-level justification** (a header comment or an exported `reason`). A second way to write a reason, one the ledger cannot count by call, and it lifts every line under one sentence that cannot be checked against any one line.
- **Lift every in-app-code code inside a range.** Would let a reason stand in for seams that exist: origins, `reveal`, server-only files, one export per file. The closed list is the guarantees a wrapped library breaks.
- **Lift in any file, not only under `unsafe/`.** Escapes would spread through `modules/`; the directory is where review and the ledger look.
- **Keep the directory lift for packages.** Two rules for one word; the 12 fixtures would keep 88 directives with no reason a counter sees.
- **A new code for a violation in an `unsafe/` file.** The codes already say what is wrong; only E1757's message needs to name the call.

## Spec diff
Applied in this commit.
- k.check (to `implemented` until its new clauses and the build land): **App code** paragraph (the definition, lifted ranges, the lifted codes, what sits outside, stdlib rules); E1757's Rules entry (scope and the two messages); Conformance gains seven clauses (#14 to #20); #14 names the directive as a `@ts-expect-error` comment, without the comment marker, so a header quotes the clause whole.
- k.persist (stays `conformance-covered`): E1551 reads app code (k.check), which now includes `unsafe/` files; no clause is added, as k.check #19 shows a non-lifted code reading an `unsafe/` file.
- k.escapes (stays `conformance-covered`): R1050's row lists files instead of "outside app code"; no behaviour change.
- std.copy (to `implemented`): Files reads `unsafe/` files whole; Conformance gains one clause (#3).
- Map: the k.check row and `spec/std/README.md`'s std.copy row read `implemented`. No row added; the map's size does not grow.
- Ledger: rows for k.check#14 to #20 and std.copy#3 come from the orchestrator's regeneration (not hand-edited).

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/check/conformance/unsafe-lifted-ranges.test.ts`: k.check #14 to #20 over in-memory file maps (`modules/m/unsafe/a.ts` with a local `unsafe` helper, as the existing E1757 and E1754 fixtures build them).
- `packages/check/conformance/fixtures-by-code.ts`: unchanged; E1757's fixture stays outside `unsafe/`.
- `packages/std-messages/conformance/`: std.copy #3 in the file holding std.copy's cases, or a new `copy-unsafe-file.test.ts`.
- Existing cases: the R1050 clause (k.escapes) is unchanged and its fixture (`review-fixtures/cast.ts`) is unchanged. A check conformance case that asserts a clean check over a fixture with a file under `unsafe/` is confirmed by the writer.

## Migration
None. No app is released, and none has a file under `unsafe/`.

## Token impact
- Spec: k.check grows by about 900 tokens to about 2,450, under the 3,400 section budget; std.copy by about 70; k.persist shrinks by about 15. The map does not grow.
- `keel explain E1757`: one line longer, under 120 tokens.
- `@keel/check`: one walk for `unsafe(` calls per `unsafe/` file and a range filter for nine codes; size to measure in the build against the package's budget.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: k.check #14 to #20, std.copy #3. 3. Build:
- `packages/check/src/internal/isAppPath.ts`: drop `unsafe` from the excluded segments. `packages/check/src/internal/liftedRanges.ts` (new): the ranges of a file under `unsafe/`, from the AST. The pipeline drops a finding of the nine codes whose offset lies in a range; `noUnsafeSyntax.ts` reads `unsafe/` files and picks the message by path. `EXPLANATIONS.ts`: E1757's entry as above.
- Each kernel rule that filters `unsafe/` itself (grep `unsafe` in `packages/check/src`) reads app code through `isAppPath`.
- `packages/std-messages/src/tools/literalCopy.ts`, `packages/std-channels/src/tools/internal/isAppFile.ts`: drop `unsafe` from their filters; grep the other `packages/std-*/src/tools` for the same.
- The 12 type-only fixtures and five new `unsafe.ts` helpers (router, server, ui, std-channels, std-text); `runtime-dom/test/match.test.ts` if a line moves.
- `tooling/structure-lint.mjs`: `packages/cli/conformance/unsafe/review-fixtures` in the skip list.
- Docs: the `keel-escapes` skill's R1058 row and the `keel-package-dev` skill's Layout line ("casts inside `unsafe(reason, fn)` in a file under `unsafe/`"), copied from `packages/cli/skills/` to `.claude/skills/` where both exist; the `keel` skill's E1757 line; the `@keel/check` README; a changeset; `tasks/BACKLOG.md` 1026.

## For the operator
1. **Option (a), with a closed list of nine lifted codes.** Recommended: yes; every lifted line sits in a function one reason names, and the codes with their own seam (origins, `reveal`, server-only files) are never lifted.
2. **The packages follow the same rule; the ledger's `unsafe` count rises by 14.** Recommended: yes; the 12 type fixtures gain a reason per directive block instead of a directory exemption.
3. **`keel review` unchanged.** Recommended: yes; the lines outside a call are check errors, so there is nothing new to review.
4. **CLAUDE.md rule 6** still reads "outside `unsafe/` directories". It stays true (the rule got stricter inside them); tightening its wording to "outside an `unsafe(reason, fn)` call in `unsafe/`" is the operator's edit.
