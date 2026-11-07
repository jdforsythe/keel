# ADR-0048: `script`/`style` take literals only, `<meta http-equiv>` is refused, and one resolver serves E1002, E1601 and E1603 (RFC 0058)

**Status:** accepted

**Context.** Red team batch 5 found four gaps.
- `<script>{x}</script>` and `<style>{x}</style>` compiled clean, and the text binding put data into code (backlog 0157).
- `<meta http-equiv="refresh" content={x}>` redirected on load, outside the URL policy (backlog 0158).
- E1002 resolved names its own way, so aliases, destructuring and folded keys passed (backlog 0154).
- E1601 and E1603 missed `Temporal.Now`, a no-date `Intl.DateTimeFormat` `format()`, `performance.timeOrigin`, `navigator.sendBeacon`, a function's `constructor`, and `import()` of a `data:` URL (backlog 0152).

**Decision.**
- **`script` and `style`.** A child that is not literal text and a bound or spread attribute are E1002. Literal text is the author's code, like any other source, so it stays allowed. So do literal attributes (`type="application/ld+json"`, `media`). Literal text that would end the element early (`</script`, `</style`, `<!--` in a script) is E1002 too. The lowering never emits a `text`, `attr` or `prop` op into these elements. It writes literal text raw into the template in HTML. In SVG or MathML it sets the text as text node data, so the serializer is its one escaping owner (backlog 0168).
- **`<meta http-equiv>`.** `isRefusedAttr` is true for `http-equiv` on `meta`, in any case. `attr` binds nothing for it and static templates omit it. In JSX it is E1003 in any form, with the removal fix. The server owns document headers. Only the attribute is refused: a `meta` keeps `name` and `content`.
- **One resolver.** `globalRefs`, `references` and `unwrapExpression` move from `@keel/check` to `@keel/compiler`, exported at `@keel/compiler/internal` (not app-facing). `@keel/check` already depends on the compiler, so there is no cycle. E1002 now resolves `document`, `Reflect`, `Object` and `DOMParser` through scope, aliases and destructuring. It also folds keys built from constant parts.
- **Resolver additions.**
  - `constString` and `initOf` are exposed. `initOf` follows a same-file alias to its initializer.
  - A function or class, as an expression or a declaration, resolves to `Function.prototype`. So its `constructor` is the `Function` family for E1603.
- **E1601 and E1603 additions.**
  - E1601 adds `Temporal.Now`, `performance.timeOrigin` and `navigator.sendBeacon`. It also adds an `Intl.DateTimeFormat` `format()` or `formatToParts()` called with no argument, and follows the instance through a `const`. The fix inserts `ctx.clock.now()` as the argument.
  - E1603 adds any `constructor` reached from `Function` and `import()` whose constant prefix is a `data:` URL.

**Alternatives.**
- **Allow bound children for `type="application/ld+json"`.** That would be a second way to emit data into a script. A JSON island needs a typed API, not an exception to E1002.
- **Refuse `http-equiv` on every element.** It has an effect only on `meta`, and refusing it elsewhere would drop harmless custom-element attributes.
- **Copy the resolver into the compiler.** That makes two implementations, against principle 1.

**Consequences.**
- `@keel/compiler` bundles the resolver: its size budget is re-based from 21 to 24 kB, and `@keel/check` drops by the same code (29,649 to 28,725 bytes).
- `blob:` URLs from `URL.createObjectURL` in `import()` and `new Worker('data:...')` stay undetected. Values that flow through calls stay undetected too, as in RFC 0053.
