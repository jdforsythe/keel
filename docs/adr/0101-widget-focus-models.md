# ADR-0101: focus models follow the APG per pattern, and the platform owns modality (RFC 0084)

**Status:** accepted (2026-11-11), user decision D1, under the WORKFLOW RFC defaults 3 and 6.

**Context.** The widgets need a focus model per WAI-ARIA Authoring Practices pattern and a modal dialog. happy-dom 21.0.4, the harness DOM, implements `showModal()` as setting `open` and has no `showPopover`; the k.ui style vocabulary has no `position`.

**Decision.** Option lists (Listbox, Combobox, Menu) keep DOM focus on the list or the input and move a highlight with `aria-activedescendant`; Tabs move focus with a roving `tabindex`; Dialog uses the native `<dialog>` with `showModal()`, whose top layer makes the rest of the page inert, while `Part` focuses the first control and returns focus on close. Popups and toasts render in flow; the Toaster keeps `status` and `alert` regions in the page from the first render.

**Alternatives.**
- A JavaScript focus trap, rejected: `showModal()` already makes the page inert, and a trap fights the platform's close requests.
- Portals, rejected: content leaves the component that owns it (principle 2).
- The popover API, rejected: absent from the harness DOM, and its default placement centers a menu on the screen.

**Consequences.**
- An open menu or combobox list pushes content down until a later RFC adds placement.
- A toast raised while a modal dialog is open is not announced until the dialog closes.
- Tab containment in a dialog is checked in the Chromium and WebKit browser journey, since the harness has no top layer.
