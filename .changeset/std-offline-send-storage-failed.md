---
"@keel/std-offline": patch
---

`send` resolves `failed` with `offline.storage` when its own write to `ctx.storage` rejects, leaving the entry `failed` and posting nothing, where it rejected before.
