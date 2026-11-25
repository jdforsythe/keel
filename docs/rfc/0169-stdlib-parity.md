# RFC 0169: k.parity: the stdlib holds no power a library lacks

Status: proposed (ADR-0191), for the operator to confirm. For decision D67 item 3 (with D49, D54, D57) and RFC 0163's D8 and its first question to the operator.

## Decisions
- D1: no `@keel/std-*` package's shipped code imports a kernel `internal` entry, but for one stated exception: `@keel/std-capacitor` and `@keel/std-tauri` import `mountRequests` from `@keel/router/internal` while the shell set is closed (D54).
- D2: `secretPathOf` becomes public as `secretPath(schema)` in `@keel/schema` (route D). `sampleFormat` is public in `@keel/schema`, beside `secretPath` (route D, D68). `findRouter` and `report` leave the stdlib with no new kernel surface (route C): `TableSearch` calls the public `navigate` inside its own `owner()` scope and reads its clock from `ctx`; std-sessions writes the E2003 error into its own recorder.
- D3: where the kernel gates a power on the name `@keel/std-*`, the gate becomes the package's kind (k.library's `"keel": "library"`, which the stdlib carries under RFC 0163 D8). Three closed sets stay named: shells, topology storage and the CLI command slots.
- D4: `tooling/structure-lint.mjs` enforces it in this repository from data in `tooling/deps.json`: S0012 (a stdlib file names a kernel `internal` entry not listed) and S0013 (kernel code names `@keel/std-` in a file not listed). In an app, E1576 holds over a library's files, the stdlib's included, with the shell exception as its one allowance.
- D5: a new section k.parity states the rule, the public forms, the by-kind reading and the exceptions. The full sections it touches (k.schema, k.module, k.reactive, std.tables) carry no new text; k.parity holds it.

## Problem
App and library code may not import a kernel `internal` entry (E1576, k.security). The stdlib does, eight times, for five functions (`grep -rnE "@keel/[a-z-]+/internal" packages/std-*/src`):

| function | from | callers |
|-|-|-|
| `secretPathOf(node)` | `@keel/schema/internal` | std-channels `channel.ts:13`, std-jobs `queue.ts:13`, std-offline `outbox.ts:43` |
| `sampleFormat(node, sample)` | `@keel/schema/internal` | std-sessions `internal/fake.ts:39` |
| `report(ctx, event)` | `@keel/ctx/internal` | std-sessions `internal/reportUnapplied.ts:9` |
| `findRouter()` | `@keel/router/internal` | std-tables `TableSearch.component.ts:28` |
| `mountRequests(ctx, shell)` | `@keel/router/internal` | std-capacitor and std-tauri `shellMount.ts` |

What each does, from the code:
- `secretPathOf` walks a schema node and returns the dotted object-key path of the first `secret` node (`""` at the root), null when none; array items, record values and union members add no segment. Each caller throws its own code when a schema holds a secret: E2602 (a channel message), E2503 (a job input), E2651 (an outbox endpoint body). `@keel/store`'s `secretGuard` uses it too (E1303). `hasSecret` (internal) answers only yes or no; `piiPaths` reads `.pii()` marks, not secrets. No public query answers the question.
- `sampleFormat` builds one encoded value of a format node without fast-check: it gives the format's `gen.from` node to `sample`, maps the result through `gen.map`, and keeps it when `check` accepts. The format's `gen` lives in a private table of `@keel/schema` (`formats`), so nothing outside the package can do this. Its one caller, `fake`, makes the placeholder for a redacted value; it runs in the browser, inside `record` (std.sessions), which is why it cannot use `@keel/schema/gen` (fast-check).
- `report` delivers a ctx event to every observer and keeps `nav` and `error` events for later observers. std-sessions uses it for one thing: when a replayed input cannot apply, it reports an E2003 `error` on the replay ctx, so the replay's own recorder records it and the fingerprint differs (std.sessions). Both callers (`replayRun.ts:70`, `group/internal/userRealm.ts:190`) hold that recorder already.
- `findRouter` returns the router whose `App` encloses the running scope, else the only mounted one. `TableSearch` takes the router's `ctx` when it was given none, and calls `router.navigate(href, { replace: true })` from a debounced timer. The public `navigate` (k.router Client) is `findRouter()?.navigate(...)`, but called from a timer it runs outside every scope, so it would find the router only when exactly one is mounted.
- `mountRequests` is the router's intake for a shell: it routes navigations under the identity mount through `ctx.net`, opens the external browser and takes launch and return links (k.return, k.links). Only a shell package drives it.

