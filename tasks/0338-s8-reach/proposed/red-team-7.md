# Red team 7: `git diff 9836a78f..HEAD` (RFC 0120 call sites, 0126, 0127, 0128, 0129, lane fixes)

Probes ran as scratch vitest files inside each package (one file at a time, deleted afterwards). "Ran" means the output quoted was observed; "reasoned" means read from the code only.

Counts: HIGH 2 · MEDIUM 4 · LOW 7.

## HIGH

### H1. A flush posts an entry after its owner changed and after `own` failed it (ran)
`packages/std-offline/src/internal/flush.ts:52-67`. The owner and the state are read once at the top of the iteration; `await put(e.key, "sending", {})` (line 62) yields, and the call on line 67 uses the captured `e` with no second look. A `drain`/`send` under another owner during that write fails the entry in memory (`own`), then the flush posts it anyway under the ctx's (new) session and settles it `sent`.

Probe: sim ctx online, storage `set` #1 (the flush's `sending` write) held. `send(ctx, o, 'add', { body: { t: 'alice-secret' } }, { base: 0, owner: 'alice' })`; then `drain(ctx, o, { owner: 'bob' })` in a scope; then release the write.
Observed: entries before switch `[["alice","sending"]]`; after `own(bob)` `[["alice","failed"]]`; after release: alice's `send` resolves `{"state":"sent","value":{}}`, server posts `[{"t":"alice-secret","write":{"key":"66dcbc10-…","base":0}}]`, entries `[]`.
Breaks std.offline Owner ("A flush posts only entries of the owner last given on the ctx", "A `failed` entry is never posted").
Fix: after the `sending` write settles, look the entry up again and post only when it is still `sending` and `c.owners.get(ctx) === e.owner`; otherwise `continue` (it is already `failed`). Add a conformance case with a held `sending` write.

