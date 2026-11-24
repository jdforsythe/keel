# k.module: Module manifest
status: implemented

**Manifest.** All app code lives in modules. A module is a folder `modules/<id>/` with a `module.ts`:
```ts
import { module } from '@keel/compiler'
export default module({
  id: 'orders',
  deps: ['catalog', '@keel/std-auth'],
  capabilities: ['net'],
  public: { exports: ['OrderCard', 'addItem'] },
})
```
- `id`: lowerCamel, equals the folder name; prefixes its route ids, store ids, transaction names and error codes.
- `deps`: app module ids or stdlib package names it may import from, link to or call; a page of a module it lists may name its layouts (k.routes Layouts). An app module entry is one the module uses (Checks); a stdlib entry is used by being listed (Std config). Stdlib modules ship the same manifest (extension point) at the package root; `deps` name the package and its `id` is its prefix.
- `capabilities`: `ctx` capabilities its code may use.
- `std` (optional): its config for stdlib packages, `{ '<pkg>': <literal JSON> }`, read statically. A package that takes config registers its schema under its name (`s.register('@keel/std-x', Config)`); the value must parse with it.
- `public.exports`: export names (equal to file names) other modules may import. Its routes are its contract's entries, public to every module whose `deps` name it (k.contract).

Anything not listed is private. Cross-module imports name the exporting file: no barrels.

**Checks.** Cross-module access is checked statically from imports (a contract's among them) and `uses:` lists, on every build and `keel check`. Manifests are validated by `ModuleSchema`. A module uses an app module its `deps` list when a non-test file of it, a generated one among them, imports from that module (a static, type-only, re-exporting or literal dynamic import, the contract's among them), or when a binding of either module names a layout of the other (k.routes Layouts): the entries E1152 asks for, and no others. So each `deps` edge, and each E1153 cycle, stands for code that uses it.

**Std config.** Before validating, `keel check` (every surface) and `keel build` import each `@keel/std-*` package in an app module's `deps` once, and its `./tools` export, if any, resolved from the manifest's folder; `check()` imports nothing. Only a stdlib package's `./tools*` and `./module` entries may reach `@keel/cli`, `@keel/check`, `vite`, `vitest`, `typescript` or `oxc-*`; rules, formatters and commands register in `./tools`. The build writes `.keel/std.json` (`{ data, hash }`; E1005 in `keel check`), `{ [pkg]: { [moduleId]: config } }` from `std` entries that pass E1158, `{}` when none. `createApp({ std: '.keel/std.json' })` reads it at startup and binds it to its `ctx`. A package reads it with `stdConfig(ctx, pkg, Config)` (`@keel/compiler/std/stdConfig`): `{ [moduleId]: Config }`, each value parsed with `Config` (fail: E1158), `{}` for a ctx no `createApp` bound. Browsers get only the config of packages marked `clientStd(pkg, keys?)` (`@keel/compiler/std/clientStd`; `keys`: those top-level keys), for the served deployable's modules. An island document's `#k-state` carries it as `std` (absent when empty), bound by the resume entry before resuming (`bindClientStd`); a `client` entry binds it from `std.json`.

