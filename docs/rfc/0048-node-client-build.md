# RFC 0048: a production node deployable serves its built client

Status: implemented (ADR-0037)

## Problem
- **Backlog 0116.** RFC 0046 gave node documents with islands a module script, `/@keel/entry.ts`, and made `createApp` answer it. The answer is the entry's source text, with bare specifiers (`@keel/runtime-dom/ops`) and `/@keel/islands.ts`. Only a Vite dev server in front can resolve them. Run with `node server.ts` in production, the browser cannot load that script, so `resume` never runs.
- `keel build` ran `vite build` once, which builds the first `client` deployable. Nothing built a node deployable's client code. Node static-asset serving was not specified.
- The S3 work (generated Docker and CI) needs a production node deployable that runs on its own.

## Proposal
1. **Build output (compiler, Vite plugin).** When a `vite build` runs with a `KEEL_DEPLOYABLE` that names a `node` deployable, the plugin's `config` hook sets four options:
   - `outDir: dist/<name>` (emptied);
   - input `{ entry: '/@keel/entry.ts' }`, which is the resume entry with its island modules;
   - `manifest: .vite/manifest.json` (`@keel/compiler/entry/CLIENT_MANIFEST`);
   - Vite's hashed names under `assets/`.

   That build writes no `.keel/` artifacts, because the project's own build writes them. Every other run keeps the project's Vite config unchanged.
2. **`keel build` (cli).** After a green engine build, the binary runs Vite once per entry of `viteTargets(topology.ts)`, in order:
   - the project's own `vite build`, unless every deployable is `node`;
   - then one run per `node` deployable, sorted by name, with `KEEL_DEPLOYABLE=<name>`. These come after the project's own build, which empties `dist/`.

   The first failing run prints its tail and exits 1. `topology.ts` is the only input, so there is no second configuration surface.
3. **Serving (server).** `createApp({ assets })` takes `assets`, the deployable's build directory (`dist/<name>`).
   - **Startup.** In `production`, `loadAssets` reads it once. It finds the manifest's `isEntry` chunk (the manifest key of a virtual entry depends on the machine, so it is not used) and every file under `assets/`, plus the entry file, keyed by URL path.
   - **Errors.** A missing or non-JSON manifest, one with no entry chunk, or an entry file that is not on disk rejects `createApp` with E1555.
   - **Documents.** A document with islands points its module script at `/<entry file>`.
   - **Requests.** GET or HEAD of a loaded file answers 200 with its content type and `cache-control: public, max-age=31536000, immutable`. The names are hashed, so the content never changes under a URL. Unknown paths and `/@keel/entry.ts` fall through to the route table (404).
   - **Dev, or no `assets`.** In `dev`, `assets` is ignored. Without `assets`, the RFC 0046 behaviour is unchanged: `/@keel/entry.ts` is served for Vite to resolve.
4. **golden-1.** `build` is `keel build`, which writes `dist/` (web) and `dist/api/` (api). `server.ts` passes `assets: <app>/dist/api`, so `NODE_ENV=production node apps/golden-1/server.ts` needs a `pnpm build` first.

## Alternatives
- **Bundle the server entry too (Vite SSR, `dist/<name>/server.js`).** The server entry would then need a different path to its client build in a source run and in a bundle run. Node 24 already runs the TypeScript entry directly. This is deferred to S3, where the image layout fixes both paths.
- **Require `assets` in every production `createApp`.** This breaks in-process production tests and node apps whose pages have no islands, for no gain.
- **Serve any file under `dist/<name>` from disk per request.** Reading the files once at startup removes path traversal and per-request filesystem work. Built assets are small.
- **A `build` section in `topology.ts`, or a second Vite config per deployable.** Either is a second configuration surface. `KEEL_DEPLOYABLE` plus the adapter decide everything.
- **`/@keel/entry.ts` rewritten to the built file.** The document then names a URL that Vite does not emit, and caching cannot be immutable.

## Spec diff
- **k.server.** A new **Build** paragraph covers the output layout, `createApp({ assets })`, immutable `/assets/*`, and dev or no-`assets` behaviour.
- **k.server Rules.** `E1555 production assets without a manifest entry (createApp rejects)`.
- **k.server Conformance.** "`createApp({ assets })` on a `keel build` node fixture scripts a 200 JavaScript `resume` entry, `immutable`; no manifest: E1555."
- **Trims (no change in meaning), to stay within 1,500 tokens:**
  - The Topology code block is inlined.
  - The `client` adapter and Dev server wording is tightened.
  - The `Both live in *.server.ts` bullet is dropped (E1551 states it).
  - The `orders` example is compacted.
- **k.check Codes.** E1555 joins the codes produced at runtime.

## Conformance diff
- **Added `packages/server/conformance/build-assets.test.ts`** (k.server, written by conformance-writer). It builds a tiny node fixture in the OS tmpdir through `node packages/cli/src/bin.ts build` and serves it in process with `createApp({ assets })`. It covers:
  - the script is under `/assets/` and answers 200 `javascript` with `resume`, `immutable`;
  - HEAD answers 200 with an empty body;
  - an empty directory rejects with E1555;
  - dev ignores `assets`.
- **`packages/check/conformance/fixture-per-code.test.ts`.** E1555 is explain-only (runtime).
- **Unit tests:**
  - `server/test/assets.test.ts`;
  - `compiler/test/clientBuild.test.ts`;
  - `cli/test/viteTargets.test.ts`;
  - the `viteRun` and `bin` cases for `KEEL_DEPLOYABLE`.

## Migration
- **Production node servers.** Run `keel build` and pass `assets: 'dist/<deployable>'` to `createApp`.
- **`keel build` on an all-node topology.** The project's own `vite build` no longer runs. It had nothing to build.

## Follow-ups
- **The server bundle and the generated server entry (S3, Docker).**
- **Built CSS.** Link the entry chunk's `css` from the document when islands import styles.

## Token impact
k.server 1,495 to 1,500 (Build +93, rule +18, clause +35, offset by trims). k.check +2. k.cli is unchanged (`build` already reads "production build per deployable (k.server)").
