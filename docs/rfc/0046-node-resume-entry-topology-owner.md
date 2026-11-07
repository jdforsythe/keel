# RFC 0046: node documents load a resume entry that exists; one owner for `Topology` and `StyleUsage`

Status: accepted (ADR-0035)

## Problem
- **Backlog 0111.** RFC 0037 made a document with an island carry `<script type="module" src="/@keel/entry.ts">`. Only the Vite plugin generated that URL, and only for a `client` deployable (the `mount` entry). For any other deployable it threw. A node `createApp` did not answer it either: the path fell through to the route table and got 404. So a node document with an island loaded a script that did not exist, and nothing called `resume`.
- **Backlog 0065, freeze review §2 row 13.** `Topology` was defined twice (`server/src/types/Topology.ts`, `compiler/src/types/Topology.ts`), and so was `StyleUsage` (`compiler/src/types/StyleUsage.ts`, `ui/src/types/StyleUsage.ts`). `@keel/server` exported `TopologySchema`, whose `parse` accepts a deployable with no modules, which `topology()` rejects.

## Proposal
1. **The resume entry (compiler).** `@keel/compiler/entry/RESUME_ENTRY` is the generated entry of a server-rendered deployable. It is app-independent: it imports `components` from `/@keel/islands.ts` and calls `resume(document.body, components, { ctx: createCtx({ mode: 'real' }), stores: Object.fromEntries(stores()) })`. `ENTRY_PATH` (`/@keel/entry.ts`) and `ISLANDS_PATH` (`/@keel/islands.ts`) sit next to it under the same subpath.
2. **The island map (Vite plugin).** `/@keel/islands.ts` exports `components`, mapping each route id to its component. It is built statically and best effort, like island marking. In each of the deployable's `modules/<m>/routes.ts`, a `manifest({...})` entry with a literal id whose `component` is an imported identifier contributes that import. Relative specifiers become root-relative. The output is sorted by id. `routes.ts` itself is never imported into the browser, so `*.server.ts` loaders stay off the client (E1004's node exemption still holds). Anything the scan misses stays static at resume, with the existing E1253 warning.
3. **Entry selection (Vite plugin).** `/@keel/entry.ts` is served for the deployable that `KEEL_DEPLOYABLE` names, else the first `client` one by name. A `client` deployable gets the `mount` entry, as before. A `node` or `static` deployable now gets `RESUME_ENTRY` instead of an error. In dev the Vite server serves it. In production, `vite build` with `KEEL_DEPLOYABLE=<node deployable>` bundles it as that deployable's client output.
4. **createApp serves it.** In the request flow, after the same-site check and before route matching, a GET or HEAD of `/@keel/entry.ts` returns 200 `text/javascript` with `RESUME_ENTRY` (`servedEntry`). The document and the server therefore agree on one URL in every process, including in-process tests. The served text is the same as Vite's. Its bare specifiers and `/@keel/islands.ts` are resolved by Vite, either the dev server in front or the build.
5. **One owner for each type.** `@keel/compiler` comes earliest in `tooling/deps.json` among compiler, ui, and server, so it defines `Topology` and `StyleUsage`.
   - `@keel/server` imports `Topology` and re-exports the type.
   - `TopologySchema` moves to `server/src/internal/` and is no longer exported. `topology()` remains the only validator.
   - `@keel/ui` takes on a dependency on `@keel/compiler` (type only). `compileStyles` imports `StyleUsage` from it, and `@keel/ui/css` re-exports it.
   - The duplicate files are deleted. `StyleUsage.props` widens from `Partial<Record<StyleProp, string>>` to `Record<string, string>`, the compiler's shape. `compileStyles` already reads only the vocabulary's props.

## Alternatives
- **Import each module's `routes.ts` in the entry (as the `mount` entry does).** This ships `*.server.ts` loaders and actions to the browser for a node deployable and contradicts E1004's exemption rationale.
- **createApp bundles the entry.** This would put a bundler in the server process. Vite already owns bundling.
- **A `component` field in `routes.json`.** This is a k.router artifact change. The scan needs only the source of `routes.ts`.
- **Serve the entry only for `node` deployables.** createApp renders islands for any adapter it serves, so the URL must exist whenever the script tag can appear.
- **`ui` owns `StyleUsage`.** The compiler produces `styles.json` and cannot import ui, which comes later in deps order.

## Spec diff
- **k.server Topology.** `node` gains "serves the resume entry, k.runtime". "golden app 1 uses it" is dropped from `client` to keep the section under 1,500 tokens.
- **k.runtime Islands.** The entry bullet defines the resume entry: it is served by `createApp`, resolved by Vite, and imports `components` from `/@keel/islands.ts`, which is generated statically from the deployable's `routes.ts` files and passed to `resume(document.body, components, { ctx, stores })`.
- **k.runtime Conformance.** One clause is added: "A `createApp` document with an island loads a module script whose URL answers 200 JavaScript that calls `resume`."

## Conformance diff
Added `packages/server/conformance/resume-entry.test.ts` (k.runtime, written by conformance-writer). It covers:
- the module script URL of a node island document answers 200 `javascript` that imports `resume` from `@keel/runtime-dom/ops`, calls it, and references `/@keel/islands.ts`;
- HEAD answers 200 with an empty body;
- dev mode behaves the same;
- a page with no islands has no script;
- a property over generated sets of node modules (seed 1337).

None removed. Unit tests: `compiler/test/islands.test.ts` covers the scan (cases plus a property, seed 1337) and the plugin's node entry and island map. The vite tests now expect the resume entry for a node `KEEL_DEPLOYABLE`.

## Migration
- `import { TopologySchema } from '@keel/server'` is removed. Use `topology()`.
- `import type { Topology } from '@keel/server'` still works.
- `StyleUsage` from `@keel/ui/css` is the compiler's type, with wider `props`.
- `KEEL_DEPLOYABLE=<node>` no longer throws at `/@keel/entry.ts`.

## Follow-ups
- A production node deployable must serve Vite's client build output (hashed assets) and point the script at it. Node static-asset serving is not specified.
- The island map lists every route component that is imported, not only island ones. Narrowing it to files that have `data-k` would shrink the client bundle.

## Token impact
k.server +3 tokens (1,497). k.runtime +129 (1,476).
