---
"@keel/compiler": patch
"@keel/server": patch
"@keel/ui": patch
"@keel/check": patch
"@keel/cli": patch
"@keel/schema": patch
---

Every policy reads the declared origins of the static read of `topology.ts`: a spread, a computed key or a key written twice in a deployable is E1552, and the generated entries pass the read as `createApp({ origins })`, which replaces each deployable's runtime `origins`. A `frame` origin that is the app's own is E1590 in `keel build` and `createApp`, a document leaves its own origin out of `frame-src`, and `Frame` renders `about:blank` for a `src` of the document's origin. A reason needs a character outside the blank set and holds no control or format character; an IPv6 literal origin is E1590; a directive written twice is E1591. E1570 reads a backslash as `/`; E1805 on `<iframe>` names `Frame`.
