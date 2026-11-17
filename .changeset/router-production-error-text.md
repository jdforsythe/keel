---
"@keel/router": minor
---

`createRouter` takes `mode: 'dev' | 'production'`, default `production`. Outside `dev` a `keel.unexpected` the default alert, a route's `errorElement` or a `Form`'s `error` gets has message `unexpected` and data `{}`, as the server renders it; observers and `mount`'s `onError` still get the full error. A test that reads a thrown message from a routed page passes `mode: 'dev'` or reads the ctx's `error` report.
