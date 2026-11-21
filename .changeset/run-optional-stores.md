---
"@keel/router": minor
---

A loader's and an action's `run` take `stores` as optional: absent, `fn` gets what the declared `stores` factory returns for `ctx`, `undefined` without one. `run` saves nothing.
