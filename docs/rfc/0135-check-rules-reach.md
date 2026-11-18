# RFC 0135: check rules catch what they name: literal copy in every user-visible place, the whole zone and locale list, and Node-only globals in browser code

Status: draft, for the orchestrator to accept (ADR-0157).

## Problem
Each claim below was read in the code on 2026-11-18.

1. **E2406 reads two attributes and few shapes.** `packages/std-messages/src/tools/internal/copyHits.ts` checks the attributes `label` and `alt` only (`ATTRS`, line 8); `placeholder`, `title` and the `aria-*` text attributes are copy a person reads or hears and are not reported. `stringOf` returns nothing for a template with substitutions; `+` is not followed; `<Text children="x" />` and `Text({ children: 'x' })` are not read (the `Property` visitor checks only a route `title`); a `const` holding copy is not followed; and `literalCopy.ts` reads a component file only when its name is PascalCase `.tsx` and it has a top-level `export default`. std.messages's Rules line names only `label` and `alt`, so the attributes need the spec first. Already done (ec973964): literal expression children and literal branches of `?:`, `||`, `??` and `&&`.
2. **E1758's spec lists fewer shapes than its rule.** `packages/check/src/rules/noAmbientLocale.ts` (commit 9e97776b) also reports `toLocaleUpperCase`/`toLocaleLowerCase`, the `toString` family and getters on a `const` bound to `new Date(...)`, `String(date)`, a date in an untagged template, `new Date(y, m, ...)`, `new Date(s)`/`Date.parse(s)` of an offset-less constant string, `.call` forms, and treats `void 0` and `[]` as no locale; k.check's Rules entry says only "a local-time getter (`getHours`, ...) on a `new Date(...)` expression". The rule is syntactic, so a date that arrives as a parameter, a member, a call result or an import is missed: `function f(d: Date) { return d.getHours() }` checks clean.
3. **Node-only globals type-check in browser code.** No rule reports `process`, `Buffer`, `__dirname`, `require` or a `node:` import in app code (E1302 lists `process` inside transactions only; `revealedValue.ts` treats `Buffer.from` and `node:fs` as sinks). With `@types/node` in the workspace they type-check, and a component using them fails only in the browser. `require`, `__dirname` and `__filename` are undefined in an ES module on the server too.

Corrections to the backlog lines: 0324's first shapes (`{'Recipes'}`, branches) are done, as its own note says. 0296 asks for "E1004's reachability": E1004 (`packages/compiler/src/internal/clientOnly.ts`) is exempt when every deployable listing the module is `client`, which is where Node globals are most wrong, so the new rule states its own scope. k.security says E1571 uses "E1004's reachability", but `foreignUrlFetch.ts` decides by file name only (`isAppPath` and not `*.server.*`), with no topology: the spec and the rule disagree (a new backlog line, not this RFC).

## Proposal
Two new sections, because std.messages (5,958 characters) and k.check (5,987) are full: `std.copy` (status proposed) for E2406's reach, and `k.host` (status proposed) for E1758's list and the new E1759.

