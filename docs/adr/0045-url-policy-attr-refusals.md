# ADR-0045: URL policy covers object, srcset, SVG animation and `<base>`; `attr` refuses `on*` (RFC 0056)

**Status:** accepted

**Context.** The URL policy named seven attributes, so `object data`, `srcset`/`imagesrcset` candidates, and SVG `<set>`/`<animate>` `to`/`from`/`by`/`values` aimed at `href` rendered `javascript:` unchanged. `<base href="//evil">` passed the scheme rule and re-pointed every relative URL, including the entry script (red team L1, backlog 0132). A JSX spread lowers to one `attr` per key, and `attr` set any name, so a spread with an `onclick` key created an inline handler (red team L2, backlog 0133).

**Decision.**
- **Table.** `URL_ATTRS` (`@keel/runtime-dom/url`) adds `data`, `srcset`, `imagesrcset`, `to`, `from`, `by` and `values`. The compiler's E1003, its static templates, `attr`, `prop` and `@keel/ui` all read it, so they agree.
- **Animation values on every element.** `to`/`from`/`by`/`values` are checked whatever `attributeName` names, because the target can be bound or spread. Their ordinary values (numbers, colors, transforms, `url(#id)`) have no scheme and pass.
- **Lists.** `ping`, `srcset` and `imagesrcset` split at whitespace and commas, and `values` at `;`. Every item is checked, and one bad item turns the whole attribute into `about:blank`. Splitting a `srcset` URL that holds a comma can blank a good value, never pass a bad one.
- **`<base>`.** `isRefusedAttr(tag, name)` is true for `href` on `base`. Any `<base href>`, literal or bound, is E1003 with a removal fix. Static templates omit it and `attr` binds nothing. It is dropped rather than blanked, because an `about:blank` base URL breaks every relative URL.
- **`on*`.** `isRefusedAttr` is also true for any name matching `/^on/i`, and `attr` binds nothing for it. It drops rather than throws: a key from data must not replace a subtree with its Boundary fallback. `attr` has no channel for a dev warning, and `docs/OUTPUT.md` forbids `console`. E1002 reports the source case instead: a literal `on*` key holding a string in a spread object literal on an HTML element.

**Alternatives.**
- **Inspect `attributeName`.** It can be dynamic or spread, and `isSafeUrl` takes no element.
- **Drop only the bad `srcset` candidate.** That needs a candidate parser, and the result would differ from every other URL attribute.
- **Throw from `attr`.** Data could then trigger a Boundary fallback.

**Consequences.**
- App code with `<base href>`, or a literal unsafe `object data`, `srcset` candidate or animation value, gets E1003.
- A spread `on*` key never renders. A key from data is not detectable statically, and the runtime drops it silently.
- `<meta http-equiv="refresh">` and legacy attributes browsers no longer fetch (`background`, `codebase`, `longdesc`, `xml:base`) stay out of the table.
