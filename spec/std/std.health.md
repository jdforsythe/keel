# std.health: Health route
status: conformance-covered

**Extension point.** Module manifest (k.module). `@keel/std-health` is a stdlib module: its manifest sits at the package root, `module.ts`, and its files are imported as `@keel/std-health/<File>`.
```ts
export default module({ id: 'health', deps: [], capabilities: ['clock'],
  public: { exports: ['Health', 'routes'] } })
```
Files: `src/Health.ts`, `src/routes.ts` (public), `src/health.contract.ts` (the `./contract` export), `src/loadHealth.server.ts`, `src/HealthView.ts` (private).

**API.**
- `Health` is `s.object({ status: s.literal('ok'), at: s.number() }, { closed: true })`.
- `health` (`./contract`) is `contract('health', { 'health.status': { path: '/health' } })`; `routes` is `manifest(health, { 'health.status': { component: HealthView, loader: loadHealth } })`. `loadHealth` returns `ok({ status: 'ok', at: ctx.clock.now() })`. `HealthView` renders `data` as a `main` with id `health.status` and the text `ok`.
- An app module opts in with `deps: ['@keel/std-health']`. It may import `Health`, `routes` and the `./contract` export `health`, and it may link to `health.status` with `health.href('health.status')`. A deployable serves the route when its route table (k.routes) includes `routes`.

**Rules.** None of its own. The k.module rules (E1151-E1156) apply to it and to every module that uses it.

**Conformance.**
- The package's `module.ts` default export parses with `ModuleSchema` and declares the manifest above.
- `check()` over the package files (at `node_modules/@keel/std-health/`) reports no E1151-E1156.
- An app module with `@keel/std-health` in `deps` that imports `@keel/std-health/Health` gets no k.module diagnostic.
- The same import without `@keel/std-health` in `deps` reports E1152 at the import.
- Importing `@keel/std-health/loadHealth`, a non-public file, reports E1151, even with the package in `deps`.
- `health.href('health.status')` is `/health`.
- A `createApp` (node, sim ctx) serving `routes` answers `GET /health` with `accept: application/json` with status 200; the body's `results['health.status']` is the loader result `ok({ status: 'ok', at })`, where `at` is the sim clock's `now()`. The value parses with `Health`.
