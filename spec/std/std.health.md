# std.health: Health route
status: conformance-covered

**Extension point.** Module manifest (k.module). `@keel/std-health` is a stdlib module: its manifest sits at the package root, `module.ts`, and its files are imported as `@keel/std-health/<File>`.
```ts
export default module({ id: 'health', deps: [], capabilities: ['clock'],
  public: { exports: ['Health', 'routes'], routes: ['health.status'] } })
```
Files: `src/Health.ts`, `src/routes.ts` (public), `src/loadHealth.ts`, `src/HealthView.ts` (private).

**API.**
- `Health` is `s.object({ status: s.literal('ok'), at: s.number() }, { closed: true })`.
- `routes` is a k.router manifest with one route `health.status`: path `/health`, loader `loadHealth`, component `HealthView`. `loadHealth` returns `ok({ status: 'ok', at: ctx.clock.now() })`. `HealthView` renders `data` as a `main` with id `health.status` and the text `ok`.
- An app module opts in with `deps: ['@keel/std-health']`. It may import `Health` and `routes`, and it may link to `health.status` with `routes.href('health.status')`. A deployable serves the route when its route table includes `routes.routes`.

**Rules.** None of its own. The k.module rules (E1151-E1157) apply to it and to every module that uses it.

**Conformance.**
- The package's `module.ts` default export parses with `ModuleSchema` and declares the manifest above.
- `check()` over the package files (at `node_modules/@keel/std-health/`) reports no E1151-E1157.
- An app module with `@keel/std-health` in `deps` that imports `@keel/std-health/Health` gets no k.module diagnostic.
- The same import without `@keel/std-health` in `deps` reports E1152 at the import.
- Importing `@keel/std-health/loadHealth`, a non-public file, reports E1151, even with the package in `deps`.
- `routes.href('health.status')` is `/health`.
- A `createApp` (node, sim ctx) serving `routes` answers `GET /health` with `accept: application/json` with status 200; the body's `results['health.status']` is the loader result `ok({ status: 'ok', at })`, where `at` is the sim clock's `now()`. The value parses with `Health`.
