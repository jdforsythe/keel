---
"@keel/server": patch
---

`server.mjs.map` is read only up to 32 MB; a missing, over-cap or malformed map is one `keel.unexpected` `diag` and its frames are dropped. Under `--enable-source-maps`, frames Node already mapped are kept, relative to the project.
