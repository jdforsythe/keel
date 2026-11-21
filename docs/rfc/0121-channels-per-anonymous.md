# RFC 0121: std.channels: a `perAnonymous` bound for cookieless opens

Status: implemented. Accepted (user, 2026-11-17). For backlog 0478. ADR-0147 records it.

## Decisions
- D1 (user): cookieless opens get their own bound, `perAnonymous` (default 64). Every open whose caller is `""` counts, with all the others, against `perAnonymous` and never against `perCaller`. Config is `std['@keel/std-channels']: { perCaller?, perAnonymous?, maxStreams? }`.
- D2: an open past `perAnonymous` gets what an open past `perCaller` gets: `{ kind: 'closed', reason: 'full' }` as its only event; the streams already open continue.
- D3: std.channels states that a route whose `member` refuses `""` holds no cookieless stream (`member` runs before the caps), and gains one conformance bullet, appended at the end as bullet 11.

## Problem
Read on `jdforsythe/test-impl` at `623fdb62`.

An event-stream GET never sets the caller cookie (k.server), so every client that has not yet written opens a channel as caller `""`. `channelRoute` counts the open streams whose caller equals the opener's (`packages/std-channels/src/server/channelRoute.ts:55-57`), so all cookieless clients share one `perCaller` allowance, 8 streams per process by default. On a route whose `member` admits `""`, one anonymous client that opens 8 streams and holds them makes every other cookieless open get `closed` `full`: every first-time visitor loses live updates until that client goes. Routes whose `member` refuses `""` are not exposed, since `member` runs first and a refused open holds nothing. The decision note is `tasks/0338-s8-reach/proposed/channels-cookieless-0478.md`.

## Proposal
`packages/std-channels/src/server/ChannelsConfig.ts`: the schema becomes

```ts
s.object(
  { perCaller: s.int({ min: 1 }).optional(), perAnonymous: s.int({ min: 1 }).optional(), maxStreams: s.int({ min: 1 }).optional() },
  { closed: true },
)
```

`packages/std-channels/src/server/channelRoute.ts:55-57`: the bound for the opener is `caller === "" ? (cfg.perAnonymous ?? 64) : (cfg.perCaller ?? 8)`, compared with the count of open streams whose caller equals the opener's, as now. `maxStreams` is unchanged and checked first, as now. `member` still runs before both.

Why 64: an attacker must hold 64 open connections to one process to shut out anonymous viewers, eight times today's cost, while `maxStreams` (1,000) keeps 936 places for cookied callers. The bound stays per process and per serving module's config, like `perCaller`.

## Alternatives
- Cookieless opens count only against `maxStreams`: one anonymous client could hold the whole pool, so cookied members are shut out too.
- Key cookieless callers by client address: a new trust input (a forwarded-for header is spoofable behind a proxy the app does not control), and many users share one address.
- Refuse cookieless opens unless the route opts in: a second spelling of what `member` already decides, and the opted-in route keeps the shared allowance.

## Spec diff
std.channels: 5,488 characters (1,372 tokens) before, 5,961 (1,491 tokens) after. No tightening needed.

Serve, the `member` paragraph, whole new text:

```
`member` is a pure predicate over the request's `caller`, the parsed `params` and `stores` opened read-only. It runs at open (false: `closed` `denied` is the only event), at each publish (false: 403, nothing delivered) and, for each open stream, after each save of its stores. An event-stream GET reads the caller cookie and never sets one (k.server). The POST takes `{ message }` as an action: the k.server same-site proof, `maxBodyBytes` and 422 `keel.fields` apply, and it answers `ok(null)` once delivered. Delivery reaches the streams open in the serving process. Config `std['@keel/std-channels']: { perCaller?, perAnonymous?, maxStreams? }` (server-only; defaults 8, 64 and 1,000): the open streams of one caller, of all cookieless opens together (caller `""`, counted against `perAnonymous`, never `perCaller`), and of the process. A route whose `member` refuses `""` holds no cookieless stream. The kernel caps open streams per app as one pool (k.server `maxStreams`) with no per-caller share, so one client holding streams up to that cap makes the others get 503.
```

Conformance, appended as bullet 11:

```
- An open past `perAnonymous` cookieless streams, from any client, gets `{ kind: 'closed', reason: 'full' }` as its only event, and the earlier streams continue; with that bound reached, a caller with a cookie opens up to its `perCaller`.
```

The `closed` event bullet ("`full` when the open is past a cap") already covers the new bound.

## Conformance diff
One `rfc:0121` commit by the `conformance-writer`:
- `packages/std-channels/conformance/fixtures.ts:148`: `ServeOptions` gains `readonly perAnonymous?: number`; `:236-241`: the std artifact is written when `perCaller` or `perAnonymous` is set, its `std['@keel/std-channels']` holding each one given. A change to an existing file, so under the tag; no existing assertion changes, and `per-caller.test.ts` (cookied callers only) and `member-open.test.ts` (one cookieless open) hold as they are.
- New `packages/std-channels/conformance/per-anonymous.test.ts`, citing bullet 11: with `perCaller` 2 and `perAnonymous` n (a property over 3 to 5, seed 1337), n cookieless opens each start with `reset`, so cookieless opens are not held to `perCaller`; the next cookieless open gets `[{ kind: 'closed', reason: 'full' }]` and the n earlier streams do not end and get `saved` after a save; an enrolled caller then opens 2 streams that start with `reset` and a third that gets `closed` `full`. With no config, the 65th cookieless open is the first `full`.

## Migration
None for apps: the new key is optional, and an app that sets no config moves from 8 cookieless streams per process to 64. In this repo: `packages/std-channels/src/server/ChannelsConfig.ts` (schema and doc comment), `packages/std-channels/src/server/channelRoute.ts:25` (doc comment) and `:55-57`, `packages/std-channels/README.md:13,16,25,29` (the config shape, the caps sentence, the rungs list), `packages/std-channels/test/channelRoute.test.ts` (a unit case for the config schema accepting `perAnonymous` and refusing `0`).

## Build order
1. Orchestrator: the spec diff (applied). The `conformance-writer`: the conformance diff, one `rfc:0121` commit.
2. One std-channels lane owns `packages/std-channels/src/server/ChannelsConfig.ts`, `packages/std-channels/src/server/channelRoute.ts`, `packages/std-channels/test/**`, `packages/std-channels/README.md` and a changeset (`@keel/std-channels` minor: a config key). It runs `check`, `build` and the std-channels suite once, and `pnpm budgets` (`@keel/std-channels/server`).
3. Orchestrator: the `keel-realtime` skill if it names the config, ledger, backlog 0478 closed, HANDOFF.

## Token impact
std.channels 1,372 to 1,491 tokens (5,488 to 5,961 characters). No other section changes.

## Choices
- C1: past `perAnonymous`, the open gets `closed` `full` as its only event, the same answer as past `perCaller` and `maxStreams`, so `subscribe` treats it as it does today (reopen with backoff).
- C2: the bound counts every cookieless open in the process across the serving module's channel routes, as `perCaller` counts one caller's, so one setting caps one pool.
- C3: the conformance bullet asserts that a cookied caller still opens up to its own `perCaller` while the anonymous pool is full: the point of the change is that the anonymous pool cannot shut out callers with a cookie.
