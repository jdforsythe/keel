# RFC 0137: a called prop is placed as content, and a JSX child that would render nothing is reported by the check and in dev

Status: draft, for the orchestrator to accept (ADR-0159).

## Problem
Each claim below was read, and each compiled case run in memory with `compile` from `@keel/compiler`, on 2026-11-18.

1. **A called prop is bound as text.** `classify` in `packages/compiler/src/internal/lowerFile.ts` places a JSX child expression as content only when `isSlotCall` (`packages/compiler/src/internal/isSlotCall.ts`) matches it, by name: `children()`, `x.children()` or `slots.<name>()`. Every other call goes to `text`. So `<Box>{props.icon()}</Box>` with `icon: () => Node` compiles to `__k.text(n, () => (props.icon()))`, and the runtime's `toText` (`packages/runtime-dom/src/ops/text.ts`) renders a node as `''`: the server serves nothing, the client mounts nothing, and nothing is reported (the op's comment: "There is no dev channel for a binding, so this stays silent"). `{props.children()}` compiles to `__k.slot(n, () => (props.children()) ?? "")` and works.
2. **An uncalled function prop writes its source.** `{props.icon}` compiles to a text binding with no diagnostic, and `toText` writes `String(fn)`: the function's source text appears on the page.
3. **The compiler cannot see types.** It parses with `oxc-parser` and has no TypeScript checker; `elementValued` (`packages/compiler/src/internal/elementValued.ts`) resolves same-file JSX, functions and bindings, and returns false for any member expression. So whether `props.icon()` returns a node or a string is not known where the op is chosen.
4. **The spec has no rule for it.** k.component Slot props says a named slot is a prop returning JSX that the receiving component calls; it does not say how that call is placed. The JSX typing (`packages/runtime-dom/jsx-runtime.d.ts`) gives intrinsic children `Value`, which includes `Node` and functions, so `tsc` reports neither case.

Corrections to the backlog line (0843): `{props.icon}` is not E1403; it compiles clean and renders the function's source. `{icon()}` after `const { icon } = props` is E1401's shape (destructured props), not a separate case. A same-file function returning JSX called in a child (`{renderRow(x)}`) is already E1403.

## Proposal
A new section `k.place` (status proposed), since k.claim (5,991 characters) and k.component (5,831, with 169 free) cannot hold it.

### D1. A called prop alone is a slot call
In a component, a JSX child expression that is a call of a direct member of the component's first parameter (`props.icon()`, `props.icon?.()`), alone or as the left of `??`, is a slot call like `props.children()`. The compiler decides it by syntax, so it needs no types: `isSlotCall` gains the case. What it returns is placed through `slot`: a node, nodes or a fragment as content, a string as text. The slot claims in place at resume (k.claim In place), so the content resumes.

Trade: a slot renders once in its place, as `children()` and k.component Build already say of a function prop a component calls; a text binding re-reads. A prop like `label: () => string` reading a signal, called alone, stops updating. No app, eval or conformance file calls a non-`children` prop alone in a JSX child (searched), and the reactive spelling stays: `{props.label}` with a value prop, or any expression that is not a prop call alone (`{String(props.count())}`).

Not slot calls: `props[k]()` (computed), `props.a.b()` (not the prop itself), calls of other functions. D2 reports those that hold a node.

### D2. E1406: a JSX child that renders nothing
Where the compiler binds text, the check's type pass (`packages/check/src/internal/typeCheck.ts`, which already holds a checker for E1751 and E1453) reports E1406 when the expression's type is or may hold a `Node` or is a function: `{ok ? props.icon() : null}`, `{makeIcon()}` from another file, `{props.items}` of `Node[]`, `{props.icon}`. `any` and `unknown` are skipped. Fix: `()` appended when the expression is a prop member or a name whose type is a function with no required parameter (`{props.icon}` to `{props.icon()}`, which D1 then places); none otherwise. E1403 (syntactic, compiler) keeps its cases; where it reports, E1406 does not: one diagnostic per fault.

