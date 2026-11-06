# k.module: Module manifest
status: implemented

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
- `deps`: app module ids or stdlib package names this module may import from or link to. Stdlib modules ship the same manifest (extension point).
- `capabilities`: `ctx` capabilities its code may use; topology and shells read this list.
- `public.exports`: export names (equal to file names, principle 3) other modules may import. `public.routes`: route ids other modules may pass to `href()`.

Everything not listed is private. Cross-module imports name the exporting file directly; there are no barrel files. Each module has its own `routes.ts`; a deployable's route table is the union of its modules' manifests.

**Checks.** Cross-module access is checked statically from imports, `href()` calls, and `uses:` lists, on every build and every `keel check`. Manifests are validated by `ModuleSchema`.

**Rules.** E1151 import of a non-public export of another module · E1152 import from, or `href()` into, a module not in `deps` · E1153 cycle in module `deps` (message lists the cycle) · E1154 `public` names an export or route that does not exist · E1155 route id, store id, transaction name, or error code not prefixed by its module id · E1156 `ctx` capability used but not in `capabilities` · E1157 `href()` to a non-public route of another module.

**Conformance.**
- Importing a non-public export of another module reports E1151 at the import; adding it to `public.exports` clears it.
- Importing from a module absent from `deps` reports E1152 even when the export is public.
- Modules `a` and `b` that list each other in `deps` produce one E1153 naming both.
- Using `ctx.net` in a module without `net` in `capabilities` reports E1156.
- Changing the signature of a non-public export produces no diagnostic in any other module.
- A route `show` declared in module `orders` without the `orders.` prefix reports E1155.
- A stdlib module's manifest is validated by the same schema and enforced by the same rules as an app module's.
