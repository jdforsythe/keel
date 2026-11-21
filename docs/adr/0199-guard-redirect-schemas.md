# ADR-0199: k.guards: a guard redirect's carried params fit the target's schemas, checked when the route table is built (RFC 0177)

**Status:** accepted.

**Context.** A guard denial carries the matched route's same-name params to its `redirect` route, checking presence only. A param of another `id` brand lands unchecked, and one the target's schema cannot encode is a 500 that shows only on a denial; a missing one is E1508 at the denial.

**Decision.** `manifest`, and `routeTable` for chains across modules, throw E1508 for each page whose chain holds a page or layout guard with `redirect` when a field of the target's `params` is missing from the page's or does not fit: the same node, the same type and options, an `enum` or `literal` the target parses, or a `string`, `number` or `int` within the target's bounds. `keel build` reports it through build-time evaluation. The static half in `keel check` is unchanged. k.guards reads `implemented` until clause 4 is covered.

**Alternatives.** A static check (misses call-built and package schemas, and JSON Schema loses brands); parsing at the denial (still a late 500, brands pass); run-time id brands (a k.schema change); declared carried params on the guard (new API under the freeze); a general subset relation (not decidable).

**Consequences.** A carried param that does not fit stops the build and every test that builds the table. Some safe pairs are refused until the relation widens. Backlog 1000 stays open.
