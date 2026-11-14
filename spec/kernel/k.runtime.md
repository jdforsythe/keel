# k.runtime: DOM runtime and islands
status: conformance-covered

**API.** App code uses only `mount` and the intrinsics `If`, `For`, `Match`, `Case`, `Boundary` from `@keel/runtime-dom`.
`mount(Component, el, { ctx?, onError? })` (generated entry only; the root takes no props) renders a client-only tree into `el`, passing `ctx` as the root component's third argument, and returns `dispose`. `onError` also gets each `keel.unexpected` error the default root Boundary renders. Server-rendered apps never call it; their entry calls `resume` (`@keel/runtime-dom/ops`), which passes `ctx` to every island root.

**Ops.** Compiler-only (k.compiler): `template(html)`, `clone(t)`, `text(node, fn)`, `attr(el, name, fn)`, `prop(el, name, fn)`, `on(target, type, handler)` (`target`: element id or `Element`), `cond`, `list`, `match`, `boundary`, `slot`; `element(tag, fill)` (also k.ui). Each binding is an `effect` in the owning component's scope that writes exactly one DOM location; disposing the scope removes it. `attr` with `null` or `false` removes the attribute; `true` sets it empty. `attr` and `prop` apply the URL policy (k.compiler); `attr` binds nothing for an `on*` name, a `<base>` `href` or a `<meta>` `http-equiv`.

**Events.** Delegated: one listener per event type at the mount or island root. Handlers live in a table keyed by element id (k.component). Dispatch walks from the target to the root and calls each handler whose element it passes, innermost first, until `stopPropagation`. Non-bubbling events (`focus`, `blur`, `mouseenter`, `mouseleave`, `scroll`, `load`, `error`, `cancel`, `close`) bind directly on the element.

**Islands and resume.** The compiler marks a component instance as an island when its subtree has an event handler, an `effect`, or a read of client-writable state; everything else is static HTML and ships no JS. Marking is static and best effort by name within a file: an element is bound when it has an `on` binding or a binding whose expression reads a `signal`, `computed`, or `resource` declared in the file or calls `.get`/`.select`; every root element of a component that calls `effect` is bound. The compiler writes `data-k="<elementId>"` into the template of each bound element. The server emits:
- `data-k` on every bound element (from the template);
- `data-k-island="<componentId>"` on each island root (a k.server route level whose returned element has a `data-k` element outside nested islands, keyed by route id);
- `<script type="module" src="/@keel/entry.ts">` only when the page has an island: the generated resume entry. It imports `components` (by route id; best effort) from `/@keel/islands.ts`, and calls `resume(document.body, components, { ctx, stores })` with a real `ctx`;
- one `<script type="application/json" id="k-state">` with store snapshots, island props, the served `route` (`{ id, path, href, params, search }`), encoded by their schema codecs, and a failed loader's `error` (`code`, `data.at` only).

Resume restores stores, finds bound nodes by `data-k`, attaches bindings and delegated handlers, and neither re-renders nor re-runs loaders. All islands resume at load. `resume` first reports `route` as a `nav`, then that `error`; per island it then fires `input` on each control off its default value with none queued, then replays queued events in order, reporting each before its handlers.

**Resume markup.** The server wraps each structural op's content (`If`, `For`, `Match`, `Boundary`) in `<!--[-->` … `<!--]-->`, immediately before the op's anchor; regions nest. At resume the island's first template claims the island root element, and each op claims the elements of its region in order (rows of a `For` in list order); a template slot `<!--+-->` holds one element, which its component claims; `element` claims the next element, and its `fill` claims the children; claimed nodes are kept, and later content is inserted before the closing marker. Tags and structure must match the compiled templates; text and comments are not compared. A missing marker, a missing or extra element, or a slot without its element is a mismatch: E1253, and that island re-renders on the client in place of the server element; events queued for it are dropped.

**Rules.** E1251 app code imports a runtime op · E1252 `document` or `window` in app code outside the generated entry · E1253 server HTML does not match the compiled structure at resume (dev diagnostic).

**Conformance.**
- `mount` then `dispose` leaves no event listener or reactive subscription.
- A tree using N distinct bubbling event types attaches exactly N listeners to its root.
- After resume, every server-rendered node keeps its identity, `state()` equals the serialized snapshot, and firing an event by id yields the same state and DOM as a client-only render.
- A page with no islands loads no runtime JS: its document has no `<script type="module">`, `data-k`, or `data-k-island`; a page with an event handler has all three, and `resume` attaches the handler to server nodes.
- An event fired before its island resumes is applied exactly once after resume.
- A `createApp` document with an island loads a module script whose URL answers 200 JavaScript that calls `resume`.
- A handler on an inner element runs before one on its ancestor; `stopPropagation` in the inner handler prevents the outer one.
- `mount` `onError` receives the error the root boundary rendered.
- `attr(el, 'x', fn)` removes `x` when `fn` returns `false` and restores it on a string.
- JSX spread `{...{ onclick: 'alert(1)' }}` creates no `onclick` attribute.
- An island rooted at a k.ui base element, or with a child component in a template, resumes without E1253, keeping every server element and the focus.
- An observer on the resume ctx gets the served `nav`, an `input` for a field typed before load, then each queued event, once.
- After resume of a page whose loader failed, an observer gets the served `nav`, then its `error` with only `code` and `data.at`.
