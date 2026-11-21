---
"@keel/server": minor
---

A node deployable's documents carry a `<title>` (the deployable name), a stylesheet link per CSS file of the client build's entry chunk, and `/keel-mark.svg` as the icon when the build has it; production serves the build's top-level `keel-mark.svg`. The default alert for `keel.notFound` is `<h1>Not found</h1>`, so an unknown path answers 404 with a readable page (k.server Document).
