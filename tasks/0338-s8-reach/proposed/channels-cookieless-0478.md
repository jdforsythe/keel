# 0478: cookieless channel opens share one `perCaller` allowance (the owner decides; security)

**Attack.** An event-stream GET never sets the caller cookie, so every client that has not made a write opens a channel as caller `""`, and `channelRoute` counts them all as one caller against `perCaller` (default 8, per process; `packages/std-channels/src/server/channelRoute.ts:55-57`). On a route whose `member` admits `""`, one anonymous client that opens 8 streams and holds them makes every other cookieless open get `closed` `full`: every first-time visitor loses live updates until the holder disconnects.

Routes whose `member` refuses `""` are not exposed: `member` runs before the caps, so a cookieless open there is `denied` and holds nothing.

**Options.**
- A: cookieless opens skip `perCaller` and count only against `maxStreams` (default 1,000). Cost: no knob. One anonymous client can then hold the whole pool, so cookied members get `full` too: the same attack, aimed at everyone.
- B: key cookieless callers by client address. Cost: the host must hand `createApp` a trusted address (a forwarded-for header is spoofable behind a proxy the app does not control), many users share one NAT address, and Keel has no address notion in k.server today; a new trust input for one bound.
- C: refuse cookieless opens unless the route opts in (`anonymous: true`). Cost: one option on public channels. It duplicates `member`, which already decides whether `""` may open; on an opted-in route the shared allowance is unchanged.
- D: a separate `perAnonymous` bound for caller `""` (default 64), next to `perCaller` in `std['@keel/std-channels']`. Cost: one config key, set only by apps with public channels. The pool is still shared, but an attacker must hold 64 open connections, the bound is tunable, and cookied callers keep their own `perCaller`.

**Recommendation: D**, with one std.channels sentence: cookieless streams share `perAnonymous`, and a route whose `member` refuses `""` has none. A widens the blast radius, B adds a spoofable trust input, and C is a second spelling of what `member` already decides. A per-client fair share for anonymous clients needs an identity; an app that needs one mints the caller cookie with a write before it opens the channel.

**Spec and RFC.** D adds a config key, a sentence and a conformance bullet to std.channels (`perAnonymous` past its bound: `closed` `full` for caller `""` only), so one RFC after the owner's choice.
