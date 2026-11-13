---
name: keel-realtime
description: "Push Keel updates live: live loaders (async generator, events: true endpoints), @keel/std-channels channel/channelRoute/subscribe/publish, @keel/std-live live() views; E2601, E2602"
---

# Live loaders, channels, live views

Spec: `pnpm spec k.server`, `std.channels`, `std.live`. All serve from a `node` deployable (keel-server).

**Live loader:** `loader({ output }, async function* ({ signal }) { yield ok(v) })`, read with an `events: true` GET endpoint (`for await (const r of api.feed({}, ctx))`). A document GET takes the first yield.

**Channel (`@keel/std-channels`):** `export const boardChannel = channel('api.board', { path: '/api/board/events', params: s.object({}) })` in a shared file; `message` (a schema) allows `publish`. Server, in `*.server.ts`: `channelRoute(boardChannel, { id: 'api.boardEvents', stores: boardStores, member: () => true })`; list `{ api: true, path, loader }` in the manifest and pass `actions` to `routes.actions`. Client, in a scope: `subscribe(ctx, origin, channel, params, on)` returns `{ status, close }`; `publish(ctx, origin, channel, params, message)`. E2601 `channelRoute` outside `*.server.ts`; E2602 an `s.secret` in `message`.

**Live (`@keel/std-live`):** in a scope, `live(ctx, origin, boardChannel, {}, { read: (c) => api(origin).lists({}, c), hydrate })` re-reads after every save; `status()` is `connecting | live | offline | denied`. It replaces re-reading after your own writes for views other users change.
