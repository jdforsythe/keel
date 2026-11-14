# @keel/std-headless

**Spec:** std.headless, std.options · **Status:** proposed · **verified:** (none)

Headless widgets built on `Part`: keyboard, focus and ARIA follow the WAI-ARIA Authoring Practices 1.2 pattern each widget names. Values stay the app's; interaction state is a state chart instance per widget.

## Contract

- **Public API** (`.`, client-safe, no CSS):
  - `Listbox({ id, label | labelledBy, options, mode, selected, onChange, orientation?, option?, styles? }, undefined, ctx?)`: parts `list`, `option.<key>`.
  - `Combobox({ id, label | labelledBy, text, onInput, options, onChange, option?, empty?, styles? }, undefined, ctx?)`: parts `input`, `list`, `option.<key>`, `empty` (a `status`).
  - `Menu({ id, trigger, items, onSelect, item?, styles? }, undefined, ctx?)`: parts `trigger`, `menu`, `item.<key>`; an item with `checked` is a `menuitemcheckbox`.
  - `Tabs({ id, label | labelledBy, tabs, selected, onChange, orientation?, tab?, panel, styles? }, undefined, ctx?)`: parts `list`, `tab.<key>`, `panel.<key>`.
  - `Dialog({ id, title, level?, trigger, content, alert?, styles? })`: parts `trigger`, `dialog` (`alertdialog` with `alert`), `title`, `description`.
  - `Disclosure({ id, summary, children, styles? })`: parts `button`, `panel`.
  - `Toaster({ id, items, onDismiss, dismiss, duration?, styles? }, undefined, ctx?)`: parts `status`, `alert`, `toast.<item>`, `dismiss.<item>`. A `status` item expires `duration` ms (at least 5,000) after it shows, on `ctx.clock`; focus on its dismiss button holds it and leaving starts the full duration again.
  - Charts `optionsChart` (`headless.options`), `openChart` (`headless.open`), `toastChart` (`headless.toast`); types `Option`, `ToastItem`.
  - Each part's id is `<id>.<part>`. Every string a person sees or hears is a prop or a slot's output. Values reach a widget through functions and leave through callbacks.
  - Each widget keeps a chart `instance` in its scope, keyed by its `id`; a Toaster keys one per item by a counter. Chart data hold indexes and counts only. A list widget sends `items` before an event when the list's length changed since the last one.
  - Typeahead: a printable key without `mod` extends a buffer that empties 500 ms after the last key (`ctx.clock`; without a ctx each key starts a new buffer) and jumps to the next option after the active one whose text starts with it.
  - E2801 is thrown at render for an option, tab or toast key that is not 1 to 64 of `[A-Za-z0-9_-]` or repeats in its widget; the message starts with the code.
- **Dependencies:** `@keel/ui` (`Part` from `@keel/ui/aria`), `@keel/runtime-dom`, `@keel/reactive`, `@keel/ctx`, `@keel/schema`, `@keel/std-statecharts`, `@keel/store` (types and `tx`).
- **Rungs:** conformance (examples, properties and `explore`, seed 1337); a property that `optionsChart` agrees with a naive list model under generated event sequences.

## Extension points

None.

## Unsafe

count: 0
