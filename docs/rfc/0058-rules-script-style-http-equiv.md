# RFC 0058: `script`/`style` take literals only, `<meta http-equiv>` is refused, E1002 shares the rfc:0053 resolver, and E1601/E1603 cover more forms

Status: accepted (ADR-0048)

## Problem
- **Backlog 0157.** `<script>{x}</script>` and `<style>{x}</style>` compiled with no diagnostic. The lowering bound a `text` op into the element, so SSR wrote the data as live code. Repro: `<div><script>{p.x}</script></div>` with `x: "alert(document.cookie)"` rendered `<script …>alert(document.cookie)</script>`.
- **Backlog 0158.** `<meta http-equiv="refresh" content={x}>` was outside the URL policy. SSR rendered `content="0;url=https://evil.example"`, an open redirect on load. A literal `content="0;url=javascript:alert(1)"` got no E1003. RFC 0056 left this case for a red-team pass to show a route, and this is that route.
- **Backlog 0154.** E1002 resolved names its own way (`keyOf`/`isGlobal` in `ruleRawHtml.ts`), not through the rfc:0053 resolver. Each of these passed with no E1002:
  - `el['inner'+'HTML']=x`;
  - `` el[`inner${H}`]=x `` with `const H='HTML'`;
  - `const d=document; d.write(x)` and `const { write } = document`;
  - `globalThis.Reflect.set(el,'innerHTML',x)` and `const R=Reflect; R.set(...)`;
  - `document.execCommand('insertHTML',false,x)`.
- **Backlog 0152.** E1601 missed four forms: `Temporal.Now.instant()`, `new Intl.DateTimeFormat('en').format()` (with no argument it reads the clock), `performance.timeOrigin`, and `navigator.sendBeacon('/x', b)`. E1603 missed `(() => {}).constructor(s)`, `(async () => {}).constructor(s)`, `Function.prototype.constructor(s)`, and `import('data:text/javascript,' + s)`.

## Proposal
1. **`script` and `style` take literals only (E1002, k.compiler).**
   - These are E1002:
     - any child of a `script` or `style` element that is not literal text. Literal text is JSX text, a string or number literal, a template with no substitution, or an empty `{}`;
     - a bound or spread attribute on either element;
     - literal text that would end the element early: `</script` or `</style` in any case, or `<!--` in a script.
   - **Why literal children stay allowed.** Literal text is the author's code, like any other source file. Scoped CSS in a `<style>` child is common, and so is a literal JSON-LD script. The harm is data reaching code or CSS, and only an expression carries data.
   - **Lowering.** The compiler never emits a `text`, `attr` or `prop` op into these elements. Data children and bound attributes are dropped, and literal attributes and text go into the template. Text is written raw in HTML, where the parser decodes nothing inside the element. Before this RFC it was escaped, so `a > b` became `a &gt; b` in CSS. Inside SVG or MathML a browser parses template text as markup while the server DOM keeps it raw, so the lowering sets it once as text node data (`textContent`), and the serializer is its one escaping owner (backlog 0168).
2. **`<meta http-equiv>` is refused (E1003, k.compiler; `attr`, k.runtime).**
   - `isRefusedAttr(tag, name)` is true for `http-equiv` on `meta`, in any case. `attr` binds nothing for it, static templates omit it, and a spread key is dropped.
   - In JSX it is E1003 in any form, literal or bound, with the removal fix.
   - **Why refuse the attribute, not police `content`.** `http-equiv` sets a document header: `refresh` redirects, `set-cookie`, `content-security-policy`. The server owns the document and its headers, so app code has no reason to set one. Policing `refresh` URLs inside `content` would add a second URL grammar.
   - Only `meta` is affected. `name` and `content` stay, so `<meta name="description" content={x}>` is fine.
3. **One resolver for E1002, E1601 and E1603.**
   - `globalRefs`, `references`, `unwrapExpression` and their types move from `@keel/check` internals to `@keel/compiler`, exported at `@keel/compiler/internal`. That subpath is not app-facing, like `@keel/runtime-dom/url`.
   - `@keel/check` already depends on `@keel/compiler` (`tooling/deps.json` order), so the compiler cannot import from check. Moving the resolver down is the only placement with one implementation (principle 1).
   - **What E1002 resolves.**
     - The callees: `document.write`/`writeln`, `DOMParser`, `Reflect.set/get/defineProperty/getOwnPropertyDescriptor`, and `Object.defineProperty/getOwnPropertyDescriptor/assign/defineProperties`.
     - Like E1601, these are found through lexical scope, `globalThis`/`window`/`self`, same-file aliases and destructuring. An unexported alias is reported at its uses, and an exported one at its initializer.
     - Keys fold constant strings: `'inner' + 'HTML'`, a template of `const` parts, and a `const` string. This applies to member keys, destructuring, `setAttribute(NS)` names and `Reflect`/`Object` keys.
   - **`execCommand`.** `execCommand` whose first argument folds to `insertHTML` (any case) is E1002, as a member or destructured from `document`.