Code: E1406, the lowest free code in E140x, k.component's block (E1403's sibling: elements in a JSX child expression), which k.place joins.

### D3. Runtime: never silent in dev, never source text
`text` renders `''` for a node, an array holding one, and now a function, in every mode. In `'dev'` mode the client writes one `console.warn` per binding (`E1406`, the element id, `renders nothing`), and a dev `createApp` logs one `diag` E1406 per route on first render, as k.claim's E1257 does. Production stays silent: a wrong page is the check's to stop. `mode` already reaches `mount` and `resume` (k.runtime); the server knows its own. Budget: `@keel/runtime-dom` is about 4.5 KB of 6,144 B gzip; the check and the dev line are expected under 80 B.

### D4. The sanctioned forms, stated
`{props.x()}`, `{props.children()}`, inline JSX, a component tag, the thunk handed to a base element's `children`, a prop call inside `If`, `For`, `Match` or `Boundary` content; `If` or `For` for a conditional or a list.

## Alternatives
- **Type-directed lowering.** The compiler would need a TypeScript program per compile: slower builds and a second parse for every file, for one shape.
- **A diagnosed error only** (no D1): the check would report `{props.icon()}` and send authors to `<Box children={props.icon} />` or `slots.x()`; more spellings for one idea, and `props.children()` already proves the call form.
- **Make `text` place nodes.** A text hole and a content region are different markup; the op would need a region for every binding, served and claimed, to cover a case the compiler can name.
- **Report E1406 in production too.** The fault is static and the check stops it; a production console line per binding adds bytes to every page for nothing the check misses.
- **Keep `String(fn)`.** Writes code into the page; nothing wants it.

## Spec diff
- New `spec/kernel/k.place.md`, status proposed: intro, Prop calls, Sanctioned, Check, Runtime, Rules (E1406), five Conformance bullets. 3,862 characters, 966 tokens; `pnpm spec k.place` prints the same.
- `spec/00-map.md`: a row `k.place | Placed props | proposed | a called prop is content`; E140x owner `k.component, k.place`; one-line cells trimmed (k.reactive, k.component, k.compiler, k.runtime, k.model, k.prove, k.serverlog, k.persist, k.openapi, k.evidence), no title or status changed. 1,200 to 1,199 tokens.
- k.component and k.claim unchanged; no bullet reordered, renumbered or reworded; no status changes, so the ledger does not move.

## Conformance diff
One `rfc:0137` commit by the `conformance-writer`, files headed `Spec: k.place`.

**Placed** (`packages/server/conformance/place-prop-call.test.ts`; `createApp` serving an island page whose `Card` takes `icon: () => Node`, resumed by `resumeDocument`): for each case the served document holds the icon's element inside `Card`'s `Box`; resume gives no warning, `removed()` 0, `detached()` 0; a click handler on the icon's element runs:
- `<Box>{props.icon()}</Box>`; `{props.icon?.()}` with `icon` given;
- `{props.icon?.() ?? 'none'}` with `icon` absent: the text `none`;
- `icon` returning two elements (an array) and returning a fragment, with static text and `{count}` beside it;
- `<If when={ok}>{props.icon()}</If>` with `ok` true; a `For` of three rows, each row's content `{props.icon()}`.
- `{props.label()}` with `label: () => 'Hi'`: `Hi` served and kept.

**Compiled** (`packages/compiler/conformance/place-prop-call-compile.test.ts`, `compile` in memory): `{props.icon()}`, `{props.icon?.()}` and `{props.icon() ?? 'x'}` emit a slot and no text op; `{props[k]()}`, `{props.a.b()}`, `{f()}` and `{String(props.n())}` emit a text op; `{props.label()}` renders once: after the signal `label` reads changes, the text is unchanged; `{String(props.count())}` updates.

