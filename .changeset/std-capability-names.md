---
"@keel/std-geo": minor
"@keel/std-tokens": minor
---

`@keel/std-geo` registers the capability `geo.position` and `@keel/std-tokens` registers `tokens.opaque`, the `<id>.<name>` form E1607 asks; a module using `geo(ctx)` lists `geo.position` in `capabilities`. The accessors `geo(ctx)` and `tokens(ctx)` are unchanged.
