---
"@keel/check": minor
"@keel/compiler": minor
"@keel/server": patch
---

E1808 and std config in the browser (backlog 0188, 0189; RFC 0069). `keel check` reports E1808 when a `@keel/ui` base element gets `children` made before it: an element call, JSX, or an array, conditional or `const` holding one. That child takes its parent's server node at resume, so the island re-renders (E1253). The fix wraps an inline value in `() => `. Aliased and namespace imports count. `keel check` also flags a `For`, `If` or `Match` call, an element destructured from a namespace import, and a `const` props object. A stdlib package opts its config into the browser with `clientStd(pkg)` (`@keel/compiler/std/clientStd`); by default config stays on the server. An island document from `createApp({ std })` now carries the opted-in config for the served deployable's modules as `std` in `#k-state`. The resume entry binds it with the new `bindClientStd` (`@keel/compiler/std/bindClientStd`) before `resume`, so `stdConfig` in a resumed island reads the server's value. A `client` deployable's entry embeds that part of the build's `std.json` and binds it before the router starts.
