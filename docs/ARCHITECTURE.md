# Architecture

**Monorepo.** pnpm workspaces · Turborepo, wrapped (agents call `pnpm <task>`, never `turbo`) · strict TS profile in `tsconfig.base.json` · Biome · Vitest + fast-check · Playwright · Stryker on kernel packages · changesets.

**Kernel packages, dependency order.** `schema` -> `reactive` -> `store` -> `runtime-dom` -> `compiler` -> `router` -> `forms` -> `ui` -> `check` -> `scaffold` -> `testing` -> `server` (thin) -> `services` (thin) -> `cli` (serves MCP and LSP; the entry point, so it may call everything) -> `ctx`. `tooling/deps.json` enforces downward-only imports.

**Extension points** (kernel work, used by stdlib): schema type registry · check rule registry · capability registry on `ctx` · module manifest · inspector hooks (`@keel/compiler/inspect/inspector`: named, schema-typed sections of the inspect document, k.cli) · output formatter registry. Stdlib packages `packages/std-*` (spec `spec/std/`) come after `ctx` in `tooling/deps.json`; wave 0 uses each point once: std-money, std-brands, std-geo, std-health, std-timings, std-report. The values packages build on platform `Intl` and ISO text: std-i18n (the `Locale` type, `formatNumber`, `plural`; schema type registry and check rule registry), std-money (schema type registry), std-temporal (`Instant`, `PlainDate`, `TimeZone` and `Duration` format types; schema type registry), std-text (`line`, `para`, `Email`, `Slug`; schema type registry) and std-messages (message sets, `formatMessage`; schema type registry and check rule registry). std-statecharts (`chart`; check rule registry) compiles a state chart to a store and one transaction per event. std-headless (`Listbox`, `Combobox`, `Menu`, `Tabs`, `Dialog`, `Disclosure`, `Toaster`) builds each widget on `Part` from `@keel/ui/aria`, the entry only kernel and stdlib code may import (E1822), with one state chart instance per widget. std-tables (`columns`, `tableSearch`, `applyQuery`, `DataTable`, `TableSearch`) keeps the query in the route's `search` and runs one `applyQuery` for a loader and for a client store.

**Storage, workflows, shells, proofs.** `ctx.storage` has `get`, `set`, `read(keys)` (one cut) and `commit(writes)` (compare-and-set over several keys). `createCtx({ drivers: { storage?, net? } })` swaps a driver into a `real` or `shell` ctx; on `sim` it is E1605. A server action saves in one `commit`, so processes sharing a driver get 409 `keel.conflict`; `commitStores` (`@keel/server`) is the same path for runners and jobs. A `node` deployable's `storage` in `topology.ts` (`'file'`, `'sqlite'`, `'postgres'`) picks the driver the generated entry opens: `@keel/std-db` (`sqlite`, `postgres`, from `KEEL_DATABASE_URL`), never imported by app code (E2151). `@keel/std-workflows` (`workflow`, `flows`) runs a state chart per instance in one server store, its steps as std-jobs jobs. A `client` deployable's `shells` (`capacitor`, `tauri`) build with `keel build --target`; the generated shell entry passes the drivers of `@keel/std-capacitor` or `@keel/std-tauri` (`capacitorDrivers`, `tauriDrivers`: `storage` and `net`) to `createCtx({ mode: 'shell' })`. `@keel/testing/prove` proves a store's invariants by induction with Z3 (the optional peer `z3-solver`), and `keel ledger` records them as `proven`. `@keel/std-credentials` (`credentials(ctx)`: `hash`, `verify`, `mint`, `check`) hashes passwords and mints tokens in a `node` deployable's server code.

**Production and dev.** One `mode` (`'dev'` or `'production'`, default `production`) decides what a person sees of an unexpected failure: `createApp`, `mount`, `resume` and `createRouter` each take it, and none reads `NODE_ENV`. In `production` a `keel.unexpected` shows as the code `unexpected` with empty data, on the server page, the root fallback, a route's `errorElement` and a `Form`'s `error`; the ctx's observers still get the full error. `publicError` lives in `@keel/router/internal`, and `@keel/server` imports it from there, so the client router and the server write one value (router sits before server in the dependency order). The Vite plugin writes `mode` into the generated client and resume entries as a literal: `keel dev` produces `dev`, and `keel build` always writes the production client whatever `NODE_ENV` or `.env` says. The server's `req` log path marks each secret route param as `[secret]`, using the routes of every deployable, and cuts a longer path at its secret.

**Live and offline.** `@keel/std-channels` carries named channels over a server event stream; `@keel/std-live` keeps a client store current by re-reading through its loader after each push, and gives up a read that has not settled in 30 s and retries. `@keel/std-offline` keeps an outbox of writes made offline, each with its key and base, sent in order on reconnect; `@keel/std-conflicts` finds races among rebased writes. A ctx has `dispose`, which removes what the ctx attached.

**Borrow vs build**

| Concern | Decision | Reason |
| --- | --- | --- |
| Reactivity engine | Build Solid-style signals | In-distribution; constraints come from the compiler |
| Schema validation | Build | Validators, generators and codecs derive from one declaration |
| Dates, zones, locale data | Borrow platform `Intl`; build ISO values | no `Temporal` polyfill; `Intl` ships with the engine |
| Parser, transforms | oxc | `check` latency is tokens |
| Bundler | Vite + rolldown | Ecosystem, adapters |
| HTTP server | Hono | Standard Request/Response, adapters |
| Test runner | Vitest + fast-check | Property testing |
| Browser automation | Playwright | Engine matrix |
| Accessibility rules | Borrow axe-core; build token contrast | Rule engine is a solved problem; contrast comes from the tokens |
| Content security policy | Build, per-response nonce | The document and the runtime decide what may run |
| Evidence signing | Borrow `node:crypto` Ed25519 | Platform signatures, no dependency |
| Compiler artifacts | Build | Nothing emits dep graphs, ID indexes, a11y expectations |
| Store and log | Build | Core of the thesis |
| Invariant proofs | Borrow Z3 through `z3-solver`; build the translation of transactions | A transaction's own source is the model; the solver is a solved problem |
| Durable storage | Borrow `node:sqlite` and `pg`; build the driver contract | One `read` and `commit` contract over files, SQLite and Postgres; no query layer |
| Native shells | Borrow Capacitor and Tauri; build the drivers and generated files | The web build runs unchanged; the shell supplies storage and net |
| Model checking | Build `explore` over transactions; no TLA+ or Alloy model | The model is the store the app runs |
| Simulation | Borrow fast-check generation and shrinking; build schedules in the sim ctx | Faults and delays are inputs a seed replays |
| State charts | Build on store and transactions; no XState | A chart is a store, so every tool already reads it |
| Widgets (listbox, combobox, menu, tabs, dialog, disclosure, toast) | Build on `Part` and state charts; follow the WAI-ARIA Authoring Practices patterns; no third-party headless library | Keyboard, focus and ARIA are one tested chart per widget, and the parts take the app's tokens |
| Data tables | Build; one `applyQuery` for server and client; the query in the route's `search` | A sorted, filtered page is a URL, and the loader and the client compute the same rows |
| check, cli, mcp, lsp | Build | The product |
| Sessions (stdlib) | Build | The product |

**Generated, read-only:** `turbo.json`, CI workflows, Dockerfiles, compose. Hand edits fail `pnpm check`.

verified: e23b0f2f0815e2dc76754c22cd494c3ae9cb35ae
