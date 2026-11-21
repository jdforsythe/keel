# RFC 0154: k.schema: `piiPaths` lists a marked open object's undeclared keys as `*`

Status: implemented (ADR-0176) under the RFC defaults (4: privacy by default), for the orchestrator to confirm. For backlog 0595.

## Decisions
- D1: for each open object under a mark (its own or inherited), `piiPaths` lists `<object path>.*` with that mark's class, after the object's declared leaves (`*` alone for a marked open root). A closed object, and an open one under no mark, add nothing.
- D2: `*` keeps its meaning, any one segment, as for an array item or record value; no new path syntax.
- D3: a lookup of one path against a schema reads the path through declared fields. A declared path, leaf or not, takes the class of its nearest mark (the node's own or one above it), or none; an open object's `<object>.*` never answers for a field the object declares. The first key an object does not declare, and every path under that key at any depth, takes the class in force at that object, open or closed: under a closed object no parsed value holds such a path, and `@keel/forms` refuses it (E1902) before any lookup, so the class only over-masks and a lookup needs no closed-object case. So `address: s.object({ street: s.string(), geo: s.object({ lat: s.number() }).pii('special') }).pii('location')` gives `address.geo` `special` (its own mark), `address.street` `location`, and `address.floor` and `address.floor.n` `location`. Chosen over "a declared non-leaf has no class": that would leave a control bound to `address.geo` unmasked while every value under it is personal, and segment matching against `address.*` would give `address.geo` the parent's `location` over its own `special`. It is the reading k.privacy's Inputs sink already uses ("a marked path": the node or one above it marked) and the one `@keel/server` `secretSegments` applies to params.
- D4: a lookup through a union never gives a path less than `piiPaths` states for it. The path is matched as `piiPaths` spells its entries (a declared field by name; an array index, a record key or an open object's undeclared last key as `*`) through every variant in declaration order; of the matches that carry a class, the one with the fewest `*` wins, and on a tie the first in declaration order, which is the class `piiPaths` lists for that spelling (it keeps the first class its declaration-order walk meets). A path no entry spells takes the class in force where the match stops (D3). So in `u: s.union('k', [s.object({ k: s.literal('a'), name: s.string() }), s.object({ k: s.literal('b'), name: s.string() }).pii('name')])` the path `u.name` is `name`, as `piiPaths` lists it, though the first variant is unmarked; and a key one variant declares unmarked takes another, open, marked variant's `*` class, since a value of that variant may hold it. Chosen over "the first variant that declares the segment": that drops a marked later variant's class, so `data-k-pii` and input masking fail open.

## Problem
`piiValues(schema, value)` returns, for a marked open object, the names and values of its undeclared keys (k.schema Derivations), but `piiPaths(schema)` lists only declared leaves. A consumer that works from paths (std.sessions redaction, the `pii.json` evidence report, `@keel/forms`' class lookup) then has no entry for those keys: a session capture of `{ address: { street, floor } }` under `address: s.object({ street }).pii('location')` redacts `street` and keeps `floor` in the clear, and `pii.json` does not show that the object takes personal data beyond its fields. Repro: `packages/schema/test/piiOpenObject.test.ts` (`piiValues` gives `["Elm", "floor", "3rd"]`, `piiPaths` gives only `address.street`).

## Proposal
`packages/schema/src/piiPaths.ts`: in the `object` case, after the fields, a node that is not `closed` adds `[...prefix, "*"]` with the class in force (the same dedupe by path as leaves). Measured with a prototype: schema bundle +38 B gzip.

Path lookups follow D3: an open object's `*` covers only the keys it does not declare, and everything under them; a declared path, leaf or not, takes its nearest mark's class. k.schema states this beside `piiPaths`. `@keel/forms` `piiClassAt` (internal; seen through `form(schema).field(path).bind(el)` as `data-k-pii`) reads the class along the declared path in the schema instead of matching `piiPaths` entries by segment count, which would give a declared non-leaf the parent's `*` class. Each consumer is listed under Migration.

## Alternatives
- State the limit ("`piiPaths` lists declared leaves only"): leaves every path-driven sink blind to data `piiValues` already calls personal.
- A distinct marker (`address.?`) for undeclared keys: a second wildcard every consumer must learn, for the same "any key" meaning.
- Make every marked object closed: changes parsing for marks, which must not change it (k.schema: marked and unmarked schemas parse alike).

## Spec diff
k.schema, Derivations: "`piiPaths(schema)` lists `{ path, class }` per marked leaf in declaration order, `path` dotted …" becomes "`piiPaths(schema)` lists `{ path, class }` per marked leaf in declaration order, a marked open object's undeclared keys as `*` after its fields, `path` dotted …".
k.schema, Derivations: after "the class its nearest mark's" add "(a lookup gives a declared path its nearest mark's class, and an object's undeclared key, open or closed, and all under it, the class in force at the object; `*` covers no declared key)". D4's union rule stays in this RFC and ADR-0176: the section has no room for it.
k.schema, Conformance: "`piiPaths` lists each marked leaf once with its class, an array item as `*`, and every leaf under a marked object." becomes "`piiPaths` lists each marked leaf once with its class, an array item as `*`, and every leaf under a marked object, then `*` for its undeclared keys when it is open; a control bound (k.forms) to a declared object under it carries its nearest mark's class as `data-k-pii`."

## Conformance diff
By the `conformance-writer`, under `rfc:0154` (changes to existing assertions, so the tag is required):
- `packages/schema/conformance/privacy-fixtures.ts` `expectedPaths`: an object spec under a mark (`cls !== null`) appends `{ path: [...prefix, "*"].join("."), class: cls }` after its fields (the fixture builds open objects).
- `packages/schema/conformance/privacy-pii-paths.test.ts`, "every leaf under a marked object": the expected list becomes `address.street`, `address.geo.lat`, `address.geo.lng`, `address.geo.*`, `address.lines.*`, `address.*`; a new case: a marked `{ closed: true }` object adds no `*`, and a marked open root lists `*` last.
- `piiPaths` of `s.object({ address: s.object({ street: s.string(), geo: s.object({ lat: s.number() }).pii('special') }).pii('location') })` is exactly `address.street` (`location`), `address.geo.lat` (`special`), `address.geo.*` (`special`), `address.*` (`location`), in that order.
- `piiPaths` of the same schema with `address` built `{ closed: true }` (and `geo` closed) is `address.street`, `address.geo.lat` only: no `*` entry.
- `piiPaths` of `s.object({ name: s.string() }).pii('name')` (an open root) is `name` then `*`, both `name`.
- `@keel/forms` `form`, under happy-dom with `@keel/runtime-dom` `mount` as in `privacy-input-mask.test.ts`, on the first schema above: an `input` bound with `field('address.geo').bind(el)` has `data-k-pii="special"` (a declared non-leaf keeps its own mark, not `address.*`'s `location`); `field('address.street')` gives `data-k-pii="location"` (a declared leaf); `field('address.floor')` throws E1902, since a form binds declared paths only.
- `@keel/schema` `piiValues` on that schema and `{ address: { street: "Elm", geo: { lat: 1 }, floor: { n: "3rd" } } }` holds `floor`, `n` and `3rd` (an undeclared key at any depth under the open object is personal); the same value under a schema with no mark gives `[]`.
- `@keel/forms` `form`, under happy-dom with `@keel/runtime-dom` `mount` as above, on `s.object({ u: s.union('k', [s.object({ k: s.literal('a'), name: s.string() }), s.object({ k: s.literal('b'), name: s.string() }).pii('name')]) })`: an `input` bound with `field('u.name').bind(el)` has `data-k-pii="name"` (a field several variants declare takes a marked variant's class, though the first is unmarked), as does `field('u.k')`; `piiPaths` of that schema is exactly `u.k` (`name`), `u.name` (`name`), `u.*` (`name`), in that order.
- `packages/cli/conformance/evidence-pii-coverage.test.ts`: its `Account.holder` is a marked open object, so the expected `pii.json` rows gain `holder.*` (`name`) after `holder.first` and `holder.last`; the other `packages/cli/conformance/evidence-*` suites need no change.

## Migration
No app code changes. Each consumer of `piiPaths`:
- `@keel/forms` (`piiClassAt`, `form.ts` `field`): changes in this RFC's build. It reads the class along the declared path (D3, D4) instead of matching entries with `*` as any segment, so a control bound to a declared object under a marked open object carries that object's nearest mark, and the parent's `*` never overrides a declared field's own mark. Declared leaves keep the class they had, or gain a marked variant's (D4); undeclared keys stay unbindable (E1902).
- `@keel/std-tables` (`columns` key check, `tableSearch` search and filter checks): unaffected. They prefix-match a declared column name (`path === name` or `path.startsWith(name + ".")`); a marked object already matched through its declared leaves, and no column is named `*`.
- `@keel/server` (log scrubbing, `secretSegments`): unaffected. Scrubbing replaces `piiValues`, which already holds undeclared keys and values; `secretSegments` reads each path's first segment, and no route param is named `*`.
- `@keel/cli` (`keel evidence` `pii.json`): gains one row per marked open object.
- `@keel/std-sessions` (`redact` in `redactionOf.ts`): skips undeclared keys, returning their values unread, so `address.*` does not yet redact `address.floor`. Making `redact` replace an undeclared key's value that a path covers is a follow-up in that package (Build order 4), not part of this RFC.

## Token impact
k.schema +102 tokens, 1,489 of 1,500 (see RFC 0152, Known limits, for the section budget).

## Build order
1. This commit: RFC, ADR, spec diff. 2. `conformance-writer`. 3. Build: `piiPaths`; `@keel/forms` `piiClassAt` per D3; flip `packages/schema/test/piiOpenObject.test.ts` from `it.fails` to `it`. 4. Follow-up, std.sessions lane: `redact` replaces an undeclared key's value when a path matches it.
