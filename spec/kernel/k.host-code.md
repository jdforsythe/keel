# k.host-code: Host element code
status: implemented

**Code.** `hostCode({ mount, update?, dispose? })` from `@keel/ui` makes a `HostCode<I, E>`, what a `Host`'s `code` (k.host-element) resolves to:
- `mount(node, value, out)` returns the code's own state `S`; `node` is the element, `out` is `{ emit(e: E): void, signal: AbortSignal }`.
- `update(state, value, prev)`, optional: with none, a change of value calls nothing. `prev` is the value the last call got. Values pass by reference, never copied: an unchanged store or loader value keeps its identity, so `value.points !== prev.points` skips work.
- `dispose(state)`: runs once, then `signal` aborts.

**Events.** `emit(e)` parses `e` with `events`, reports `{ kind: 'fire', id, event: { type: 'emit', detail: e } }` to the ctx observers, then calls `onEvent(e)` as a handler: what the app does with it is a transaction, so it is logged, recorded in a session and replayed without the outside code. A throw from `code`, `mount`, `update`, `onEvent` or an `emit` that fails `events` is caught by the nearest `Boundary` (`data.at` the element's id); a throw from `dispose` is reported to the ctx and dropped.

**customElement.** `customElement(tag, { set, events? })` from `@keel/ui` is the thin case, itself a `HostCode<I, E>`: `mount` creates `tag` (a name with a hyphen) as the node's only child, `set(el, value)` runs at mount and on each update, and `dispose` removes the child. Each `events` key is a DOM event type the custom element dispatches (`'change'`, `'dial-pick'`), and its entry `(ev: Event) => E` maps the event to what `emit` carries: `mount` listens for that type on the child, not on the `div`, with `out.signal`, and passes each result to `out.emit`, so the `Host`'s `events` schema parses it as any `emit`. The two `events` share only `E`: the `Host`'s is the schema, this one the DOM names. The file defining the element imports its package, so the definition loads with the code.

**Styles and policy.** The fixed policy (k.security) holds inside the node: outside code may set properties and CSSOM styles (`el.style.x`, d3's `.style()`), draw on a canvas, and build SVG; an HTML string sink throws (Trusted Types). A host element code file (one a `code` prop imports) may import a same-origin `.css` file of a package, emitted as its own stylesheet. The build serves it from the app's origin and loads it with the code's chunk, which `style-src 'self'` allows. In production a `<style>` element or a `style` attribute that outside code adds does not apply; `dev` serves the policy report-only, so there it applies and is reported. Tokens reach the code as `currentColor` from `fg` and as `var(--k-<group>-<name>)` through CSSOM.

**Rules.** E1825 a `.css` import outside a host element code file.

**Conformance.**
- `emit(e)` with an `e` that parses calls `onEvent` once and reaches an observer as a `fire` of `type: 'emit'`; one that fails `events` calls nothing and reaches the `Boundary`.
- `customElement('x-dial', { set })` creates one `x-dial` child, calls `set` at mount and on each update, and removes the child at dispose.
- With `events: { 'dial-pick': (ev) => ({ at: 1 }) }`, a `dial-pick` event dispatched on the `x-dial` child calls `onEvent` once with `{ at: 1 }`; the same event dispatched on the `div`, or on the child after dispose, calls nothing.
- `import 'x/a.css'` in a component file is E1825 and in a host element code file is not.
- The build of an app whose host element code file imports `./chart.css` emits it as a `.css` asset and inlines it in no document or chunk.
- In Chromium under a production document's policy, a `<style>` element and a `style` attribute that `mount` adds change no computed style, and `node.style.color` set by `mount` does.
