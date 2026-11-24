---
"@keel/std-sessions": minor
"@keel/cli": patch
---

A session of a page a `node` deployable serves replays through its app. `replay` and `minimize` take `serve(ctx)`, a function resolving a `createApp` result made on the replay ctx, and `user`, the id the base renders signed in as; the base renders with `renderRoute` and `app` over empty sim storage and the recorded `state` is not applied. A base page that redirects is E2003 `base route <id> redirected to <other id>` with `unapplied` -1 and is never reproduced. `keel session replay|minimize|to-test` pick `serve` when a `node` deployable serves the route and take `--user <id>`; the `to-test` file of such a page is written to `test/session-<fingerprint>.test.ts` beside `topology.ts` (a page a `client` or `static` deployable serves keeps `modules/<id>/test/`), imports `../topology.ts`, `../modules/<id>/routes.ts`, the contract and `../identity.server.ts` when it exists, builds the app with `createApp`, passes `app` and no `state`, and holds a `user` option only when `--user` was given, so `keel check` reports no W1723 on it.
