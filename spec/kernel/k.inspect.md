# k.inspect: The dev inspect document and inspector hooks
status: conformance-covered
What a dev app serves at `GET /__keel/inspect`, what `keel inspect` (k.cli) prints of it, and the hook that adds a section.

**Inspect.** In dev, `GET /__keel/inspect` is JSON `{ live, graph, stores, ids, a11y, routes, sections }`: `inspect()` outside a request scope, `{ [id]: { state, log } }` from `stores()` unredacted, the `.keel/` artifacts. A `node` deployable's dev `createApp` serves it, else the compiler plugin's dev and preview servers, where the page's dev entry posts `{ graph, stores, sections, deployable }` on mount and change (`live: false` before). `keel dev` (k.topology Local topology) adds `deployables`, `{ [name]: { sections } }`: each `node` deployable's own sections and those its `client` deployable's page last posted; `sections` is their union, where a `node` deployable's section replaces the page's of that id and, of two `node` deployables, the first by name is kept. Both answer a loopback or listed `Host` with its own or a listed `Origin` (`createApp({ inspect: { origins } })`; plugin: comma-separated `KEEL_INSPECT_ORIGINS`; `:*` any port; CORS echoed), no `Origin` for GET alone, else 403 `keel.denied`. `keel inspect [url]` (default `http://localhost:5173`) prints `inspect.store` per store, `inspect.section` per section (per deployable with `deployables`), counts.

**Inspector hooks** (extension point).
```ts
import { inspector } from '@keel/compiler/inspect/inspector'
inspector({ id: 'orders.recent', schema: Recent, read: (ctx) => recent(ctx) })
```
Per request each `read` gets the app's `ctx`; `sections[id]` is `{ doc, value }` (`schema.doc()`, the encoded value), or `{ doc, error }` when `read` throws or its value fails `schema` (E1057, logged).

**Rules.** E1056 inspect target unreachable, not 2xx, or not an inspect document · E1057 inspector id registered twice (throws), or a section that throws or fails its schema.

**Conformance.**
- `GET /__keel/inspect` on a dev `createApp` returns every live store's state and log and the `inspect()` graph; in production mode it is the route table's 404.
- `keel inspect` against an unreachable url emits E1056 and exits 1.
- A `POST /__keel/inspect` without `Origin` on a dev `createApp` gets 403 `keel.denied`.
- A dev `createApp` serves each section as `{ doc, value }`; a value failing its schema is `{ doc, error }` with E1057; a second `inspector` with that id throws E1057.
- The served `graph` equals `inspect()` taken outside the request.
- `keel inspect` prints one `inspect.section` per section; an `error` one is E1057, exit 1.
- `keel inspect` of a document with `deployables` prints one `inspect.section` per deployable and section.
