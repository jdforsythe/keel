# k.runtime: DOM runtime and islands
status: implemented

**API.** App code uses only `mount` and the intrinsics `If`, `For`, `Match`, `Case`, `Boundary` from `@keel/runtime-dom`.
```ts
import { mount } from '@keel/runtime-dom'
const dispose = mount(App, document.getElementById('app'), { ctx: createCtx({ mode: 'real' }) }) // generated entry only; App takes no props
dispose()
```
`mount(Component, el, { ctx?, onError? })` renders a client-only tree into `el`, passing `ctx` (k.ctx) as the root component's third argument, and returns `dispose`. When the default root Boundary catches an error, `onError(error)` (a `keel.unexpected` error, k.errors) is called in addition to rendering the fallback. Server-rendered apps never call it: the generated entry calls `resume(root, components, { ctx?, stores? })` (`@keel/runtime-dom/ops`), which passes `ctx` to every island root.

**Ops.** Compiler-only (k.compiler): `template(html)`, `clone(t)`, `text(node, fn)`, `attr(el, name, fn)`, `prop(el, name, fn)`, `on(id, type, handler)`, `cond`, `list`, `match`, `boundary`. Each binding is an `effect` in the owning component's scope that writes exactly one DOM location; disposing the scope removes it. `attr` with `null` or `false` removes the attribute; `true` sets it empty.

**Events.** Delegated: one listener per event type at the mount or island root. Handlers live in a table keyed by element id (k.component). Dispatch walks from the target to the root and calls each handler whose element it passes, innermost first, until `stopPropagation`. Non-bubbling events (`focus`, `blur`, `mouseenter`, `mouseleave`, `scroll`, `load`, `error`) bind directly on the element. The harness `fire(id, event)` uses the same table.

**Islands and resume (ADR-0006).** The compiler marks a component instance as an island when its subtree has an event handler, an `effect`, or a read of client-writable state; everything else is static HTML and ships no JS. The server emits:
- `data-k="<elementId>"` on every element with a binding;
- `data-k-island="<componentId>"` on each island root;
- one `<script type="application/json" id="k-state">` with store snapshots (k.store) and island props, encoded by their schema codecs.

Resume restores stores from the snapshot, finds bound nodes by `data-k`, attaches bindings and delegated handlers, and neither re-renders nor re-runs loaders. All islands resume at load; events fired before resume are queued and replayed in order.

**Resume markup.** The server wraps the content of each structural op (`If`, `For`, `Match`, `Boundary`) in `<!--[-->` … `<!--]-->`, placed immediately before the op's anchor node; regions nest, each `<!--[-->` closing at its matching `<!--]-->`. At resume the island's first template claims the island root element, and each op claims the elements of its region in order (rows of a `For` in list order); claimed nodes are kept, and later content is inserted before the closing marker. Element tags and element structure must match the compiled templates; text and comments are not compared. A missing marker, a missing or extra element, or a child component whose root lies outside any region is a mismatch: E1253, and that island re-renders on the client in place of the server element; events queued for it are dropped.

**Rules.** E1251 app code imports a runtime op · E1252 `document`, `window`, or DOM node APIs in app code outside the generated entry · E1253 server HTML does not match the compiled structure at resume (dev diagnostic; that island re-renders on the client) · E1254 island root prop not encodable by its schema (function or class instance).

**Conformance.**
- `mount` then `dispose` leaves zero event listeners and zero reactive subscriptions.
- A tree using N distinct bubbling event types attaches exactly N listeners to its root.
- After resume, every server-rendered node keeps its identity, `state()` equals the serialized snapshot, and firing an event by id yields the same state and DOM as a client-only render.
- A page with no islands loads no runtime JS.
- An event fired before its island resumes is applied exactly once after resume.
- A handler on an inner element runs before one on its ancestor; `stopPropagation` in the inner handler prevents the outer one.
- `mount` `onError` receives the error the root boundary rendered.
- `attr(el, 'x', fn)` removes `x` when `fn` returns `false` and restores it when `fn` returns a string again.
