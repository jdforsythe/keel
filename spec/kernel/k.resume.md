# k.resume: Served documents and resume
status: implemented

How a document `createApp` serves (k.server) meets `resume` (k.runtime).

**Regions.** The server renders each route level in the runtime's server mode, where every structural op (`If`, `For`, `Match`, `Boundary`) writes its content in a region `<!--[-->` … `<!--]-->` right before its anchor (k.runtime Resume markup), an empty region when it renders nothing; so does every template slot other than a component slot `<!--+-->`: a slot call such as `children()`, or a JSX expression of elements. A `For` region holds its rows in order, or its `empty` content. The root Boundary of a level's render writes no region. At resume a slot claims the nodes of its region in order, as an op does.

**Layout islands.** At resume an island level's `children` is a thunk that renders no child level: it returns the nodes of its slot's region, the child level's server content, kept in place and unclaimed by the layout. A later call (an `If` or `Boundary` rendering anew) returns the same nodes and moves them to its place; a removed place detaches them, disposing nothing. With no server content (no `children` call, or the slot's branch did not render), a call returns nothing. A second call while the layout builds (k.component Build), or a later call while the content is in the document, throws E1255, on the server and in a resumed island; its level fails as a throw does (k.router, k.errors).

**Nested islands.** Every `[data-k-island]` root resumes, in document order, each with its own props (`#k-state`, by route id), root Boundary and delegated listeners; an island's claim stops at a nested island root. An island that mismatches (E1253) re-renders on the client in place of its server element, and only it: its ancestors and descendants resume as if it had not. A re-rendered layout's `children` returns the held content, so its descendants keep their nodes; a held island that re-renders is what a later `children` call returns. The server writes `<!--k-->` first in a child level's content; a layout island mismatching before its `children` call holds only that comment's region.

**Replay.** Events queued before resume replay once all islands resume, in fired order, each as a live one: from the target through each enclosing island, until `stopPropagation`; one in a re-rendered island's own nodes is dropped.

**Stores.** During a request `createApp` serves (guards, loaders, action, renders, across `await`s), `tx` on a module store (k.store Registries) throws E1256, changing nothing: a level fails as a throw does; an action answers 500. A store created in the request goes to `#k-state`; at resume its snapshot restores the store of its id in `stores`, else one an island creates resuming; else E1253.

**Limits.** A slot whose branch did not render on the server stays empty when shown on the client (a static level ships no JS); a request for the route renders it.

**Rules.** E1255 a layout called `children` twice while it builds, or while its content is in the document · E1256 `tx` on a module store during a request.

**Conformance.**
- For every route of a test app, the body of the document `createApp` serves, resumed with the app's compiled components by route id and its stores, returns no warning, keeps every server node, and a handler fired on a server element runs and updates the bindings it writes.
- An island layout around an island page: both resume, each with its own props; the page's root is the server element in the layout's slot region; a handler in each runs once per event.
- An island layout around a static layout around an island page: the static level's nodes are kept, unclaimed; the page resumes; handlers in the layout and the page run.
- An island page with a `Boundary` around a `Match` whose case holds a `For` whose rows hold an `If`: it resumes with no warning; flipping the `If` in one row, adding and removing a row, changing the case and resetting the Boundary each update in place, keeping the other nodes.
- A `For` with no rows and an `empty` branch is served as a region holding that content; it resumes keeping it; a first row replaces it.
- A layout island rendering `children()` inside an `If`: served with the branch shown, hiding it detaches the page and showing it puts back the same nodes, whose handler still runs with its state kept; served with it hidden, it resumes with no warning and showing it renders nothing.
- A layout that calls `children` twice in its body: a request fails its level as a throw whose message starts with `E1255`. After resume, a layout island whose added `For` row calls `children` while another row holds the content throws E1255 to its root Boundary.
- Islands resume in document order: an `effect` in each records its route id, layout before page.
- A served layout island whose template mismatches (E1253) re-renders while the island page in its slot keeps its server nodes and its handler runs; a page island that mismatches re-renders while the layout keeps its nodes and its slot holds the re-rendered page.
- Clicks queued on a page island's button, then its layout island's, replay after both resume, page first; a layout handler on an element enclosing the page's button runs after the page's, unless the page's calls `stopPropagation`.
- A layout island with its slot in an `If` in a wrapper element, mismatching before calling `children`, re-renders with one wrapper around the page island's server nodes; a click queued on the layout is dropped, one on the page replays.
- A loader, guard or component writing a module store fails its level with a throw starting `E1256`, the store unchanged; such an action answers 500. Two requests in turn never see each other's request stores.
- Served documents resume in a client module graph of their own (k.testing `resumeDocument`): a store created while a level renders restores with no warning; a module store is at its initial state.
