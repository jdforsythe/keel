# ADR-0074: modules call each other through `service({ module })`, and node deployables forward to peers (RFC 0080)

**Status:** accepted (2026-11-10), user decisions D1 and D4, under the WORKFLOW RFC defaults 2, 4 and 6.

**Context.** k.server said "calls between deployables are stdlib". The golden apps call their api with `service({ base: new URL(url).origin })` and a Vite proxy for `/api` that exists only in dev and preview, so nothing in production routes a request to the deployable that serves it, and nothing ties a caller's endpoint to the route it calls.

**Decision.** `service({ module, schema })` calls the routes of an app module. On a ctx a `createApp` bound, the call is answered in process when the module is served there or by an in-process peer, else through `ctx.net.fetch` to that peer's URL; in a browser it goes to the document's origin; on an unbound ctx to `http://<module>.keel.invalid`. Every path encodes, sends the same-site headers and decodes alike, so a split adds latency and `api.network` or `api.timeout` outcomes and never changes a value. `createApp({ peers })` names the other `node` deployables, and a request for a path a peer serves is forwarded to it unchanged, at most once (`x-keel-forwarded`), so any `node` deployable is an entry to the whole app. A `service({ module })` endpoint is cross-module access: E1152 without the module in `deps`, E1157 for a route outside its `public.routes`. One `KEEL_SECRET` is shared by an app's deployables, so `caller` is the same hash wherever a request lands.

**Alternatives.**
- `service({ base })` with forwarding alone, rejected: calls between co-located modules would leave the process, and the compat rule would have to guess the producer from a path.
- A shared front proxy, rejected: a third-party image and its config in generated files.
- One origin per deployable, rejected: client deployables and links between modules would need cross-origin writes, which the same-site proof refuses.
- A secret per deployable, rejected: `caller` would change when a module moves, so a split would change stored values.

**Consequences.**
- Whoever holds one deployable's environment can sign caller cookies the others accept: the trust domain of one deployable today.
- Forwarding adds no trust: a peer serves the same public routes a client could reach directly and checks the same public `origin`.
- golden-2 keeps `service({ base })` until its shared schemas move to `kitchen`, since `module` would make its modules' `deps` a cycle.
