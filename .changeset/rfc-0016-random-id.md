---
"@keel/ctx": minor
"@keel/schema": minor
---

k.ctx: `ctx.random.id(brand)` returns a fresh uuid typed `Id<B>`, so actions need no re-parse. `@keel/schema` exports the `Id<B>` type used by `s.id`. Custom `Random` implementations must add `id`.
