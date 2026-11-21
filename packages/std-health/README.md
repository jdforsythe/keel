# @keel/std-health

**Spec:** std.health · **Status:** conformance-covered · **verified:** (none)

## Contract

- **Public API:** stdlib module `health` (`module.ts` at the package root). Public exports `Health` (closed `{ status: 'ok', at }`) and `routes` (the binding of `health.status`, `GET /health`); the `./contract` export `health` (`contract('health', { 'health.status': { path: '/health' } })`), from `health.contract.ts`. Private: `loadHealth` (in `loadHealth.server.ts`, so a browser build that imports `routes` stubs it), `HealthView`.
- **Invariants:** `loadHealth` returns `ok({ status: 'ok', at: ctx.clock.now() })`. Apps list `@keel/std-health` in `deps`; k.module E1151-E1156 apply to it like any module.
- **Dependencies:** `@keel/compiler`, `@keel/ctx`, `@keel/router`, `@keel/schema`, `@keel/ui`.
- **Rungs:** conformance (example + probabilistic, served through `createApp`), property for `loadHealth`.

## Extension points

Uses the **module manifest** (k.module): a stdlib manifest, its public surface and route, checked from app modules.

## Unsafe

count: 0
