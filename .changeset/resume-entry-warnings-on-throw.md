---
"@keel/runtime-dom": patch
"@keel/compiler": patch
---

When `resume` rethrows an island's throw, the warnings it collected are at `Symbol.for("keel.resumeWarnings")` on `globalThis`, and the resume entry prints them before the throw goes on.
