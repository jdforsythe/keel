---
"@keel/compiler": minor
---

The `node` server build writes `dist/<name>/server.mjs.map` beside `server.mjs`: an external map with sources relative to the project (one outside it as `../`) and no `sourcesContent`. `server.mjs` ends with its `sourceMappingURL`. The client build is unchanged.