**E1406** (`packages/check/conformance/E1406-text-node.test.ts`, type pass on). Each one E1406 at the expression:
- `{props.icon}` with `icon: () => Node`: fix `{props.icon()}` applies with `git apply`, re-checks clean.
- `{icon}` with `const icon = props.icon` typed `() => Node`: fix `{icon()}`.
- `{ok ? props.icon() : null}`; `{props.items}` with `items: Node[]`; `{props.el}` with `el: Node | string`; `{makeIcon()}` with `makeIcon(): Node` imported from `ui/makeIcon.ts`; `{props[k]()}` returning `Node`; `{f}` with `f: (n: number) => string` (no fix: a required parameter).
Negative (none): `{props.icon()}`, `{props.children()}`, `{props.label}` with `label: string`, `{String(n)}`, `{t.title}`, `{n + 1}`, `{x}` with `x: any`, `{u}` with `u: unknown`, `{formatMoney(m, l)}`, inline JSX, `{ok && <b/>}` (one E1403, no E1406), a file with the type pass off (`types: false`), and each reporting case in a `.ts` file with no JSX.

Edited (rfc:0137): `packages/check/conformance/fixtures-by-code.ts` gains an E1406 fixture; `fix-applies.test.ts` and `fix-diffs.test.ts` an E1406 case.

**Runtime** (`packages/runtime-dom/conformance/text-renders-nothing.test.ts`, happy-dom, spied `console.warn`): a component mounted with `mode: 'dev'` whose text binding yields a node, then an array holding one, then a function: one `console.warn` starting `E1406` and holding the element id, over all three updates, and the text is `''` each time; a second such binding, a second line. With `mode: 'production'`: `''`, no line. A function value never writes its source in either mode. A string, number, `null` and `false`: no line.

**Server** (`packages/server/conformance/place-e1406-diag.test.ts`): `createApp` in `'dev'` mode serving a route whose component binds `{props.icon}` as text, twice: one `diag` E1406 with the route id; two such routes, one each; production mode, none.

## Migration
- `packages/compiler/src/internal/isSlotCall.ts` gains the first-parameter member case (it needs the component's parameter name: `classify` passes it); `lowerFile.ts` unchanged otherwise.
- `packages/compiler/test/mutation-lowerFile-a1.test.ts`: its source holds `{props.body()}`, pinned as a text hole with a deps edge `T.tsx#props.body -> T.0:text:#text`; it becomes a slot and the expected output changes. `{props[k]()}`, `{props.foo?.bar()}`, `{foo()}` and the `slots` cases stay as they are. `mutation-lowerFile-b1.test.ts` (`slots.a()`) and `element-children-0165.test.ts` (E1403) are unaffected.
- `packages/runtime-dom/src/ops/text.ts`: functions render `''`; the dev line. Any test asserting a function's source in a text node changes (none found).
- `@keel/check`: E1406 in the type pass, its fix, an `explain` entry (at most 120 tokens).
- `@keel/server`: the dev `diag` record once per route.
- App, eval and conformance code: no file calls a non-`children` prop alone in a JSX child or binds a function prop as text (searched `apps/`, `evals/`, `packages/*/test`, `packages/*/conformance`).

## Build order
1. This RFC, ADR-0159 and k.place (commit 1).
2. `conformance-writer`: the conformance diff (commit 2), red.
3. Builders (commit 3): compiler D1, check D2, runtime-dom and server D3, the Migration, changesets; k.place to `conformance-covered` in the section and the map.

## Token impact
k.place 966 tokens (new). Map 1,200 to 1,199. No other section changes.

## Choices
Each is the author's call for the orchestrator to confirm or reverse.
- C1: a call of a direct member of the component's first parameter, alone or left of `??`, is a slot call, decided by syntax; it renders once, like `children()`.
- C2: E1406 from the check's type pass for any other text binding whose type holds a node or is a function; fix `()` for a parameterless function prop or name.
- C3: `text` renders `''` for a function in every mode; dev writes a console line per binding and a `diag` per route; production is silent.
- C4: a new section, k.place, with E1406 in k.component's E140x.
