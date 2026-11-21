# ADR-0057: `.ts` components export `Props`, an empty JSON body is `{}`, `scaffold project` writes `<name>/`, a resource unwraps a `Result` (RFC 0068)

**Status:** accepted

**Context.**
- The golden-1-api eval did not converge (backlog 0120). Plain `.ts` api components could not export the `Props` that `render` needs (E1752, E1104).
- An empty JSON POST body was 422 with a root `""` key, even for an action whose input accepts `{}`.
- `keel scaffold project <name> --workspace` wrote into the working directory.
- A resource reached `error` only on a throw, while the skills forbid throw and a services client returns a `Result`.
- golden-2's `pass.ts` did not grade the ledger, and the golden-1 brief named scripts the workspace scaffold does not write.

**Decision.**
- A component file is a PascalCase `.tsx`/`.jsx` with a default export, or a PascalCase `.ts` whose default export is a function whose first parameter's type names `Props`. Only it may export `Props` and `uses`. `isComponentFile` in `@keel/check` is the one definition E1752 and E1104 call (backlog 0197).
- A zero-byte JSON action body decodes as `{}`. Decode failure stays 422 `keel.fields`.
- The CLI writes `scaffold project <name>` under `<name>/`. The generator stays project-relative.
- `resource` unwraps only a keel `Result`: k.schema `ok`/`err` brand each result with a non-enumerable `Symbol.for('keel.result')` key, and `ok(v)` is `ready` with `v`, `err(e)` is `error` with `e`; any other value is `ready` as is. Its signature is `resource<T>(fetcher: () => Promise<T>): Resource<Settled<T>>` (backlog 0198).
- The `routes.ts` and `*.server.ts` cycle stays. The keel-api skill and the eval slices say to import `routes.ts` first.
- golden-2 grades the ledger like golden-1, and the golden-1 brief names the scaffold's scripts.

**Alternatives.**
- A new 400 code for an empty body. Decoding already fails as `keel.fields`.
- An empty JSON body as an empty FormData. An absent checkbox would read as `false`.
- `scaffold('project')` returning prefixed paths. Every chained operation would strip it.
- Two `resource` overloads. A fetcher with a `Promise.reject` branch matched neither (TS2769).
- Unwrapping by shape. It mistyped explicit `Result` type arguments and caught third-party `{ ok: false, error }` payloads.
- A separate actions file to break the cycle. ADR-0052 rejected the extra wiring.

**Consequences.**
- A plain object shaped like a `Result` stays the ready value. A literal typed exactly as a `Result` variant, not made by `ok`/`err`, is typed as unwrapped but stays whole at runtime.
- With the vitest module runner, a test that imports a `*.server.ts` before its `routes.ts` still attaches `undefined` without an error. A router check for that is backlog.
- The committed `apps/golden-2` has 21 of 31 ledger items at rung `none`, so its eval fails until a run raises them.
- `@keel/server` stays inside 13.5 kB. `@keel/reactive` is 2,041 B of 4 kB and `@keel/schema` 4,337 B of 5 kB.
