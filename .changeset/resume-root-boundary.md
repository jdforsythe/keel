---
"@keel/runtime-dom": minor
"@keel/compiler": patch
"@keel/reactive": patch
---

Each island `resume` resumes gets the root Boundary `mount` gives its tree: a handler, binding or render throw after the claim, or a throw of an `effect` or `computed` created in the island component, is reported to the ctx as `keel.unexpected` and the island is replaced by the root fallback (`<pre data-k-error>`), so it is never an uncaught page error and observers see it. A handler's throw carries `data.at` the id it was registered under, else the compiler's `data-k` stamp on its element or nearest ancestor (a bound template element's id, or a bound k.ui base element's literal `id`, which the compiler stamps in `.tsx` tags and `.ts` calls), else `""`, under `mount` and `resume` alike; a runtime `id` (app data) is never `data.at`, and the `attr` op does not bind `data-k`. The compiler keeps a `@keel/runtime-dom` import whose intrinsic is called, passed as a value or named in a parameter or destructuring default, so a plain `.ts` module calling `If(...)` or `Boundary(...)` works in the browser. A computed's throw surfaces in the effect or computed reading it, so a binding whose computed throws reports its own element as `data.at` under `mount` and `resume` alike, instead of the nearest scope's `onError`.