### D1. E2406 reads every user-visible text attribute
Added: `placeholder`, `title`, `aria-label`, `aria-description`, `aria-placeholder`, `aria-roledescription`, `aria-valuetext`, and `children` as an attribute. Each is read or announced to a person. Left out: `id`, `name`, `type`, `href`, `value` and every other attribute, which hold tokens or data (golden-2's literal attributes are all of this kind). The route `title` stays as it is, with more shapes (D2).

### D2. E2406 follows the shapes copy is written in
Reported: a template with substitutions whose text parts hold a letter; a `+` with such an operand; a thunk's body; a `const` whose initializer is copy, in the same file or imported from a project file (the project input E1258 already uses), reported at the use, so a shared `copy.ts` is no escape. The same property names in an object literal passed to an uppercase identifier callee (`Text({ children })`, `Input({ placeholder })`) are read in every app file of the module but the set's locale files: hand-built components are `.ts` files. A route `title` is read in every `return` of its function and through a same-file function it names. Every `.tsx` file of the module is read, with or without `export default`.

Stays out of reach, stated in the section: calls (`fmt('x')`), members (`copy.title`), `let`, destructuring, installed packages, lowercase and member callees. Each needs data flow the rule does not have, and a call or member is how message-set text arrives, so following them would report the sanctioned path.

### D3. E1758's list is the rule's list
k.host lists every shape the rule reports and every shape it leaves, so the spec and the rule agree and the conformance writer can test each.

### D4. A date is found by its type
A date is an expression whose TypeScript type is `Date`, through the check's type pass (`packages/check/src/internal/typeCheck.ts`), which already builds a program and a checker for E1751 and E1453. So a parameter, member, call result or import is covered, and `const d = new Date(x)` needs no special case. `any` and `unknown` are not dates (no false reports from untyped code). With the type pass off (`types: false`), the rule keeps today's syntactic reach. The builder moves the date-receiver half of E1758 into the type pass (as `resultDiscards` is for E1453) or gives rules a checker; one diagnostic per location either way.

### D5. E1759: Node-only globals in browser files
A browser file is an app file not named `*.server.*` under `modules/<id>/` of a listed module, except the `routes.ts` of a module no `client` or `static` deployable lists (a node server loads it, as for E1004); with no `topology.ts`, any app file not named `*.server.*`. `*.server.*` is the boundary E1004 enforces, so every other module file can reach the browser; a helper only server files import is renamed `*.server.ts`.
- In a browser file: a read of `process`, `Buffer`, `global`, `setImmediate`, `clearImmediate`, `__dirname`, `__filename`, `require`, `import.meta.dirname`, `import.meta.filename`; a value import, re-export, literal `import()` or `require` of a Node built-in (`node:` or a bare name in Node's built-in list).
- In every app file: `require`, `__dirname`, `__filename`, undefined in an ES module.
- Not reported: names the file declares (scope, as E1601); the operand of `typeof` and a read under a `typeof x !== 'undefined'` test; members of `globalThis` (an explicit host probe); `import type`; tests, `*.config.*`, `unsafe/`, `.keel/`, `node_modules/`.
- Fix: in a file that is not a browser file, `__dirname` to `import.meta.dirname` and `__filename` to `import.meta.filename` (Node 20.11 and later, the toolchain's floor). None otherwise: moving code to a `*.server.ts` file or to `ctx` is the author's.
- Message: `<name> is Node-only and <file> runs in the browser; move it to a *.server.ts file` or `<name> is undefined in an ES module; use import or import.meta`.
- Code E1759: the lowest free code in E175x (k.check's block, which k.host joins).

## Alternatives
- **Module-graph reachability** (follow imports from routes and components). Exact, but no rule has a graph today and the `*.server.*` convention already marks the boundary; a server-only helper is one rename.
- **E1004's predicate as is.** Exempts all-`client` modules, the case where Node globals fail every time.
- **Report `globalThis.process` too.** It is the idiom for a host probe; reporting it leaves no sanctioned way to probe.
- **E1758 date parameters as a stated limit.** The type pass exists and is cheap per call; a limit would leave the commonest shape (a helper taking a `Date`) open.
- **Report every string literal in a `.tsx` file.** Ids, tokens and keys are literals; the false reports would bury the true ones.
- **Follow calls and members for E2406.** Message text arrives that way; the rule would report the sanctioned path.

## Spec diff
- New `spec/kernel/k.host.md`, status proposed: intro, Zone and locale, Node globals, Rules (E1759), five Conformance bullets. 5,095 characters, 1,274 tokens; `pnpm spec k.host` prints the same.
- New `spec/std/std.copy.md`, status proposed: intro, Files, Places, Shapes, Not followed, two Conformance bullets. 3,149 characters, 788 tokens.
- `spec/std/README.md`: a row `std.copy | Literal copy | proposed`.
- `spec/00-map.md`: a row `k.host | Host reads | proposed | zone, locale, Node globals`; E175x owner `k.check, k.host`; one-line cells trimmed (k.guards, k.topology, k.services, k.module, k.security), no title or status changed. 1,196 to 1,199 tokens.
- std.messages and k.check unchanged: their E2406 and E1758 entries stay true and the new sections widen them. No bullet reordered, renumbered or reworded; no section changes status, so the ledger does not move.

## Conformance diff
One `rfc:0135` commit by the `conformance-writer`, each file headed `Spec: k.host` or `Spec: std.copy`.

**E2406** (`packages/std-messages/conformance/copy-places.test.ts`, `copy-shapes.test.ts`; fixtures are project trees with a `module.ts` listing `@keel/std-messages`). Each one E2406 at the literal:
- `<Input placeholder="Search" />`, `<Box aria-label="Close" />`, `title="Info"`, and `aria-description`, `aria-placeholder`, `aria-roledescription`, `aria-valuetext` each with a word; `<Text children="Recipes" />`.
- `Text({ children: 'Recipes' })` and `Input({ placeholder: 'Search' })` in `modules/recipes/row.ts`.
- `` <h1>{`${n} recipes`}</h1> ``, `{'Hello, ' + name}`, `label={ok ? 'On' : 'Off'}` (two), `placeholder={() => 'Search'}`.
- `const t = 'Recipes'` then `<h1>{t}</h1>` (at the use); a `const` exported from `copy.ts` and imported; the same `const` used twice (two).
- `RecipeRow.tsx` exporting `function RecipeRow` and no default.
- A route `title` returning `'Recipes: ' + name`, a template with a word, from the second `return` of a block body, or naming a same-file function that returns `'Recipes'`.

Negative (no E2406, each its own fixture): `id="recipes.list"`, `type="number"`, `href="/a"`, `name="q"`; `{props.data.text.title}`; `` {`${a}${b}`} ``; `{'%'}`, `{'42'}`, `{n + 1}`; `copy.title`; `fmt('Recipes')`; `s.enum(['a'])` and `Set.text({ title: 'Rezepte' })`; a locale file; `let t = 'x'` used in JSX; a `const` imported from an installed package; every reporting case in `*.test.tsx`; every reporting case in a module whose `deps` do not list `@keel/std-messages`.

**E1758** (`packages/check/conformance/E1758-host-list.test.ts`, with the type pass on unless stated). Each one E1758: `d.getHours()`, `d.toString()` and `String(d)` with `d: Date` a parameter; `o.at.getMonth()` with `at: Date`; `f().getDay()` with `f(): Date`; a `Date` imported from a project file; `` `${d}` ``; `x.toLocaleUpperCase()`, `x.toLocaleLowerCase()`; `x.toLocaleString(undefined)`, `(void 0)`, `([])`; `Intl.Collator([])`; `Number.prototype.toLocaleString.call(n)`; `String.prototype.localeCompare.call(a, b)`; `new Date(2026, 0, 1)`; `new Date('2026-01-01T10:00')`; `Date.parse('Jan 1 2026')`; `new Intl.DateTimeFormat('de-DE', {})`; `d.toLocaleTimeString('de-DE')`.
Negative: `d.getUTCHours()`, `d.toISOString()`, `d.toUTCString()`, `Date.UTC(2026, 0, 1)`, `new Date(0)`, `new Date('2026-01-01')`, `new Date('2026-01-01T10:00Z')`, `Date.parse('2026-01-01T10:00+02:00')`, `new Date(s)` with `s` a parameter, `x.toLocaleString('de-DE')`, `new Intl.DateTimeFormat('de-DE', { ...o })`, `new Intl.DateTimeFormat('de-DE', opts)`, `v.getHours()` with `v: any`, a local `function getHours(d)` called as `getHours(d)`, `` tag`${d}` ``, `d.getHours.apply(d)`, each reporting case in a test file. With `types: false`: `d.getHours()` with `d` a parameter is none, and with `const d = new Date(x)` one.

**E1759** (`packages/check/conformance/E1759-node-globals.test.ts`; project trees with a `topology.ts`). Each one E1759 in `modules/shop/Badge.tsx` of a `node` deployable: `process.env.X`, `Buffer.from(s)`, `global.x`, `setImmediate(f)`, `clearImmediate(h)`, `import.meta.dirname`, `import.meta.filename`, `import fs from 'node:fs'`, `import { join } from 'path'`, `export { readFile } from 'fs'`, `import('node:os')`, `require('x')`, `__dirname`, `__filename`; the same in `modules/shop/stock.ts` with only a `client` deployable listing `shop`, and with a `static` one; with no `topology.ts`, in `src/Badge.tsx`; `require('x')`, `__dirname` and `__filename` in `modules/shop/stock.server.ts`.
Negative: `process.env.X`, `Buffer.from(s)` and `import fs from 'node:fs'` in `modules/shop/stock.server.ts`, in `modules/shop/routes.ts` of a module only `node` deployables list, and in `server.ts` at the app root with a topology; everything in `Badge.test.tsx`, `vite.config.ts` and `unsafe/x.ts`; `typeof process`; `typeof process !== 'undefined' && process.env.X`; `if (typeof Buffer !== 'undefined') Buffer.from(s)`; `globalThis.process`; `import type { Buffer } from 'node:buffer'`; `const process = { env: {} }; process.env`; a parameter named `require`; `import x from 'pathe'`.
Fix: `__dirname` in `modules/shop/paths.server.ts` is one E1759 whose fix writes `import.meta.dirname`, applies with `git apply` and re-checks clean; `__filename` likewise; in `Badge.tsx` E1759 carries no fix.

Edited (rfc:0135): `packages/check/conformance/fixtures-by-code.ts` gains an E1759 fixture; `fix-applies.test.ts` and `fix-diffs.test.ts` an E1759 case.

## Migration
- `packages/check/test/ambientLocale.test.ts`: the `let d = new Date(x); d = { getHours: ... }` case is a `Date` by its type and is reported; the builder updates the expectation.
- `packages/std-messages/test/literalCopy.test.ts` and `test/rules.test.ts`: any clean case using a newly read attribute or shape moves to the reporting side; `conformance/rules-e2401-e2406.test.ts` keeps its fixtures (its clean component reads text from `props.data.text`).
- `apps/golden-2/modules/recipes` (the only module listing `@keel/std-messages`): no literal of a newly read attribute, no copy template, concatenation or `const` was found (its literal templates are `id`s); the builder runs `keel check` on golden-2 and moves any hit into `RecipesText`.
- E1759: no file under `apps/` reads a Node global outside `*.server.*`. `evals/tasks/*/pass.ts`, `browser.ts`, `restartBuilt.ts` and `splitBuilt.ts` read `process`, `Buffer` and `node:` modules; they are harness scripts outside any app's `modules/`, so not browser files; none uses `require`, `__dirname` or `__filename`.
- `explain` entries for E1759 (at most 120 tokens) and the E1758 and E2406 entries name the new sections.

## Build order
1. This RFC, ADR-0157 and the spec (commit 1).
2. `conformance-writer`: the conformance diff (commit 2), red.
3. Builders (commit 3): `@keel/std-messages` `copyHits` and `literalCopy` (D1, D2); `@keel/check` E1758 in the type pass (D4) and the `noNodeGlobal` rule E1759 with its fix (D5), reading `topology.ts` from the project input; `explain` entries; the Migration; changesets; k.host and std.copy to conformance-covered in each section, the map and the std README.

## Token impact
k.host 1,274 tokens (new), std.copy 788 (new). Map 1,196 to 1,199. No other section changes.

## Choices
Each is the author's call for the orchestrator to confirm or reverse.
- C1: E2406 reads `placeholder`, `title`, `aria-label`, `aria-description`, `aria-placeholder`, `aria-roledescription`, `aria-valuetext` and `children`; every `.tsx` file of the module; uppercase-callee object properties in every app file but locale files.
- C2: E2406 follows templates, `+`, thunks and `const`s (project imports too); calls, members, `let` and packages stay out, stated.
- C3: a date is found by its TypeScript type (parameters covered); syntactic reach without the type pass.
- C4: E1759 in browser files by `*.server.*` naming and the topology, `require`/`__dirname`/`__filename` in every app file; `typeof` guards and `globalThis` members are not reported; a fix only for `__dirname`/`__filename` outside browser files.
- C5: two new sections, k.host and std.copy, because k.check and std.messages are full.
