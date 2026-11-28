# RFC 0056: URL policy covers object, srcset, SVG animation and `<base>`; `attr` refuses `on*`

Status: implemented (ADR-0045)

## Problem
- **Red team L1 (2026-11-07, backlog 0132).** The URL policy (RFC 0024) named seven attributes. Each of these passed `keel check` and rendered unchanged:
  - `<object data="javascript:alert(1)">`;
  - `<img srcset="javascript:x 1x">` and `<link imagesrcset>`;
  - `<set attributeName="href" to="javascript:alert(1)">` inside an SVG `<a>`, and the same through `<animate values="...;javascript:...">`, `from` and `by`;
  - `<base href="//evil.example">`. A protocol-relative URL is allowed by the scheme rule, and it re-points every relative URL on the page, including the generated entry script `/@keel/entry.ts`.
- **Red team L2 (backlog 0133).** A JSX spread on a plain HTML element lowers to one `attr` per key. `attr` set any name, so `<div {...{ onclick: 'alert(1)' }} />` (or a spread of an object whose keys come from data) created an inline handler.

## Proposal
1. **More URL attributes (`URL_ATTRS`, `@keel/runtime-dom/url`).** Add `data`, `srcset`, `imagesrcset`, `to`, `from`, `by` and `values`. `embed src` was already covered by `src`. `formaction`, `ping`, `xlink:href` and `action` are confirmed in the table.
2. **SVG animation attributes are policed on every element.** `to`, `from`, `by` and `values` are checked whatever `attributeName` says and whatever the element is.
   - **Why not inspect `attributeName`.** It can be bound dynamically, set by a spread, or written after the value. Checking the value needs no second attribute.
   - **Why it costs nothing.** These names carry numbers, colors, lengths, transforms and `url(#id)` references. None of those has a scheme, so the rule accepts them unchanged.
3. **Lists.** Every URL in a list is checked, and one bad item turns the whole attribute into `about:blank`, as `ping` already did.
   - `ping`, `srcset` and `imagesrcset` split on whitespace and commas. For `ping`, splitting on commas is new and conservative.
   - In `srcset` and `imagesrcset` every token is checked, so descriptors (`2x`, `100w`) are checked too and pass, having no scheme. A URL that contains a comma is split as well. That is conservative: it can blank a valid URL but never pass a bad one, because every candidate starts after whitespace or a comma.
   - `values` splits on `;`.
   - **Why blank the whole attribute, not drop the bad candidate.** One rule for every URL attribute: the value is unchanged or `about:blank`. `about:blank` in `srcset` is a valid candidate that loads nothing.
4. **`<base href>` is forbidden.** The server emits the document and its head, so app code has no reason to set the document base URL.
   - A `<base>` `href` in JSX is E1003 in any form, literal or bound, with the usual removal fix. `<base target>` alone is harmless and stays allowed.
   - It is never rendered: static templates omit it, and `attr` drops it (`isRefusedAttr(tag, name)`, `@keel/runtime-dom/url`).
   - **Why drop, not `about:blank`.** `about:blank` as the base URL makes every relative URL fail to resolve, including the entry script.
5. **`attr` refuses `on*` names.** `attr(el, name, fn)` binds nothing when `name` matches `/^on/i`. It also binds nothing for `href` on a `<base>` element.
   - **Drop, not throw.** A throw goes to the nearest Boundary, so a spread whose keys come from data could replace a subtree with its fallback. `attr` has no channel for a dev warning: it returns nothing, the package has no logger, and `docs/OUTPUT.md` forbids `console`. The source-level case is reported by the compiler instead (item 6).
   - `prop` is unchanged. The compiler calls it only for `value`, `checked`, `selected`, `indeterminate` and `muted`.
   - The compiler never emitted `attr` for a JSX `on*` attribute: those lower to `on`, and a literal `on*` string on an HTML element was already E1002.
6. **E1002 sees spreads.** A spread whose argument is an object literal with a literal `on*` key holding a string or template literal, on an HTML element, is E1002 ("inline handler string"). A key from data is not detectable statically, and item 5 covers it at run time.

### Not covered
- `<meta http-equiv="refresh" content="0;url=...">`. Browsers refuse `javascript:` there, and a redirect needs the author to write the element. It is left for a red-team pass to show a route.
- Legacy URL attributes that browsers no longer fetch or run (`background`, `codebase`, `classid`, `archive`, `longdesc`, `xml:base`).

