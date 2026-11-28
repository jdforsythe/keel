# RFC 0131: std.offline: the action behind an outbox endpoint refuses a write of another owner

Status: implemented. Accepted (orchestrator under the owner's standing leave, 2026-11-18). For red team 7, H2 (task 0338). ADR-0153 records it. Extends RFC 0120.

## Problem
RFC 0120 gave each outbox entry an `owner`, a string the page gives `send` and `drain`, and a flush posts only entries of the owner last given on its ctx. Nothing ties that string to the caller the server sees. The caller (k.server Server state) is the hash of one cookie per browser, shared by every tab, and an app signs a user in by tying that caller to an account in its own store (golden-2's `submitSignIn.server.ts` records `{ caller, userId }`); the cookie does not change at sign-in.

Tab 1 runs as alice and queues three writes offline. In tab 2, alice signs out and bob signs in, so the shared caller is now bob's. Tab 1 comes online; its ctx still has owner `alice`, its flush posts alice's entries, and each action commits under `caller`, which the app now reads as bob (red team 7, H2, reasoned). The body carries only `write: { key, base }` (`packages/std-offline/src/internal/flush.ts`), so the server cannot tell. Two ctxs over one outbox, or two tabs over one stored outbox (red team 7, L4 and L5), reach the same place by another path: whichever ctx or tab flushes, the server cannot check whose write it is.

The orchestrator's decision: this fails closed; alice's queued write must not commit under bob's caller.

## Proposal
The owner travels with the write, and the action checks it against the owner it gives its own caller.

**Write** (`packages/std-offline/src/Write.schema.ts`). `Write` becomes `s.object({ key: s.id('Write'), base: s.int({ min: 0 }), owner: s.string() })`.

**Flush** (`src/internal/flush.ts`). The body is `{ ...body, write: { key: e.key, base: e.base, owner: e.owner } }`. An answer whose error body has `code` `offline.owner` settles the entry `failed` with `fault(c, 'offline.owner')` (std.outbox Errors: `message` the outbox id), whatever its status; the flush goes on to the next entry, as for any other `failed`.

**Check** (new `src/writeFor.ts`, exported from `@keel/std-offline`):

```ts
export function writeFor(write: Write, owner: string): Result<{ readonly key: string; readonly base: number }, KeelError<'offline.owner', Readonly<Record<string, never>>>>
```

It returns `ok({ key: write.key, base: write.base })` when `write.owner === owner`, else `err({ code: 'offline.owner', message: 'owner', data: {} })`. It is pure and client-safe, so it lives in the package's one entry.

**Owner of a caller.** Each module that takes outbox writes has one server function from its caller to an owner, app code with no std API: golden-2's would find `caller` in its sessions store and return the `userId`, else `""`. Its pages give `send` and `drain` the same id, from the signed-in user they already show. An action runs:

```ts
const w = writeFor(input.write, ownerOf(caller, stores))
if (!w.ok) return err(w.error)
const r = tx(stores.editTodo, payload, { meta: { caller }, ...w.value })
```

The err is not a k.server code, so it is answered 400 with the `Result` JSON, and no store is saved (k.server: `err` saves none).

**Cases.**
- Anonymous: a caller signed in as no one is owner `""` on both sides. An app with no sign-in passes `""` everywhere and every write passes. An entry queued as `""` and posted after bob signs in is refused, as alice's is.
- Sign-out: the server's owner becomes `""`, so every entry still queued under alice is refused. Tab 1's `own` sweep (RFC 0120) is unchanged; it covers the tab that signs out, and the check covers every other one.
- In flight: the check runs when the action runs, inside the request. A sign-in in another tab that lands first refuses the write; one that lands after leaves it committed under alice, who was the caller's owner when it committed. A write the server committed whose answer was lost, resent under its key after the owner changed, is refused before k.sync's key check, so its entry is `failed` though the server holds the write.
- The refused entry: `failed` with `{ code: 'offline.owner', message: <outbox id>, data: {} }`, stored, never posted again on any ctx (std.offline Owner: a `failed` entry is never posted), and removed by `resolve(..., 'theirs')`.

## Alternatives
- Bind the owner to the kernel's caller id, so no app string exists: the caller is one cookie per browser and does not change at sign-in, so alice and bob in one browser have the same caller and the check would pass. The cookie is `httpOnly`, and a page offline cannot learn it either.
- A kernel check (k.sync or k.server) on a field of every write: the kernel has callers, not accounts; which account a caller is signed in as lives in app stores. A narrower kernel change, `tx` options other than `meta`, `base` and `key` being `schema.invalid`, would make an action that spreads `input.write` unchecked fail on `owner`; it is left out (Choices C5).
- A client-only guard: a `storage` event on a `keel.owner` key or a `BroadcastChannel` message that tells other tabs the owner changed, so they call `own` before the next post. It cannot be the whole answer. Delivery is asynchronous and not ordered with a fetch already started; a frozen or throttled background tab can post before it handles the message; a sign-in made by a page that does not run the signal (a form post with no script, another app on the origin, a session that expires on the server) sends none. Only the server knows whose caller it is when the write commits. It may still be added later to fail entries before they are posted rather than after.
- Fail every entry of the refused owner at the first refusal: it saves requests, but alice's other entries would be failed on one answer; each refusal settles its own entry.

## Spec diff
New section `spec/std/std.outbox-owner.md` (2,486 characters, 622 tokens), whole text:

```
# std.outbox-owner: Outbox owner check
status: proposed

How the action behind an outbox endpoint (std.offline) refuses a write queued by another owner than the one its caller is signed in as when the action runs.

**Write.** `Write` is `s.object({ key: s.id('Write'), base: s.int({ min: 0 }), owner: s.string() })`; a flush sends each entry's `owner` in `body.write`. The action passes the write through `writeFor(write, owner)` from `@keel/std-offline`, `owner` being the id its module gives the request's `caller` (k.server): the id its pages give `send` and `drain`, `""` for a caller signed in as no one.
(code block: the three action lines above)
`writeFor` returns `ok({ key, base })` when `write.owner` is `owner`, else `err({ code: 'offline.owner', message: 'owner', data: {} })`, which k.server answers 400; no store is saved.

**Refused.** A flush reads an answer whose error `code` is `offline.owner` as `failed` with `offline.owner` (std.outbox Errors), whatever its status, and goes on to the next entry. The entry is never posted again; `'theirs'` removes it.

**When.** The check runs when the action runs. A sign-in or sign-out in another tab before then refuses the write; one after it leaves the write committed under the owner who queued it. A write the server committed whose answer was lost, resent after the owner changed, is refused, so its entry is `failed` though the server holds the write.

**Limits.** An action that spreads `input.write` into `tx` without `writeFor` commits a write of any owner. The check decides which owner a write commits under, not what reaches the server: a refused entry's body reaches the action.

**Rules.** None.
```

Conformance, bullets 1 to 3 of the new section:

```
- `writeFor({ key, base, owner: 'a' }, 'a')` is `ok({ key, base })`; with owner `'b'` or `""` it is `err` with `{ code: 'offline.owner', message: 'owner', data: {} }`; `writeFor({ key, base, owner: "" }, "")` is `ok`.
- With entries queued offline under owner `a` and a route whose action passes `writeFor` owner `b`, `drain` with `a` online posts each with `body.write.owner` `a`, the server store commits nothing, and each entry is `failed` with `{ code: 'offline.owner', message: <id>, data: {} }`.
- After that refusal, `drain` with `a` on a new ctx over that storage posts nothing, and a `send` with `a` to a route whose owner is `a` is posted and resolves `sent`.
```

`spec/std/README.md` gains, after the `std.outbox` row:

```
| std.outbox-owner | Outbox owner check | proposed | `@keel/std-offline`: `writeFor` refuses a write of another owner than the caller's, `offline.owner` |
```

std.offline, for whoever next edits it (its Write paragraph names the old shape): "`s.object({ key: s.id('Write'), base: s.int({ min: 0 }) })`; its action passes it on: `tx(t, payload, { meta, ...input.write })` (k.sync)." becomes "its action passes it through `writeFor` (std.outbox-owner)." No conformance bullet of std.offline changes; bullet 1's `body.write` `{ key, base }` now also holds `owner`.

No kernel section changes.

## Conformance diff
One `rfc:0131` commit by the `conformance-writer`:
- `packages/std-offline/conformance/fixtures.ts`: the sim route passes the body's `write` through `writeFor(write, routeOwner)`, `routeOwner` a fixture option defaulting to `OWNER`, and answers its err as k.server does, 400 `{ ok: false, error }`; the other fixtures keep `OWNER` on both sides, so their assertions hold.
- New `packages/std-offline/conformance/owner-check.test.ts`, citing std.outbox-owner bullets 1 to 3, with a property: for generated owner pairs, `writeFor` is `ok` exactly when they are equal.
- Any assertion that a posted `body.write` equals `{ key, base }` takes `owner: OWNER`.

## Migration
Stored data: none. Entries already hold `owner`; the flush adds it to the body when it posts.

Deploy order: the server first. A client from before this change posts `write` without `owner`, which the new `Write` fails (422 `keel.fields`), so its entry is `failed` with that `ApiError`, not committed. A new client against an old server sends an `owner` the old `Write` does not read.

API: `Write` requires `owner`; each action behind an outbox endpoint passes its write through `writeFor`. In this repo:
- `packages/std-offline/src/`: `Write.schema.ts`, `internal/flush.ts`, new `writeFor.ts`, `index.ts`; `README.md` (the Write line); a changeset (`@keel/std-offline` minor, breaking before 1.0: `Write` requires `owner`; new `writeFor`).
- `apps/golden-1/modules/api/postEdit.server.ts`, `postList.server.ts`, `postTodo.server.ts`, `postToggle.server.ts`: `writeFor(input.write, "")` before `tx`, an err returned as is. golden-1 has no sign-in, so its owner is `""` on both sides.
- `apps/golden-1/test/api.test.ts`, `serverSqlite.test.ts`, `writeSchemas.test.ts`, `packages/std-offline/test/unreachable.test.ts`: hand-built `write` values take `owner: ""`; one golden-1 api case posts `owner: "x"` and expects 400 `offline.owner` with nothing saved.
- `docs/guide/build-golden-1.md` (the Write and action snippets), `.claude/skills/keel-writes/SKILL.md`, `docs/THREAT-MODEL.md` (the limit under Limits).

## Token impact
New section std.outbox-owner, 622 tokens. std.offline unchanged here (one sentence shorter when its Write paragraph is edited). `@keel/std-offline`: `writeFor` about 60 B, the remap of an `offline.owner` answer about 35 B, `owner` in the body and the schema about 20 B: about 115 B against 143 B free (3,185 of 3,328). `@keel/server`: 0 B.

## Choices
Each is the drafter's choice; the operator can reverse any of them.
- C1: the check is in std-offline and app actions, not the kernel; the kernel has callers, the app has accounts.
- C2: `writeFor` is exported from the package's one entry. If the builder finds it over budget, a `@keel/std-offline/server` entry with its own budget line is the fallback, and a budget line is the user's call.
- C3: a refused entry is `failed` alone; the flush goes on, and the next entry of that owner is refused in its turn.
- C4: `Write.owner` is required, so a client from before this change fails closed instead of skipping the check.
- C5: an action that skips `writeFor` is a stated limit, not a kernel error. The alternative, a k.sync sentence "An option other than `meta`, `base` and `key` is `schema.invalid`." beside "A `base`, `key` or `keys` of the wrong type is `schema.invalid`", makes that action's `tx` fail on `owner`; it costs `@keel/store` bytes and a kernel RFC under the provisional freeze.
- C6: the err's `message` is the fixed word `owner`; the client replaces it with the outbox id.
