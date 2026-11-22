# RFC 0193: k.user, std.channels and std.live: an open stream judges its user again before each delivery

Status: accepted (ADR-0215, operator, 2026-11-22). Amends k.user (User), k.server (live loader args), std.channels and std.live. From `apps/household` (walkthrough finding L7-4).

## Decisions
- D1: before each delivery to an open stream, std-channels asks who the stream's request belongs to now. A live loader's args gain `currentUser()`, which runs the identity source's `identify` again on the request the stream opened with. An answer other than the stream's `user` closes the stream `denied` and delivers nothing.
- D2: on delivery only, with a check less than 1,000 ms old on `ctx.clock` standing for the next one. Rejected: a session change signal (Keel sees no session, k.user) and a bounded interval while idle (an identify per stream per interval, for a stream that delivers nothing).
- D3: `live` shows `denied` for a refused read as for a refused channel. A `read` whose `err` is `api.status` 401 or 403, or a KeelError `keel.denied`, puts `status()` at `denied`, closes the stream and stops reading. `denied` stays distinct from `connecting` (a read pending or failed for another reason) and `offline` (`ctx.net.online()` false).
- D4: a stream keeps the `user` it opened with. A different answer never becomes the stream's user; it closes the stream, and a new open is judged as any open is.
- D5: Keel still reads no credential. Whether the opening request's cookie still names a user is the identity source's answer, so a library whose sign-out only clears the browser's cookie (a self-contained token) keeps answering the user until the token expires, as it would for any request carrying it.

## Problem
`test/live.test.ts` "refuses the re-read of a member who signed out": Grace's stream is open with her cookie, she signs out through `/api/auth/sign-out` in another tab, and Ada adds Rice. Grace's stream gets `{ kind: 'saved', store: 'shopping.changes', head: 1 }`; her re-read answers 403.

The spec says this happens: k.user keeps an event stream's `user` from open to close. std.channels runs `member` after each save with that user, so the stream outlives the session that opened it. No list data reaches the signed-out browser, since the re-read is guarded, but the stream keeps telling a signed-out page when the household's list changes, and keeps one of the process's `maxStreams` for it.

std.live then misreports. `status()` is `denied` "once the channel denies" and `connecting` while "a read is pending or failed", so a 403 on the re-read shows Connecting and retries with backoff to 30 s, forever. `ShoppingList.tsx` works around it: it wraps `read`, sets a `signedOut` signal on an `api.status` 403 and composes its own status:
```ts
const signedOut = signal(false)
const read = async (c: Ctx, abort: AbortSignal) => {
  const r = await shoppingApi.items({ signal: abort }, c)
  signedOut.set(!r.ok && r.error.code === 'api.status' && r.error.data.status === 403)
  return r
}
const following = live(ctx, origin, listChannel, {}, { read, hydrate })
const status = (): LiveStatus => (signedOut.get() ? 'denied' : following())
```

## Proposal
### What the author writes
After: the page passes its read as is and shows `live`'s status.
```ts
const status = live(ctx, origin, listChannel, {}, { read: (c, signal) => shoppingApi.items({ signal }, c), hydrate })
```
The server side does not change: `member: ({ user }) => user !== ''` now closes a signed-out member's stream at the next change, and the page shows the `denied` copy it already has ("Signed out: sign in again to see changes").

### k.user, User
"An event stream keeps the `user` it opened with until it closes" stands, and gains: "A live loader's args have `currentUser()`, `Promise<string>`: `identify` run again on the request the stream opened with (without its body), under the same rules; a throw, an invalid answer or 5,000 ms on `ctx.clock` answers `''` with the same `diag`. With no identity source it answers `''`; for a stream whose `user` came from a verified `x-keel-user` or from `renderRoute`'s `user`, that `user`, and no `identify` runs."

### k.server, API
The live loader line "args add `signal`" becomes "args add `signal` and `currentUser` (k.user)".

### std.channels
`member` runs "at open, at each publish and, for each open stream, before each delivery". Before each delivery to an open stream (`saved`, `changed` (RFC 0192) or `message`) the route calls `currentUser()`; an answer other than the stream's `user` gives `{ kind: 'closed', reason: 'denied' }` in place of that event, then the end. An answer given less than 1,000 ms earlier on `ctx.clock` for that stream stands, so a burst of saves costs one `identify` per stream per second. Deliveries to one stream keep their order; the checks of different streams run independently, so one slow `identify` delays only its own stream. A publisher's own `currentUser()` is not asked: a publish is a request and runs `identify` as one.

### std.live
`status()` is `live` while the stream is open and the latest read since its `reset` succeeded; `connecting` while the stream opens or a read is pending or failed for any other reason; `offline` while `ctx.net.online()` is false; `denied` once the channel denies or a read is refused. A read is refused when its `err` is `api.status` with `status` 401 or 403, or a KeelError with code `keel.denied` (a direct loader call). A refused read commits nothing, closes the stream and stops reading, as a channel denial stops `subscribe`. `denied` ends that `live` call; a later sign-in shows on the next navigation or reload, which mounts the page again.

