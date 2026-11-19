---
"@keel/std-channels": minor
---

`@keel/std-channels`: `channel` (E2602 for a secret in its `message` schema), `channelRoute` (a live loader whose streams start with `reset`, get `saved` per save of the channel's stores and `message` per publish, with `member` checked at open, at each publish and after each save, and `perCaller`/`maxStreams` caps from the module's `std` config), the client `subscribe` (status signal, 1 s to 30 s backoff on `ctx.clock`, offline-aware) and `publish`, the `channels` module manifest, and rules E2601 and E2602 in `./tools`.
