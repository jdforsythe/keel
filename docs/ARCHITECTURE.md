# Architecture

**Monorepo.** pnpm workspaces · Turborepo, wrapped (agents call `pnpm <task>`, never `turbo`) · strict TS profile in `tsconfig.base.json` · Biome · Vitest + fast-check · Playwright · Stryker on kernel packages · changesets.

**Kernel packages, dependency order.** `schema` -> `reactive` -> `store` -> `runtime-dom` -> `compiler` -> `router` -> `forms` -> `ui` -> `check` -> `scaffold` -> `testing` -> `server` (thin) -> `services` (thin) -> `cli` (serves MCP and LSP; the entry point, so it may call everything) -> `ctx`. `tooling/deps.json` enforces downward-only imports.

**Extension points** (kernel work, used by stdlib): schema type registry · check rule registry · capability registry on `ctx` · module manifest · inspector hooks (`@keel/compiler/inspect/inspector`: named, schema-typed sections of the inspect document, k.cli) · output formatter registry. Stdlib packages `packages/std-*` (spec `spec/std/`) come after `ctx` in `tooling/deps.json`; wave 0 uses each point once: std-money, std-brands, std-geo, std-health, std-timings, std-report. The values packages build on platform `Intl` and ISO text: std-i18n (the `Locale` type, `formatNumber`, `plural`; schema type registry and check rule registry), std-money (schema type registry), std-temporal (`Instant`, `PlainDate`, `TimeZone` and `Duration` format types; schema type registry), std-text (`line`, `para`, `Email`, `Slug`; schema type registry) and std-messages (message sets, `formatMessage`; schema type registry and check rule registry). std-statecharts (`chart`; check rule registry) compiles a state chart to a store and one transaction per event. std-headless (`Listbox`, `Combobox`, `Menu`, `Tabs`, `Dialog`, `Disclosure`, `Toaster`) builds each widget on `Part` from `@keel/ui/aria`, the entry only kernel and stdlib code may import (E1822), with one state chart instance per widget. std-tables (`columns`, `tableSearch`, `applyQuery`, `DataTable`, `TableSearch`) keeps the query in the route's `search` and runs one `applyQuery` for a loader and for a client store.

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
| Model checking | Build `explore` over transactions; no TLA+ or Alloy model | The model is the store the app runs |
| Simulation | Borrow fast-check generation and shrinking; build schedules in the sim ctx | Faults and delays are inputs a seed replays |
| State charts | Build on store and transactions; no XState | A chart is a store, so every tool already reads it |
| Widgets (listbox, combobox, menu, tabs, dialog, disclosure, toast) | Build on `Part` and state charts; follow the WAI-ARIA Authoring Practices patterns; no third-party headless library | Keyboard, focus and ARIA are one tested chart per widget, and the parts take the app's tokens |
| Data tables | Build; one `applyQuery` for server and client; the query in the route's `search` | A sorted, filtered page is a URL, and the loader and the client compute the same rows |
| check, cli, mcp, lsp | Build | The product |
| Sessions (stdlib) | Build | The product |

**Generated, read-only:** `turbo.json`, CI workflows, Dockerfiles, compose. Hand edits fail `pnpm check`.

verified: 40e24cec12b6c28e2fd5d39fda9ba0560e83e889
