# ADR-0097: stdlib widgets are built from one kernel element, `Part`, closed to app code (RFC 0084)

**Status:** accepted (2026-11-11), user decision D1, under the WORKFLOW RFC defaults 1, 2 and 6.

**Context.** No k.ui base element takes `role`, an `aria-*` prop, `tabindex` or a keyboard or focus handler, and stdlib source is app code to `keel check` (`isAppPath` exempts `unsafe/`, `.keel/` and `node_modules/` only), so E1805 and E1251 stop a stdlib package from writing its own elements. Nothing opens a modal dialog or moves focus on request.

**Decision.** k.aria, a new kernel section: `@keel/ui/aria` exports `Part`, a base element whose `role` fixes its tag (`listbox` a `ul`, `columnheader` a `th scope=col`, `dialog` a native `dialog`) and the ARIA props it accepts, typed as a union discriminated by role. It takes `tabIndex` 0 or -1, a reactive `focus` that focuses on a false-to-true change only, `onKey` with a `KeyInput` whose true return prevents the default, `onFocus`, `onBlur`, `onClick` and `onInput`. `activeDescendant` marks the named element `data-k-highlighted` and scrolls it into view; a `dialog` opens with `showModal()`, focuses its first control, returns focus on close and reports a close request as `onDismiss`. E1822 refuses `@keel/ui/aria` in app code outside `unsafe/`.

**Alternatives.**
- ARIA props on base elements for app code, rejected: a second way to build each widget, with no keyboard model behind the attributes.
- Exempting `packages/std-*` from E1805, rejected: intrinsics carry no role typing and no resume guarantee, and each widget would repeat focus and dialog code.
- One kernel element per widget, rejected: seven contracts frozen at once where one role table serves them.

**Consequences.**
- k.aria is 1,470 tokens; k.ui gains one pointer (1,421 to 1,433) and k.a11y names `Part`'s `0` and `-1` (1,281 to 1,293).
- The glossary's extension point list gains widget parts.
- An app that needs a pattern Keel lacks writes it under `unsafe/` with a justification.
