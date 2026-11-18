# k.resume: Served documents and resume
status: proposed

How a document `createApp` serves (k.server) meets `resume` (k.runtime): the regions the server writes, a layout island's `children`, and islands inside islands.

**Regions.** The server renders each route level with the runtime in its server mode, in which every structural op (`If`, `For`, `Match`, `Boundary`) writes its content in a region `<!--[-->` … `<!--]-->` right before its anchor (k.runtime Resume markup), an empty region when it renders nothing; so does every template slot other than a component slot `<!--+-->`: a slot call such as `children()`, or a JSX expression of elements. A `For` region holds its rows in list order, or its `empty` content while it has none. The root Boundary of a level's render writes no region. At resume a slot claims the nodes of its region in order, as an op does.

**Layout islands.** At resume an island level's `children` is a thunk that renders no child level: it returns the server's content of the child level, the nodes of its slot's region, which stay in place and which the layout does not claim. A later call (an `If` branch or a `Boundary` rendering anew) returns the same nodes and moves them to its place; a removed place detaches them and disposes nothing in them. When the server placed no content (it did not call `children`, or the slot's branch did not render), a call returns nothing. A second call while the layout builds (k.component Build), or a later call while the content is in the document, throws E1255, on the server and in a resumed island; its level fails as a throw does (k.router, k.errors).

**Nested islands.** Every `[data-k-island]` root resumes, in document order, each with its own props from `#k-state` by route id, its own root Boundary and its own delegated listeners; an island's claim stops at a nested island root. An island that mismatches (E1253) re-renders on the client in place of its server element, and only it: its ancestors and descendants resume as if it had not. A re-rendered layout's `children` returns the held content, so its descendants keep their nodes; a held island that re-renders is what a later `children` call returns.

**Limits.** A slot whose branch did not render on the server stays empty when it shows on the client: a static level ships no JS to render it. A request for the route renders it.

**Rules.** E1255 a layout called `children` twice while it builds, or while its content is in the document.

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
