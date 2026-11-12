# k.compat: Surface compatibility
status: conformance-covered

**Purpose.** Deployables ship at different times, so a module's routes must keep accepting what its callers in other deployables send, and keep answering what they decode. `keel check` proves both from one artifact.

**Surface.** `keel build` writes `.keel/surface.json`, a k.compiler artifact (E1005): for each route of the app its `module`, `path`, `params`, `search`, its GET answer (its loader's `output`; none without a loader) and, per action method, its `input` and answer (`Href | null`); every route's error answer is a KeelError `{ code, message, data }`; for each `service({ module })` call its calling module, `module`, and each endpoint's method, `path`, `params`, `query`, `body`, `output` and `errors`. Schemas are JSON Schema, as in `routes.json`; the file holds `version: 1`. To read them, the build evaluates `routes.ts` (k.compiler) and each file whose `endpoints` a `service({ module })` names; one that throws is E1006 (k.compiler), records no endpoint and fails the build.

**Accepts.** Schema `A` accepts `B` when every value `B` admits parses with `A`, decided on the schema kinds: an object accepts one whose required fields include every field it requires, whose fields it accepts field by field (a field an open one lacks only if that field accepts any value), and, when it is closed, one that is closed too with no other field; a literal or enum one whose values it holds; a number or string one whose bounds lie inside its own; an array one whose items it accepts; a union one whose every member some member accepts; a nullable or optional one when it accepts the inner schema; a format type one of its name; `s.json()` accepts any.

**Endpoints.** An endpoint of `service({ module: m })` matches the route of `m` with its `path` and method (GET: a route with a loader; others: `routes.actions`). The route's `params`, `search` and `input` must accept the endpoint's `params`, `query` and `body`, and the endpoint's `output` must accept the route's answer and each `errors[status]` its error answer (E1561).

**Base.** `keel check --base <file>` reads another `surface.json`, the one of the deployed code (the generated CI takes the base branch's). For each base endpoint whose calling module and `m` are in different deployables now, the current route must accept the base endpoint's request, and the base endpoint's `output` must accept the current answer (E1562). Modules in one deployable ship together and are not compared. Without `--base`, no E1562; a base file absent, unreadable or of another `version` is W1568 and no E1562. With `topology.ts` unreadable (E1552), every caller and route count as split.

**Rules.** E1561 an endpoint of `service({ module })` that no route of that module at its method and path accepts, or whose `output` or `errors` refuse the route's answer, at the endpoint, naming the first refused path; no fix · E1562 a route change that a base endpoint in another deployable refuses, at the route's schema, naming the endpoint; fix when the change is one added required object field: make it optional · E1567 a `service({ base })` in app code, `base` not a URL literal, with an endpoint a route of an app module serves (method and path), at `base`, naming the module; no fix (use `service({ module })`) · W1568 `--base` names no readable surface of this `version`.

**Conformance.**
- For generated pairs of schemas, when `A` accepts `B`, every value `gen(B)` yields parses with `A`.
- An endpoint whose `body` lacks a field the route's `input` requires is one E1561; the same endpoint with the route's own schema has none.
- With a base where `y`'s action input is `{ name }` and its caller `a` is in deployable `x`, adding a required field `note` is one E1562 at `note` whose fix leaves none; with `a` and the route in one deployable there is none.
- Removing an output field a base endpoint requires is one E1562 with no fix; adding a field to an open output object is none.
- `keel check` without `--base` reports no E1562; a changed byte of `.keel/surface.json` is E1005.
- A `service({ module: 'b' })` endpoint in module `a` reports E1152 without `b` in `deps` and E1157 for a route not in `b`'s `public.routes`.
- An open `{ a?: string }` does not accept an open `{}` and accepts a closed `{}`.
- A GET endpoint to a route with no loader is one E1561.
- `keel check --base` naming a missing file is one W1568 and exits 0; with `topology.ts` unreadable, a base endpoint the current route refuses is E1562.
- `service({ base: origin, schema })` with an endpoint that a route of app module `b` serves is one E1567 naming `b`; with `base: 'https://api.example.com'` none.
- An endpoints file that throws is one E1006 from `keel build`, which exits 1.
