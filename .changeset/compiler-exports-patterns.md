---
"@keel/compiler": patch
---

A placed stdlib module's `./routes` export resolves through its package's `exports` subpath patterns (`"./*"`, `"./*.js"`) as Node resolves them: an exact key first, then the pattern with the longest prefix; a `null` target exports nothing.
