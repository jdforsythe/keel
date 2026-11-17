---
"@keel/services": minor
"@keel/std-offline": minor
---

A services client call takes `bearer`, a `Secret<string>`, beside `signal` and sends it as `authorization: Bearer <token>`, on an `events: true` GET too; the token is revealed only to build the header, and one outside the Bearer form (empty, over 4,096 characters, or with a space, comma or tab inside) is `api.input` at `bearer` with nothing sent. std-offline's `send` takes no `bearer`, so a queued write never stores a token.
