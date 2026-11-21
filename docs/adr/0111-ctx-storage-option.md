# ADR-0111: `createCtx({ storage })` backs `ctx.storage`; `fileStorage` keeps one JSON file on Node (RFC 0088)

**Status:** accepted by the orchestrator (2026-11-12) under the WORKFLOW RFC defaults 1 and 3; awaiting the user's confirmation of the API shape.

**Context.** `keel dev` runs every `node` deployable in one plain Node process, where the platform `localStorage` does not exist, so any module using `ctx.storage` failed. k.topology already places dev storage in `.keel-dev/`.

**Decision.** `createCtx({ storage })` takes a `KeyValueStorage` used in real and shell modes in place of the platform `localStorage`; sim ignores it. `@keel/ctx/node` exports `fileStorage(path)`, one JSON file rewritten atomically per `set`. The generated dev entry gives each `node` deployable its own file under `.keel-dev/`.

**Alternatives.**
- Node's `--localstorage-file` for the dev process, rejected: one shared file, and flags on every start.
- Registering a second `storage` capability, rejected: E1602.

**Consequences.**
- `keel dev` works with no flags, and deployables do not share state.
- An app may pass its own `KeyValueStorage`; the production entry is unchanged.
