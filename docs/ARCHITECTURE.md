# Architecture

**Monorepo.** pnpm workspaces · Turborepo, wrapped (agents call `pnpm <task>`, never `turbo`) · strict TS profile in `tsconfig.base.json` · Biome · Vitest + fast-check · Playwright · Stryker on kernel packages · changesets.

**Kernel packages, dependency order.** `schema` -> `reactive` -> `store` -> `runtime-dom` -> `compiler` -> `router` -> `forms` -> `ui` -> `check` -> `scaffold` -> `testing` -> `server` (thin) -> `services` (thin) -> `cli` (serves MCP and LSP; the entry point, so it may call everything) -> `ctx`. `tooling/deps.json` enforces downward-only imports.

**Extension points** (kernel work, used by stdlib): schema type registry · check rule registry · capability registry on `ctx` · module manifest · inspector hooks (`@keel/compiler/inspect/inspector`: named, schema-typed sections of the inspect document, k.cli) · output formatter registry. Stdlib packages `packages/std-*` (spec `spec/std/`) come after `ctx` in `tooling/deps.json`; wave 0 uses each point once: std-money, std-brands, std-geo, std-health, std-timings, std-report. The values packages build on platform `Intl` and ISO text: std-i18n (the `Locale` type, `formatNumber`, `plural`; schema type registry and check rule registry), std-money (schema type registry), std-temporal (`Instant`, `PlainDate`, `TimeZone` and `Duration` format types; schema type registry), std-text (`line`, `para`, `Email`, `Slug`; schema type registry) and std-messages (message sets, `formatMessage`; schema type registry and check rule registry).

**Borrow vs build**

| Concern | Decision | Reason |
| --- | --- | --- |
| Reactivity engine | Borrow Solid-style signals, wrap | Mature, in-distribution; constraints come from the compiler |
| Schema validation | Borrow a Standard Schema validator, wrap | Validation is solved; generators and codecs are ours |
| Dates, zones, locale data | Borrow platform `Intl`; build ISO values | no `Temporal` polyfill; `Intl` ships with the engine |
| Parser, transforms | oxc | `check` latency is tokens |
| Bundler | Vite + rolldown | Ecosystem, adapters |
| HTTP server | Hono | Standard Request/Response, adapters |
| Test runner | Vitest + fast-check | Property testing |
| Browser automation | Playwright | Engine matrix |
| Compiler artifacts | Build | Nothing emits dep graphs, ID indexes, a11y expectations |
| Store and log | Build | Core of the thesis |
| check, cli, mcp, lsp | Build | The product |
| Sessions (stdlib) | Build | The product |

**Generated, read-only:** `turbo.json`, CI workflows, Dockerfiles, compose. Hand edits fail `pnpm check`.

verified: 30a5850cfed9146e5cd4d7f6a4c58ba5551b2794