4. **Resolver additions.**
   - `constString(e)` is exposed. `initOf(e)` follows a same-file alias chain to its initializer, so a value can be inspected.
   - A function or class, as an expression or a declaration, resolves to `Function.prototype`. So `(() => {}).constructor` resolves to `Function.prototype.constructor`.
5. **E1601 additions (k.ctx).**
   - `Temporal.Now` (any member; reported once at `Temporal.Now`), `performance.timeOrigin` and `navigator.sendBeacon`.
   - `format()` or `formatToParts()` called with no argument on `new Intl.DateTimeFormat(...)` or `Intl.DateTimeFormat(...)`, directly or through a `const`. The fix inserts `ctx.clock.now()` as the argument. A call with an argument is clean, even `format(undefined)`.
6. **E1603 additions (k.ctx).**
   - Any resolved path `Function…constructor` that is called or constructed: `(() => {}).constructor(s)`, async and generator functions, a class, `function g() {}; g.constructor(s)`, `Function.prototype.constructor(s)`. The `.call`/`.apply`/`.bind` forms of these are included.
   - `import(x)` where the constant prefix of `x` is a `data:` URL. The prefix is read after the leading characters the URL parser skips, and is followed through aliases, `+` and templates.
7. **Not covered.**
   - `import(URL.createObjectURL(blob))` and `new Worker('data:...')`.
   - Values that flow through calls or another file (as rfc:0053).
   - A `DateTimeFormat` passed as a parameter.

## Alternatives
- **Allow bound children for `<script type="application/ld+json">`.** The server's raw-text serialization escapes `</script`, so this is safe on the server. But it would be a second way to put data in a script, keyed on a literal attribute. A JSON island needs a typed API: future RFC.
- **Refuse `http-equiv` on every element.** It has an effect only on `meta`.
- **Keep a copy of the resolver in the compiler.** That makes two implementations that drift. Drift is how 0154 happened.
- **Report every `.constructor(...)` call.** `this.constructor(...)` and instance constructors are common and harmless. Only a path resolved from a function or `Function` is string code.

## Spec diff
- **k.compiler Escaping.** "a `<base>` `href` is never rendered" becomes "a `<base>` `href` or `<meta>` `http-equiv` is never rendered".
- **k.compiler Rules.**
  - E1002 becomes "raw HTML (`innerHTML` family, `DOMParser`, `document.write`, `on*` strings, also spread; data in `script`/`style`; rfc:0053, 0058)". The full sink list is items 1 and 3 of this RFC.
  - E1003 becomes "any `srcdoc`, `<base>` `href` or `<meta>` `http-equiv`, or a literal ...".
- **k.compiler Conformance.**
  - The rfc:0056 clause ends "any `<base>` `href` or `<meta>` `http-equiv` is E1003, never rendered."
  - Adds "`<script>{x}`, `<style>{x}` and `<script src={x}>` are E1002 and bind nothing."
- **k.compiler trims** (to stay at 1,500 tokens; all non-normative or restated):
  - "never string-concatenated";
  - "`@keel/ui`" in the URL policy parenthetical;
  - "after the leading characters the URL parser skips" becomes "parsed";
  - "; no scheme is relative", which "relative literals pass" already says;
  - "(k.router)" after E1501;
  - "under 90 chars" in E1000, which `docs/OUTPUT.md` requires of every message;
  - "the file gets no other rule, element, or lowering" becomes "nothing else runs on the file";
  - E1049 "the message verbatim, no app location, never an app code" becomes "message verbatim, no app location or code".
- **k.runtime Ops.** "`attr` binds nothing for an `on*` name, a `<base>` `href` or a `<meta>` `http-equiv`." Trims "(ADR-0006)" from the islands heading and "element" from "Element tags and element structure".
- **k.ctx Rules.**
  - E1601 lists `Temporal.Now`, `Intl.DateTimeFormat` `format()`/`formatToParts()` with no date, `performance.now`/`timeOrigin`, and `navigator.sendBeacon`.
  - E1603 adds "also aliased or as a function's `constructor`, and `import()` of a `data:` URL". The rfc reference becomes "(rfc:0053, 0058)".
- **k.ctx Conformance.** Adds two clauses:
  - "`Temporal.Now.instant()`, `performance.timeOrigin`, `navigator.sendBeacon(u, b)`, and `new Intl.DateTimeFormat('en').format()` are each one E1601; `.format(d)` is not."
  - "`(() => {}).constructor(s)`, `(async () => {}).constructor(s)`, `Function.prototype.constructor(s)`, and `import('data:text/javascript,' + s)` are each one E1603; `import('./a.ts')` is not."

