---
"@keel/server": minor
---

`createApp` for a `client` or `static` deployable throws E1558 for a route whose loader names `stores` or whose action names `stores`, as it does for a live loader; the message names the route and the module to serve from a `node` deployable.
