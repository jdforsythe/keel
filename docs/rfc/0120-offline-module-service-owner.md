# RFC 0120: std.offline: the outbox sends through `service({ module })`, and each entry has an owner

Status: accepted (user, 2026-11-17). For backlogs 0501 and 0509. ADR-0146 records it.

## Decisions
- D1 (user): the outbox is bound to its module's service. `outbox(id, api, { module, limit, maxBytes })` sends through `service({ module, schema: api })` (k.services), and reads answers as `service({ module })` reads them. `send(ctx, outbox, endpoint, input, { base, owner })` takes no origin, and entries hold no `origin`.
- D2 (user): each entry carries an owner stamp, and `drain` does not post entries of another owner.
- D3: the owner is a string the app gives to `send` and `drain` (Choices C1). Entries of another owner become `failed` with `offline.owner`, visibly and durably; none is dropped in silence (C2).
- D4: a stored entry that still holds an `origin`, or holds no `owner`, loads `failed` with `offline.owner` and is never posted (Migration).
- D5: std.offline gains two conformance bullets, appended at the end as 13 and 14. The section stays under 1,500 tokens by tightening its prose (Spec diff).

## Problem
Read on `jdforsythe/test-impl` at `81bc3a54`.

- 0509: the flush calls `service({ base: e.origin, schema: c.wire })` (`packages/std-offline/src/internal/flush.ts:46`). `c.wire` is a second map that `outbox` derives (`src/outbox.ts:42-47`): every output and the 409, 502 and declared error statuses as `s.json()`. `internal/outcomeOf.ts` then reads each answer by hand: it unwraps a route `Result`, tries the endpoint's schema on the inner value and then on the whole body, and maps a 502 `keel.unreachable` to `queued`. That is a second reading of what `service({ module })` already does (k.services Encoding), with a fallback that accepts two answer shapes. golden-1 declares its outputs as the whole k.server answer to fit it (`apps/golden-1/modules/todos/WriteAnswer.schema.ts`, `WriteRefusal.schema.ts`).
- 0501: the origin a write goes to is stored in the entry (`src/send.ts:41`) and used unchecked on load and flush (`internal/load.ts:19-28`, `flush.ts:46`). A stored entry with `origin: 'https://evil.example'` is posted there, body and write key included, so std.offline Privacy ("go only to their endpoint") does not hold for stored data. Entries carry no owner: after one user signs out, the next user's `drain` in the same browser posts the first user's queued writes under the new caller cookie.

## Proposal
**Outbox** (`src/outbox.ts`, `src/internal/Config.ts`). `opts` is `{ readonly module: string; readonly limit?: number; readonly maxBytes?: number }`; `module` is required. `wire` and `outcomeOf`'s unwrapping go. `Config` holds `client: service({ module, schema })`, where `schema` is `api` with `errors[409]` set to `s.json()` on each endpoint that declares no 409 (the flush reads a refusal's `data.transaction` and `data.head` whatever the endpoint declares), and `owners: WeakMap<Ctx, string>`, the owner last given on each ctx.

**Entries** (`src/OutboxEntry.schema.ts`). `origin: s.string()` becomes `owner: s.string()`.

**Errors** (`src/OutboxResult.ts`). `failed`'s `error` adds `KeelError<'offline.owner', {}>`, built as `{ code: 'offline.owner', message: <outbox id>, data: {} }`.

**Owner** (new `src/internal/own.ts`). `own(ctx, c, owner)` sets `owners` for `ctx`; when the owner changes, it settles every entry whose `owner` differs and whose state is not `failed` as `failed` with `offline.owner` and stores the outbox. It writes `ctx.storage` only when it changed an entry, so RFC 0112's storage schedules count the same `get` and `set` calls.

**Send** (`src/send.ts`):

```ts
export async function send<const D extends EndpointMap, K extends keyof D & string>(
  ctx: Ctx, o: Outbox<D>, endpoint: K, input: SendInput<D, K>,
  opts: { readonly base: number; readonly owner: string },
): Promise<OutboxResult<Output<D, K>>>
```

It loads, calls `own(ctx, c, opts.owner)`, then adds `{ key, endpoint, owner, input, base, at, state: 'queued' }` as today.

**Drain** (`src/drain.ts`): `drain(ctx, o, opts: { readonly owner: string })`; it loads, calls `own`, then flushes as today.

**Load** (`src/internal/load.ts`). Entries parse one at a time, not as one `OutboxState`. An entry that holds `origin`, or no string `owner`, is added `failed` with `offline.owner`, `owner` `""` and no `origin`; an entry of an owner other than the ctx's is added `failed` with `offline.owner`; others load as today. When any entry loaded `failed` this way, the outbox is stored once after the load. A value that is not JSON, or whose `entries` is not an array, still loads nothing.

