# ADR-0073: deployables are placed only by `topology.ts` and served by a generated entry (RFC 0080)

**Status:** accepted (2026-11-10), user decisions D1 and D2, under the WORKFLOW RFC defaults 1, 2 and 3.

**Context.** Each node deployable starts from a hand-written `server.ts` that imports one module's routes, names its deployable and reads its own environment variables. Moving a module to another deployable means editing that file, so a split is a source change. `createApp` already keeps the routes whose module the served deployable lists, but merging modules is left to the author. k.server is at the 1,500-token cap.

**Decision.** `topology.ts` is the only file that places a module; a module, app or stdlib, is in one deployable. A deployable's route table is the union of its app modules' `routes`. `keel build` bundles a generated entry per `node` deployable into `dist/<name>/server.mjs` with every dependency; the entry is a virtual module of the compiler plugin, never a source file. It parses `process.env` with `DeployEnv` (`PORT`, `KEEL_ORIGIN`, `KEEL_SECRET`, `KEEL_PEER_<NAME>`), prints one E1560 naming a failing key and never its value, serves `createApp` through `@keel/server/start`, and on SIGTERM or SIGINT stops listening and awaits `close()`. `createApp({ origin })` sets the public origin for `url`, the same-site check and `Secure`. A path served by two deployables is E1559. k.server's Topology paragraph and its rules E1552 and E1553 move into a new section, k.topology, unchanged in meaning; `keel dev` serves every deployable in one process on one origin.

**Alternatives.**
- A hand-written `server.ts` per deployable, rejected: each split edits it, and every app repeats it.
- One hand-written entry reading `KEEL_DEPLOYABLE`, rejected: every deployable's bundle would hold every module's server code.
- A front proxy image in front of the deployables, rejected: an external integration and a second router for dev.

**Consequences.**
- golden-1, golden-2 and `apps/sessions` drop `server.ts`; `apps/sessions` reads `KEEL_SECRET` and `PORT` instead of its own names.
- The entry is the only code that reads `process.env`; an app has no source for its own secrets until a later RFC adds them through `ctx`.
- `@keel/server` gains the `./start` export (node only, 2 kB budget) and `@hono/node-server` as a dependency.
- k.topology is at 1,496 tokens; its next change needs a split.