### What does not change
`identify`'s contract, `member`'s signature, the `closed` reasons, `subscribe`'s status set, the caps, the guard on the page's loader.

## Alternatives
- **A session change signal**: the identity source raises `revoked(user)` or Keel re-judges a caller's streams after a `handle` response sets a cookie. Rejected: Keel holds no session and reads no credential (k.user), a sign-out on another device or another replica passes through no `handle` this process sees, and a revocation in the library's own admin tool passes through none.
- **A bounded interval**: run `currentUser()` for each open stream every 60 s, idle or not. Rejected as the one rule: 1,000 open streams cost about 17 `identify` calls a second with no event to protect, and a change delivered within the interval after a sign-out still goes out. An idle stream after a sign-out delivers nothing, so the delivery check covers what a stream can say. It can be added on the 15 s keep-alive in a later RFC if an app needs idle streams closed.
- **Leave the user fixed and document the wrapper.** Rejected: every live page repeats the 403 check, and the stream keeps reporting changes to a browser that no longer belongs to a member.
- **Switch the stream to the new answer.** Rejected (D4): a stream judged at open for one user would continue for another without an open.
- **`denied` for any failed read.** Rejected: a 502 or a timeout is a reason to retry, which `connecting` says.

## Spec diff
Applied to the spec sections named below; the `implemented` status flips and the ledger rows come with the implementation.
- **k.user**, User: the `currentUser` sentences above after "An event stream keeps the `user` it opened with until it closes." Conformance gains: "With `identify` answering `'u1'` at open and `''` after, a live loader's `currentUser()` answers `''`, one `identify` call per call; a stream opened with a verified `x-keel-user: u1`, `'u1'` with no `identify` call."
- **k.server**, API: "args add `signal` and `currentUser` (k.user)".
- **std.channels**, Serve: `member` "before each delivery"; the `currentUser` paragraph. Conformance: the clause "After a save that makes `member` false ..." gains a twin below.
- **std.live**, API: the status sentence and the refused read sentences above. Conformance: the clauses below.
- **Status**: k.user and k.server `implemented`, std.channels and std.live `implemented`, in each section and `spec/00-map.md`.
- **Ledger**: the clauses below at `none`.
- **Skills**: keel-data Live updates says `denied` covers a refused read; keel-server names `currentUser` on a live loader.

## Conformance
By the `conformance-writer`, under `rfc:0193`, from the spec text alone.
- k.user: the clause in the Spec diff.
- std.channels: with `identify` answering `'u1'` for a stream's cookie, then `''` once that session is removed, the next save of its stores gives that stream `{ kind: 'closed', reason: 'denied' }` and no `saved`; another member's stream gets `saved`.
- std.channels: five saves within 500 ms on the sim clock run `identify` once for an open stream; a save 1,000 ms after the check runs it again.
- std.channels: `identify` throwing or not settling within 5,000 ms at a delivery closes that stream `denied`.
- std.live: a read answering `api.status` 403 commits nothing, `status()` is `denied`, the stream's request is aborted, and no read runs after 1 s, 2 s or 30 s on `ctx.clock`; a read answering `api.status` 502 leaves `status()` at `connecting` and reads again 1 s later.
- std.live: a read returning a KeelError `keel.denied` gives `denied`.
- std.live: with callers A and B live on one sim server and B's session removed, A's write leaves B's `status()` at `denied` and B's hydrated store as it was.

## Build
- `packages/server/src/`: the live loader args gain `currentUser`, bound to the opening request's headers and the identity source; the `x-keel-user` and harness cases answer the stream's `user`.
- `packages/std-channels/src/server/channelRoute.ts`: the check before each delivery in the per-stream chain, with its 1,000 ms standing answer.
- `packages/std-live/src/`: the refused read classification and stop.
- `apps/household/modules/shopping/ShoppingList.tsx`: the wrapper and the `signedOut` signal go; `test/live.test.ts` "refuses the re-read of a member who signed out" expects `closed` `denied`.
- Size: std-live gains the classification, under 0.1 kB.

## Migration
None: unreleased.

## Token impact
k.user gains about 90 tokens, k.server about 5, std.channels about 110, std.live about 70; each stays under the section budget (2,350).

## For the operator
Decided:
- A kernel section changes: k.user and k.server gain `currentUser()` on a live loader, by RFC under the provisional freeze, in place of an app-side wrapper.
- The 403 wrapper on a live page goes away; `denied` also means a read was refused. A refused read has no retry form.
- Each delivery to an open stream can cost one `identify` call, at most one per stream per second; a list with 1,000 open streams and a burst of saves is up to 1,000 reads a second on the auth library's store.
- A sign-out that only clears a cookie in the browser (D5) does not close streams; that is the library's revocation model, outside Keel.