**Flush** (`src/internal/flush.ts`, `internal/outcomeOf.ts`). An entry is posted only when it is `queued` and its `owner` is `owners.get(ctx)`; with no owner given on the ctx, nothing is posted (a `'mine'` `resolve` then resolves `queued`). The call is `c.client[e.endpoint](...)`. `outcomeOf` maps the client's `Result`: `ok` is `sent` with the decoded value; `api.network` (which includes a 502 `keel.unreachable` for a module service) and `api.timeout` are `queued`; `api.status` 409 whose body has a string `data.transaction` and a number `data.head` is `conflict`; another 409, once, is sent again; anything else is `failed` with the `ApiError`.

**Resolve.** No signature change. `'mine'` only re-queues `conflict` entries, which belong to the ctx's owner after `own`, and its flush posts under that owner.

`unsafe` count unchanged (`unsafe/asResult.ts` stays).

## Alternatives
- The owner read from the caller cookie: the cookie is `httpOnly` and an event-stream GET never sets one (k.server), so the client cannot read it; a server round-trip to learn it fails offline, when the outbox matters.
- An owner given once to `outbox(...)`: the declaration is module-level and runs before anyone signs in.
- Other owners' entries kept in storage, untouched, until their owner returns: a second user's session would carry and rewrite them on every store; the user asked that `drain` fail or drop them.
- Dropping them silently: a write the user made disappears with no trace.
- Rewriting a stored `origin` to the module's address: it would post writes whose owner nobody knows.

## Spec diff
std.offline: 5,776 characters (1,444 tokens) before, 5,993 (1,499 tokens) after. To make room, the section is tightened: the Extension points paragraph drops its list of `ctx` members; the Declare paragraph drops the E2651 sentence (the Rules line and conformance bullet 9 state it); the Flush bullets, the `drain` paragraph, Resolve and Privacy are shortened as below. No conformance bullet text changes.

Extension points, whole new text:

```
**Extension points.** Check rule registry: E2651 through `@keel/std-offline/tools`.
```

Declare code block:

```ts
export const boardOutbox = outbox('todos.outbox', BoardApi, { module: 'api', limit: 100 })
```

Declare paragraph after it, whole new text:

```
`outbox(id, api, { module, limit = 100, maxBytes = 262144 })`, over the k.services `endpoints` of module `module`'s routes, creates client store `id` (prefixed, E1155), state `{ entries: OutboxEntry[] }`, changed only by `<id>.add`, `<id>.settle` and `<id>.resolve`. `OutboxEntry` is `{ key, endpoint, owner, input, base, at, state, head?, error? }`, `state` `queued`, `sending`, `conflict` or `failed`.
```

Write, whole new text of the paragraph, its code block and the paragraph after it:

```
**Write.** An outbox endpoint's `body` holds `write: Write`, `s.object({ key: s.id('Write'), base: s.int({ min: 0 }) })`; its action passes it on: `tx(t, payload, { meta, ...input.write })` (k.sync).
```

```ts
const r = await send(ctx, boardOutbox, 'editTodo', { params: { todoId }, body: { title } }, { base: view.get('head'), owner })
```

```
`send` adds an entry with `body.write` `{ key: ctx.random.id('Write'), base }`, stores the outbox at `ctx.storage` `keel.outbox.<id>`, and flushes. It resolves `OutboxResult<O>`: `{ state: 'sent', value }`, `{ state: 'queued' }` (offline or network failure), `{ state: 'conflict', head }` or `{ state: 'failed', error }`, `error` an `ApiError`, `offline.full`, `offline.storage` or `offline.owner`. A full outbox (`limit` entries, `maxBytes` encoded) resolves `failed` with `offline.full`, adding nothing. A rejected `ctx.storage` write in `send`, a flush or `'mine'` leaves the entry `failed` with `offline.storage` in memory and releases the flush, posting nothing more.
```

New paragraph before Flush:

```
**Owner.** `send` and `drain` require `owner`: the signed-in user's id, else `""`; an entry holds its `send`'s. A flush posts only entries of the owner last given on the ctx. When it changes, and on load, each other owner's entry not `failed` is stored `failed` with `offline.owner`, as is a stored entry with an `origin` or no `owner`. A `failed` entry is never posted.
```

Flush, whole new text of the lead and the bullets:

```
**Flush.** In order, one request at a time, through `service({ module, schema: api })`, answers read as `service({ module })` reads them (an undeclared 409 as a KeelError):
- 2xx: `sent`; the entry is removed.
- `api.network` or `api.timeout`: it stays `queued`; flushing stops until `{ kind: 'net', online: true }`, the next `send`, or 1 s later doubling to 60 s on `ctx.clock` while `online()`.
- 409 `keel.conflict` with `data.transaction` (k.sync): `conflict`, keeping `data.head`; the next entry goes.
- 409 without it: sent once more; a second is `failed`.
- Any other status: `failed` with its `ApiError`; the next entry goes.
```

