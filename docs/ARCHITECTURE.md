# Architecture

**Monorepo.** pnpm workspaces · Turborepo, wrapped (agents call `pnpm <task>`, never `turbo`) · strict TS profile in `tsconfig.base.json` · Biome · Vitest + fast-check · Playwright · Stryker on kernel packages · changesets.

**Kernel packages, dependency order.** `schema` -> `reactive` -> `store` -> `runtime-dom` -> `compiler` -> `router` -> `forms` -> `ui` -> `check` -> `scaffold` -> `testing` -> `server` (thin) -> `services` (thin) -> `cli` (serves MCP and LSP; the entry point, so it may call everything) -> `ctx`. `tooling/deps.json` enforces downward-only imports.

**Extension points** (kernel work, used by stdlib): schema type registry · check rule registry · capability registry on `ctx` · module manifest · inspector hooks · output formatter registry.

**Borrow vs build**

| Concern | Decision | Reason |
| --- | --- | --- |
| Reactivity engine | Borrow Solid-style signals, wrap | Mature, in-distribution; constraints come from the compiler |
| Schema validation | Borrow a Standard Schema validator, wrap | Validation is solved; generators and codecs are ours |
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
