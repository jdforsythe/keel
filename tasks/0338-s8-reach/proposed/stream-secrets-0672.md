# 0672: a live stream's secret set grows while the stream is open

Path (b). The log text is already bounded and fails closed as k.privacy says; what is unbounded is memory, which no
spec sentence states. A bound the user can rely on is a security and API choice, so it is proposed, not built.

## Facts (read and probed)

- Set made per request: `packages/server/src/createApp.ts:202` (`new Set<string>()`), run as the request's
  `requestSecrets` store at `createApp.ts:203` (`packages/server/src/internal/requestSecrets.ts:4`).
- Added to: `packages/server/src/internal/noteRequestSecrets.ts:9-14`, the `onSecret` listener; each `Secret` made in the
  request's async context adds `""` and every revealed string or number (`packages/schema/src/internal/secretValues.ts`).
- Held by a live stream: `packages/server/src/internal/liveStream.ts:35` spreads `r.rq` (so `rq.secrets` is the same
  set) and the generator runs inside the `requestSecrets.run` context, so every tick's `Secret` lands there until the
  stream's `finally` (`liveStream.ts:87-95`). Nothing ever deletes from the set.
- Read only on a throw: `liveStream.ts:81-83` (`scrubbedCause`, `redacted`); a stream writes no per-yield log record.
- Scrub cost and cap: `packages/server/src/internal/automatonOf.ts:2` (`CAP = 2_000_000`), `:93-111` (forming stops
  the moment distinct forms pass the cap, returns `"over"`), `:209-221` (cached per set; `"over"` kept however the set
  grows). `scrubbed.ts:37` turns `"over"` into one mark. So CPU per scrub is bounded and the text fails closed; memory
  is not: the set keeps every value, and the cache keeps the set's last automaton (up to the cap) alive with it.

## Probe

`packages/server/test/liveStreamSecrets.test.ts` (passes): 500 ticks of a fresh 40-character secret leave the set at
501 (+1 per tick, the `""` included) and the throw logs `loader api.live threw: Error: plain words; last [secret]`.
1,000 ticks of 1,000-character secrets (about 2,333,000 characters of forms) leave it at 1,001 values and the throw
logs `loader api.live threw: [secret]`: the cap fails closed. At, say, a 40-character token per second, an open stream
holds about 144 KB of values per hour, times up to `maxStreams` (1,000) streams.

## Options

A. **Stop holding at the cap (no spec change).** The noter keeps a running upper bound of the forms' characters per set
   (the sum of each value's form lengths before dedup); when it passes 2,000,000, and again at each doubling, it
   calls `automatonOf([set])` (bounded by the cap). Once that is `"over"`, it records an `over` flag on the request
   and adds nothing more. Every later record is one mark, exactly as today, because `"over"` is already sticky.
   Cost: about 15 lines in `noteRequestSecrets.ts` and `automatonOf.ts`, one WeakMap. Leaves exposed: nothing in the
   log. Memory past the cap is bounded only once forms truly pass it; values whose folded forms collide (case variants)
   can still grow the set under the cap (adversarial, not a fresh-token stream).
B. **Cap the number of values (spec change).** Past 100,000 secret values a request is over, like the text cap.
   Bounds memory for any input, fails closed. Cost: a sentence and a conformance case; a long stream of short tokens
   (100,000 ticks, about 28 h at one per second) then logs its throw as one mark, losing the diagnostic.
C. **Window of the most recent N.** Rejected: a secret made before the window and thrown later (a closure, a cached
   token) is written to the log in clear. Silent unmarking.
D. **Mark per emitted event.** Rejected: a stream writes no per-yield record; its one scrubbed record is the end-of-stream
   throw, which can hold a value made on any earlier tick. Same exposure as C.

## Spec sentence (option B only)

k.privacy, Sinks, Server log bullet. Today: "Past 2,000,000 characters of these values' written forms, the message and
each frame are one mark, `[secret]` if the request made a secret." Proposed: "Past 2,000,000 characters of these
values' written forms or 100,000 secret values, the message and each frame are one mark, `[secret]` if the request
made a secret." Trim to fit: "- Server log (k.server): " to "- Server log: ", and "An action's `output` counts as a
loader's." to "An action's `output` is a loader's." Section: 5,992 to 5,999 characters, 1,498 to 1,500 tokens.
Conformance header quoting the changed sentence: `packages/server/conformance/privacy-secret-reach.test.ts:8`.

Conformance wanted (B): a live loader making 100,001 distinct 12-character secrets then throwing `Error("plain " +
first)` logs a `diag` whose message is `loader <id> threw: [secret]` and no line holds any value, in dev and production;
with 99,999 the message is `loader <id> threw: Error: plain [secret]`.

## User's call

Whether a memory bound is a promise (B, spec) or an implementation detail (A), and the value count if B.

## Recommendation

A now: it bounds memory for real streams with no change to what the log says. B only if the bound must hold against
adversarial case-colliding values; never C or D.
