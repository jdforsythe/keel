---
"@keel/server": minor
"@keel/router": minor
"@keel/services": minor
"@keel/testing": minor
"@keel/compiler": minor
"@keel/check": minor
"@keel/cli": minor
---

A project's `identity.server.ts` default-exports `identity({ identify, handle? })` from `@keel/server`, and each `node` deployable's generated entry passes it as `createApp({ identity })`. `identify` runs once per routed request, after the same-site check and before guards, and its answer reaches guards, loaders and actions as `user` beside `caller`; a throw, an invalid answer or an answer past 5,000 ms fails the request closed. `handle` mounts a library's own endpoints and returns their responses as given. A `service({ module })` call takes `user`, sent as an `x-keel-user` header signed under the app's secret for 60 s and that method and path. A `node` deployable's `caller: { days }` gives the caller cookie it mints a `Max-Age`, and `pii.json` records it as `caller: { days, class: 'network' }`. `renderRoute` takes a `user` option. E1578 and E1579 report a bad `caller` option and a bad identity source.
