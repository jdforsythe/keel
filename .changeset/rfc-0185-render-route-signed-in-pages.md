---
"@keel/testing": minor
"@keel/services": minor
"@keel/ctx": minor
"@keel/schema": patch
"@keel/check": minor
"@keel/tooling": minor
---

`renderRoute(id, { user })` signs the page in for its own requests: without `app`, a `service({ contract })` call on a `createApp`-bound ctx that names no `user` carries the harness's `user`; with `app`, each request to the document's origin carries `x-keel-user`, signed by the `keel.user` signer of the binding `createApp` made of `app` on `ctx`. Each harness with `app` or `shell` is one browser with its own cookie jar, applied as its requests enter `ctx.net` and updated from every `set-cookie` it receives, so a sign-in through the identity mount holds; with `app` the page runs on a ctx of its own and `ctx.net` routes the document's origin to `app.fetch` unless the test routed it. Two harnesses over one `app` are two users, open at once. E1724 rejects `user` with `app` on a ctx no `createApp` of `app` bound, and a second router-mode harness on one ctx with another `user`. Under `keel test` (`keelConfig`) the `Request`, `Response`, `Headers`, `fetch`, `AbortController` and `AbortSignal` globals are Node's under happy-dom, and a DOM `FormData` body is accepted; `decodeStrings` reads a `FormData` of either realm.
