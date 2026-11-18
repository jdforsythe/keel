# RFC 0127: std-offline storage faults

Status: accepted (orchestrator under the owner's standing leave, 2026-11-18). For backlog 0763, 0764, 0781, 0784 and 0758 (task 0338, lane B). ADR-0149 records it.

## Problem
Five gaps in how `@keel/std-offline` handles a `ctx.storage` write that goes wrong. Each has a reproduction marked `test.fails` in `packages/std-offline/test/storageFaults.test.ts`.

- 0763. With `storage: ['ok', 'ok', 'fail']` (the load's `get`, `send`'s `set`, the flush's `sending` `set`), `send` resolves `failed` with `offline.storage` and the entry is `failed` in memory, while `keel.outbox.<id>` still holds it `queued`. A reload's `drain` posts it, though the page was told `failed`; a user who retried with a second `send` (a new key) commits the write twice. std.offline states what memory holds and says nothing about storage.
- 0764. The flush has one `catch`. A ctx whose `clock.after` throws, behind a route answering `api.network`, settles the entry `queued`, then the retry timer throws and the catch fails the entry with `offline.storage`, a storage fault that never happened. Only a ctx that breaks its contract gets there today, but the label is false.
- 0781. Online, `send` A whose `set` never settles, then `send` B: B starts the flush, which waits on A's write in order for ever, and B never resolves.
- 0784. `fault.ts` gives `offline.owner` the same `{ code, message: <outbox id>, data: {} }` as `offline.storage`, and the README says so; std.offline states it for `offline.storage` only.
- 0758. With `['ok', 'fail', 'fail']` offline, `send` leaves a `failed` entry, and `resolve(ctx, o, key, 'theirs')` rejects with the storage's thrown error, whose text std.offline keeps from the page for every `offline.storage` err.

std.offline is at 1,499 tokens (5,993 characters). The text below, with its six bullets, is about 720 tokens; the proposal's one trim candidate is a Conformance bullet, which this RFC may not touch.

## Proposal
**Storage writes.** A `ctx.storage` write in `send`, a flush or `resolve` that rejects, or has not settled 10 s after it began on `ctx.clock`, leaves the entry `failed` with `offline.storage` in memory, writes the outbox once more and releases the flush, posting no more. The second write is best effort: its own rejection is ignored. A write that settles after the 10 s changes nothing in memory; the entry is already `failed`. In `'theirs'` the entry is still removed in memory, the outbox is written once more the same way, and `resolve` resolves `true`.

**What storage holds, and the fail-closed rule.** When the second write lands, storage holds the entry `failed` (or no entry, after `'theirs'`), and no reload posts it. When it fails too, storage keeps the state of the write that landed last, and `drain` loads it as it loads any stored outbox. This RFC decides that `load` does not try to guess: no stored state tells an entry the page was told is `failed` apart from one queued normally, because the write that would have said so is the write that failed. A marker written earlier cannot help either, since it would be one more write to a storage that is rejecting writes. So the rule that holds is the one k.sync already gives: a stored entry is posted only under its own key, so the server store commits it at most once while its `keyLimit` (RFC 0128) still holds that key. A page told `failed` that calls `send` again makes a new key, and the two can both commit. The spec states that limit in plain words.

For `'theirs'` this means: after its second write lands, storage holds no entry. When both of its writes are rejected, storage holds the entry as last written. If that is `conflict` or `failed`, a reload never posts it. If it is `queued` (the two writes of the earlier fault were lost too), a reload posts it under its own key, the same limit as above.

**Errors.** An `offline.storage` or `offline.owner` err is `{ code, message, data: {} }`, its `message` the outbox `id`, never thrown text. No code change.

**Other throws.** Only a storage write's rejection, or the 10 s bound, becomes `offline.storage`. Any other throw inside a flush releases it (the `busy` flag clears in a `finally`), leaves the entries as they are in memory, resolves each call waiting on the flush `queued`, and is rethrown, so it surfaces as an unhandled rejection. An entry in hand stays `sending` in memory, and a flush only takes `queued` entries, so this session never posts it again; a later `drain` loads it `queued` and posts it under its own key.

**Where the text goes.** std.offline cannot hold this text. A new section, `std.outbox` ("Outbox storage faults", status `proposed`), takes it, with the six new bullets. std.offline's Write paragraph keeps one pointer in place of its fault sentence. Bullets 11 and 15 of std.offline stay where they are, unchanged; they test behavior std.outbox now states. The split follows std.options beside std.headless and std.tokens beside std.credentials: one package, two sections.

## Alternatives
- 0763: state the limit only, with no second write. Leaves the gap open even when the fault was transient, which is the common case.
- 0763: write a marker before each risky write, so `load` can tell a doubtful `queued` entry apart. Any marker is a write to the same failing storage, and the marker's own failure puts us back where we started.
- 0763: have `load` fail every stored `queued` entry it cannot vouch for. It cannot vouch for any, so every normal offline queue would fail on reload.
- 0764: keep one catch and fail the entry with a new code (`offline.unexpected`). A new code for a broken ctx, and the entry is still failed for a fault outside storage.
- 0781: skip the held entry and post the next. Breaks "in order".
- 0781: state the liveness limit in the README only. B stays stuck.
- 0758: resolve `false` and keep the entry. `false` already means there was no such entry.
- 0758: resolve `failed` with `offline.storage`. Changes the result type from `boolean`.
- Fit the text into std.offline by trimming. The new prose and bullets need about 220 tokens, and the prose of std.offline has no 220 tokens that do not state behavior.

## Spec diff
std.offline (before 5,993 characters, 1,499 tokens; after 5,873 characters, 1,469 tokens). In Write, "A rejected `ctx.storage` write in `send`, a flush or `'mine'` leaves the entry `failed` with `offline.storage` in memory and releases the flush, posting no more. Its `message` is the outbox `id`, never the thrown text." becomes:
```
A `ctx.storage` write that rejects or does not settle, and any other throw in a flush: std.outbox.
```

New `spec/std/std.outbox.md` (2,879 characters, 720 tokens), whole text in the file; its prose:
```
What `@keel/std-offline` (std.offline) does when a `ctx.storage` write rejects or never settles, and when anything else throws inside a flush.

**Storage writes.** A `ctx.storage` write in `send`, a flush or `resolve` that rejects, or has not settled 10 s after it began on `ctx.clock`, leaves the entry `failed` with `offline.storage` in memory, writes the outbox once more and releases the flush, posting no more. A write that settles after those 10 s changes nothing in memory. In `'theirs'` the entry is still removed and `resolve` resolves `true`.

**What storage holds.** When the second write lands, storage holds the entry `failed`, or no entry after `'theirs'`. When it fails too, storage keeps the state of the write that landed last, and `drain` loads that state as it loads any: an entry stored `queued` or `sending` is posted under its own key, so the server store commits it at most once while its `keyLimit` holds the key (k.sync). No stored state tells such an entry apart from one queued normally, so a page told `failed` that calls `send` again, under a new key, can commit the same write twice. That is the limit of a storage that rejects every write.

**Errors.** An `offline.storage` or `offline.owner` err is `{ code, message, data: {} }`, its `message` the outbox `id`, never thrown text.

**Other throws.** Only those storage faults become `offline.storage`. Any other throw in a flush releases it: the entries stay as they are in memory (an entry in hand stays `sending`, so this session never posts it again), each call waiting on the flush resolves `queued`, and the error is rethrown as an unhandled rejection.

**Rules.** None.
```
`spec/std/README.md` gains the row `std.outbox | Outbox storage faults | proposed | ...`.

## Conformance diff
std.offline: no bullet changes. std.outbox Conformance, new:
1. With `storage: ['ok', 'ok', 'fail']` online, once `send` resolves `failed` with `offline.storage`, `ctx.storage` `keel.outbox.<id>` holds the entry with `state: 'failed'`.
2. With `['ok', 'ok', 'fail', 'fail']` online, storage holds that entry `queued`, and `drain` on a new ctx over that storage posts it once, with its key.
3. Online, with `send` A's storage `set` never settling, `send` B resolves `sent` once `ctx.clock` passes 10 s, A resolves `failed` with `offline.storage`, and only B is posted.
4. With a ctx whose `clock.after` throws `RangeError('clock')` and a route answering `api.network`, `send` resolves `queued`, no entry is `failed`, no `offline.storage` err appears, and the `RangeError` is rethrown unhandled; once the route answers 2xx and `clock.after` behaves, the next `send` posts.
5. With owners `a` and `b`, after `send` with `a` offline and then `send` with `b`, `a`'s entry `error` is `{ code: 'offline.owner', message: <id>, data: {} }`.
6. Offline, with every storage write after the load rejecting, `resolve(ctx, o, key, 'theirs')` on a `failed` entry resolves `true` and `o.get('entries')` holds no entry with that key.

One `rfc:0127` commit by the `conformance-writer`: new `packages/std-offline/conformance/storage-faults.test.ts` for bullets 1 to 4 and 6 and `owner-message.test.ts` for bullet 5, each citing std.outbox. The headers of `storage-message.test.ts` (line 2) and `storage-fail.test.ts` (line 2) quote the old Write sentence and move to the std.outbox sentence they test; their assertions stay. Every existing storage-schedule case is checked for step counts: the second write takes one more step of the schedule (`['ok', 'fail']` and `['ok', 'ok', 'fail']` in bullet 11 still hold, since the step after a schedule's end is `ok`).

## Migration
No app source changes. An app that caught `resolve`'s rejection under `'theirs'` now gets `true`. A ctx that throws from a method now surfaces as an unhandled rejection, where its entries were failed with `offline.storage` before.

## Token impact
std.offline 1,499 to 1,469 tokens; new std.outbox 720 tokens. `@keel/std-offline` grows about 100 bytes gzip (second write about 15, catch split about 30, 10 s bound about 45, `'theirs'` about 8) against 3,066 of 3,072, so the builder trims the bundle or raises the budget in `tooling/budgets.json`; that budget change is the operator's call.

## Choices
Each is the drafter's choice; the operator can reverse any of them.
- C1: the bound is 10 s on `ctx.clock`.
- C2: `load` reads storage as written and the duplicate under a second key is a stated limit, with no marker write.
- C3: `'theirs'` also writes the outbox once more after a rejected write.
- C4: a non-storage throw is rethrown unhandled from the flush, and the calls waiting on it resolve `queued`.
- C5: the text goes in a new section, `std.outbox`, since std.offline has no room.

## Amendment (review 7, finding 1 and minors 3 to 6; red team 7, H1, M1, M2)
The flush's `catch` treats every rejected write alike. When the server answers 2xx and the write that records the entry as sent rejects or times out, the catch resolves the caller `failed` with `offline.storage` though the server committed the write; a page that offers a retry sends it again under a new key and commits it twice. A 409 or a refusal is overwritten the same way: the entry, already `conflict` or `failed` with its `ApiError`, becomes `failed` with `offline.storage`.

The answer decides the result. When the failed write is the one that records the server's answer (`sent`, `conflict` or `failed`), the call resolves that answer and memory keeps the entry as the answer left it; the flush still writes the outbox once more and ends. If both writes fail after a `sent` answer, storage holds the entry `sending` as last written, and a reload posts it again under its own key: the server store commits it at most once while its `keyLimit` holds that key, and beyond that limit it commits twice. A write that fails before an answer, the `sending` write included, still fails the entry with `offline.storage`.

A write given up at the 10 s bound is not cancelled: `persist` races `ctx.storage.set` against the timer and cannot stop the `set` it issued, so the write can land after the second write and leave the entry `queued` in storage, which a reload posts though the page was told `failed` (red team 7, M1, ran). Ordering the writes would make the second wait on a `set` that may never settle, so instead a given-up write that settles later is followed by one more write of the outbox as memory then holds it; the late write is the last to land only if that write fails too.

The flush reads the owner and the entry once, then waits on the `sending` write and posts the entry it holds. A `drain` with another owner during that wait fails the entry in memory, and the flush posts it anyway and resolves `sent` (red team 7, H1, ran). std.offline already forbids it ("A flush posts only entries of the owner last given on the ctx", "A `failed` entry is never posted"), so the spec gains only a std.outbox Conformance bullet; std.offline has no room for one. A `ctx.storage.set` that throws synchronously counts as a rejected write. std.offline's last bullet and std.outbox's Errors sentence both state the `offline.storage` message; both are quoted by `storage-message.test.ts`, and the std.offline one is a Conformance bullet, so neither moves.

Choices the operator can reverse:
- A1: the answer stands only for answers the flush settles (`sent`, `conflict`, `failed`); a failed `queued` write after a network failure still fails the entry.
- A2: a late-settling write is followed by one more write, with no per-outbox write queue.
- A3: std.outbox's status is `conformance-covered`, as std.offline's is.

Spec diff (std.outbox, 720 to 1,330 tokens): Storage writes gains "A write that throws counts as one that rejects. When the failed write is the one that records the server's answer (`sent`, `conflict` or `failed`), the answer stands: the call resolves it, memory keeps the entry as the answer left it, and the flush writes the outbox once more and ends."; What storage holds gains, before its last sentence, "After a `sent` answer whose two writes both fail, storage still holds the entry `sending`, and a reload posts it again under its own key, which is safe while the server's `keyLimit` holds the key and commits it a second time beyond that. A write given up at the 10 s bound that settles later is followed by one more write of the outbox as memory then holds it, so the late write is not the last to land unless that write fails too."; status `proposed` becomes `conformance-covered` in the section and in `spec/std/README.md`. Conformance, appended as bullets 7 to 14: the answer standing under `['ok', 'ok', 'ok', 'fail']`, a late settle, the bound in a flush and in `'mine'`, the second write under `'theirs'`, a synchronous throw, the write after a late settle, and an owner change during the `sending` write (text in the section).

Conformance writer: in `packages/std-offline/conformance/storage-faults.test.ts`, bullets 7 to 13, and in `owner-message.test.ts`, bullet 14, citing std.outbox. Builder: in `flush.ts`, resolve the answer before the write that records it and have the `catch` fail the entry only when no answer settled it; after the `sending` write, look the entry up again and post it only while it is `sending` and its owner is the ctx's, else resolve its caller with the entry's `failed` and go on; in `persist.ts`, make the function async so a synchronous throw rejects, and when a `set` settles after its bound, call `persist` once more; update the doc comments, the README and a changeset (`@keel/std-offline` patch), about 70 bytes gzip against 3,185 of 3,328.