### H2. The owner stamp is not bound to the session cookie: a second tab's sign-in makes the first tab post the previous user's entries under the new cookie (reasoned)
`packages/std-offline/src/internal/flush.ts:52-67`, `src/internal/own.ts:13-18`, `src/drain.ts:17-25`. The owner is per ctx and only changes when the app calls `send`/`drain` in that tab. Cookies are shared across tabs. Tab 1: alice, three writes queued offline. Tab 2: alice signs out, bob signs in (cookie now bob's). Tab 1 goes online; its flush still has owner `alice` and posts alice's entries with bob's cookie. That is the 0501 threat RFC 0120 closed for one tab. The body carries only `write: { key, base }`, so the server cannot tell.
Fix (either): carry `owner` in `body.write` and have the action/k.sync refuse a write whose owner is not the caller's principal (settles `failed` with `offline.owner`); or have the outbox listen for a cross-tab sign-in signal (storage event on a `keel.owner` key / BroadcastChannel) and call `own` before the next post. At minimum, state the limit in std.offline Privacy and docs/THREAT-MODEL.md.

## MEDIUM

### M1. A storage write that settles after the 10 s bound overwrites the second write: storage holds `queued`, a reload posts a write the page was told `failed` (ran)
`packages/std-offline/src/internal/persist.ts:9-18`, `src/internal/admit.ts:19-26`. The timed-out `set` is not cancelled; when it lands after the second (best-effort) write it restores the earlier snapshot.
Probe: sim ctx offline, storage `set` #0 (`send`'s own write) held. `send(... owner 'u1')`; `clock.advance(10_000)`; release the held write; new outbox over the same storage, online, `drain(... { owner: 'u1' })`.
Observed: `send` → `{"state":"failed","error":{"code":"offline.storage",…}}`; storage before release `state:"failed"`; after release `state:"queued"`; after reload, 1 post `{"t":"a","write":{"key":"66dcbc10-…","base":0}}`.
Contradicts std.outbox "When the second write lands, storage holds the entry `failed`" (the second write did land).
Fix: when a write that was timed out settles later, write the current entries once more (`persist` keeps a generation counter; a late settle of an older generation re-persists), or serialize writes per outbox so no older snapshot can land after a newer one.

### M2. A write committed by the server is reported `failed` with `offline.storage` when the write after the answer rejects (ran)
`packages/std-offline/src/internal/flush.ts:92` and `:98-105`. `put(e.key, 'sent')` rejects → `lost` → the catch fails the (already removed) entry and resolves `failed`. Same for a `conflict` (its `head` is lost).
Probe: sim storage `['ok','ok','ok','fail']` online (load `get`, `send`'s `set`, `sending` `set`, `sent` `set`), `send(... { t: 'a' } ...)`.
Observed: `{"state":"failed","error":{"code":"offline.storage","message":"rt71.outbox","data":{}}}`, server posts 1, storage `{"entries":[]}`.
A page told `failed` that sends again commits twice (new key). std.outbox says only "posting no more"; the entry was posted.
Fix: once the server has answered, resolve that answer (`sent` / `conflict` / `failed` ApiError) and treat the follow-up write as best effort (one retry); keep `offline.storage` for writes before the post.

### M3. E1802 misses invisible labels spelled as named entities that esbuild decodes (ran)
`packages/check/src/rules/blankLabel.ts:41-45` decodes only numeric references and `&nbsp;`.
Probe: `check([{ path: 'modules/a/v.tsx', source: "import { Input } from '@keel/ui'\nexport const a = <Input label=\"&zwnj;\" />" }], { types: false })` and the same with `&emsp;`, `&shy;`.
Observed: no E1802 for each. `esbuild.transformSync('<I label="&zwnj;" c="&emsp;" />', { loader: 'tsx', jsx: 'automatic' })` gives `label: "‌"`, `c: " "`. (`&ZeroWidthSpace;` is not in the JSX table, so esbuild keeps it as text; that one is correctly visible.)
`keel check` passes a label that ships blank.
Fix: decode the JSX named-entity table (the HTML 4 set esbuild and TypeScript use), or at least the entities that decode to White_Space, Cf or DI (`&ensp; &emsp; &thinsp; &zwnj; &zwj; &lrm; &rlm; &shy;`).

### M4. `Secret.of` freezes and walks the value before `check`: parse throws on some inputs and freezes the caller's object even when it returns an error (ran)
`packages/schema/src/Secret.ts:8-18,41-46`, called from `internal/seal.ts:14` before validation.
Probe (`s.object({ k: s.secret(s.string()) })`):
- `.parse({ k: new Uint8Array(4) })` → THREW `TypeError: Cannot freeze array buffer views with elements`
- `.parse({ k: { get x() { throw new Error('boom') } } })` → THREW `Error: boom` (the getter ran)
- revoked Proxy → THREW `TypeError: Cannot perform 'preventExtensions' on a proxy that has been revoked`
- `const victim = { arr: [1] }; .parse({ k: victim })` → `ok: false`, `Object.isFrozen(victim) === true`, `Object.isFrozen(victim.arr) === true`
- `s.secret(s.json())` on a caller object `shared`, then `shared.list.push(3)` → THREW `Cannot add property 2, object is not extensible`
`parse` returns a `Result`; these throw, and a failed parse leaves the app's own objects frozen. Not reachable from a JSON body (no getters, typed arrays or proxies there), so app-code only: no remote denial.
Fix: freeze after `check` succeeds (only for values that become a secret), skip typed arrays / non-plain objects (they never pass a JSON node), and read with `Object.getOwnPropertyDescriptor(...).value` instead of `Reflect.get` so no getter runs; or copy before freezing for `json` nodes.

## LOW

- L1. E1802 passes C0/C1 controls (ran): `<Input label="\u0001" />`, `label="&#0;"`, `label="&#x7f;"` → no E1802. `blankLabel.ts:38`. Fix: add `\p{Cc}` to the blank class.
- L2. The flush's retry timer is not tied to `drain`'s scope (reasoned): `flush.ts:83-87` arms `c.timer`; `drain.ts:21` disposes only the net observer and `c.live` follows the outbox's declaring scope. After `drain`'s scope is disposed, a pending 1–60 s retry still runs `loop` and posts. Fix: `sc.onDispose(() => c.timer.abort())` in `drain`, or a per-drain live flag.
- L3. An outbox over an `events: true` endpoint (reasoned): `outbox.ts:36` does not reject it; the client returns an `AsyncIterable`, `outcomeOf` reads `r.error.code` of `undefined` → TypeError in the flush, the entry stays `sending`, and every reload rethrows. Fix: throw at `outbox(...)` for an `events` endpoint (or a check rule).
- L4. Two ctxs over one module-level outbox (reasoned): the store is shared and `owners` is per ctx, so `own(ctxB, 'b')` fails ctxA's live entries. Fix: state one ctx per outbox or key entries by ctx.
- L5. Two tabs overwrite each other's stored outbox (reasoned, not new in this diff): `persist` writes the whole in-memory list, so tab B's write drops tab A's entries from storage; a reload of A loses its queued writes. Fix: merge by key on write, or re-read before write.
- L6. `s.json()` deep nesting throws `RangeError: Maximum call stack size exceeded` (ran; `check` recursion, not this diff): `JSON.parse('{"k":' + '['.repeat(2e5) + ']'.repeat(2e5) + '}')` parses, then `s.object({ k: s.json() }).parse(v)` throws, with or without `s.secret`. A ~400 KB request body reaches it. Fix: an iterative `check` for `json` or a depth bound returning `schema.invalid`.
- L7. A huge integer `keyLimit` (reasoned): `store.ts:77,147,175` copies the whole `keys` list per keyed commit and scans it per write, so `keyLimit: 1e6` costs O(n) per write; `restore` parses a forged snapshot's whole `keys` array before trimming (`:253-279`). Fix: a Set index plus a ring buffer; trim before parse, or cap `keyLimit`.

Note, not filed: E1802 reports a label of one lone Devanagari vowel sign (`"ि"`, an M character) as blank; it renders as a dotted circle plus the sign. That follows std.text `line`, so it is consistent.

## Probes that held
- secretSegments (ran): pii and secret on one route `/u/alice@x.com/k/T0KEN` → `/u/[pii]`; with a tail → `/u/[pii]`; `%75` for `u` → `/%75/[pii]`; `alice%2Fx` → `/u/[secret]`; malformed `%zz` → `/u/[pii]`; pii-only table `/u/alice%2F..%2Fx` → `/u/[pii]`, `%5c` → `/u/[pii]`, trailing slash → `/u/[pii]/`, `//u//alice@x.com` → `//u//[pii]`; pii at the front `/alice@x.com/inbox` → `/[pii]`; `.pii()` on the whole params object and on an `.optional()` field both mark. `;` matrix segment `/u;m=1/alice@x.com` is not marked, but the router answers 404 there, so it is not a param value. Every path the router matches lined up (the router's static compare is stricter than the marker's).
- Cost: per route, at most its own segments; a single huge segment is decoded once per marked route (bounded by the table).
- Deep freeze: a cyclic value terminates (`ok: false`, no hang); a Map under `s.secret(s.json())` is `schema.invalid`, so no mutable Map/Set/Date can escape inside a Secret.
- `keyLimit` `Infinity`, `NaN`, `"5"`, `0`, `1.5` throw at construction (`Number.isInteger`, reasoned); duplicate keys in a restored snapshot only dedupe the same writes; trimmed to `keyLimit` on restore.
- std-offline load (reasoned): an entry with `origin` (any value, including `null`), a missing or non-string `owner`, or a JSON `__proto__` key loads `failed` with owner `""` or is dropped by `OutboxEntry.parse`; `field` reads own JSON data only, so a prototype-key owner cannot match; a `failed` entry with owner `""` is never posted under golden-1's `""`; an unbound ctx (no owner given) posts nothing; an endpoint name like `constructor` fails `api.input` (`Object.hasOwn`). No stored value makes `drain` hang: every write is bounded by `persist`, the service call never throws and has its own timeout, and `c.writes` entries are deleted when their write settles.
- `'theirs'` resolving `true` with both writes rejected leaves the entry in storage, but only as `conflict` or `failed`, which no reload posts (as std.outbox states).
- `errorName` (reasoned): a lower-case `typeerror` gives `Error`; a subclass naming itself `TypeError` gives only that fixed word; a throwing `name` getter or a Proxy whose `getPrototypeOf` throws is inside the try.
- `logUnwritable` under json (reasoned): the record is the fixed `{ kind, code: "keel.unexpected", message, see }`; no path, thrown text or request value.

## Proposed backlog lines
- [ ] 0790 red-team, HIGH: std-offline flush posts an entry whose owner changed (and that `own` already failed) while its `sending` write was pending; re-read the entry and owner after the write · std-offline · std.offline · repro: red-team-7.md H1
- [ ] 0791 red-team, HIGH: the outbox owner is not bound to the session cookie; a sign-in in a second tab makes the first tab post the previous user's entries under the new cookie; carry the owner in `write` and refuse a mismatch on the server, or state the limit · std-offline, sync · std.offline · repro: red-team-7.md H2
- [ ] 0792 red-team, MEDIUM: a storage write that settles after the 10 s bound overwrites the second write; storage holds `queued`, a reload posts a write reported `failed` · std-offline · std.outbox · repro: red-team-7.md M1
- [ ] 0793 red-team, MEDIUM: a write after the server's answer that rejects turns `sent`/`conflict` into `failed` `offline.storage`; a resend commits twice · std-offline · std.outbox · repro: red-team-7.md M2
- [ ] 0794 red-team, MEDIUM: E1802 misses `&zwnj;`, `&emsp;`, `&shy;` and the other JSX named entities that decode to invisible characters · check · k.a11y · repro: red-team-7.md M3
- [ ] 0795 red-team, MEDIUM: `Secret.of` freezes and walks the value before `check`; `parse` throws on a typed array, a throwing getter or a revoked Proxy, and freezes the caller's object on a failed parse · schema · k.schema · repro: red-team-7.md M4
- [ ] 0796 red-team, low: E1802 passes a label of C0/C1 controls (`\u0001`, `&#0;`, `&#x7f;`) · check · k.a11y
- [ ] 0797 red-team, low: the flush's retry timer outlives `drain`'s scope and still posts · std-offline · std.offline
- [ ] 0798 red-team, low: `outbox` accepts an `events: true` endpoint; the flush throws on its stream and the entry stays `sending` across reloads · std-offline · std.offline
- [ ] 0799 red-team, low: two ctxs over one module-level outbox fail each other's entries (shared store, per-ctx owner) · std-offline · std.offline
- [ ] 0800 red-team, low: two tabs overwrite each other's stored outbox (whole-list writes); a reload loses the other tab's queued writes · std-offline · std.offline
- [ ] 0801 red-team, low: `s.json()` check recursion overflows the stack on ~200k nesting from a JSON body · schema · k.schema
- [ ] 0802 red-team, low: a large `keyLimit` costs O(keyLimit) per keyed write; `restore` parses a forged `keys` array whole before trimming · store · k.sync
