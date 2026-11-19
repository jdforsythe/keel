# ADR-0042: E1601 and E1002 see aliases, literal keys, and string code (RFC 0053)

**Status:** accepted

**Context.** E1601 matched only a syntactic path rooted at a global name. So `const D = Date; D.now()`, ``Date[`now`]()`` and `const { random } = Math; random()` passed `keel check`. `eval` and `new Function` were never reported, though either reaches every ambient. E1002 matched member names only, so `Reflect.set(el, 'innerHTML', x)`, `el['innerHTML']`, `DOMParser` and `document.write` passed (red team M5, backlog 0129).

**Decision.**
- **Resolver.** `globalRefs` (`@keel/check` internal) is a per-file binding table. Each declared name maps to its lexical scope spans, and a read binds to the innermost span that contains it. A `const`, a parameter default, or a `let`/`var` never assigned in the file resolves to its initializer's path plus any destructuring keys. A literal key is a string, a template with no substitution, a `const` string, or a `+` of those. Leading `globalThis`/`window`/`self` segments are dropped. Chains stop after 16 links.
- **E1601.** It reports each use once, where it happens. The initializer of an unexported alias is skipped, and an exported alias is reported at its initializer. The destructuring set is the whole E1601 table.
- **E1603 (k.ctx).** It reports `eval` at any use, and `Function` where it is invoked: called, constructed, `.call`/`.apply`/`.bind`, or `Reflect.apply`/`construct`. Aliases count. It applies to app and test code, and has no fix.
- **E1002 (k.compiler `ruleRawHtml`).** The `innerHTML` family plus `setHTMLUnsafe`, `createContextualFragment`, `parseHTMLUnsafe`, `DOMParser` and `srcdoc` count as a member, a computed literal key, or a destructured key. They also count as a literal key to `Reflect`/`Object` property calls, or as a key of an object literal passed to `Object.assign`/`defineProperties`. So do `setAttribute(NS)` with `srcdoc` (E1002) or an `on*` name (inline handler), the global `DOMParser`, and `document.write`/`writeln`. A local `Reflect`, `Object`, `document` or `DOMParser` does not count.

**Alternatives.**
- **TypeScript binder.** It needs the type pass, which `{ types: false }` skips, and a second AST.
- **The old name-based `declared` set.** One `Date` anywhere in a file silenced the whole file, and it could not follow an alias.
- **Report at the alias.** A chain would report at every link.
- **Fold `eval` into E1601.** Its message names a ctx capability, and there is none for string code.

**Consequences.**
- **Not detected.** Fully dynamic keys (`el[k]`, `Reflect.set(el, k, v)`). Values through calls, object or array literals, reassigned bindings, or imports. `document` through an alias. `Function` reached as `(() => {}).constructor`. This is acceptable because the compiler and the runtime never emit raw HTML or ambient effects, so an escape takes deliberate indirection. E1252 already reports the global `document`/`window` in app code.
- **Spec budget.** k.compiler sits at 1,499 tokens, so its E1002 line cites RFC 0053 for the full sink list.