**Rules.** E1151 import of a non-public export of another module, its contract excepted (fix adds it to that module's `public.exports`) · E1152 import from a module not in `deps` (fix adds it) · E1153 cycle in module `deps`, at the entry of the cycle's smallest module id that names the next module of the cycle, the opening quote of the id inside `deps: [...]` (message `module deps cycle: <ids joined by ' -> '>`; when a module of the cycle imports from a `*.guard.*` file of the module after it, `module deps cycle through guard <name>: <ids>` and `see` k.guards, `<name>` the file name up to its first dot (`y` of `y.guard.ts`) of the first such file along the cycle, the first edge of the listed cycle that has one, its first file by path: k.guards Home) · E1154 `public` names an export that does not exist (fix removes it) · E1155 route id, store id, transaction name, or error code not prefixed by its module id (fix prefixes it) · E1156 `ctx` capability used, or `observe` called, but not in `capabilities` (fix adds it) · E1158 `std` key that is not a stdlib package (`@keel/std-*`) in `deps`, a `std` value that is not literal JSON, or one that fails the schema registered under its package name (message names the issue's path and rule), at `keel check`, `keel build` and `createApp` · E1159 a `@keel/std-*` `deps` entry not named `@keel/std-[a-z0-9-]+`, not found in the manifest's own or ancestor `node_modules`, or throwing on import, at the entry · E1160 `createApp({ std })` file missing, not `{ data, hash }`, or its `hash` not that of its `data` · E1165 a `deps` entry, other than a `@keel/std-*` package, that the module does not use (Checks), a module id the project lacks among them, at the entry, one per entry (fix removes it). No fix edits `node_modules/`.

**Conformance.**
- Importing a non-public export of another module reports E1151 at the import; adding it to `public.exports` clears it.
- Importing from a module absent from `deps` reports E1152 even when the export is public.
- Modules `a` and `b` that list each other in `deps` produce one E1153 naming both.
- Using `ctx.net` or calling `observe` in a module whose `capabilities` lack `net` or `observe` reports E1156.
- Changing the signature of a non-public export produces no diagnostic in any other module.
- A route `show` declared in module `orders` without the `orders.` prefix reports E1155.
- A stdlib module's manifest is validated by the same schema and enforced by the same rules as an app module's.
- A `std` key absent from `deps`, or naming an app module, reports E1158, and listing it in `deps` clears it. A `std` value that fails its package's registered schema reports E1158 naming the issue's path; a value that parses is clean.
- With `@keel/std-brands` in a module's `deps`, `keel check` reports E2101 for a lowercase `s.id` brand; a `deps` package that cannot be imported reports E1159 naming it.
- `keel build` writes `.keel/std.json` with each module's `std` config by package and module id; a value failing its package's schema is E1158 naming the path, and nothing is written.
- `stdConfig` returns, for the `ctx` given to `createApp({ std })`, every module's config, equal to its manifest literal, and `{}` for another ctx; a `std.json` failing a registered schema rejects with E1158 naming the path, a hand-edited one with E1160.
- An island document of `createApp({ std })` carries as `std` in `#k-state` the config of `clientStd` packages for the served deployable's modules, and a resumed route component reading `stdConfig` on a ctx `bindClientStd` bound gets the server's value; other packages and modules, and a `createApp` without `std`, add nothing.
- With `clientStd(pkg, ['a'])`, `#k-state` holds only key `a` of each module's `pkg` config.
- `keel check` imports a `deps` package's `./tools` export: a rule it registers reports, and a throw is E1159.
- A page of `b` naming a layout of `a`, where `a` lists `b` in `deps`, reports no E1152 and no E1153; `a` and `b` listing each other produce one E1153 naming both.
- Module `a` listing `b` in `deps`, with no file of `a` importing from `b`, reports one E1165 at the entry, as it does when only a test file of `a` imports from `b`; its fix removes the entry, and `keel check` then reports neither E1165 nor E1152.
- No E1165 for `b` when one non-test file of `a` holds any one of `import { X } from '../b/X.ts'` (`X` public), `import type { X } from '../b/X.ts'`, `export { X } from '../b/X.ts'`, `import('../b/X.ts')`, or an import of `b`'s contract alone.
- With `app` (deps `['shop']`) holding a layout `app.frame` and `shop` (deps `[]`) a page bound with `layout: 'app.frame'`, and no import between them, no E1165; with `shop` listing `app` and `app` listing nothing, none either.
- Modules `receipts`, `setup` and `shopping`, where `shopping` lists `setup` and `receipts`, `receipts` lists `setup`, with no import behind any of the three, and `setup` lists `shopping` and imports from it: one E1153 and three E1165, one at each of the three entries; after their three fixes, neither code.
- A `@keel/std-*` entry the module imports nothing from reports no E1165; an entry `ghost` naming no module of the project reports one.
- Modules `members` (deps `['shopping']`, `public.exports` `['signedIn']`) holding `signedIn.guard.ts` and a page that imports `../shopping/shopping.contract.ts` and links with `shopping.href('shopping.list')`, and `shopping` (deps `['members']`) whose `routes.ts` imports `signedIn` from `../members/signedIn.guard.ts` and binds it as a page's `guard`: one E1153, at the `shopping` entry of `modules/members/module.ts`, message `module deps cycle through guard signedIn: members -> shopping -> members`, `see` `k.guards`. With `signedIn.guard.ts` in module `access` (deps `[]`, `public.exports` `['signedIn']`), `members` listing `['access', 'shopping']` and `shopping` listing `['access']`, each `routes.ts` importing `../access/signedIn.guard.ts` and binding it: no E1153, E1152 or E1165.
- Modules `a` (deps `['b']`, a file importing `../b/X.ts`) and `b` (deps `['a']`, a file importing `../a/y.guard.ts` and `../a/w.guard.ts`), each `public.exports` naming the files the other imports: one E1153, message `module deps cycle through guard w: a -> b -> a`; with `a` importing `../b/x.guard.ts` as well, `module deps cycle through guard x: a -> b -> a`; with no guard file imported either way, `module deps cycle: a -> b -> a` and `see` `k.module`.
