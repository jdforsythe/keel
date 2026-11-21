# k.compat: Surface compatibility
status: conformance-covered

**Purpose.** Deployables ship at different times, so a module's routes must keep accepting what its callers in other deployables send, and keep answering what they decode. `keel check` proves both from one artifact.

**Surface.** `keel build` writes `.keel/surface.json`, a k.compiler artifact (E1005): for each contract (k.contract) its `module`, the modules that import it (`callers`), and each API entry's id, method, `path`, `params`, `query`, `body`, `output` and `errors`; for each store a `stores` factory creates, its `id`, state schema and each transaction's payload schema (the build runs each factory once on a sim ctx). Schemas are JSON Schema, as in `routes.json`; the file holds `version: 2`. Its layout, keys sorted, `callers` sorted, an absent `params`, `query` or `body` `null`, no `errors` `{}`, `sources` each file the build evaluated with its content hash:
```json
{ "data": { "version": 2,
    "contracts": { "kitchen": { "module": "kitchen", "callers": ["recipes"], "entries": {
      "kitchen.add": { "method": "POST", "path": "/api/recipes", "params": null, "query": null,
        "body": { "type": "object", "properties": { "title": { "type": "string" } }, "required": ["title"] },
        "output": { "type": "object", "properties": {}, "required": [] }, "errors": { "422": { "type": "object" } } } } } },
    "stores": { "kitchen.box": { "state": { "type": "object" }, "transactions": { "kitchen.addRecipe": { "type": "object" } } } },
    "sources": { "modules/kitchen/kitchen.contract.ts": "fnv1a:0498f75b" } },
  "hash": "fnv1a:5c1e09a2" }
```
`contracts` is keyed by module and `entries` by API id; a module with no API entry has no key. To read them, the build evaluates each contract file (k.compiler); one that throws is E1006, records nothing and fails the build. A client and its handler read one entry, so within one build they cannot disagree.

**Accepts.** Schema `A` accepts `B` when every value `B` admits parses with `A`, decided on the schema kinds: an object accepts one whose required fields include every field it requires, whose fields it accepts field by field (a field an open one lacks only if that field accepts any value), and, when it is closed, one that is closed too with no other field; a literal or enum one whose values it holds; a number or string one whose bounds lie inside its own; an array one whose items it accepts; a union one whose every member some member accepts; a nullable or optional one when it accepts the inner schema; a format type one of its name; `s.json()` accepts any.

**Base.** `keel check --base <file>` reads another `surface.json`, the one of the deployed code (the generated CI takes the base branch's). For each API entry of a base contract with a base caller in a different deployable from the contract's module now, the current entry must exist at its method and path, its `params`, `query` and `body` must accept the base entry's, and the base entry's `output` and each `errors[status]` must accept the current ones (E1562). Modules in one deployable ship together and are not compared. Without `--base`, no E1562; a base file absent or unreadable (not JSON, or not a `version: 2` surface) is W1568 and no E1562. With `topology.ts` unreadable (E1552), every caller counts as split.

**Stored data.** Stored snapshots outlive deploys (k.persist), so with `--base`, for each store in both surfaces, whatever its deployable: the current state schema must accept the base one (E1563), and each base transaction should still exist with a payload schema accepting the base one, since stored logs holding it fold at their next restore (W1564).

**Rules.** E1562 an entry change that a base entry with a caller in another deployable refuses, at the current entry's member, naming the id; fix when the change is one added required object field: make it optional; an entry gone from its method and path has no fix · E1567 a `service({ base })` in app code, `base` not a URL literal, with an endpoint an app contract's API entry serves (method and path), at `base`, naming the module; no fix (use `service({ contract })`) · E1563 a state schema change a base store's stored states fail, naming the store and the first refused path; fix as E1562 · W1564 a base transaction removed or its payload narrowed, naming it; no fix · W1568 `--base` names no readable surface of this `version`.

**Conformance.**
- For generated pairs of schemas, when `A` accepts `B`, every value `gen(B)` yields parses with `A`.
- With a base where `y.add`'s `body` is `{ name }` and module `a`, which imports `y`'s contract, is in deployable `x`, adding a required `note` is one E1562 at `note` whose fix leaves none; with `a` and `y` in one deployable there is none.
- Removing an `output` field a base entry requires is one E1562 with no fix; adding a field to an open output object is none; removing a base entry is one E1562 with no fix.
- `keel check` without `--base` reports no E1562; a changed byte of `.keel/surface.json` is E1005.
- An open `{ a?: string }` does not accept an open `{}` and accepts a closed `{}`.
- `keel check --base` naming a missing file, or one that is not JSON, is one W1568 and exits 0; with `topology.ts` unreadable, a base entry the current one refuses is E1562.
- `service({ base: origin, schema })` with an endpoint that an API entry of app module `b` serves is one E1567 naming `b`; with `base: 'https://api.example.com'` none.
- A contract file that throws is one E1006 from `keel build`, which exits 1.
- No input makes `keel check` report E1561.
- With a base where store `s` has state `{ a }`, adding a required field `b` is one E1563 at `b` whose fix leaves none, adding an optional one is none, removing a transaction of `s` is one W1564, and without `--base` there is neither.
- `keel build` with `a` importing `y`'s contract writes `data.contracts.y` `{ module, callers: ["a"], entries }`, `params` `null` on an entry without one.
