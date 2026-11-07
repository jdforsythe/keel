# k.module: Module manifest
status: conformance-covered

**Manifest.** All app code lives in modules. A module is a folder `modules/<id>/` with a `module.ts`:
```ts
import { module } from '@keel/compiler'
export default module({
  id: 'orders',
  deps: ['catalog', '@keel/std-auth'],
  capabilities: ['clock', 'net'],
  public: { exports: ['OrderCard', 'Order', 'addItem'], routes: ['orders.show'] },
})
```
- `id`: lowerCamel, equals the folder name; prefixes the module's route ids, store ids, transaction names, and error codes.
- `deps`: app module ids or stdlib package names this module may import from or link to. Stdlib modules ship the same manifest (extension point) at the package root, `node_modules/@keel/std-<x>/module.ts`; `deps` name the package and its `id` is its prefix.
- `capabilities`: `ctx` capabilities its code may use; topology and shells read this list.
- `std` (optional): this module's config for stdlib packages, `{ '<pkg>': <literal JSON> }`, read statically. Each key is a stdlib package (`@keel/std-*`) in `deps`. A package that takes config registers its schema under its package name (`s.register('@keel/std-x', Config)`, k.schema), and the value must parse with it.
- `public.exports`: export names (equal to file names, principle 3) other modules may import. `public.routes`: route ids other modules may pass to `href()`.

Everything not listed is private. Cross-module imports name the exporting file directly; there are no barrel files. Each module has its own `routes.ts`; a deployable's route table is the union of its modules' manifests.

**Checks.** Cross-module access is checked statically from imports, `href()` calls, and `uses:` lists, on every build and every `keel check`. Manifests are validated by `ModuleSchema`.

**Std config** (rfc:0066). Before validating, `keel check` (every surface) and `keel build` import each `@keel/std-*` package in an app module's `deps` once, resolved from the manifest's folder (`importDeps`, `@keel/compiler/std/importDeps`), so its rules and config schema register; `check()` itself imports nothing. The build writes `.keel/std.json` (`{ data, hash }` like the k.compiler artifacts; E1005 in `keel check`), `{ [pkg]: { [moduleId]: config } }` from the `std` entries that pass E1158, `{}` when none. `createApp({ std: '.keel/std.json' })` (k.server) reads it at startup and binds it to its `ctx`. A package reads it with `stdConfig(ctx, pkg, Config)` (`@keel/compiler/std/stdConfig`): `{ [moduleId]: Config }`, each value parsed with `Config` (fail: throws E1158), `{}` for a ctx no `createApp` bound.

**Rules.** E1151 import of a non-public export of another module (fix adds it to that module's `public.exports`) · E1152 import from, or `href()` into, a module not in `deps` (fix adds it) · E1153 cycle in module `deps` (message lists the cycle) · E1154 `public` names an export or route that does not exist (fix removes it) · E1155 route id, store id, transaction name, or error code not prefixed by its module id (fix prefixes it) · E1156 `ctx` capability used but not in `capabilities` (fix adds it) · E1157 `href()` to a non-public route of another module (fix adds it to that module's `public.routes`) · E1158 `std` key that is not a stdlib package (`@keel/std-*`) in `deps`, a `std` value that is not literal JSON, or one that fails the schema registered under its package name (message names the issue's path and rule), at `keel check`, `keel build` and `createApp` · E1159 a `@keel/std-*` `deps` entry not named `@keel/std-[a-z0-9-]+`, not found in the manifest's own or ancestor `node_modules`, or throwing on import, at the entry · E1160 `createApp({ std })` file missing, not `{ data, hash }`, or its `hash` not that of its `data`. No fix edits a file under `node_modules/`.

**Conformance.**
- Importing a non-public export of another module reports E1151 at the import; adding it to `public.exports` clears it.
- Importing from a module absent from `deps` reports E1152 even when the export is public.
- Modules `a` and `b` that list each other in `deps` produce one E1153 naming both.
- Using `ctx.net` in a module without `net` in `capabilities` reports E1156.
- Changing the signature of a non-public export produces no diagnostic in any other module.
- A route `show` declared in module `orders` without the `orders.` prefix reports E1155.
- A stdlib module's manifest is validated by the same schema and enforced by the same rules as an app module's.
- A `std` key absent from `deps`, or naming an app module, reports E1158, and listing it in `deps` clears it. A `std` value that fails its package's registered schema reports E1158 naming the issue's path; a value that parses is clean.
- With `@keel/std-brands` in a module's `deps`, `keel check` reports E2101 for a lowercase `s.id` brand; a `deps` package that cannot be imported reports E1159 naming it.
- `keel build` writes `.keel/std.json` with each module's `std` config by package and module id; a value failing its package's schema is E1158 naming the path, and nothing is written.
- `stdConfig` returns, for the `ctx` given to `createApp({ std })`, every module's config, equal to its manifest literal, and `{}` for another ctx; a `std.json` failing a registered schema rejects with E1158 naming the path, a hand-edited one with E1160.
