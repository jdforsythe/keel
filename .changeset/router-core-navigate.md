---
"@keel/router": minor
---

`@keel/router/internal` exports `findRouter()` and the `RouterCore` type for kernel and stdlib components: the router rendering them, with its `ctx` and its `navigate(href, { replace? })`. App code does not import it (E1576).
