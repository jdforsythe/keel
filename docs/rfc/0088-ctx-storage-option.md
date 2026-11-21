# RFC 0088: `createCtx({ storage })` and a file storage for Node

Status: implemented. Accepted by the orchestrator (2026-11-12) under WORKFLOW RFC defaults 1 and 3; it adds a hand-written API shape, so the user confirms or reverses it (`docs/HANDOFF.md`, pending decisions). For backlog 0374.

## Problem
k.topology says `keel dev` runs each `node` deployable with "real `ctx`, storage in `.keel-dev/`". The real `ctx.storage` is the platform `localStorage`, which Node has only when started with `--experimental-webstorage --localstorage-file`. `keel dev` is one plain `node` process, so every request of a module using `ctx.storage` answered 500 `keel.unexpected` and each runner logged a rejection every second. One global `localStorage` file would also be shared by every deployable in the process.

## Proposal
- `createCtx({ storage })` takes a `KeyValueStorage` (`get(key)`, `set(key, value)`, both async, string values) that backs `ctx.storage` in real and shell modes in place of the platform `localStorage`. Sim storage stays an in-memory map and ignores it.
- `@keel/ctx/node` exports `fileStorage(path)`: one JSON file of strings, read on first use, rewritten whole through a temporary file and a rename on each `set`. One process owns a file.
- The generated dev entry gives each `node` deployable `fileStorage('<root>/.keel-dev/<name>.storage.json')`.
- When no storage is available the error names both fixes: the Node flags and `createCtx({ storage })`.

## Alternatives
- **`NODE_OPTIONS=--localstorage-file` for the dev process.** One file for every deployable, and it works only when Node is started with flags.
- **A storage capability registered by the cli.** `register` is for new capabilities; `storage` is a built-in one, and a second registration is E1602.
- **A coded diagnostic for unavailable storage.** No free code fits (E1604 is taken by RFC 0082); the message carries the fix.

## Spec diff
- **k.ctx** API: one sentence for the option and `fileStorage`; one Conformance clause.
- **k.topology**: no change; its Local topology sentence already says `.keel-dev/`.

## Conformance diff
New file `packages/ctx/conformance/storage-option-0088.test.ts`: a value `set` through `createCtx({ storage: fileStorage(f) })` is read by a second ctx over the same file; a sim ctx given `storage` never calls it.

## Migration
None. The production entry keeps the platform `localStorage` file.

## Token impact
k.ctx gains about 60 tokens, offset by rewording. `@keel/ctx` 2,113 B of 3 kB; `@keel/ctx/node` 434 B.
