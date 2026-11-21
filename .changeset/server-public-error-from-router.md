---
"@keel/server": patch
---

The server takes `publicError` from `@keel/router/internal`, so a `keel.unexpected` reads the same on a server page and a client page.
