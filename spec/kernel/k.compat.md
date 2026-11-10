# k.compat: Surface compatibility
status: proposed

**Purpose.** Deployables ship at different times, so a module's routes must keep accepting what its callers in other deployables send, and keep answering what they decode. `keel check` proves both from one artifact.

**Surface.** `keel build` writes `.keel/surface.json`, a k.compiler artifact (E1005): for each route of the app its `module`, `path`, `params`, `search`, its GET answer (`{ id, results }` of its chain's loader `output`s, k.server) and, per action method, its `input` and answer (`Result` of `Href | null`); for each `service({ module })` call its calling module, `module`, and each endpoint's method, `path`, `params`, `query`, `body`, `output` and `errors`. Schemas are JSON Schema, as in `routes.json`. To read them, the build evaluates `routes.ts` (k.compiler) and each file whose `endpoints` a `service({ module })` names.

**Accepts.** Schema `A` accepts `B` when every value `B` admits parses with `A`, decided on the schema kinds: an object accepts one whose required fields include every field it requires, whose fields it accepts field by field, and, when it is closed, one that is closed too with no other field; a literal or enum one whose values it holds; a number or string one whose bounds lie inside its own; an array one whose items it accepts; a union one whose every member some member accepts; a nullable or optional one when it accepts the inner schema; a format type one of its name; `s.json()` accepts any.

**Endpoints.** An endpoint of `service({ module: m })` matches the route of `m` with its `path` and method (GET: the loader; others: `routes.actions`). The route's `params`, `search` and `input` must accept the endpoint's `params`, `query` and `body`, and the endpoint's `output` and `errors` must accept the route's answer (E1561).

**Base.** `keel check --base <file>` reads another `surface.json`, the one of the deployed code (the generated CI takes the base branch's). For each base endpoint whose calling module and `m` are in different deployables now, the current route must accept the base endpoint's request, and the base endpoint's `output` must accept the current answer (E1562). Modules in one deployable ship together and are not compared. Without `--base`, no E1562.

**Rules.** E1561 an endpoint of `service({ module })` that no route of that module at its method and path accepts, or whose `output` or `errors` refuse the route's answer, at the endpoint, naming the first refused path; no fix · E1562 a route change that a base endpoint in another deployable refuses, at the route's schema, naming the endpoint; fix when the change is one added required object field: make it optional.

**Conformance.**
- For generated pairs of schemas, when `A` accepts `B`, every value `gen(B)` yields parses with `A`.
- An endpoint whose `body` lacks a field the route's `input` requires is one E1561; the same endpoint with the route's own schema has none.
- With a base where `y`'s action input is `{ name }` and its caller `a` is in deployable `x`, adding a required field `note` is one E1562 at `note` whose fix leaves none; with `a` and the route in one deployable there is none.
- Removing an output field a base endpoint requires is one E1562 with no fix; adding a field to an open output object is none.
- `keel check` without `--base` reports no E1562; a changed byte of `.keel/surface.json` is E1005.
- A `service({ module: 'b' })` endpoint in module `a` reports E1152 without `b` in `deps` and E1157 for a route not in `b`'s `public.routes`.
