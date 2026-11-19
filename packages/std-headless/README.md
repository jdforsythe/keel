# @keel/std-headless

**Spec:** std.headless, std.options · **Status:** proposed · **verified:** (none)

Headless widgets built on `Part`: keyboard, focus and ARIA follow the WAI-ARIA Authoring Practices 1.2 pattern each widget names. Values stay the app's; interaction state is a state chart instance per widget.

## Contract

- **Usage.** In a component, write each widget as a JSX tag:
  ```tsx
  <Combobox id="diet" label={msg.diet} text={() => typed.get()} onInput={(v) => typed.set(v)}
    options={() => diets.filter((d) => d.text.includes(typed.get()))} onChange={(k) => pick(k)} />
  ```
  The compiler lowers a tag to a component call that receives the component's `ctx` (the clock behind typeahead and toast timers) and renders its node in place. A call written inside a JSX expression, `{Combobox({ ... })}`, is compiled as a text binding: it renders nothing and gets no `ctx`. The plain call `Widget(props, undefined, ctx)` is for code without JSX, such as a test harness component passed to `render` from `@keel/testing`, or another `.ts` component file that forwards its own `ctx`.
- **Public API** (`.`, client-safe, no CSS):
  - `Listbox({ id, label | labelledBy, options, mode, selected, onChange, orientation?, option?, styles? }, undefined, ctx?)`: parts `list`, `option.<key>`.
  - `Combobox({ id, label | labelledBy, text, onInput, options, onChange, option?, empty?, styles? }, undefined, ctx?)`: parts `input`, `list`, `option.<key>`, `empty` (a `status`).
  - `Menu({ id, trigger, items, onSelect, item?, styles? }, undefined, ctx?)`: parts `trigger`, `menu`, `item.<key>`; an item with `checked` is a `menuitemcheckbox`; an item's role is read once, when its row is made.
  - `Tabs({ id, label | labelledBy, tabs, selected, onChange, orientation?, tab?, panel, styles? }, undefined, ctx?)`: parts `list`, `tab.<key>`, `panel.<key>`.
  - `Dialog({ id, title, level?, trigger, content, alert?, styles? })`: parts `trigger`, `dialog` (`alertdialog` with `alert`), `title`, `description`; `level` and whether `alert` is given are read once, since they fix the heading's tag and the dialog's role.
  - `Disclosure({ id, summary, children, styles? })`: parts `button`, `panel`; `children` are its JSX children.
  - `Toaster({ id, items, onDismiss, dismiss, duration?, styles? }, undefined, ctx?)`: parts `status`, `alert`, `toast.<item>`, `dismiss.<item>`. A `status` item expires `duration` ms (at least 5,000) after it shows, on `ctx.clock`; focus on its dismiss button holds it and leaving starts the full duration again.
  - Charts `optionsChart` (`headless.options`), `openChart` (`headless.open`), `toastChart` (`headless.toast`); types `Option`, `ToastItem`.
  - Each part's id is `<id>.<part>`. Every string a person sees or hears is a prop or a slot's output. Values reach a widget through functions and leave through callbacks.
  - Read once, at build: `id`, whether the widget is named by `label` or by `labelledBy`, and `styles`, which the compiler turns into classes. Every other prop is read in a binding, so a change shows in place: the widget keeps its nodes, focus and open state. An option, tab or toast keeps its row while its key stays in the list, and its text follows the item.
  - Each widget keeps a chart `instance` in its scope, keyed by its `id`; a Toaster keys one per item by a counter. Chart data hold indexes and counts only. A list widget sends `items` before an event when the list's length changed since the last one.
  - Typeahead: a printable key without `mod` extends a buffer that empties 500 ms after the last key (`ctx.clock`; without a ctx each key starts a new buffer) and jumps to the next option after the active one whose text starts with it.
  - E2801 is thrown at render for an option, tab or toast key that is not 1 to 64 of `[A-Za-z0-9_-]` or repeats in its widget; the message starts with the code.
- **Dependencies:** `@keel/ui` (`Part` from `@keel/ui/aria`), `@keel/runtime-dom`, `@keel/reactive`, `@keel/ctx`, `@keel/schema`, `@keel/std-statecharts`, `@keel/store` (types and `tx`).
- **Rungs:** conformance (examples, properties and `explore`, seed 1337); a property that `optionsChart` agrees with a naive list model under generated event sequences.

## Extension points

None.

## Unsafe

count: 0