The same privilege by other routes (a survey of `packages/*/src` and `tooling/`):
1. E1576 exempts every file under `packages/`, `node_modules/` and `.keel/` (`noInternalEntry.ts:10`), so any installed package may import an internal entry unchecked. RFC 0163 D4 makes a library's files app code, which ends this.
2. E1822 (`ariaImport.ts:8`): `@keel/ui/aria` only under those roots. RFC 0159 opens `Part` and retires E1822.
3. `importDeps.ts:11`: `keel check`, `keel build` and the Vite plugin import a dependency's `./tools` only when its name matches `@keel/std-*`. Name.
4. E1158 (`stdConfig.ts:23`, `stdArtifact.ts:43`): only a `@keel/std-*` dependency takes a manifest `std` config. Name.
5. `discoverModules.ts:6`, `resolveImport.ts:6`: only `node_modules/@keel/std-*/module.ts` joins the module graph. Name.
6. `stdRoutes.ts:6`: only a `@keel/std-*` dependency supplies a placed module's route table through `./routes`. Name.
7. `noEagerElement.ts:206`: any capitalized `@keel/std-*` export is taken as a component without being followed. Name.
8. `schemaMarks.ts:11`: E1111 reads `tableSearch` from `@keel/std-tables` as the package's own schema; any other factory call is E1111. Name.
9. `topologyNeeds.ts:7`, `entryCode.ts:19`, `serverEntryCode.ts:51`, `shellBuild.ts:59`: `storage` `sqlite` and `postgres` need `@keel/std-db`, shells `@keel/std-capacitor` and `@keel/std-tauri`; the generated entries import them by name. Name.
10. `stdCommand.ts:9`: `keel session` and `keel report` are slots any package may fill once; no other command can be added. No name gate; a closed set.
11. E1106 (k.schema): "format types are stdlib's". `isAppPath` exempts `node_modules/`, so an installed library may declare one today, and under RFC 0163 D4 it may not.
12. E1207 (`noDetachedScope.ts:12`): a detached scope only under `packages/`; std-conflicts, std-offline, std-sessions and std-statecharts create one. Path; under RFC 0163 D4 the stdlib's four become E1207 in an app.
13. `@keel/compiler/std/*` and `@keel/compiler/inspect/*` are wildcard exports. The stdlib imports `stdConfig`, `clientStd` and `inspector` (specified) and `bindStd`, `INSPECT_PATH` and `LOOPBACK` (not specified). No gate; an unpromised surface.
14. std-schedules and std-workflows import `@keel/std-jobs/tools/internal` (10 times) and `@keel/std-statecharts/tools/internal` (2): check-rule helpers over `@keel/check`'s public types and `oxc-parser`. No kernel power.
15. E1753 (`defineRule.ts:10`): a registered rule takes an E2xxx or W2xxx code, any package's. No gate.
16. Path readings that treat any package alike: `isAppPath`, `noUnsafeSyntax`, the compiler's and `keel check`'s `node_modules` skip, `appFrames.ts:25` (log frames). E1551 reads app files only; E2151 is std-db's own rule. No privilege.

No stdlib package has an `unsafe/` reach-in (std-brands' `unsafe/` holds only `.gitkeep`) and none imports a kernel package by a relative path.

## Proposal

### The five functions

**`secretPathOf`: route D.** A library that stores, sends or broadcasts a value it validates with an app's schema needs to refuse a secret and say where it sits, as the three stdlib callers do. `@keel/schema` gains, beside `piiPaths`:
```ts
// packages/schema/src/secretPath.ts
import type { Schema } from "./Schema.ts";
import { secretPathOf } from "./internal/secretPathOf.ts";

/** The dotted object-key path of the first `s.secret` node in `schema` (`""` at the root), null when none (k.parity). */
export function secretPath(schema: Schema<unknown, boolean>): string | null {
  return secretPathOf(schema.node);
}
```
`secretPathOf` leaves `@keel/schema/internal`'s index (the file stays, the public function's body); `@keel/store`'s `secretGuard` calls `secretPath(schema)`. Stated in k.parity Entries.

Before and after, std-jobs `queue.ts` (std-channels and std-offline change the same way: `secretPath(opts.message)`, `secretPath(e.body)`):
```ts
// before
import { secretPathOf } from "@keel/schema/internal";
const at = secretPathOf(j.input.node);
// after
import { secretPath } from "@keel/schema";
const at = secretPath(j.input);
```
`j.input`, `opts.message` and `e.body` are `Schema` values already (`.node` is read off them today), and `Schema<M>` is assignable to `Schema<unknown, boolean>`, as `piiPaths(schema)` is called with app schemas.

