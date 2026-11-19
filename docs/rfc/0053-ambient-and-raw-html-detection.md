# RFC 0053: E1601 and E1002 see aliases, literal keys, and string code (E1603)

Status: accepted (ADR-0042)

## Problem
- **Red team M5 (2026-11-07, backlog 0129).** E1601 matched only a syntactic path rooted at a global name. Each of these passed `keel check` with no E1601:
  - `const D = Date; D.now()`;
  - ``Date[`now`]()`` (a template-literal key);
  - `const { random } = Math; random()`.
- **String code.** `eval(s)` and `new Function(s)` were never reported. Either one runs a string that can reach every ambient, so it defeats E1601 entirely.
- **E1002 matched member names only.** It missed `Reflect.set(el, 'innerHTML', x)`, `el['innerHTML'] = x`, `new DOMParser().parseFromString(s, 'text/html')`, `document.write(s)`, and `range.createContextualFragment(s)`.

## Proposal
1. **One resolver for E1601 and E1603 (`globalRefs`, `@keel/check` internal).** A per-file binding table maps each declared name to its lexical scope span: program, function (parameters and `var`), block, `for`, `catch`, `switch` and static block. A name read at offset `p` binds to the innermost scope span that declares it and contains `p`. A name with no such span is the global.
   - **Why not the TypeScript binder.** Rules see the oxc AST and run with `{ types: false }`. A second parse per file would cost more than the table, and the table answers the one question the rules ask: is this name the global, and if not, what was it bound to.
   - **What a binding resolves to.** A `const` declarator `X = <expr>`, or a `let`/`var` one whose name is never assigned in the file, resolves to the path of `<expr>`. A destructured name resolves to `<expr>` plus its literal key path: `const { random: r } = Math` gives `Math.random`, and `const { Date: { now } } = globalThis` gives `Date.now`. A parameter default `(D = Date) => ...` counts too, because the call that omits the argument gets the global. Imports, functions, classes, other parameters and non-literal patterns resolve to nothing: a local.
   - **Paths.** An identifier, a member with a literal key, and parentheses, `as`, `satisfies`, `!` and a comma expression's last operand all extend a path. A literal key is an identifier, a string, a template with no substitution, a `const` string binding, or a `+` of those. A leading `globalThis`, `window` or `self` that is the global is dropped, repeatedly. Alias chains are followed up to 16 links, and a cycle resolves to nothing.
2. **E1601 reports each use once, where the effect happens.** A call, a `new`, a member, or a bare reference that resolves to an ambient path is reported. The initializer of an unexported alias is not reported. Its uses are, so `const a = Date.now; const b = a; b()` is one E1601, at `b()`. An exported alias (`export const now = Date.now`) is reported at its initializer, since its uses are in other files. The destructuring set is the whole E1601 table, not a list of roots: whatever the resolver turns into `Math.random`, `Date.now`, `performance.now`, `crypto.*`, `document.cookie` or a storage member is reported.
   - **Amendment (backlog 0151, 0153).** An exported binding is reported at the exported name when it resolves to a whole `Date`, `Math`, `performance` or `crypto`, or to a guarded member bound by destructuring. This covers named exports, `export { D }` and `export default D`, because the uses are in other files. A whole global read as a member object (`WebSocket.OPEN`) or as an `instanceof` operand is not reported. Neither was reported before this RFC.
3. **E1603 (k.ctx): `eval`, `Function(...)`, `new Function(...)` in app code.**
   - Any use that resolves to the global `eval` or `Function` is reported, including aliases, `(0, eval)(s)`, `globalThis['eval']`, and `const F = Function`. Like E1601, it applies to app and test code.
   - There is no fix, because the code in the string is the author's.
   - **Why a new code in k.ctx.** The harm is ambient reach: a string can call any capability without `ctx`, so it is in the block that owns capability rules. E1757 (k.check) is about type escapes (casts, `any`, suppression), not effects. Folding it into E1601 would give "eval outside ctx; use the ctx capability", which names no capability.
