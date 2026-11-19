# ADR-0119: production frames through `server.mjs.map`, the frame root from `artifacts`, E1558 reports unreadable calls (RFC 0096)

**Status:** accepted

**Context.** A production `diag`'s `frames` name positions in `server.mjs`, kernel frames included, because `keel build` bundles the server with no source map and frames are made relative to the working directory, which holds the bundle. `caught` reads `process.cwd()` for that root, a hidden global. E1558's static read passes a generator held in a `const`, calls through `import * as`, and options built by a spread or a helper, so those reach `createApp` before anything fails.

**Decision.**
- D1: `keel build` writes `dist/<name>/server.mjs.map` beside `server.mjs`: sources relative to the project (one outside it: `../`), no `sourcesContent`. `@keel/server` maps a frame in `<artifacts>/server.mjs` through it with Node's `SourceMap`, decoded on the first throw that needs it and kept. The map is never served. Stated in k.deploy Build and k.server Log.
- D2: frames are relative to the folder holding `createApp({ artifacts })`; without `artifacts` they are `[]`. No new `createApp` option; `process.cwd()` leaves the server.
- D3: `serverOnlyCalls` reads top-level `const` generators and namespace calls, and reports a `loader` or `action` call it cannot read as E1558. Stated in k.topology Rules.
- Budgets: `@keel/server` to 20kb, `@keel/compiler` to 29.5kb.

**Alternatives.**
- `process.setSourceMapsEnabled(true)` in the generated entry, rejected: measured on Node 22.23 and 24.19, it maps nothing in the bundle that calls it.
- `--enable-source-maps` in the image, rejected: a direct `node server.mjs` stays unmapped, every start pays 3 to 11 ms, and every stack in the process is mapped.
- Keeping `sourcesContent`, rejected: the app's source text in every image, 3 times the size.
- A `root` option on `createApp`, rejected: a new option holding the value `artifacts` already gives.
- A root on `ctx`, rejected: a file path in app code's effect surface.
- A new code or a warning for an unreadable call, rejected: one code per rule, as E1111.

**Consequences.**
- Production frames name `modules/…` files in json logs; the first mapped throw costs about 8 ms and holds about 6 MB (golden-1 `api`).
- The deploy image grows by the map (golden-1 `api`: 338,815 B); no deploy file changes.
- `keel dev` frames are relative to the project wherever it runs; a test calling `createApp` without `artifacts` logs `frames: []`.
- A `client` or `static` module's unreadable `loader` or `action` call fails `keel check` and `keel build`; none exists in the repo.
- k.server is at 1,497 tokens; k.compiler is untouched.
