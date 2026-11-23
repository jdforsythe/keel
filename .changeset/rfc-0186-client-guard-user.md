---
"@keel/server": minor
"@keel/router": minor
"@keel/testing": minor
---

A `node` deployable with an identity source answers `GET /__keel/user` with `{ user }`, the identity source's answer, and `cache-control: no-store`; it needs `x-keel: 1` (else 403 `keel.denied`), and without an identity source the path is a 404. A client router started with `mount` (the project has `identity.ts`) reads it from its page's origin once as it starts and again after each mount request's answer in a shell, before it acts on the redirect; guards, loaders and actions wait for a read in flight and get its `user`, `''` before an answer and after a failed one. The value is held in memory only. A router with no `mount` sends nothing. `renderRoute` reads it in a shell run over an identity mount, or with `mount`, unless `user` is given.
