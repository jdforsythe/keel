# RFC 0047: Stdlib wave 0, one module per extension point, and the k.module `std` key

Status: accepted (ADR-0036)

## Problem
The G3 exit criterion says each extension point is used by at least one stdlib module (docs/ROADMAP.md). Freeze review §3 counted 0 of 6, because no stdlib package existed. Some registries had never been exercised by a package at all. The check registry's `fix` had never run, and the schema registry had only registered names. std.sessions (backlog 0092) also needs per-module config, `std: { '@keel/std-sessions': { redact } }`, which k.module did not allow.

## Proposal
- **Six packages, one extension point each.** Each package is minimal and real. Each has a `spec/std/` section, a conformance suite written from that section, and no `unsafe`.
  - `@keel/std-money` (std.money) uses the schema type registry. It registers `money.Money`, a closed `{ amount: int ±1e15 minor units, currency }`, and `money.Currency`. It also exports `addMoney` (returns a `Result`) and `formatMoney`.
  - `@keel/std-brands` (std.brands) uses the check rule registry. Its rule E2101 flags `s.id` and `ctx.random.id` brand literals that are not PascalCase, and its `fix` rewrites the literal.
  - `@keel/std-geo` (std.geo) uses the capability registry. It provides `geo(ctx).position()`. The real implementation uses `navigator.geolocation`. The shell implementation delegates to real. The sim implementation returns one seeded position.
  - `@keel/std-health` (std.health) uses the module manifest. It has a root `module.ts` (id `health`), a public `Health` export and public `routes`, and route `health.status` at `GET /health`.
  - `@keel/std-timings` (std.timings) uses inspector hooks. `time(ctx, name, fn)` records clock durations per ctx, and inspect section `timings.recent` serves them.
  - `@keel/std-report` (std.report) uses the output formatter registry. It registers the kind `report.tally`, with compact, pretty and json renderers, and exports `tallyOf(id, keys)`.
- **k.module `std` key.**
  - **Manifest.** `module({ ..., std: { '<@keel/std-x>': <literal JSON> } })`. `ModuleDef.std` is optional. `ModuleSchema` adds `std: s.record(s.json()).optional()`.
  - **Config schema.** A package that takes config registers its schema under its package name, `s.register('@keel/std-x', Config)`. This uses the schema type registry, so k.module gains no new registry.
  - **E1158** (k.module) is reported by the `keel check` module pass, statically from the literal manifest. It fires for a key that is not a `@keel/std-*` package in `deps`, a value that is not literal JSON, or a value that fails the registered schema (the message names the first issue's path and rule). It has no fix, because adding the dep or dropping the entry is the author's choice.
- **Tooling.**
  - `tooling/deps.json` appends the six packages after `ctx`, so no kernel package may import a stdlib package (S0003).
  - `tooling/budgets.mjs` measures `spec/std/*.md` against the 1,500-token section budget.

## Alternatives
- **A new primitive kind (`s.money()`) in the schema kernel.** The kernel `Node` union is closed, and every derivation walks it. A pluggable kind would be a new extension point with codec, generator, doc, JSON Schema and `decodeStrings` hooks. A registered composite is honest and needs no kernel change. A money "kind" that is a string would have been fake.
- **Validating `std` inside `module()`.** It would depend on import order, because the package must be imported before the manifest is evaluated (principle 2). `keel check` already loads stdlib rules the same way.
- **One rule per package for its own config.** This duplicates validation. The kernel pass gives every package the same E1158.
- **A `std` config consumer in wave 0.** std-sessions (0092) is the first real consumer. A wave-0 package that took config but ignored it at runtime would be fake.

## Spec diff
- **New sections.** `spec/std/std.{money,brands,geo,health,timings,report}.md` are each 457-710 tokens, with status `conformance-covered`. `spec/std/README.md` lists wave 0.
- **k.module.** It adds a `std` bullet, E1158 in Rules, and one Conformance clause appended at the end (697 -> 891 tokens).
- **Spec map.** Block `E210x | std.brands` and six stdlib rows are added (745 -> 890 tokens).

## Conformance diff
- **Added.**
  - `packages/std-*/conformance/**`: 39 tests, written by the conformance-writer from the sections.
  - `packages/check/conformance/module-E1158-std-config.test.ts`.
- **Edited** (rfc:0047).
  - `check/conformance/fixtures-by-code.ts` gains an E1158 bad/clean pair.
  - `check/conformance/fix-diffs.test.ts` lists E1158 under NO_FIX.

## Migration
None. `std` is optional. Manifests without `std` read as before, and a non-literal `std` makes the manifest opaque, as a non-literal list already does.

## Token impact
k.module +194, map +145, six std sections 3,272 in total, each under 1,500. No kernel section exceeds its budget.

## Follow-ups (kernel changes not made here)
1. **Loading stdlib packages for `keel check`.** The CLI does not import stdlib packages named in `deps`, so their rules and config schemas register only when something imports them (tests do this). k.check step 3 assumes they are loaded.
2. **Runtime access to `std` config.** A deployable has no runtime path to the `std` config of its modules. std-sessions `record` will need one, for example a compiler artifact `.keel/std.json` passed to `createApp`.
3. **Pluggable schema kinds.** These would be a separate extension point, if a stdlib type ever needs a primitive.
