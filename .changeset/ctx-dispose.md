---
"@keel/ctx": minor
---

`Ctx` has `dispose()`: on a real or shell ctx it removes the window `online` and `offline` listeners its own net added, once. A repeat call, a sim ctx and a ctx whose net came from `drivers` do nothing, and the ctx stays usable. An object literal typed `Ctx` carries `dispose`, for example `dispose: base.dispose`.
