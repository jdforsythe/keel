# RFC 0190: k.cli Inspect: each deployable's sections under `keel dev`

Status: draft (ADR-0212 proposed). Backlog 0954.

## Decisions
- D1: under `keel dev` of a topology with a `node` deployable, the inspect document gains `deployables`, `{ [name]: { sections } }`: each `node` deployable's own sections and the sections the page of each `client` deployable last posted, under that deployable's name.
- D2: the page's dev entry posts its deployable's name as `deployable` beside `{ graph, stores, sections }`. A report whose `deployable` is not a string is 400, as any malformed report.
- D3: `sections` stays the union, and the spec now names the winner: a `node` deployable's section replaces the page's of that id; of two `node` deployables, the first by name is kept.
- D4: `keel inspect` prints, for a document with `deployables`, one `inspect.section` per deployable and section (deployables by name, sections by id), carrying `deployable`; the summary counts those records. A document without `deployables` (a `createApp` in dev, a client-only dev server) prints as now.
- D5: no new codes. k.cli and k.topology go from `conformance-covered` to `implemented` until the new clauses are covered.

## Problem
k.cli Inspect does not say what `keel dev` serves on one origin for a `client` and a `node` topology, nor which section wins when two serve an id. golden-2's recipes page and its `api` deployable both serve `timings.recent` (std.timings): the page's records how long it waited for each `kitchen` call, the `api`'s the catalog query. The `api` one replaces the page's, so the page's timings are in no document and `keel inspect` cannot show them.

## Proposal
`GET /__keel/inspect` from the compiler plugin under `keel dev` with dev apps:
```json
{ "live": true, "graph": {}, "stores": {}, "ids": {}, "a11y": {}, "routes": {},
  "sections": { "timings.recent": { "doc": "…", "value": "<api's>" } },
  "deployables": {
    "api": { "sections": { "timings.recent": { "doc": "…", "value": "<api's>" } } },
    "web": { "sections": { "timings.recent": { "doc": "…", "value": "<page's>" } } } } }
```
`keel inspect` compact: `section api timings.recent {…}`, `section web timings.recent {…}`.

A dev `createApp` and a client-only dev server answer with no `deployables`: one deployable serves every section there.

## Alternatives
- **Qualify colliding ids** (`api:timings.recent`). Rejected: an id stops being stable across topologies, and a tool reading `sections` by id breaks the moment a second deployable registers it.
- **The page's section wins.** Rejected: swaps which half is hidden.
- **E1057 for one id in two deployables.** Rejected: a stdlib module placed on both sides (std.timings) registers its section wherever it runs, by design.

## Spec diff
- **k.topology** Local topology gains: "Its inspect document (k.cli Inspect) also holds `deployables`, `{ [name]: { sections } }`: each `node` deployable's own sections and those its `client` deployable's page last posted; `sections` is their union, where a `node` deployable's section replaces the page's of that id and, of two `node` deployables, the first by name is kept." Conformance gains clause 15.
- **k.cli** Inspect: the page's post gains `deployable`; "`keel dev` adds `deployables` (k.topology)"; `keel inspect` prints "an `inspect.section` per section (per deployable given `deployables`)". The paragraph is tightened so `keel docs k.cli` stays within 1,500 tokens. Conformance gains clause 20.
- **Ledger**: `k.topology#15` and `k.cli#20` at `none`.

## Conformance diff
By the `conformance-writer`, under `rfc:0190`, from the spec text alone:
- k.topology 15 (`packages/compiler/conformance/`): a dev server for a topology of a `client` deployable `web` and a `node` deployable `api`, the page posting section `x` with `deployable: "web"` and the `api` app serving `x`: `sections.x` is `api`'s, `deployables.web.sections.x` the page's and `deployables.api.sections.x` `api`'s.
- k.cli 20 (`packages/cli/conformance/`): `keel inspect` against a document whose `deployables` hold `x` under `api` and `web` prints two `inspect.section` records for `x`, `deployable` `api` then `web`.
Spec topics: `pnpm spec k.cli`, `pnpm spec k.topology`.

## Build
- `@keel/compiler`: `entryCode` takes the deployable's name and the dev reporter posts it; `inspectMiddleware` takes the dev apps by name, keeps each named page's last sections and adds `deployables` when it has dev apps; `isDevApp` requires the name.
- `@keel/cli`: `InspectDocSchema` reads `deployables`; `inspectCommand` prints per deployable; `InspectSectionSchema` gains optional `deployable`, which the compact and pretty formatters print before the id.
- Docs: the compiler and cli READMEs, golden-2's README.

## Known limits
Two open pages of one `client` deployable share one entry: the last to post is kept, as `live` is today.

## Migration
None: unreleased.

## Token impact
k.cli 5,969 to 5,978 characters (the Inspect paragraph tightened); k.topology about 6,965 to 7,500.
