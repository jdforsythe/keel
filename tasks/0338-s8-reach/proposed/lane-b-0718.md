# Lane B proposals: std-offline, store, check

Each line below needs a spec sentence, a conformance change or a decision, so its code is untouched. Each has a reproducing unit test marked `test.fails` (it passes once the spec and the code follow): `packages/std-offline/test/storageFaults.test.ts`, `packages/store/test/keysBound.test.ts`, `packages/check/test/blankLabel.test.ts` (last `describe`). Every reproduction was also run with `test.fails` turned into `test` and failed on the asserted line, not earlier.

Spec budgets today (ceil(chars/4), limit 1,500): std.offline 1,499 (5,993 chars), k.a11y 1,500 (5,999), k.sync 1,365 (5,459). std.offline and k.a11y have no room: every sentence added there needs a trim of the same size, named below. Package sizes today (gzip): `@keel/std-offline` 3,066 of 3,072, `@keel/check` 55,798 of 55,808 (after the 0740 build in this lane), `@keel/store` 3,325 of 3,584.

The std.offline lines 0763, 0758 and 0784 touch the same Write sentence; one RFC should take them together, with 0764 and 0781 beside them.

## 0763 std-offline: a rejected write leaves a `queued` copy in storage

**Reproduction.** Schedule `storage: ['ok', 'ok', 'fail']` (the load's `get`, `send`'s `set`, the flush's `sending` `set`). `send` resolves `failed` with `offline.storage`, the entry is `failed` in memory, and `keel.outbox.<id>` still holds it `queued`. A reload's `drain` loads it `queued` and posts it, though the page was told `failed`. If the user retried by a new `send` (a new key), both writes commit.

**Today's spec.** Write: "A rejected `ctx.storage` write in `send`, a flush or `'mine'` leaves the entry `failed` with `offline.storage` in memory and releases the flush, posting no more." Storage is not stated.

**Options.** (a) After the rejected write, write the outbox once more with the entry `failed` (best effort; a second rejection is ignored). (b) State the limit only: the stored copy keeps its last written state, so a reload may post it with its own key. (c) Both.

**Recommendation.** (c). The second write closes the gap whenever the fault was transient (fail closed), and the sentence tells the truth when it was not.

**Sentence** (Write, replacing the sentence quoted above and the next one; this replacement also carries 0758 and 0784):
> A rejected `ctx.storage` write in `send`, a flush or `'mine'` leaves the entry `failed` with `offline.storage`, written once more, and releases the flush, posting no more; storage keeps its last written state. In `'theirs'` the entry is still removed, `true`. An `offline.storage` or `offline.owner` err's `message` is the outbox `id`, never thrown text.

About +130 chars (+33 tokens): std.offline would be 1,532. Trim candidate: the Conformance bullet "On an unbound sim ctx, `send` posts to `http://<module>.keel.invalid` plus the path; the stored entry has `owner`, no `origin`." (k.services states the unbound origin; the stored-entry half is Owner's), -31 tokens.

**Conformance headers quoting a changed sentence.** `storage-message.test.ts` line 2 and `storage-fail.test.ts` line 2 quote the Write sentence.

**Conformance wanted.** With `storage: ['ok', 'ok', 'fail']` online, after `send` resolves `failed`, `ctx.storage.get('keel.outbox.<id>')` holds the entry with `state: 'failed'`; with `['ok', 'ok', 'fail', 'fail']` it holds it `queued`, and the next `send` stores it `failed`. Check the step counts of every existing storage-schedule case: the extra write takes a step.

**Code outline.** In `admit` and the flush's catch, after `tx(c.settle, { ..., state: 'failed' })`, `await attempt(() => persist(ctx, c))`. About +15 bytes gzip: `@keel/std-offline` would be about 3,081 of 3,072.

## 0764 std-offline: the flush's catch takes more than storage errors

**Reproduction.** A ctx whose `clock.after` throws, and a route that throws (`api.network`): the flush settles the entry `queued`, then the retry's `ctx.clock.after` throws, and the catch fails the entry with `offline.storage`, a storage fault that never happened. No conforming ctx method or service call throws today (`service` calls never throw), so this is reachable only through a ctx that breaks its contract; the label still lies.

**Options.** (a) Catch only the flush's storage writes (wrap `put`); any other throw releases the flush (`finally`), resolves its waiters `queued`, leaves the entries as they are in memory (an entry in hand stays `sending`, so this session never posts it again) and rethrows. (b) Keep one catch but fail the entry with a new code (`offline.unexpected`). (c) Leave it and say so.

**Recommendation.** (a): no new code, the tool tells the truth, and the entry in hand is not posted again (fail closed). The rethrow surfaces a broken ctx as an unhandled rejection.

**Sentence** (Flush, after the bullets): "Any other throw in a flush releases it, leaving the entries as they are, and is rethrown." (+22 tokens; trim as above).

**Conformance wanted.** A ctx whose `clock.after` throws `RangeError('clock')`, the route throwing `TypeError`: `send` resolves `queued`, the entry is not `failed`, no `offline.storage` appears, the rejection is the `RangeError`, and the next `send` on a well-behaved ctx flushes.

**Code outline.** `put` becomes `persist(...).catch((x) => { throw new StorageFault(x) })`-like marking, or a flag set before each write; the catch checks it. About +30 bytes gzip.

## 0781 std-offline: a storage write that never settles blocks the flush

**Reproduction.** Online, `send` A whose own `ctx.storage.set` never settles; then `send` B, whose write lands. B starts the flush, which finds A first in order and waits on A's write for ever; B never resolves.

**Options.** (a) Bound the wait: a write that has not settled 10 s after it began, on `ctx.clock`, counts as rejected (`offline.storage`, as today's rejection), and the flush goes on. (b) Skip a held entry and post the next: breaks "in order". (c) State the liveness limit in the README only.

**Recommendation.** (a): the entry fails closed, later sends make progress, and the sim clock keeps it deterministic. A write that lands after the bound changes nothing (the entry is already `failed`; the next write stores that).

**Sentence** (Write, after the replacement above): "A write not settled 10 s after it began, on `ctx.clock`, counts as rejected." (+19 tokens.)

**Conformance wanted.** A storage whose second `set` never settles: `send` A stays pending; `send` B resolves `sent` once `ctx.clock` passes 10 s; A resolves `failed` with `offline.storage`; posts are B only.

**Decision for the user.** The bound (10 s proposed).

**Code outline.** In `admit`, race `persist` with `ctx.clock.after(10_000, signal)` that rejects; abort the timer when the write settles. About +45 bytes gzip.

## 0784 std-offline: `offline.owner` errs have the fixed message, unstated

**Not a code defect.** `fault.ts` gives `offline.owner` the same `{ code, message: <outbox id>, data: {} }` as `offline.storage`; the README says so, std.offline states it for `offline.storage` only. Pinned now by the property in `storageFaults.test.ts` (passing).

**Recommendation.** State it (the replacement sentence under 0763 covers it) and widen the conformance bullet: "An `offline.storage` or `offline.owner` err's `message` is the outbox `id` and its `data` `{}`, whatever was thrown." (+6 tokens.) The header of `storage-message.test.ts` line 1 quotes today's bullet. Case wanted: two owners, `send` with `a` offline then with `b`: `a`'s entry `error` equals `{ code: 'offline.owner', message: <id>, data: {} }`. No code change, no budget cost.

## 0758 std-offline: `'theirs'` with a rejected write rejects `resolve`

**Reproduction.** Schedule `['ok', 'fail', 'fail']`, offline: `send` leaves a `failed` entry; `resolve(ctx, o, key, 'theirs')` rejects with the storage's thrown error (its text reaches the caller, which std.offline keeps from a page for `offline.storage`).

**Options.** (a) Remove the entry in memory and resolve `true`; the stored copy loads again as `conflict` or `failed` after a reload and is never posted. (b) Resolve `false` and keep the entry: `false` already means "no such entry". (c) Resolve `failed` with `offline.storage`: changes the `boolean` result type.

**Recommendation.** (a): no API change, nothing is posted (fail closed), no thrown text escapes. The `asResult` justification already names "one of the outbox's endpoints for resolve".

**Sentence.** In the 0763 replacement ("In `'theirs'` the entry is still removed, `true`."). Conformance bullet 12 gains: "`'theirs'` resolves `true` also when its storage write rejects." The header of `resolve-result.test.ts` quotes bullet 12. Case wanted: as the reproduction; `resolves.toBe(true)` and `o.get('entries')` empty.

**Code outline.** `await attempt(() => persist(ctx, c))` in `resolve`'s `'theirs'` branch (`attempt` is already imported elsewhere in the bundle). About +8 bytes gzip.

## 0741 store: write keys live only as long as `logLimit`

**Reproduction.** `logLimit: 0`: `tx(push, {v:1}, {key:'k'})` twice commits twice. `logLimit: 2`: keys k1, k2, k3, then k1 again commits again. This is what k.sync states ("the `{ name, key }` of its last `logLimit` commits made with a `key`") and conformance bullet 11 pins ("commits again once `logLimit` later commits with a `key` have passed it"), so idempotency depends on an undo-history setting, and a shared server store forgets a key after 256 keyed writes from other clients.

**Options.** (a) A store option `keyLimit` (default 1,024, a non-negative integer, else `store` throws), bounding `keys` apart from `logLimit`. (b) `keys` keeps `max(logLimit, 256)`: no new API, but still forgets on a busy store and still couples the two. (c) Refuse `key` on a `logLimit: 0` store with a new E-code: fixes only the first half.

**Recommendation.** (a), as the user decides the default: a retry window is a sync property, not an undo one. An outbox that waits longer than `keyLimit` keyed writes can still commit twice; std.offline should then say a key protects a retry within the server store's `keyLimit`.

**Sentence** (k.sync Write key, replacing "The store keeps `keys`, the `{ name, key }` of its last `logLimit` commits made with a `key` (k.store), oldest first;"):
> The store keeps `keys`, the `{ name, key }` of its last `keyLimit` commits made with a `key` (`store` option, default 1024), oldest first;

and "keeping the latest `logLimit`" becomes "keeping the latest `keyLimit`". k.sync 1,365 -> about 1,372. k.store's options list `{ id, clock?, logLimit? }` gains `keyLimit?` (k.store is at 1,500: trim needed there, or name the option in k.sync only).

**Conformance headers quoting a changed sentence.** `packages/store/conformance/sync-keys.test.ts` and `sync-key.test.ts` (bullet 11).

**Conformance wanted.** Bullet 11 becomes "... and commits again once `keyLimit` later commits with a `key` have passed it." Cases: `logLimit: 0` (default `keyLimit`), a key retried commits once; `logLimit: 2, keyLimit: 2`, k1 k2 k3 then k1 commits again; `logLimit: 2, keyLimit: 8`, it does not; `keyLimit: -1` throws; `restore` keeps the latest `keyLimit` keys.

**Decision for the user.** The option name and default; whether a persisted snapshot of a busy store may carry 1,024 keys (about 90 KB).

**Code outline.** `recent()` in `store.ts` slices by `keyLimit`. About +25 bytes gzip (`@keel/store` 3,350 of 3,584).

## 0740 check: invisible-only labels (the rest is built)

Built in this lane, inside k.a11y's "blank literal": parentheses, `as`, `satisfies`, `!`, a wrapped call argument, and object-literal spreads in JSX and calls. Not built: labels of only invisible characters.

**Reproduction.** `<Input label={"​"} />`, `<Input label="&#x2800;" />`, `<Input label={"ㅤ"} />` report no E1802 (`it.fails` in `blankLabel.test.ts`). k.a11y says blank is "`""` or white space"; U+200B, U+2800, U+3164 are not white space.

**Options.** (a) Count `\p{Cf}` and the fillers U+2800, U+115F, U+1160, U+3164, U+FFA0 as blank. (b) Leave it: the render check (axe-core) does not see these either.

**Recommendation.** (a): a label a reader cannot see names nothing (fail closed); the set is closed and stable.

**Sentence** (k.a11y Required props, replacing "A blank literal `label` (`""` or white space) is E1802 too;"):
> A blank literal `label` (`""`, white space, format characters and the fillers U+2800, U+115F, U+1160, U+3164, U+FFA0) is E1802 too;

+19 tokens: k.a11y would be 1,519; trim candidate in the same paragraph, "(`name`, `email`, `tel`, `street-address`, `bday`, ...)" (-13) plus "(text, or an `Image` whose `alt` names it; no `label`)" shortened to "(text or a named `Image`)" (-8).

**Conformance header quoting it.** `packages/check/conformance/E1802-blank-label.test.ts` line 1.

**Conformance wanted.** E1802 for `label={"​"}`, `label="&#8203;"`, `label="⠀"`, `Input({ label: "ㅤ‍" })`; none for `label="a​"`.

**Code outline.** `blank` becomes `/^[\s\p{Cf}⠀ᅟᅠㅤﾠ]*$/u.test(text)`. About +25 bytes gzip: `@keel/check` about 55,823 of 55,808; trim candidate: share the `findingAt` closure in `blankLabel.ts` between the JSX and call visitors (about -10).
