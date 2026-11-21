---
"@keel/server": minor
---

A throw's `frames` are relative to the folder holding `createApp({ artifacts })`; without `artifacts` they are `[]`, and the working directory is no longer read. A position in `<artifacts>/server.mjs` is mapped through `server.mjs.map` (Node's `SourceMap`, read on the first throw that needs it), so a production server's frames name app files. The map is never served; frames stay scrubbed.
