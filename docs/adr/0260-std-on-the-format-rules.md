# ADR-0260: library entries, store makers, a library's lifted E1207, std-workflows' server entry (RFC 0238)

**Status:** accepted (orchestrator, 2026-11-25).

**Context.** A library's files are read as the app's for every rule (RFC 0163). Moving std-jobs, std-statecharts and std-workflows onto the format met four rules a library cannot satisfy as an app module does: E1151 with no way to make a `./tools` entry public, E1107 at a store whose schema is the caller's, E1207 at a detached scope k.parity places under `unsafe/`, and E1551 or E1004 in a package whose whole API is server code.

**Decision.**
- A subpath a library's `exports` names as written, with no `*`, is an entry: no E1151, still E1152. A subpath a `./*` pattern reaches is a file, judged by `public.exports`.
- A library function whose `store` call's state schema the read cannot take only at its parameters is a store maker: E1107 judges each call of it in client code, at the call, with the caller's arguments; the library's call is not judged. `s.enum` and `s.literal` arguments are values.
- E1207 is lifted inside a library's `unsafe/` ranges, not an app module's.
- `@keel/std-workflows`' entry is `src/index.server.ts`, server-only: a client value import is E1004, a type import is not.

**Alternatives.**
- Restructure each library instead: tool readers as public files, `chart` without a caller's schema, a `./server` subpath moving every app import; E1207 has no restructure.
- Entries in `public.exports`: each entry written twice.
- A declared store-maker marker: a hand-written path the check would verify anyway.
- E1207 lifted everywhere: an app could detach a scope.

**Consequences.** k.module, k.leave, k.reactive and std.workflows gain Conformance clauses and read `implemented` until they are covered. An app's E1107 coverage reaches through a library's store makers; a library's detached scope counts in the ledger as an `unsafe` escape.