**`sampleFormat`: route D, in `@keel/schema` (D68).** A library that fakes or redacts values in the browser needs a valid value of a format type it did not declare, and the format's `gen` is private to `@keel/schema`. Its one caller, std-sessions' `fake.ts`, runs in the browser, and a runtime package must not depend on the test harness, so the function is public in `@keel/schema`, which owns the table it reads:
```ts
// packages/schema/src/sampleFormat.ts, exported from the root of @keel/schema
import type { JsonValue, Schema } from "./Schema";
import { formats } from "./internal/formats";
import { toJson } from "./internal/toJson";

type SchemaNode = Schema<unknown, boolean>["node"];

/**
 * An encoded value of format node `node` without fast-check (k.formats): `sample` gives an encoded value of the
 * format's `from`, which its `map` turns into a candidate. Undefined when `node` is no in-memory format or `check`
 * refuses the candidate.
 */
export function sampleFormat(node: SchemaNode, sample: (from: SchemaNode) => JsonValue): JsonValue | undefined {
  const impl = node.kind === "format" ? formats.get(node) : undefined;
  if (impl === undefined) return undefined;
  const candidate = impl.map(sample(impl.from));
  return impl.test(candidate) ? toJson(node, candidate) : undefined;
}
```
The module reads `formats` and `toJson` from the package's own files. The node type is named as `Schema<unknown, boolean>["node"]`, the public spelling std-sessions already uses (`TypeNode`). Stated in k.formats Format types.

std-sessions `internal/fake.ts`:
```ts
// before
import { sampleFormat } from "@keel/schema/internal";
// after
import { sampleFormat } from "@keel/schema";
// the call is unchanged:
//   case "format": return sampleFormat(node, (from) => fake(from, rand)) ?? fake(node.base, rand);
```
std.sessions says its root imports no harness; `@keel/schema` is not one.

**`report`: route C.** The error is the recorder's own fact (std.sessions: "an input it cannot apply is E2003, so the fingerprint differs"), and std-sessions owns the recorder. `Live` (internal to std-sessions) gains `note(event: CtxEvent): void`, the recorder's observer function (`recording.ts` `onEvent`; `inert.ts` a no-op), and `reportUnapplied` writes to it:
```ts
// before: packages/std-sessions/src/internal/reportUnapplied.ts
import type { Ctx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
export function reportUnapplied(ctx: Ctx, index: number): void {
  report(ctx, {
    kind: "error",
    error: { code: "E2003", message: `cannot apply input ${index}`, data: { at: "sessions.replay" } },
  });
}
// after
import type { Ctx } from "@keel/ctx";
import { actives } from "./actives.ts";
export function reportUnapplied(ctx: Ctx, index: number): void {
  actives.get(ctx)?.note({
    kind: "error",
    error: { code: "E2003", message: `cannot apply input ${index}`, data: { at: "sessions.replay" } },
  });
}
```
Both callers pass the ctx their recorder was started on (`record(ctx, ...)` in `replayRun.ts`; `record(c, ...)` on `simCtx()` in `userRealm.ts`), so the event lands where it did. What changes: another observer of the replay ctx no longer sees the E2003 event. None exists: the replay ctx is made inside `replay` and given to no one. A library that writes its own recorder has the same power, an observer it owns. No public `report`: an event on a ctx is the kernel's account of what happened (a navigation, an input, a caught error), and an open `report` would let any package forge one into every recorder and the inspector. A library's failure reaches observers as the stdlib's do: an `err` from its loader or action, or a throw a `Boundary` catches.

