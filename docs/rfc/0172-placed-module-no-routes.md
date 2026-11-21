# RFC 0172: k.topology: a placed stdlib module with a contract and no routes is E1586

Status: implemented (ADR-0195). For backlog 0926.

## Decisions
- D1: E1586 (error, `keel check`, so `keel build` too) at a module id in `topology.ts` when that id is a stdlib module whose package's `./contract` export resolves and whose `./routes` export does not. "Resolves" is what the static readers already use (`stdExport` in `@keel/compiler`): the package is found from an app manifest's `deps`, the export is in its `exports` map, and the file it names exists inside the package.
- D2: a stdlib module with neither export is a module that serves no route (std-jobs, std-schedules, std-workflows, std-channels place runners or give schemas only) and stays silent. k.contract already says a module with no route has no contract, so `./contract` is the signal that routes were declared.
- D3: the diagnostic sits at the id's string in `topology.ts`, the one file that places a module (k.topology Declaration). It carries no fix: the package, not the app, is wrong. Message: `module "<id>": <package> exports ./contract and no ./routes`.
- D4: the code comes from the k.topology block (E155x in the map), the first free number past E1585; E157x and E159x are left to the privacy rules.
- D5: the app-module twin (`modules/<id>/<id>.contract.ts` with no `routes.ts`) is out of scope; see For the operator.

## Problem
k.topology Route table reads "a stdlib module's package `./routes` export (none: no routes)". `packages/compiler/src/internal/unreadModules.ts` follows it: a placed id that resolves to no app folder and no stdlib package is W1005, and its doc comment says "A stdlib module without `./routes` is not one". `routeLiterals.ts` then skips the module, and `createApp` gets a route table without it.

That is right for a module with no routes, and wrong for one that has them. std-health and std-sessions ship both `./contract` and `./routes` (`packages/std-*/package.json`, read on 2026-11-21). A published package whose `exports` loses `./routes`, or whose `./routes` names a `dist` file the publish left out, places cleanly, passes `keel check` and `keel build`, and serves 404 at every path its contract declares. A page linking to `health.href('health.status')` type-checks against the contract and links to nothing. Nothing reports it.

## Proposal
A `keel check` rule over each module id of each deployable in a readable `topology.ts`: if `stdExport(root, id, './contract')` resolves and `stdExport(root, id, './routes')` does not, report E1586 at the id.

```ts
// topology.ts
export default topology({
  web: { modules: ['shop', 'health'], adapter: 'node' },
})
// node_modules/@keel/std-health/package.json "exports" holds "./contract" and no "./routes":
// E1586 topology.ts:3:27 module "health": @keel/std-health exports ./contract and no ./routes
```

## Alternatives
- Report every placed module that resolves no routes: false for every runner-only stdlib module (D2).
- Fold it into W1005 as an unread module: W1005 is a warning about what a reader could not read; here the reader read everything and the package is missing a part, and a build that serves none of a contract's routes should stop.
- Throw in `createApp` when a contract has no binding: the route table it receives never names the contract, so it cannot know; and a check finds it before a deploy.

## Spec diff
- k.topology Rules, before "E1511 (k.api)": "E1586 a placed stdlib module whose `./contract` resolves and `./routes` does not (at its id) ·".
- k.topology Conformance, new bullet 10: "A placed stdlib module whose `./contract` export resolves and `./routes` does not is one E1586 at its `topology.ts` id in `keel check` and `keel build`; both or neither is none."
- To stay within 1,500 tokens, wording only: the Build pointer paragraph goes (k.deploy owns it and the Declaration already names it); Declaration's cross-references and "Each module is in one deployable, where its routes … run; moving one edits `topology.ts` alone"; Calls' `service` and `KEEL_SECRET` sentences shortened (k.deploy states the shared secret); the loop-guard parenthesis, the E1558 tail ("a top-level function or `const`") and Local topology's storage parenthesis reworded. No Conformance bullet and no sentence a conformance header quotes changes.
- k.topology status `proposed` (section and map row) until the build lands.

## Conformance diff
By the `conformance-writer`, under `rfc:0172`: `packages/check/conformance/E1586-placed-module-no-routes.test.ts` (new), from bullet 10, with fixture packages under a temp project's `node_modules/@keel/std-<x>/` (a root `module.ts` with the id, a `package.json` `exports` map): `./contract` alone; `./contract` and a `./routes` naming a missing file; both (none); neither (none). Each case through `check()` and the `keel build` command (exit 1, nothing written, for the first two).

## Token impact
k.topology 1,498 to 1,499 tokens; 10 Conformance clauses. Map 1,333 with RFC 0171's row (status word). One code, E1586.

## Build order
1. This commit. 2. `conformance-writer`. 3. Build: the rule in `packages/check` (beside the `topology.ts` pass, using `stdExport` through `@keel/compiler/internal`), its `keel explain` entry, the `unreadModules.ts` comment, `tooling/ledger/ledger.json`, k.topology back to `conformance-covered`.

## For the operator
- An app module with `modules/<id>/<id>.contract.ts` and no `routes.ts` is silent too (no app has one today). Recommendation: a backlog line for the same rule over app modules, with no placement condition; it was left out to keep this change to the finding.
- A placed stdlib package with `./routes` and no `./contract` is not covered here: `routeLiterals` already names its unread contract (W1005).