## Conformance diff
- **Added** `packages/compiler/conformance/raw-text-http-equiv-0058.test.ts` (k.compiler; both clauses). It covers:
  - the 0157 repro, `style` data, a template child, and mixed literal and data children: each E1002, rendering no data;
  - bound `src`/`media` and a spread on `script`: E1002, binding nothing;
  - a fast-check property (seed 1337): any string in a `script` or `style` child renders empty;
  - literal `<style>` CSS with `>` and `&amp;`, and a literal JSON-LD script: clean, rendered verbatim;
  - literal `</style` and `<!--`: E1002;
  - the 0158 repros, literal, bound and spread: E1003 where JSX, and no `http-equiv` rendered;
  - clean `meta name/content` and `style media`.
- **Changed** `packages/compiler/conformance/url-policy-0056.test.ts`: its header quotes the amended clause.
- **Added** `packages/runtime-dom/conformance/attr-http-equiv-refused.test.ts` (k.runtime Ops). `attr(meta, 'http-equiv', …)` sets nothing. A property (seed 1337) covers every case of the name, and `content`, `name` and a non-`meta` `http-equiv` still set. `attr-on-refused.test.ts` quotes the amended Ops sentence.
- **Added** `packages/check/conformance/ambient-string-code-0058.test.ts` (k.ctx; both clauses). It covers:
  - the 0152 repros;
  - `Temporal.Now.plainDateISO`, `formatToParts`, and `Intl.DateTimeFormat()` without `new`;
  - a `const` formatter;
  - aliased `Temporal.Now` and destructured `sendBeacon`;
  - clean counterparts (`format(d)`, `NumberFormat`, `navigator.language`, `performance.mark`, `import('./a.ts')`, `import(u)`, `bind`/`call`/`constructor` reads);
  - a fast-check property (seed 1337): a data URL built from constant parts through `+`, templates and aliases is E1603 exactly once.
- **Added** `packages/check/conformance/raw-html-resolver-0058.test.ts` (k.compiler Rules E1002). It covers:
  - the 0154 repros and `Object.assign` with a folded key, each one E1002;
  - clean counterparts (local `document`/`Reflect`, `execCommand('bold')`, a folded safe key, a dynamic key, an unused alias);
  - a fast-check property (seed 1337): alias chains of depth 1 to 4 to `document.write` or `Reflect.set`, and `innerHTML` keys split into constant parts, are E1002 exactly once, at the use.
- **Changed** `raw-html-sinks-e1002.test.ts`: its header quotes the amended Rules sentence.
- **Unit tests.**
  - `packages/compiler/test/rules.test.ts` covers locations, the literal forms allowed, no ops emitted, SVG text as text node data, the `meta` fix, scope shadowing, exported aliases, `execCommand`, and folded `setAttribute`/destructuring keys.
  - `packages/runtime-dom/test/refused.test.ts` covers `http-equiv` only on `meta`.
  - `packages/server/test/svgRawText.test.ts` (backlog 0168) renders SVG `style`/`script` text escaped once on the server, and HTML `style` text raw.

## Migration
- Data in a `<script>` or `<style>` is E1002. Move CSS to a style file or a class, and pass data to scripts through props or stores.
- `<meta http-equiv>` is E1003. Set headers in the server.
- App code that reached a raw-HTML sink through an alias, destructuring or a folded key now gets E1002.
- App code using `Temporal.Now`, `performance.timeOrigin`, `navigator.sendBeacon` or a no-date `format()` now gets E1601. Use `ctx.clock`, or `ctx.net` for beacons.
- `@keel/check` internals that imported `globalRefs`/`references` import `@keel/compiler/internal`.
- `apps/` gets no new findings.

## Token impact
- k.compiler: 1,500 to 1,498 tokens (5,998 to 5,990 characters, measured with the concurrent Artifacts edits of RFC 0059).
- k.runtime: 1,498 to 1,499 tokens.
- k.ctx: 772 to 910 tokens.
- `keel explain` rows for E1002, E1003, E1601 and E1603 are amended, each about 10 tokens longer. No output format changes.
- **Size budget.**
  - `@keel/compiler` grows by about 2.5 kB gzip, from 20,232 to 22,739 bytes, because it now bundles the resolver. That is over its 21 kB budget, so the budget is re-based to 24 kB (handoff D7).
  - `@keel/check` drops from 29,649 to 28,725 bytes, because the resolver is now an external import.
  - `@keel/runtime-dom` is unchanged at 3,435 bytes.
