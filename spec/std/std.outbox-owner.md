# std.outbox-owner: Outbox owner check
status: proposed

How the action behind an outbox endpoint (std.offline) refuses a write queued by another owner than the one its caller is signed in as when the action runs.

**Write.** `Write` is `s.object({ key: s.id('Write'), base: s.int({ min: 0 }), owner: s.string() })`; a flush sends each entry's `owner` in `body.write`. The action passes the write through `writeFor(write, owner)` from `@keel/std-offline`, `owner` being the id its module gives the request's `caller` (k.server): the id its pages give `send` and `drain`, `""` for a caller signed in as no one.
```ts
const w = writeFor(input.write, ownerOf(caller, stores))
if (!w.ok) return err(w.error)
const r = tx(stores.editTodo, payload, { meta: { caller }, ...w.value })
```
`writeFor` returns `ok({ key, base })` when `write.owner` is `owner`, else `err({ code: 'offline.owner', message: 'owner', data: {} })`, which k.server answers 400; no store is saved.

**Refused.** A flush reads an answer whose error `code` is `offline.owner` as `failed` with `offline.owner` (std.outbox Errors), whatever its status, and goes on to the next entry. The entry is never posted again; `'theirs'` removes it.

**When.** The check runs when the action runs. A sign-in or sign-out in another tab before then refuses the write; one after it leaves the write committed under the owner who queued it. A write the server committed whose answer was lost, resent after the owner changed, is refused, so its entry is `failed` though the server holds the write.

**Limits.** An action that spreads `input.write` into `tx` without `writeFor` commits a write of any owner. The check decides which owner a write commits under, not what reaches the server: a refused entry's body reaches the action.

**Rules.** None.

**Conformance.**
- `writeFor({ key, base, owner: 'a' }, 'a')` is `ok({ key, base })`; with owner `'b'` or `""` it is `err` with `{ code: 'offline.owner', message: 'owner', data: {} }`; `writeFor({ key, base, owner: "" }, "")` is `ok`.
- With entries queued offline under owner `a` and a route whose action passes `writeFor` owner `b`, `drain` with `a` online posts each with `body.write.owner` `a`, the server store commits nothing, and each entry is `failed` with `{ code: 'offline.owner', message: <id>, data: {} }`.
- After that refusal, `drain` with `a` on a new ctx over that storage posts nothing, and a `send` with `a` to a route whose owner is `a` is posted and resolves `sent`.
