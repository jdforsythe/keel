---
"@keel/runtime-dom": patch
---

The E1253 warning for a throw while an island is claimed holds the thrown text only with `mode: "dev"`; otherwise it holds the code and the island id.