The `drain` paragraph, whole new text:

```
`drain(ctx, outbox, { owner })`, in a scope, loads the stored outbox (`sending` as `queued`) and flushes, again on each reconnect until the scope is disposed. A resent entry keeps its key, so a committed write commits nothing again (k.sync).
```

Resolve, whole new text (same rules as RFC 0112's text):

```
**Resolve.** `resolve(ctx, outbox, key, 'mine' | 'theirs')`. `'mine'` queues a `conflict` entry again, last, with `base` its `head`, flushes, and resolves its `OutboxResult` as `send` does. `'theirs'` removes a `conflict` or `failed` entry, resolving `true`. Without one, each resolves `false`, changing nothing. The outbox log records each as `<id>.resolve` `{ key, resolution }`.
```

Privacy, whole new text:

```
**Privacy.** Entries stay in browser storage and go only to their endpoint on `module`, for their owner; E2651 keeps secrets out. Sessions record its transactions under the module's `redact`.
```

Rules: unchanged. Conformance, appended as bullets 13 and 14:

```
- On an unbound sim ctx, `send` posts to `http://<module>.keel.invalid` plus the path; the stored entry has `owner`, no `origin`.
- Stored entries of owner `a`: `drain` with `a` posts them; with `b`, none, each `failed` with `offline.owner`, as is one with an `origin` or no `owner`; so does `send` with `b` after `a`'s.
```

## Conformance diff
One `rfc:0120` commit by the `conformance-writer`. Changed files (call shapes and the fixture server; no assertion changes):
- `packages/std-offline/conformance/fixtures.ts`: `:17` `ORIGIN` becomes `http://todos.keel.invalid`, with new exports `MODULE = "todos"` and `OWNER = "u1"`; `:106` the 2xx answer becomes `{ ok: true, value: { head, title } }` (a module service reads the route's `Result`; the 409, 422, 500 and 502 bodies are already `{ ok: false, error }`); `:150` `outbox(id, Api, { module: MODULE, ...opts })`; `:167-170` `startDrain(ctx, o, owner = OWNER)` calls `drain(ctx, o, { owner })`.
- Each `send(ctx, c.o, ORIGIN, endpoint, input, { base })` becomes `send(ctx, c.o, endpoint, input, { base, owner: OWNER })`, and the import line takes `OWNER` for `ORIGIN`: `backoff.test.ts:7,17,44`, `conflict-409.test.ts:8,21,22,44,57,74`, `deterministic.test.ts:6,25`, `flush-order.test.ts:7,26`, `full.test.ts:7,18,23`, `lost-response.test.ts:6,16`, `queue-offline.test.ts:10,36` (and `:52` `drain(next, c2.o, { owner: OWNER })`), `resolve.test.ts:8,17,29,80`, `send-online.test.ts:7,17,27`, `resolve-result.test.ts:5,13,40`, `storage-fail.test.ts:6,24,38,44`.
- `e2651.test.ts:42` `outbox(..., api, { module: "todos" })`; `:71` the fixture source `outbox("todos.outbox", TodosApi, { module: "todos", limit: 100 })`.

New files:
- `packages/std-offline/conformance/module-service.test.ts`, citing bullet 13: on an unbound sim ctx with a route at `http://todos.keel.invalid/todos/t1` answering `{ ok: true, value }`, `send` resolves `{ state: 'sent', value }`; offline, the raw `keel.outbox.<id>` JSON holds an entry with `owner` `OWNER` and no `origin` key.
- `packages/std-offline/conformance/owner.test.ts`, citing bullet 14: three `send`s offline under owner `a`; on a new ctx over that storage, online, `drain` with `a` posts all three in order; on another new ctx, `drain` with `b` posts nothing, and every entry, in the store and in storage, is `failed` with `error.code` `offline.owner`. A hand-written stored outbox with one `queued` entry holding `origin: 'https://evil.example'` and no `owner`, and one with neither: under `drain` with `""` and with `a`, both are `failed` with `offline.owner`, nothing reaches `https://evil.example` or the module, and `resolve(..., 'theirs')` removes them. On one ctx, a `send` offline with `a`, then online with `b`: `a`'s entry is `failed` with `offline.owner` and `b`'s is posted.

## Migration
Stored data: an entry written before this change holds `origin` and no `owner`. On load it becomes `failed` with `{ code: 'offline.owner', message: <outbox id>, data: {} }`, `owner` `""`, and no `origin`, and the outbox is stored so; it is never posted, under any owner, and `resolve(..., 'theirs')` removes it (`'mine'` applies only to `conflict`). A write queued offline before the upgrade is therefore not sent: the browser cannot tell whose it was. An app that shows failed entries (golden-1's outbox panel) shows it until the user dismisses it.

API: `outbox(id, api, opts)` requires `opts.module`; `send` loses its `origin` argument and takes `owner` in its options; `drain` takes `{ owner }`; outputs and error schemas describe the route's `ok` value and its `error`, not the whole k.server answer. In this repo:
- `packages/std-offline/src/`: `outbox.ts`, `send.ts`, `drain.ts`, `OutboxEntry.schema.ts`, `OutboxResult.ts`, `internal/Config.ts`, `internal/flush.ts`, `internal/load.ts`, `internal/outcomeOf.ts`, new `internal/own.ts`.
- `packages/std-offline/test/`: every `ORIGIN` route and every `outbox`, `send` and `drain` call in `sendStorage.test.ts`, `lifetime.test.ts` (and its stored entry with `origin`, `:21`), `flush.property.test.ts`, `unreachable.test.ts`, `outbox.test.ts` (and its hand-built entry, `:58`) and `resolveResult.test.ts`; `moduleAnswers.test.ts` is rewritten (the whole-body fallback is gone); `packages/std-offline/README.md` (the `outbox`, `send`, `drain` lines and the "One flush per outbox" paragraph, which becomes "each through `service({ module, schema: api })`, read as `service({ module })` reads answers").
- `apps/golden-1/modules/todos/boardOutbox.ts:12` `outbox("todos.outbox", boardWrites, { module: "api" })`; `TodoRow.tsx:22-25`, `createList.server.ts:10-11`, `createTodo.server.ts:11-12`, `updateTodo.server.ts:21-25` drop `origin` and pass `owner: ""` (golden-1 has no sign-in); `AppShell.tsx:46` `drain(ctx, boardOutbox, { owner: "" })` (its `origin` stays for `live`); `WriteAnswer.schema.ts` becomes `s.object({})`; `WriteRefusal.schema.ts` becomes the `FieldsReply` itself, so `formAnswer.ts:24` parses the err's `error`.
- `apps/golden-1/test/formAnswer.test.ts:10,22`, `outbox.sim.test.ts:20,54,59`, `board.test.ts:217`.
- `docs/guide/build-golden-1.md:1062-1070,1238-1294,1379,1862`; `.claude/skills/keel-writes/SKILL.md:12`; `evals/tasks/golden-1-api/TASK.md:37-38` and `spec-slice.txt:156`.

## Build order
1. Orchestrator: the spec diff (applied). The `conformance-writer`: the conformance diff, one `rfc:0120` commit.
2. One std-offline lane owns `packages/std-offline/src/**`, `packages/std-offline/test/**`, `packages/std-offline/README.md`, the golden-1 files listed under Migration, and a changeset (`@keel/std-offline` minor, breaking before 1.0: `outbox` requires `module`, `send` takes no origin and requires `owner`, `drain` requires `owner`). It runs `check`, `build`, the std-offline suite and the golden-1 suite once each, and `pnpm budgets` (`@keel/std-offline` is held to `3kb`; the derived map and the whole-body fallback leave, the owner sweep comes in).
3. Orchestrator: `docs/guide/build-golden-1.md`, the `keel-writes` skill, the `golden-1-api` eval task text, ledger, backlogs 0501 and 0509 closed, HANDOFF.

## Token impact
std.offline 1,444 to 1,499 tokens (5,776 to 5,993 characters). No other section changes. The map is unchanged.

## Choices
- C1: the owner is a string the app passes to `send` and `drain`, required on both. The client cannot read the caller cookie (`httpOnly`), and `outbox` is declared before sign-in. Required, not defaulted: an app with sign-in that forgot it would stamp every entry `""` and keep the bug; an app without sign-in writes `owner: ""` once per call site.
- C2: the owner is per ctx, the last one given; changing it fails the other owner's live entries at once. The invariant "every entry not `failed` belongs to the ctx's owner" keeps `resolve` free of an owner argument.
- C3: another owner's entry is `failed` with `offline.owner`, stored, never posted, removable with `'theirs'`: closed and visible. An app that must not show one user's pending write to the next filters failed entries by `owner`, which each entry holds.
- C4: a stored entry with an `origin` or no `owner` takes the same path, with owner `""`; it is never posted, so `""` cannot be used to send it.
- C5: an endpoint that declares no 409 still has its refusal read: the outbox gives the client `errors[409]: s.json()`, so `data.transaction` and `data.head` reach the flush.