**`findRouter`: route C.** A component can already set the URL's search through the public `navigate`, and reads it from its `search` prop. Two things differ: the timer runs outside every scope, and the clock came from the router when no `ctx` was passed. `owner()` gives the component's scope, and `Scope.run` runs a function with it as owner, so `navigate`, whose `findRouter()` runs synchronously before its first `await`, finds the enclosing router. The clock comes from `ctx` only, as `Toaster`'s does: k.component says the runtime passes `ctx` from the mount and the harness from `render`.
```ts
// before (TableSearch.component.ts, the parts that change)
import { findRouter } from "@keel/router/internal";
const router = findRouter();
const clock = (ctx ?? router?.ctx)?.clock;
const timer =
  router === null || clock === undefined
    ? undefined
    : debounced(clock, () => props.delay ?? 300, () => {
        sent = q.slice(0, Q_MAX);
        void router.navigate(props.href(withQuery(props.search, sent)), { replace: true });
      });
owner()?.onDispose(() => timer?.cancel());

// after
import { type Href, navigate } from "@keel/router";
const at = owner();
const clock = ctx?.clock;
const timer =
  clock === undefined
    ? undefined
    : debounced(clock, () => props.delay ?? 300, () => {
        sent = q.slice(0, Q_MAX);
        const go = (): Promise<void> => navigate(props.href(withQuery(props.search, sent)), { replace: true });
        void (at === undefined ? go() : at.run(go));
      });
at?.onDispose(() => timer?.cancel());
```
`at.run` cannot meet a disposed scope (E1206): the same scope's dispose cancels the timer first. With no router mounted `navigate` does nothing, as the old `router === null` branch did. The std.tables conformance fixtures call `TableSearch` without `ctx` (`fixtures.ts:143`, `resume-datatable-routes.ts:113`); they pass the route component's third argument through (`component: (props, _s, ctx) => ... TableSearch({...}, undefined, ctx)`). Stated in k.parity Entries; std.tables is full.

**`mountRequests`: the stated exception.** It stays internal while the shell set is closed for 1.0 (D54): a public form would be the shell driver contract, which RFC 0161 keeps in the kernel with `shells` as `capacitor | tauri`. Opening the set later makes it public, additively. Stated in k.parity Exceptions.

### Every other privilege
| # | privilege | route |
|-|-|-|
| 1 | E1576 exempts `node_modules/` | removed by RFC 0163 D4; E1576 keeps one allowance over library files, the shell exception, by package name and specifier |
| 2 | E1822 `@keel/ui/aria` | removed by RFC 0159 |
| 3-6 | `./tools`, `std` config (E1158), module discovery, `./routes` gated on `@keel/std-*` | general: gated on the package's kind (`"keel": "library"`); the stdlib passes as a library (RFC 0163 D8). The manifest key stays `std`. |
| 7 | `noEagerElement` takes a capitalized std export as a component | removed: a library's source is read (RFC 0163 D4), so the rule follows the stdlib's export as it follows any |
| 8 | E1111 reads `tableSearch` as the package's | general: a schema a package export returns is the package's, as its exported route tables already are; the package guards it (std-tables throws E2852) |
| 9 | storage and shells name std-db, std-capacitor, std-tauri | stated exception: closed topology sets for 1.0 |
| 10 | `keel session`, `keel report` slots | stated exception: the command set is k.cli's; a package adds rules and formatters, no command |
| 11 | E1106 format types are the stdlib's | general: E1106 reads a library's files as a package's; a library may declare format types |
| 12 | E1207 detached scope under `packages/` | general: a detached scope in a stdlib package or a library lives under its `unsafe/` with a justification, counted in the ledger and the library manifest; the four stdlib sites move there |
| 13 | unspecified `@keel/compiler/std/*` and `inspect/*` files | general: the six files the stdlib imports are named public in k.parity (`bindStd`, `INSPECT_PATH`, `LOOPBACK` added) |
| 14 | stdlib to stdlib `internal` entries | no privilege: a package family shares its own internal entries, as `@acme/a` may import `@acme/b/internal`; S0012 and E1576's library reading allow `@keel/std-*` to `@keel/std-*` |
| 15 | E1753 code range | no gate; the range question is the operator's (below) |
| 16 | path readings, E1551, E2151 | no privilege |

### The rule that keeps it true
`tooling/deps.json` gains two keys beside `order`:
```json
"internal": { "std-capacitor": ["@keel/router/internal"], "std-tauri": ["@keel/router/internal"] },
"names": [
  "packages/check/src/internal/topologyNeeds.ts",
  "packages/check/src/internal/EXPLANATIONS.ts",
  "packages/cli/src/internal/shellTargets.ts",
  "packages/compiler/src/internal/entryCode.ts",
  "packages/compiler/src/internal/serverEntryCode.ts"
]
```
`tooling/structure-lint.mjs`, beside S0003, which already parses these import forms:
- S0012: a file in `packages/std-*/{src,unsafe}/` names `@keel/<k>/...` with an `internal` path segment, `<k>` a kernel package (in `order`, not `std-*`), in an import, re-export, `import()` or `require()`, and `internal[<pkg>]` does not list that specifier. Message: `<pkg> may not import <spec>: the stdlib holds no power a library lacks (k.parity)`.
- S0013: code outside comments in `packages/<kernel>/src/` names `@keel/std-` in a file `names` does not list. Build B sets `names` to the files that still name a package after the kind gates land, each one a stated exception's; the list above is the floor. The kernel sites that name `@keel/std-postgres` (the deploy files, the server build's PGlite files, `registersCapability`) name it no more once k.server-deps is built (RFC 0163 slice 4b), so none joins the list; the shell scaffold's `packages/scaffold/src/internal/shellManifest.ts` joins it if its code, not only its comments, names a shell package. `EXPLANATIONS.ts` is listed because its text names the stdlib package that fixes a diagnostic, which is advice, not a gate.

