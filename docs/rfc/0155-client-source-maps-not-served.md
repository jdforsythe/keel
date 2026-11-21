# RFC 0155: k.deploy: a `*.map` file under `assets/` is not served

Status: implemented (ADR-0177) under the RFC defaults (4: privacy by default; 6: kernel-level enforcement), for the orchestrator to confirm. For backlog 0569.

## Decisions
- D1: production `createApp({ assets })` neither reads nor serves a file under `assets/` whose name ends `.map`, at any depth. A GET of one is answered as any path the build does not hold.
- D2: the server enforces it, not `keel build`: `assets` may be any folder an operator points at, and a build step that strips maps would leave a hand-copied or hand-built folder exposed. `keel build` keeps whatever Vite writes.
- D3: `server.mjs.map` stays as it is: beside `server.mjs`, outside `assets/`, never served, read only for log frames (k.deploy Build).

## Problem
An app's Vite config may set `build.sourcemap`. Vite then writes `*.map` beside each client chunk under `dist/<name>/assets/`, each with `sourcesContent`, the full text of every client module. `loadAssets` reads every regular file under `assets/`, so each map is served (`application/json`, `no-cache`) to anyone. Client modules are public as built, but their sources are not: comments, unminified names and module paths go out with them, and k.deploy already refuses this for the server map. Repro: `packages/server/test/assetsSourceMap.test.ts` (an `it.fails` until the build: `loadAssets` keys `/assets/entry-Ab12Cd34.js.map` and a nested `.css.map`).

## Proposal
`packages/server/src/internal/loadAssets.ts`: the walk skips a file whose name ends `.map`; the `map` entry of its type table goes. A browser's developer tools then find no map: to debug a production client, a developer builds with maps and serves them by other means (a local preview), never from the app's server.

## Alternatives
- `keel build` refuses an app config that turns on `build.sourcemap`: it reaches into the app's Vite config and still leaves a folder built another way exposed.
- `keel build` deletes client maps after the build: the same gap for a folder built elsewhere, and an app that wants maps for an error tracker loses them before it can upload them.
- State the limit ("maps a Vite config turns on are served"): the server already guards its own map; privacy by default asks the same of the client's.

## Spec diff
k.deploy, Assets: "serves `/assets/*` and `/keel-mark.svg`" becomes "serves `/assets/*` but `*.map`, and `/keel-mark.svg`". The section is at 5,997 of 6,000 characters after this, so the conformance case below stays in this RFC and ADR-0177 rather than the section's Conformance list.

## Conformance diff
By the `conformance-writer`, under `rfc:0155` (k.deploy suites in `packages/server/conformance/`):
- `createApp({ assets })` on a client build holding `assets/entry-<hash>.js` and `assets/entry-<hash>.js.map` (with `sourcesContent`): `GET /assets/entry-<hash>.js` is 200; `GET /assets/entry-<hash>.js.map` is 404, and its body holds neither the map's `mappings` nor its `sourcesContent`.
- The same for a map one folder down (`assets/nested/x-<hash>.css.map`) and for one the manifest names in a chunk's `assets`.
- A HEAD of the map is 404 too; every other file of the build is still served `nosniff` as before.

## Migration
No app code changes. An app that served client maps from its own server for an error tracker uploads them at build time instead (the tracker's CLI over `dist/<name>/assets/`). The build commit flips `packages/server/test/assetsSourceMap.test.ts` from `it.fails` to `it` and updates the `@keel/server` README's assets sentence.

## Token impact
k.deploy +4 tokens, 5,997 of 6,000 characters.

## Build order
1. This commit: RFC, ADR, spec diff. 2. `conformance-writer`. 3. Build: `loadAssets` skips `*.map`; flip the repro; README.