## Alternatives
- **Police animation attributes only on `<set>`/`<animate>`/`<animateMotion>`.** It needs the element name in `isSafeUrl`, which `@keel/ui` and the compiler call by attribute name alone. A spread can still set them on those elements, so the check would move, not shrink.
- **Forbid animation elements that target `href`.** `attributeName` can be dynamic, so it only catches literals.
- **Drop the bad `srcset` candidate.** Needs a real candidate parser to rebuild the list, and the result differs from every other URL attribute.
- **Throw from `attr` on an `on*` name.** Turns a key from data into a Boundary fallback.

## Spec diff
- **k.compiler Escaping by context.**
  - URL attributes add "`data`, `ping`/`srcset`/`imagesrcset` (each URL; split at spaces, commas), and `to`/`from`/`by`/`values` on any element (each `;` item)".
  - The non-navigation attributes become "the rest are assets". A value is blanked when any of its URLs fails.
  - Adds "a `<base>` `href` is never rendered".
- **k.compiler Rules.** E1003 becomes "any `srcdoc` or `<base>` `href`, or a literal ...". E1002 adds "`on*` strings, also spread".
- **k.compiler Conformance.** One clause: "`javascript:` in `object data`, a `srcset` candidate, or a `<set>` `to`/`<animate>` `values` item is E1003 as a literal and `about:blank` bound; any `<base>` `href` is E1003, never rendered."
- **k.compiler trims.** To stay at 1,500 tokens, these non-normative words were dropped:
  - "on oxc";
  - "imported from `@keel/runtime-dom`", which the k.runtime API states;
  - "Reordered keyed `For` rows move, not re-create", "byte-identical for identical sources" and "one entry per element", each restated by a conformance clause;
  - the W1005 parenthetical in Artifacts, since Rules has W1005;
  - "nodes and edges";
  - "also at build-time evaluation" on E1000, restated by a conformance clause.
- **k.runtime Ops.** Adds "`attr` binds nothing for an `on*` name or a `<base>` `href`".
- **k.runtime Conformance.** One clause: "A JSX spread `{...{ onclick: 'alert(1)' }}` creates no `onclick` attribute."
- **k.runtime trims.** "(RFC 0037)", "(RFC 0046)", "(like `deps.json`)" and "static," were dropped from the islands paragraph to fit.

## Conformance diff
- **Added** `packages/compiler/conformance/url-policy-0056.test.ts` (k.compiler). It covers:
  - the backlog 0132 repros, each E1003 as a literal and `about:blank` when bound, with clean counterparts;
  - `<base href>`, literal and bound: E1003, and no `href` rendered;
  - `formaction`, `ping`, `xlink:href` and `action`, which stay covered;
  - the backlog 0133 repro through the compiler: the spread is E1002 and, when mounted, creates no `onclick`;
  - fast-check properties (seed 1337): any string bound to any policed attribute on any element renders unchanged or as `about:blank`, and a `javascript:` value always renders `about:blank`.
- **Added** `packages/runtime-dom/conformance/attr-on-refused.test.ts` (k.runtime).
  - `attr(el, 'onclick', fn)` sets nothing.
  - Properties (seed 1337): no `on*` name, in any case, sets an attribute, and no `<base>` `href` is set.
  - Counterparts: `a` `href`, `data-on` and `title` still set.
  - `@keel/compiler` is not a dependency of `@keel/runtime-dom`, so the JSX repro lives in the compiler file.
- **Unit tests.**
  - `packages/runtime-dom/test/refused.test.ts` covers list splitting and `isRefusedAttr`.
  - `packages/runtime-dom/test/urlCases.ts` is the agreement table both packages run. It gains the seven new attributes.
  - `packages/compiler/test/rules.test.ts` covers E1002 spread keys and `<base href>`.

## Migration
- App code now gets E1003 for a `<base href>`, and for a literal `object data`, `srcset` candidate or animation value whose scheme is not allowed. The fix removes the attribute.
- An `on*` key in a spread onto an HTML element no longer renders. Bind the handler as a JSX `on*` prop with a function.

## Token impact
- k.compiler: 1,497 to 1,500 tokens, after the trims above.
- k.runtime: 1,476 to 1,498 tokens.
- No output format changes. The `@keel/runtime-dom` bundle grows by the list splits and the refusal check, and stays within its 6 kB budget.
