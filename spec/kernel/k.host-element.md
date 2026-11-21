# k.host-element: Host elements
status: conformance-covered

**Element.** `Host` from `@keel/ui` is the one element whose node outside code owns (a chart library, d3, a custom element). A base element in every k.ui sense, rendered as an empty `div` with `data-k-host`:
```tsx
<Host id="recipes.added.chart" role="img" label={text.chart} input={AddedInput}
  value={{ points: props.points }} code={() => import("./addedChart.ts").then((m) => m.addedChart)} h="chart" />
```
Props: `id` (required, literal or template), `role` (`'img'`: the drawing is one picture, its content hidden from the accessibility tree; `'group'`: the outside code's own elements are exposed and keep their own names), `label` or `labelledBy`, `describedBy`, `input` (a schema), `value`, `code`, and with `events` (a schema) `onEvent(e)` (k.host-code for both). `Host<I, E>` types `value` as `input`'s value and `code` as a `HostCode<I, E>`, so a mismatch is a type error.

**Text alternative.** Exactly one of `label` (`aria-label`) and `labelledBy` (`aria-labelledby`, an element id). E1802, without types: a `Host` with neither, with both, or with a literal `label` holding no visible character (blank as k.a11y reads it). A computed `label` and any `labelledBy` are not checked statically, and with a spread only the types check presence; `a11y()` checks the name at render.

**Value.** `value` is a plain value, read once; a signal or a computed, read with `get()`; or a compiled expression, the getter that `value={...}` compiles to (k.component), read again when what it reads changes. A function is a plain value, never called. The runtime reads `value` in one `computed`, so a plain value never calls `update`.

**Lifecycle.** Client only. The server writes the element with its attributes and no children. `code` runs after the element's island resumes or mounts: the import resolves, then `mount` runs in the next animation frame with the current value. While mounted, a change of `value` (by `Object.is`) calls `update` at most once per animation frame, with the latest value. A change requests a frame when none is pending; in the frame `update` runs unless the latest value `Object.is` the one the last call got, so a write and its reversal in one frame call nothing. A change before `mount` calls no `update`. Disposing the element's scope (an `If`, a `For` row, a navigation) cancels a pending frame, calls `dispose` if `mount` ran and removes the node; `mount` never runs after it. Resume never compares or claims the element's children (no E1253 from them).

**Parse.** Under `mount` or `resume` with `mode: 'dev'` (`keel dev`) and in the harness, `input` parses each value before `mount` or `update` gets it, and in the harness before `find(id).value` encodes it. A value that fails is a `KeelError` `schema.invalid` thrown to the nearest `Boundary` (`data.at` the element's id), and neither `mount` nor `update` runs with it. Production (`mode` `'production'`, the default) does not parse: the value reaches the code as typed, unchecked.

**Harness and replay.** The harness never runs `code`. `find(id)` of a host element is `{ id, role, name, text: '', state: {}, value }`, `value` the latest value encoded by `input`'s codec; `a11y()` gives its node with no children. `fire(id, { type: 'emit', detail })` parses `detail` with `events` and calls `onEvent` as `emit` does (`schema.invalid` without `events` or on a mismatch); a session's `emit` replays the same way.

**Ledger.** `keel ledger --write` writes `hostElements`, an integer at the ledger file's top level after `unsafe` (k.ledger): the count of `<Host>` elements and `Host(...)` calls of `@keel/ui`'s `Host` in `src` and `unsafe` directories of `packages/*`, every file of `apps/*` and the root `modules/**` of an app, plus each library's `hostElements` (k.library). With `--scope` it counts the apps in scope, written and not compared. E1706 also reports a count higher than the committed one, in a run without `--scope`.

**Rules.** E1802 (k.a11y) as under Text alternative · E1824 a `code` prop that is not `() => import("<relative path>").then((m) => m.<export>)`, or a `Host` without `input`.

**Conformance.**
- A server document with a `Host` holds `<div data-k-host data-k=... role="img" aria-label=...>` with no children; its island loads the resume entry.
- After resume, `mount` runs once with the served value and the element's node; the server node is kept and no E1253 is reported.
- Writing the signal `value` three times in one frame calls `update` once, with the last value and the mounted value as `prev`.
- A plain `value` calls `mount` once and `update` never; writing a signal `value` to a new value and back in one frame calls no `update`.
- Removing the element through an `If` calls `dispose` once and aborts `signal`; removing it before the import resolves calls neither `mount` nor `dispose`.
- A throw from `mount` renders the nearest `Boundary`'s fallback with `data.at` the element's id.
- Under `mode: 'dev'` a `value` that fails `input` renders the nearest `Boundary`'s fallback with `data.at` the element's id and calls no `mount`; without `mode`, `mount` gets the same value as given.
- In the harness `find(id).value` equals the encoded value, `code` is never imported, and `a11y(id)` has `{ role: 'img', name: <label> }` with no children.
- `fire(id, { type: 'emit', detail })` calls `onEvent` with the parsed detail; a session holding that event replays to the same `state()`.
- A `Host` with neither `label` nor `labelledBy`, with both, or with `label=" "` is E1802 without types, and one with `label="Added"` or `labelledBy="c.title"` is not; `code={load}` is E1824.
- `keel ledger --write` of a fixture with two `Host` elements writes `hostElements: 2` beside `unsafe`; a third makes `--diff` report E1706.
