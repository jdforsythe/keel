---
"@keel/compiler": patch
---

The generated client and resume entries pass `mode` to `mount` and `resume`: `"dev"` when `import.meta.env?.DEV` is `true`, else `"production"`.
