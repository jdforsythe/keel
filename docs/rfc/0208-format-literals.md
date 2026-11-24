# RFC 0208: k.formats: a format literal, checked by `keel check` (E1108)

Status: accepted (ADR-0230), accepted by the orchestrator on 2026-11-23, for the operator to confirm. Amends k.formats (Literals, Rules, Conformance), std.temporal (API, one sentence), the map. From `apps/household` (walkthrough finding L9-3, backlog 1036).

## Decisions
- D1: one constructor for every format type, `formatLiteral(format, text)` in `@keel/schema`, typed `Format<string, N>`, with no `Result` to unwrap.
- D2: `keel check` parses `text` with the format registered under the name its type carries (`N`), the format's own `parse`; a failure, a `text` that is not a string literal, and a format with no registered name are each E1108, at the argument at fault, with no fix.
- D3: at run time outside `keel check`, `formatLiteral` parses and throws a `TypeError` naming the format and the rule; a checked tree never reaches that throw.
- D4: literals only. Data from outside the source keeps `parse` and the formats' readers (`instantOf`), which answer a `Result`; E1108 refuses any `text` but a literal, so the two never take the same input.
- D5: formats over `s.string()` registered by name only. `line`, `para` and message formats have no registered name and no literal form (E1108 says so).
- D6: E1108, the first free code in the E110x block (E1101 to E1103 are retired, E1104 to E1107 and E1111 to E1114 taken); the block's owners gain k.formats.

## Problem
In the household's weekly staples layer, `RestockData` first held `at: Instant`. The chart's `start` needs a value. `"1970-01-01T00:00:00.000Z"` fails `tsc` (`string` is not `Format<string, "temporal.Instant">`), and `instantOf(0)` is a `Result`, so the value needs a fallback the app cannot write without a cast (E1757). The run's time became epoch milliseconds (`s.int`), turned into an `Instant` only on the page. The same holds for a store's initial value and a test fixture: any format value written in source.

What the tree does today:
- A format type is `s.format(name, base, ...)`, branded `Format<T, name>` (`packages/schema/src/Format.ts`), assignable to `T` and not from it. The stdlib's fixed formats register under their names: `temporal.Instant`, `temporal.PlainDate`, `temporal.TimeZone`, `temporal.Duration`, `text.Email`, `text.Slug`, `tokens.Digested`. `line(...)`, `para(...)` and message formats are made by factories and not registered.
- The only ways to a branded value are `parse` and the formats' readers, all answering `Result`. Package code that needs a known value throws on failure by hand: `packages/std-temporal/src/UTC.ts` parses `"UTC"` and throws. App tests parse whole fixtures through helpers that throw (`apps/golden-1/test/at.ts`, `apps/golden-2/test/recipes.test.ts`'s `parsed`). `apps/household` keeps `at` as `s.int` (`modules/shopping/RestockData.schema.ts`, `restockChart.ts`, `startRun.ts`, `RestockPanel.tsx`), and `modules/members/dayOf.ts` turns a number into a `PlainDate | null`.
- A check-time reader of literals exists in one place for schemas: E1158 parses a module's literal `std` config with the schema its package registered, after `keel check` imports each `@keel/std-*` package in `deps` (k.module Std config). `check()` imports nothing and reads the registry as the process holds it.

## Proposal
### The constructor
```ts
import { formatLiteral } from '@keel/schema'
import { Instant } from '@keel/std-temporal'
start: { at: formatLiteral(Instant, '1970-01-01T00:00:00.000Z'), code: '' }
```
`formatLiteral(format, text)` takes `Schema<Format<string, N>>` and a string literal type, and returns `Format<string, N>`. A `text` typed `string` is a type error (the parameter refuses a widened `string`), as is a schema that is no format over `s.string()`. One export in one file, `packages/schema/src/formatLiteral.ts`.

### What `keel check` does
For each `formatLiteral` call (bound through `@keel/schema` by name, alias or namespace member), in every code file it reads, test files among them:
1. `text` must be a string literal: `'…'`, `"…"`, or a template with no substitution. A name, even a `const` of a literal, is E1108 at `text`.
2. The type of `format` must name one format `N` the schema type registry holds (k.schema `s.register`). `keel check` has imported each `@keel/std-*` package in `deps` first (k.module Std config), and E1152 already requires the format's package there. Else E1108 at `format`.
3. The registered format's `parse` runs on `text`. A failure is E1108 at `text`, naming `N` and the first issue's rule, as E1158 names its rule.
```
E1108 modules/shopping/restockChart.ts:12:31 formatLiteral text does not parse as temporal.Instant (format)
fail check 1 errors
```
No fix: the checker cannot know the meant value. What runs is stdlib code, the format's `check`, on text from the source: no app code is evaluated (k.check Pipeline). `TimeZone.parse` reads the pinned tz list, not the host's `Intl`, so the answer is the same on every host.

`keel explain E1108`:
```
E1108 a formatLiteral text that is not a literal or does not parse
formatLiteral is for values written in source; keel check parses them with the format's own reader. Data from outside reads with parse and answers a Result.
formatLiteral(Instant, '2026-02-30T00:00:00.000Z') -> '2026-02-28T00:00:00.000Z'
```

### At run time
Outside `keel check` (a vitest run of an unchecked file, a REPL), `formatLiteral` runs `format.parse(text)`: the value when it parses, else `TypeError` with `formatLiteral: "2023-02-29" is not a temporal.PlainDate (format)`. A literal that `keel check` accepted always parses, since the check ran the same `parse`, so in a checked tree the throw is unreachable. A module-level literal throws at import, so the failure is at the first test that loads it.

