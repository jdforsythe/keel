# RFC 0112: std.offline: `offline.storage` and the answer to `resolve(..., 'mine')`

Status: accepted (orchestrator under the owner's standing leave, 2026-11-17). For backlogs 0510 and 0527. ADR-0134 records it.

## Decisions
- D1: `offline.storage` is spec. `OutboxResult`'s `failed` names its three errors: an `ApiError`, `offline.full` or `offline.storage`. A write to `ctx.storage` that rejects, in `send`, a flush or a `'mine'` `resolve`, leaves the entry `failed` with `offline.storage` in memory, posts nothing more and releases the flush. The code does this today (`packages/std-offline/src/send.ts:49-54`, `internal/flush.ts:78-83`); the spec did not say it.
- D2: `resolve(ctx, outbox, key, 'mine')` awaits the re-send and resolves that entry's `OutboxResult`, as `send` does, or `false` when nothing applied. `'theirs'` resolves `boolean` as now.
- D3: one function with overloads by the literal resolution (Choices C1).
- D4: std.offline gains two conformance bullets, one per backlog, appended at the end.

## Problem
Read on `jdforsythe/test-impl` at `e11d5981`.

- 0510: `OutboxResult`'s `failed` carries `offline.storage` when `send`'s own storage write rejects (`send.ts:51`) and when a flush's write rejects (`flush.ts:80`). std.offline names `offline.full` only, so the code was chosen by the implementer and no conformance case holds it.
- 0527: `resolve(..., 'mine')` re-queues the entry, starts a flush with `void flush(ctx, c)` and resolves `true` (`packages/std-offline/src/resolve.ts:23`). The caller cannot see the answer to the re-send: whether it was `sent`, refused again (`conflict`), `failed` or still `queued`. golden-1's editor chart follows the outbox's entries to learn it (`apps/golden-1/modules/todos/editorFollow.ts`). `flush(ctx, c, key)` already resolves one entry's settlement; `send` uses it.

## Proposal
**Storage.** No code change for `send` and the flush. `resolve(..., 'mine')` guards its own `persist` as `send` does: a rejection settles the entry `failed` with `offline.storage` in memory and resolves `{ state: 'failed', error }`.

**Resolve.** In `packages/std-offline/src/resolve.ts`:

```ts
export function resolve<const D extends EndpointMap>(ctx: Ctx, o: Outbox<D>, key: string, resolution: 'mine'): Promise<false | OutboxResult<Outputs<D>>>
export function resolve<const D extends EndpointMap>(ctx: Ctx, o: Outbox<D>, key: string, resolution: 'theirs'): Promise<boolean>
export function resolve<const D extends EndpointMap>(ctx: Ctx, o: Outbox<D>, key: string, resolution: Resolution): Promise<boolean | OutboxResult<Outputs<D>>>
```

`Outputs<D>` is the union of the api's endpoint outputs: a key does not say which endpoint its entry names. `'mine'`, once it has queued the entry and stored the outbox, resolves `ctx.net.online() ? await flush(ctx, c, key) : { state: 'queued' }`, read through the existing `unsafe/asResult.ts`, so the unsafe count is unchanged. A flush already running picks the entry up in order and settles it; a flush that stops before reaching it (a network failure on an entry ahead) resolves `queued`, as `send` does. `'theirs'` and the `false` paths are unchanged.

## Alternatives
- One return type for both, `Promise<boolean | OutboxResult<Outputs<D>>>`: every literal caller narrows a value it knows the shape of.
- A `{ state: 'dropped' }` result for `'theirs'`: a state `send` never returns, in a type `send` shares.
- A separate `resolveMine` returning the result: two names for one choice the user makes in one control.
- `'mine'` resolving `true` and the result through `observe`: the caller still waits on something else to learn the answer.

## Choices
- C1: overloads by literal, with a third for a `Resolution`-typed argument (`OutboxPanel.tsx` and `resolveEdit.ts` pass one). Each literal call gets one meaningful type; no cast is needed, since an overload's implementation signature is the wide one. A conditional return type would need a cast in the body.
- C2: `'mine'` resolves what `send` would for that entry: `sent`, `queued`, `conflict` or `failed`. A second `conflict` is an answer, not `false`.
- C3: `'theirs'` when its storage write rejects keeps today's behavior (the promise rejects) and the spec does not state it; nothing asks for more.

## Spec diff
std.offline, the paragraph after the Write code block, whole new text:

```
`send` adds an entry whose `body.write` is `{ key: ctx.random.id('Write'), base }`, writes the outbox to `ctx.storage` key `keel.outbox.<id>`, and flushes. It resolves `OutboxResult<O>`: `{ state: 'sent', value }`, `{ state: 'queued' }` (offline, or the network failed), `{ state: 'conflict', head }` or `{ state: 'failed', error }`, `error` an `ApiError`, `offline.full` or `offline.storage`. A full outbox (`limit` entries, or `maxBytes` of encoded entries) resolves `failed` with `offline.full` and adds nothing. A write to `ctx.storage` that rejects, in `send`, a flush or a `'mine'` `resolve`, leaves the entry `failed` with `offline.storage` in memory, posts nothing more and releases the flush.
```

std.offline, the Resolve paragraph, whole new text:

```
**Resolve.** `resolve(ctx, outbox, key, resolution)`, `resolution` `'mine'` or `'theirs'`. `'mine'` queues a `conflict` entry again, last, with `base` set to its `head`, so the write applies over what it conflicted with, flushes, and resolves that entry's `OutboxResult` as `send` does. `'theirs'` removes a `conflict` or `failed` entry and resolves `true`. With no such entry, each resolves `false` and changes nothing. The outbox log records each as `<id>.resolve` `{ key, resolution }`.
```

std.offline Conformance, appended as bullets 11 and 12:

```
- With a sim schedule `storage: ['ok', 'fail']` (the load's `get`, then `send`'s `set`), `send` resolves `failed` with `offline.storage`, posts nothing and leaves the entry `failed`; with `['ok', 'ok', 'fail']` the flush's `set` fails, the entry is `failed` with `offline.storage`, and the next `send` posts.
- Online, `resolve(ctx, o, key, 'mine')` resolves `sent` with the endpoint's output once the re-send answers; offline, `queued`; for a key with no `conflict` entry, `false`. `'theirs'` resolves `true` when it removed an entry, else `false`.
```

std.offline: 4,831 characters after RFC 0111 (4,766 before it) to 5,776.

## Conformance diff
One `rfc:0112` commit by the `conformance-writer`:
- New `packages/std-offline/conformance/storage-fail.test.ts`, citing bullet 11: a sim ctx with `schedule: { storage: ['ok', 'fail'] }` (k.sim: the n-th `get` or `set` takes `storage[n]`); `send` resolves `{ state: 'failed', error }` with `error.code` `offline.storage`, the server sees no post, and the entry is `failed`. With `['ok', 'ok', 'fail']` (the load, `send`'s write, the flush's `sending` write) the entry is `failed` with `offline.storage`, and a later `send` is posted.
- New `packages/std-offline/conformance/resolve-result.test.ts`, citing bullet 12: online, after a conflict, `resolve(ctx, o, key, 'mine')` resolves `{ state: 'sent', value }` with the endpoint's output; with `setOnline(false)` it resolves `{ state: 'queued' }`; for an unknown key, and for a `queued` entry, it resolves `false`; `'theirs'` resolves `true` for a `conflict` entry and `false` for an unknown key.
- `packages/std-offline/conformance/fixtures.ts:20`: `simCtx` takes an optional `schedule`, passed to `createCtx` (a change to an existing file, so under the tag).

`resolve.test.ts` is unchanged: it awaits `resolve` and does not read its value (lines 31, 48, 63, 84).

## Migration
`resolve(..., 'mine')` resolves `false | OutboxResult` instead of `boolean`, and returns once the re-send answers or the flush stops. In this repo:
- `apps/golden-1/modules/todos/resolveEdit.ts:21`: `const applied = await resolve(ctx, boardOutbox, key, resolution)` gets the third overload; `return applied && editorFollow().ok` becomes `return applied !== false && editorFollow().ok`, so `resolveEdit` keeps resolving `boolean` and `apps/golden-1/test/editor.test.ts:117` holds.
- `apps/golden-1/test/editor.test.ts:120` (Keep mine): `resolveEdit(..., 'mine')` returns once the re-send has answered and the chart has followed it (`editorFollow`), so the chart is `viewing` there, no longer `saving`. The test changes to expect `viewing`: awaiting the re-send is what this RFC is for.
- `apps/golden-1/modules/todos/OutboxPanel.tsx:37`: `void resolve(...)`; no change.
- `apps/golden-1/modules/todos/formAnswer.ts:22`: `'theirs'`; no change.
- `packages/std-offline/test/outbox.test.ts:48-50`: `toBe(false)` for an entry that is not `conflict`; no change.
- `packages/std-offline/README.md`: the `resolve` and `OutboxResult` lines.

## Build order
1. Orchestrator: the spec diff (applied). The `conformance-writer`: the conformance diff.
2. A std-offline lane owns `packages/std-offline/src/resolve.ts`, `packages/std-offline/src/index.ts` if a type export changes, `packages/std-offline/test/**`, `packages/std-offline/README.md` (the `resolve` line, and the "A resent entry keeps its key" line takes RFC 0111's bound), `apps/golden-1/modules/todos/resolveEdit.ts`, `apps/golden-1/test/editor.test.ts` (the Keep mine case) and a changeset (`@keel/std-offline` minor: `resolve`'s return type). It runs `check`, `build`, the std-offline suite and the golden-1 suite once.
3. Orchestrator: `.claude/skills/keel-writes/SKILL.md` (the `resolve` line), ledger, backlogs 0510 and 0527 closed (and 0526, whose repro the storage case covers: `send` already resolves `failed`), HANDOFF.

## Token impact
std.offline 1,208 to 1,444 tokens (1,192 before RFC 0111). No other section changes. The map is unchanged.