In an app, `keel check` holds it through E1576 over library files (RFC 0163 D4) with the shell allowance, so an installed stdlib package is held to the same line. `keel check` cannot see kernel code, so S0013 has no app-side twin; it guards this repository.

## Alternatives
- Make all five public. `report` would let any package forge ctx events; `findRouter` would export `RouterCore`, whose `submit` and `accepts` are `Form`'s seam; `mountRequests` is the shell driver contract D54 keeps closed.
- Keep a named list of stdlib packages in E1576 (RFC 0163's first question, its second option). The stdlib then holds powers by name, which D49 refuses.
- `findRouter` as a public `currentRouter()`: a new name for what `owner().run` and `navigate` already give.
- `sampleFormat` in a `@keel/testing/sample` entry. A runtime package would depend on the test harness for a function its browser code calls.
- E1207 by kind, like E1106: a library would then make a detached scope that no count shows. A detached scope escapes `uses` and the request store registry, so it is the kind of power `unsafe/` exists to count.

## Spec diff
- New section `spec/kernel/k.parity.md` (proposed), owner `@keel/cli` in `tooling/docs-owners.json`: Entries, By kind, Exceptions, Rules, Conformance.
- k.formats, Format types: `sampleFormat(node, sample)` (public in `@keel/schema`).
- std.sessions, API: "the root imports no `@keel/testing`" becomes "the root imports no harness".
- Map: row `k.parity | Stdlib parity | proposed | seams`.
- k.schema, k.module, k.reactive, std.tables and k.security are at or near their limits; k.parity states their changes. The build updates their text where a section has room after the build of RFC 0163: k.module's Std config reads "library" for "`@keel/std-*`" (E1158 included), k.reactive's E1207 line reads "a package's `unsafe/`", k.schema's E1106 reads "a package's".

## Conformance diff
By the `conformance-writer`, under `rfc:0169`:
- k.parity's five bullets: `secretPath` in `packages/schema/conformance/`, `sampleFormat` in `packages/schema/conformance/`, `TableSearch` in `packages/std-tables/conformance/`, the replay in `packages/std-sessions/conformance/`. The S0012 and S0013 bullet is tooling: `tooling/test/structure-lint.test.mjs` by the build lane.
- std.tables: `fixtures.ts` and `resume-datatable-routes.ts` pass the route component's `ctx` to `TableSearch`. The quoted clauses are unchanged.
- std.channels, std.jobs, std.offline: the existing E2602, E2503 and E2651 cases stand as they are; they cover the callers of `secretPath`.

## What it costs
- k.parity 1,081 tokens of 1,500; k.formats grows one sentence; std.sessions shrinks; map one row.
- `@keel/schema` gains two exports, `secretPath` (a delegate) and `sampleFormat`. Sizes are measured at the build and re-based where they move (D65).
- `unsafe` count: the four stdlib detached-scope sites move under `unsafe/`, each with a justification (the count rises by four, justified).

## Build order
1. This commit: RFC, ADR, k.parity, the k.formats and std.sessions sentences.
2. `conformance-writer`: the bullets above.
3. Build A (now): `secretPath` and the store and three stdlib callers; `sampleFormat` in `@keel/schema` and `fake.ts`; `Live.note` and `reportUnapplied`; `TableSearch`; `deps.json` `internal` and S0012. The `@keel/schema/internal` and `@keel/router/internal` header comments drop their stdlib readers.
4. Build B (RFC 0163's Build order, slice 5): the name gates of items 3 to 8 and 11 become kind gates; E1207's stdlib sites move to `unsafe/`; `deps.json` `names` and S0013; E1576's shell allowance over library files; the section text of Spec diff's last bullet.

## Decided
- `sampleFormat` is public in `@keel/schema` (D68), not in `@keel/testing`.
- E1106 and E1207 read a library's files as a package's.
- E1111 trusts a schema that a package's export returns.
- A rule-code range for libraries is recorded in `tasks/FUTURE.md`.