### Tree-shaking
A named ESM export of `@keel/schema` with no side effect and no table: it calls the format it is given. A bundle that never calls it carries none of it; one that does carries a few dozen bytes. The check side lives in `@keel/check` and ships to no bundle.

### Not a second way
The readers take data from outside the source: a request, storage, `ctx.clock.now()`, a form. Their failure is a case the program handles, so they answer a `Result`. `formatLiteral` takes text the author wrote, whose failure is a bug in the source, so `keel check` reports it before anything runs, and the type is the format's with nothing to unwrap. E1108 refuses any `text` but a literal, so no checked call reads data, and a literal passed to `parse` stays legal and answers a `Result` as every `parse` does. `instantOf(ms)` stays the reader from a number.

### What it reaches
Every registered format over `s.string()`: the seven above. Formats made by factories (`line`, `para`, a message) have no name in the registry; E1108 names them at `format`. A literal `line` value has not been met in an app; if one is, the family needs a registry entry of its own (a later RFC), not a second constructor. Ids (`s.id(brand)`) are not format types and are out of scope.

## Alternatives
- **A method on each format (`Instant.of('…')`).** Reads well, but adds a member to every format schema, a new `FormatSchema` type on `s.format`, `textFormat`, `line` and `para`, and ships with every format whether called or not. The free function needs no type change.
- **A constructor per format (`instantLiteral`, `dateLiteral`, …).** One per format, each with its own check: the opposite of one way.
- **Follow `format` through imports and evaluate it** (so `line({ max: 80 })` works): runs a factory with arguments from app source, and `check()` has no module loader (the static-reading rule of D75). The registry already names every fixed format.
- **A typed `unwrap(result)` that throws.** A runtime throw for a source error, nothing at `keel check`, and a general escape hatch from every `Result` in the codebase.
- **Template-literal types that spell an `Instant`.** Cannot express February 29, the tz list or `line`'s grapheme rules; each format would carry a second definition in types.
- **A cast in `unsafe/`.** A cast per literal, with a justification, for a value the checker can prove.
- **Another code.** E1108 is the first unused code in E110x, the block of the schema family; k.formats joins its owners.

## Spec diff
Applied in this commit.
- k.formats (to `implemented` until its six new clauses are covered): Literals (`formatLiteral`, what `keel check` does, run time, tree-shaking, literal versus data); Rules gains E1108; Conformance gains six clauses (#2 to #7).
- std.temporal (stays `conformance-covered`): one API sentence naming `formatLiteral(Instant, …)` for a known instant; no new behavior, no clause.
- Map: the k.formats row reads `implemented`; the E110x owners add k.formats.
- Ledger: k.formats#2 to #7 at `none`, written by the orchestrator's regeneration on the main line.
- No glossary term; no budget moves (k.formats about 1,215 tokens, std.temporal about 1,525, the map 1,429 of 1,430).

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/schema/conformance/format-literal.test.ts`: k.formats#2 to #4, the runtime value, the throw and the types (the negative type cases through the helper under `unsafe/` the suites use).
- `packages/check/conformance/format-literal-E1108.test.ts`: k.formats#5 to #7, over file maps with `@keel/std-temporal` and `@keel/std-text` imported in the test process, so the registry holds their formats.
- `packages/check/conformance/fixtures-by-code.ts`: an E1108 fixture (k.check: every reported code has one; E1108 carries no fix).

## Migration
None. No app is released.

## Token impact
- Spec: k.formats grows by about 885 tokens to about 1,215; std.temporal by about 25; the map by one token.
- `keel explain E1108`: one catalog entry, under 120 tokens.
- `@keel/schema`: one small export, shaken out where unused; `@keel/check`: one pass over `formatLiteral` calls, sizes measured in the build.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the six clauses. 3. Build:
- `packages/schema/src/formatLiteral.ts` (new), exported from `packages/schema/src/index.ts`; README.
- `packages/check`: the E1108 pass (find `formatLiteral` calls bound to `@keel/schema`, read `N` from the type of `format`, parse with `s.registry().get(N)`), `PIPELINE_CODES.ts`, `EXPLANATIONS.ts` as above.
- `apps/household`: `RestockData.at` and `Run.at` become `Instant`, `restockChart.ts`'s `start` uses `formatLiteral`, `startRun.ts` compares days with `plainDateOf`, `postRun.server.ts` and `startRestock.server.ts` pass an `Instant`, `RestockPanel.tsx` formats it without `instantOf`; `modules/members/dayOf.ts` is reviewed against it; the tests that read `at` as a number follow.
- `packages/std-temporal/src/UTC.ts`: `formatLiteral(TimeZone, 'UTC')`.
- Docs: the `keel` and `keel-testing` skills (`packages/cli/skills/*/SKILL.md`, copied to `.claude/skills`) name `formatLiteral` for a format value in a chart's `start`, a store's initial value or a fixture; a changeset; `tasks/p1/walkthrough-findings.md` (L9-3); `tasks/BACKLOG.md`.

## For the operator
1. **Literals only, checked at `keel check`, throwing at run time when unchecked.** Recommended: yes; it is the one form for a value in source, and the `Result` readers stay the one form for data.
2. **`line`, `para` and message formats have no literal form yet.** Recommended: yes; none has been needed, and reaching them needs a registry entry per family, not a second constructor.
