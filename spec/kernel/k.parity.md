# k.parity: Stdlib parity
status: proposed

The stdlib holds no power a library lacks: a `@keel/std-*` package reaches the kernel only through public entries, and the kernel treats it as it treats any package, but for the exceptions below.

**Entries.** A stdlib package's shipped code (`src/`, `unsafe/`) imports no kernel entry with an `internal` path segment. It may import its own and another stdlib package's internal entries, as any package family shares its own. The public forms it uses where a kernel internal once served: `secretPath(schema)` from `@keel/schema`, the dotted object-key path of the first `s.secret` node (`""` at the root; array items, record values and union members add no segment), null when none, `sampleFormat(node, sample)` from `@keel/schema` (k.formats), `navigate` (k.router Client) run inside the caller's `owner()` scope, and a recorder's own events (std.sessions). `TableSearch` (std.tables) takes its clock from `ctx` only: without one it never navigates. The `@keel/compiler/std/*` and `@keel/compiler/inspect/*` files a stdlib package imports are public: `stdConfig`, `bindStd` (binds std data to a ctx as `createApp({ std })` does) and `clientStd` (k.module Std config), `inspector`, `INSPECT_PATH` (`/__keel/inspect`) and `LOOPBACK` (the loopback host names the inspect document is served to; k.inspect).

**By kind.** Where the kernel reads a stdlib package's `./tools`, `./routes`, `module.ts` or `std` config (k.module), or reads its exported route tables and schemas as the package's (k.privacy E1111, `tableSearch` included as a schema a package export returns), it reads a library's on the same terms, gated by the package's kind, never by its name. A library may declare format types (E1106 reads its files as a package's). A detached scope (E1207) in a stdlib package or a library lives under its `unsafe/`, with its justification.

**Exceptions.** Each is a closed set for 1.0; opening one is additive.
- Shells (k.shell): `@keel/std-capacitor` and `@keel/std-tauri` import `mountRequests` from `@keel/router/internal`, the router's mount-request intake a shell drives. A third shell package would need the same seam.
- Topology storage and shells: the generated entries import `@keel/std-db/<storage>`, `@keel/std-capacitor` and `@keel/std-tauri` by name, and `keel check` names them as the dependency a `topology.ts` value needs.
- Commands (k.cli): `session` and `report` are the slots `stdCommand` fills; a package adds rules and formatters, no command.

**Rules.** In this repository `tooling/structure-lint.mjs` enforces the section from `tooling/deps.json`: S0012 a file in a stdlib package's `src/` or `unsafe/` names a kernel `internal` entry (import, re-export, `import()`, `require()`) that `deps.json` `internal` does not list for that package · S0013 code (not a comment) in a kernel package's `src/` naming `@keel/std-` in a file `deps.json` `names` does not list. In an app, E1576 (k.security) applies to a library's files, the stdlib's included, with the shell exception as its one allowance.

**Conformance.**
- `secretPath(s.secret(s.string()))` is `""`; over `{ a: int, b: { c: secret(int) } }` it is `b.c`; over `{ x: secret, y: secret }` `x`; over `array(record({ k: secret(int).nullable() }))` `k`; over `union([int, { m: secret(int).optional() }])` `m`; over `{ a: json, b: array(enum) }` null.
- for a fixture format with `gen: { from: s.int(), map: (n) => n * 2 }` and an even `check`, `sampleFormat(node, () => 3)` is 6; with a `check` refusing every value, and for a non-format node, it is undefined.
- `TableSearch` rendered in one of two mounted routers navigates that one, through the public `navigate`.
- a replay whose third input cannot apply records one E2003 `error` (`data.at` `sessions.replay`), and its `reproduced` is false.
- with `deps.json` as shipped: `import { mountRequests } from '@keel/router/internal'` in `packages/std-tauri/src/a.ts` passes; `@keel/store/internal` there, and `@keel/schema/internal` in `packages/std-x/src/a.ts`, are each one S0012; `@keel/std-jobs/tools/internal` in `packages/std-x/src/a.ts` passes.
- `"@keel/std-x"` in an unlisted kernel `src/` file is one S0013; in a comment it is not.
