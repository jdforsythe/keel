# std.headless: Headless widgets
status: conformance-covered

**Package.** `@keel/std-headless`, client-safe, no config, no capability, no CSS. Widgets: `Listbox`, `Combobox`, `Menu`, `Tabs` (std.options), `Dialog`, `Disclosure`, `Toaster` (here); charts `optionsChart`, `openChart`, `toastChart`; types `Option`, `ToastItem`. Each widget is a component file (`.ts`) that calls `Part` (k.aria), base elements and `For` and `If` as functions. Keyboard, focus and ARIA follow the WAI-ARIA Authoring Practices 1.2 pattern each widget names. Read once: `id`, `label` or `labelledBy`, `styles`, a Dialog's `level` and `alert`, a Menu item's role.

**Ids.** A widget takes `id` and gives each part the id `<id>.<part>` from its table (k.component). Option, tab and toast keys become id segments: 1 to 64 characters of `[A-Za-z0-9_-]`, unique in the widget, else E2801 at render. Tests address parts by these ids.

**Text.** No widget holds copy: each string a person sees or hears is a prop (`label`, an option's `text`, `title`, `dismiss`) or a slot's output, so it comes from a message set (std.messages). A widget with a name takes `label` (written as `aria-label`) or `labelledBy` (an element id), exactly one.

**Values and state.** Values are the app's: a widget reads them through a function (`selected`, `text`, `items`) and reports a change through a callback (`onChange`, `onSelect`, `onDismiss`), so they live in a store, a form field, a signal or the route's search. Interaction state is a chart instance (std.statecharts `instance`) keyed by the widget's `id`, created in its scope:

| chart (id) | states | data | events |
| --- | --- | --- | --- |
| `optionsChart` (`headless.options`) | `closed` (initial), `open` | `active` -1 to 9,999; `count` 0 to 10,000; `back` | `open { count, at }` closed to open, `active` = `at` when below `count`, else -1, `back` false · `close { back }`, `choose` open to closed, `active` -1, `back` from the payload (`choose`: true) · `move { by, wrap }` (`next`, `prev`, `first`, `last`) in open: `next` from -1 is 0, `prev` from -1 is `count - 1`; past an end it wraps when `wrap`, else stays · `jump { to }` in open: `active` = `to` when below `count` · `items { count }`: `active` clamps to `count - 1` |
| `openChart` (`headless.open`) | `closed` (initial), `open` | none | `open`, `close`, `toggle` |
| `toastChart` (`headless.toast`) | `showing` (initial), `paused`, `gone` (final) | none | `pause`, `resume`, `expire` (in `showing`), `dismiss` (to `gone`) |

Invariant of `optionsChart`: `active` is -1 or below `count`, and -1 in `closed`. Chart data hold indexes and counts only: no key, text or typed character enters a chart, its log or a session. Every instance starts at `initial` on the server and at resume.

**Styling.** `styles` (k.aria) takes the parts each table names; `highlighted` marks the active option.

**Dialog** (APG Dialog (Modal)). `{ id, title: string, level?: 2-6, trigger: () => JSX, content: (close: () => void) => JSX, alert?: { description: string } }`; `openChart`. Parts: `trigger` (`button`, `hasPopup: 'dialog'`), `dialog` (`dialog`, or `alertdialog` with `describedBy` `<id>.description`; `labelledBy` `<id>.title`, `open` while `open`), `title` (`Heading`, default level 2), `description` (`Text`). Keys: a click or Enter or Space on the trigger sends `open`; Escape in the dialog sends `close`; Tab stays in the dialog by the platform's modal behavior. Focus moves in on open and back to the trigger on close (k.aria).

**Disclosure** (APG Disclosure). `{ id, summary: () => JSX, children }`; `openChart`. Parts: `button` (`button`, `expanded`, `controls` `<id>.panel`), `panel` (`generic`, `hidden` while closed). A click (Enter, Space) sends `toggle`.

**Toaster** (WCAG 4.1.3). `{ id, items: () => readonly ToastItem[], onDismiss: (id: string) => void, dismiss: string, duration?: number }`, `ToastItem = { id, text, tone: 'status' | 'alert' }`, a `duration` below 5,000 counts as 5,000; a `toastChart` instance per item, keyed by the Toaster's `id` and a counter, so no item id enters a chart. Parts: `status` (`status`) and `alert` (`alert`), both rendered from the first render so they are live before an item arrives; `toast.<item>` (`generic`) inside the region of its tone, `dismiss.<item>` (`button`, `controls` `<id>.toast.<item>`, text `dismiss`). A `status` item with `duration` sends `expire` that long after it shows (`ctx.clock`); focus inside the item sends `pause`, leaving it `resume`, which starts the full duration again; an `alert` item never expires. The dismiss button sends `dismiss`; at `gone` the Toaster calls `onDismiss(id)`, and the app removes the item.

**Rules.** E2801 an option, tab or toast key that is not 1 to 64 of `[A-Za-z0-9_-]` or repeats in its widget (thrown at render).

**Conformance.**
- `optionsChart`, `openChart` and `toastChart` hold the transitions in the table; under `explore`'s closed form `openChart` and `toastChart` are `complete` and `coverage` is empty; `explore` of `optionsChart` from `initial` with counts 0, 1 and 3, `at` and `to` -1, 0, 2 and 5, every `by`, `wrap` and `back`, at depth 6, finds no state breaking its invariant.
- No chart's state or log holds a key, a text or a typed character after any widget flow in this section or std.options.
- A Dialog's trigger click opens the dialog with focus on its first button; Escape closes it and focuses the trigger; an `alert` Dialog renders `alertdialog` with `aria-describedby`.
- A Disclosure's button click shows the panel and sets `aria-expanded="true"`; a second click hides it.
- A Toaster renders empty `status` and `alert` regions; a `status` item with `duration` 5,000 calls `onDismiss` after 5,000 ms of sim clock and not before; focus inside it holds it past 5,000 ms; an `alert` item stays.
- A key `a b` or a repeated key throws E2801.
- Every widget of this section and std.options rendered with its required props has no axe violations open and closed.
