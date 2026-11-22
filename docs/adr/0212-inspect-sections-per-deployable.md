# ADR-0212: k.cli: the inspect document keeps each deployable's sections under `keel dev` (RFC 0190)

**Status:** accepted.

**Context.** `keel dev` serves a topology's `client` and `node` deployables on one origin and merges their inspector sections into one `sections` map. golden-2's page and its `api` deployable both serve `timings.recent`; the `api`'s replaces the page's, so the page's timings reach no tool.

**Decision.** The document gains `deployables`, `{ [name]: { sections } }`, under `keel dev` with a `node` deployable: each `node` deployable's own sections and the sections each `client` deployable's page last posted (the dev entry posts its name as `deployable`). `sections` stays the union: a `node` deployable's section replaces the page's, and of two `node` deployables the first by name is kept. `keel inspect` prints one `inspect.section` per deployable and section, carrying `deployable`.

**Alternatives.** Qualified ids on collision (unstable ids); the page winning (hides the other half); E1057 for an id in two deployables (std.timings registers on both sides by design).

**Consequences.** k.topology gains Conformance clause 15 and k.cli clause 20, at rung `none`; both go to `implemented` until covered. Documents without `deployables` read as before.
