---
"@keel/std-text": minor
---

`@keel/std-text` is a library (k.library): a module that imports it lists `@keel/std-text` in `deps`. `Email` and `Slug` live in `*.schema.ts` files, and the `./tools` entry registers `text.Email` and `text.Slug`, so `keel check` and `keel build` see the formats. The throw for an out-of-range bound of `line`, `para` or `truncate` sits in `unsafe/` with its reason.
