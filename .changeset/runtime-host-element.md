---
"@keel/runtime-dom": minor
"@keel/ctx": minor
"@keel/testing": minor
"@keel/std-sessions": minor
---

The host element runs: `@keel/runtime-dom/ops` has the `host` op, which `@keel/ui`'s `Host` calls. Its code loads by its dynamic import on the client only, `mount` runs in the next animation frame, `update` at most once per frame and only for a changed value, and `dispose` on teardown aborts the code's `signal`. Under `mode: 'dev'` and in the harness each value is parsed by `input`, and a failure reaches the nearest `Boundary` as `schema.invalid` with `data.at`; a `Boundary` fallback's error is now `CaughtError`. Each `emit` is parsed by `events`, reported as a `fire` of `{ type: 'emit', detail }` (`FireEvent` and `TestEvent` gain it) and given to `onEvent`. In `@keel/testing` a host element never runs its code: `find(id).value` shows its encoded value and `fire(id, { type: 'emit', detail })` stands in for the outside code. A session records an `emit` and `replay` applies it without the library.
