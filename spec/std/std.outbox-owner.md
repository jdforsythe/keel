# std.outbox-owner: Outbox owner check
status: implemented

How the action behind an outbox endpoint (std.offline) refuses a write queued by another owner than the request's `user` when the action runs.

**Write.** `Write` is `s.object({ key: s.id('Write'), base: s.int({ min: 0 }), owner: s.string() })`; a flush sends each entry's `owner` in `body.write`. The action passes the write through `writeFor(write, owner)` from `@keel/std-offline`, `owner` being the request's `user` (k.user): the id its pages give `send` and `drain`, `""` for no one.
```ts
const w = writeFor(input.write, user)
if (!w.ok) return err(w.error)
const r = tx(stores.editTodo, payload, { meta: { caller }, ...w.value })
```
`writeFor` returns `ok({ key, base })` when `write.owner` is `owner`, else `err({ code: 'offline.owner', message: 'owner', data: {} })`, which k.server answers 400; no store is saved.

**Refused.** A flush reads an answer whose error `code` is `offline.owner` as `failed` with `offline.owner` (std.outbox Errors), whatever its status, and goes on to the next entry. The entry is never posted again; `'theirs'` removes it.

**When.** The check runs when the action runs. A sign-in as another user in another tab before then refuses the write; a sign-out pauses it (Signed out); one after it leaves the write committed under the owner who queued it. A write the server committed whose answer was lost, resent after the owner changed, is refused, so its entry is `failed` though the server holds the write.

**Limits.** An action that spreads `input.write` into `tx` without `writeFor` commits a write of any owner. The check decides which owner a write commits under, not what reaches the server: a refused entry's body reaches the action.

**Signed out.** A request whose `user` is `""` has no owner to compare: `writeFor(write, "")` with a `write.owner` other than `""` returns `err({ code: 'offline.signin', message: 'signin', data: {} })`, which k.server answers 400. A flush reads it as a pause: the entry stays `queued`, and flushing stops until `drain` or `send` is given that owner again. Giving `""` as the owner holds other owners' entries `queued` rather than failing them; another named owner still fails them. So a sign-in that expires, or a sign-out, keeps queued writes on the device until that user signs in again, their bodies in `ctx.storage` until then.

**Rules.** None.

**Conformance.**
- `writeFor({ key, base, owner: 'a' }, 'a')` is `ok({ key, base })`; with owner `'b'` it is `err` with `{ code: 'offline.owner', message: 'owner', data: {} }`; `writeFor({ key, base, owner: "" }, "")` is `ok`.
- With entries queued offline under owner `a` and a route whose action passes `writeFor` owner `b`, `drain` with `a` online posts each with `body.write.owner` `a`, the server store commits nothing, and each entry is `failed` with `{ code: 'offline.owner', message: <id>, data: {} }`.
- After that refusal, `drain` with `a` on a new ctx over that storage posts nothing, and a `send` with `a` to a route whose owner is `a` is posted and resolves `sent`.
- `writeFor({ key, base, owner: 'a' }, "")` is `err` with `{ code: 'offline.signin', message: 'signin', data: {} }`; entries of owner `a` refused with it stay `queued`, a `drain` with `""` posts none and fails none, and a later `drain` with `a` posts each once with its key.
