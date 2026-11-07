---
"@keel/compiler": minor
"@keel/testing": patch
---

RFC 0030: E1000 is the only result for a file that does not parse (no rules, elements, deps or output) and is reported at build-time evaluation instead of a raw esbuild failure; E1501 only for root paths or route-pattern matches in `href`/`action`/`formaction`/`Link to` (assets in `src`/`poster`/`ping`/`xlink:href` are fine); `routes.ts` that throws or exports no `routes` is E1006; internal failures are E1049 (`compile()` throws nothing else). New `@keel/compiler/a11y` (`roleFor` and the role/name tables) is the single table for `a11y.json` and the `@keel/testing` harness (decorative `img` is `presentation`, unnamed `section` is `generic`, ARIA 1.2 name-from-content list). Vite build-time warnings print `keel: <code> ...`.