4. **E1002 (k.compiler) sinks.** `ruleRawHtml` reports raw HTML through:
   - the family `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `dangerouslySetInnerHTML`, `setHTMLUnsafe`, `createContextualFragment`, as a JSX attribute, a member name, a computed literal key (`el['innerHTML']`, a template, or a single-declaration `const` string), or a destructured key;
   - `srcdoc` as a member or literal key. A JSX `srcdoc` attribute stays E1003 only, and `setAttribute('srcdoc', ...)` is E1002, because E1003 reads JSX attributes;
   - a family or `srcdoc` key, as a literal, passed to `Reflect.set`, `Reflect.get`, `Reflect.defineProperty`, `Reflect.getOwnPropertyDescriptor`, `Object.defineProperty` or `Object.getOwnPropertyDescriptor`. Also a family key in an object literal passed to `Object.assign` or `Object.defineProperties`;
   - `setAttribute`/`setAttributeNS` with a literal `on*` name, which is an inline handler string;
   - the global `DOMParser`, and `parseHTMLUnsafe`;
   - `write` and `writeln` on the global `document` (or `globalThis`/`window`/`self` `.document`).

   `Reflect`, `Object`, `DOMParser` and `document` count only when no local declaration in scope shadows them.
5. **What stays undetectable, and why that is acceptable.**
   - **Fully dynamic keys.** `el[k] = s` with a computed `k`, `Reflect.set(el, k, s)`, and keys built from input are not reported.
   - **Values that flow.** Neither rule follows values through function returns, object or array literals, reassigned bindings, or imports from another file (`export const D = Date` used elsewhere as `D.now()`). The same holds for a `document` reached through an alias, and for the `Function` constructor reached as `(() => {}).constructor`.
   - **Why that is acceptable.**
     - The compiler and the runtime never emit raw HTML or ambient effects. Text children, attributes and properties go through the DOM, and every runtime effect goes through `ctx` (k.compiler Escaping, k.ctx).
     - So an escape needs deliberate indirection in app code. The checker's job is to catch the in-distribution spellings, not to sandbox an adversary in the author's own source.
     - The dynamic forms also need a DOM reference or a string that app code rarely has. E1252 already reports the global `document`/`window` in app code, and E1603 reports string code.
6. **Scope.** E1601 and E1603 run on app and test code (unchanged for E1601). E1002 runs wherever the compiler does.

## Alternatives
- **TypeScript binder or checker symbols.** Exact for every scope form, but they need the type pass, which `{ types: false }` and the fixtures skip, and a second AST. The per-file table covers declarations the rules can resolve. Where the table is wrong (`var` in a nested block, which binds the function, is handled; `with` is a syntax error in modules) it errs toward a local, which means no report.
- **Name-based shadowing (the old `declared` set).** A file declaring `Date` anywhere silenced every `Date.now()` in the file. It also could not tell an alias from a local.
- **Report at the alias.** Simpler, but a chain of aliases would report at every link, or only at the first. The property in the Conformance diff fixes "exactly once, at the call".
- **E1601 for `eval`.** Its message names a ctx capability, and there is none for string code.

## Spec diff
- **k.ctx Rules.**
  - The E1601 sentence lists the table, then: "They are found through `globalThis`/`window`/`self`, a literal computed key (`Date['now']`, `` Date[`now`] ``, a `const` string), and same-file bindings (`const D = Date`, a parameter default, `const { random } = Math`), each name resolved by lexical scope, so a local `Date` is not the global. An alias is reported at its uses, not where it is declared, unless it is exported there."
  - Adds "E1603 `eval`, `Function(...)`, or `new Function(...)` in app code, also aliased: code from a string reaches every ambient. Neither follows values through calls, object literals, a reassigned binding, or another file (rfc:0053)."
- **k.ctx Conformance.** Adds three clauses: the backlog repros and a local `Date`; the alias-chain property; and E1603 with a local `Function` (`eval` cannot be declared in a module).
- **k.compiler Rules.** E1002 becomes "raw HTML in app code (`innerHTML` family by literal key, `DOMParser`, `document.write`; rfc:0053)". The full sink list is item 4 of this RFC. The section is 1,499 tokens after the change, so the list lives here (precedent: k.check names RFC 0035 for its no-fix list).

## Conformance diff
- **Added** `packages/check/conformance/ambient-aliases-e1601-e1603.test.ts` (k.ctx). It covers:
  - the three backlog repros, each one E1601 at the call;
  - a local `Date` binding, with no E1601;
  - a fast-check property, seed 1337: for generated alias chains of depth 1 to 4 to `Date.now` or `Math.random`, E1601 fires exactly once, at the call;
  - `eval`, `Function`, `new Function`, and an aliased `eval`, each one E1603, and a local `Function` with none.
- **Added** `packages/check/conformance/raw-html-sinks-e1002.test.ts` (k.compiler Rules). Each of these is E1002: `Reflect.set(el, 'innerHTML', x)`, `el['innerHTML']`, `new DOMParser()`, `document.write`, `document.writeln`, `createContextualFragment`, and `setAttribute('srcdoc', x)`. A clean counterpart has none.
- **Changed** `fixtures-by-code.ts` adds an E1603 fixture and a clean counterpart. `fix-diffs.test.ts` lists E1603 as no-fix.
- **Unit tests** in `packages/check/test/ambient.test.ts` and `packages/check/test/rawHtml.test.ts`: scopes (block, function, `var` hoisting, `catch`, parameter shadowing), cycles, `let` reassigned, exported aliases, `globalThis` chains, and the E1002 call forms with shadowed `Reflect`/`Object`/`document`.

## Migration
- App code that reached a clock, random or storage global through an alias or destructuring now gets E1601 at the use. The fix is the same `ctx` call.
- `eval` and `Function` in app or test code are E1603. Move string code to an `unsafe/` directory with a justification, or replace it with a function.
- `Reflect`/`Object` property calls, `DOMParser`, `document.write`, and computed literal keys of the `innerHTML` family are E1002.

## Token impact
- k.ctx: 527 to 771 tokens.
- k.compiler: 1,497 to 1,499 tokens.
- E1603 explain: about 40 tokens. No output format changes.
- **Size budget.** The `@keel/check` bundle (gzip, deps external) grows from 26,787 to 28,784 bytes with this RFC alone: the binding table and the E1603 rule. That is over its 27kb budget (27,648 bytes). The budget is re-based to 30kb (handoff D7), as was done for `@keel/cli` when it absorbed the ledger. The table is the price of resolving by scope instead of by name.
