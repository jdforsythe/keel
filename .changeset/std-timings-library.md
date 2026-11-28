---
"@keel/std-timings": minor
---

`@keel/std-timings` is a library (k.library): a module that imports it lists `@keel/std-timings` in `deps`. `Timings` and `TimingsRecent` live in `*.schema.ts` files, the manifest names the `clock` capability `time` reads, and the `./tools` entry registers the inspector's `timings.recent` section, so `keel check` and `keel build` see it.
