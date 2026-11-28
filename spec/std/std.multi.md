# std.multi: Multi-user sessions
status: conformance-covered
**Module.** Part of `@keel/std-sessions`, subpath `./group` (Node only). A session group is the sessions of several users of one server, recorded under simulation on one timeline:
```ts
type SessionGroup = { v: 1; seed: number; at: number; origin: string; server: { [store]: JsonValue }; users: Session[]; schedule?: Schedule }
```
`server` holds each server store, as stored in `keel.store.<id>`, when the group opened. Each of `users` is a `sessions.Session`, its `id` under std.sessions' rule; a group has no id of its own, and its users are named by index.

**Record.** `openGroup({ user, serve, users, seed, origin, at?, server?, schedule? })`. `user` is the URL of a module exporting `{ routes, base: { id, params, search } }`; `serve(ctx)` returns the server (`{ fetch }`, as `createApp` does) over a sim ctx of seed `seed` whose storage starts with `server`. Each user runs in its own worker thread, with its own DOM, modules and sim ctx (seed derived from `seed` and its index), renders `base` at `at` (default 0) under `record(ctx, { limit: Infinity })`, and reaches the server through its sim net at `origin` with its own cookie jar; other URLs are 404. The handle:
- `user(i)`: `fire`, `navigate`, `find` and `state`, as k.testing's harness gives them.
- `setOnline(i, b)`: that user's sim net (k.sync).
- `advance(ms)`: every clock, the server's included.
- `settle()`: resolves when no request or stream chunk is in flight and every user has settled.
- `stop()`: the `SessionGroup`.

**Schedules.** With `schedule` (k.sim), user `i` of `n` gets the schedule whose `net` holds every `n`-th step of `schedule.net` from index `i`, with `schedule.offline` and no `storage` or `plans` steps; the server ctx gets none. `advance` moves every clock, so each user's delays resolve on the group's timeline. The group keeps `schedule`, and `replayGroup` applies it.

**Net events.** std.sessions records `{ kind: 'net', online }` (k.sync) as an input; `replay` and `replayGroup` apply it with `setOnline`.

**Replay.** `replayGroup(group, { user, serve })` restores the server storage from `group.server`, opens every user at its session's base, then applies all users' inputs in order of `at`, then user index, then event index, advancing every clock to each `at` and settling after each input. A group that fails `SessionGroup` or holds a session without a `seed` throws E2007 or E2008 before any user opens. It returns `{ users: ReplayResult[], server: { [store]: Snapshot }, reproduced }`: `server` holds each server store with its log, `reproduced` holds iff every user's fingerprint matches.

**Privacy.** A group is a simulation artifact: `openGroup` runs only on sim ctxs, and a group holds what each user's `record` kept under its `redact` entries.

**Rules.** E2007 a group file fails `SessionGroup` · E2008 a group user's session has no `seed`. Both diag the file at 1:1: `keel session replay <f>` reads a file with a top-level `users` key as a `SessionGroup` (exported by `@keel/std-sessions/group`) and reports them before any replay; a valid group file replays nothing there (`replayGroup` needs the user module and `serve`) and exits 0.

**Conformance.**
- Under one seed, two runs of one script on `openGroup` give byte-equal groups.
- `replayGroup` of a recorded group ends with every server store equal to the live group's final store and each user's `state()` equal to its live final state; two replays are byte-equal.
- Two users of one group get distinct `caller`s, and one user's `find` never returns the other's elements.
- Inputs of different users apply in order of `at`, then user index, then event index.
- A `net` event that `record` captured is applied by `replay` and `replayGroup` as a `setOnline` call and recorded again.
- Under one `schedule`, two runs of one script on `openGroup` give byte-equal groups, and with a `lost` step on a user's write the server holds one entry for that write's key.
- E2007 and E2008 each fire on a fixture and not on its clean twin.
- `SessionGroup` refuses a group whose `users[1].id` is `../x`, its first issue's `path` being `['users', 1, 'id']`; `keel session replay` of that group file emits E2007 and exits 1, and `replayGroup` of it throws E2007 before any user opens.
