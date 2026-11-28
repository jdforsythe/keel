---
"@keel/cli": patch
---

`keel dev` runs the project's Vite in process and, when `--port` is not given, serves on the Vite config's `server.port` (5173 when it sets none). A port in use is one E1560 line and exit 1, as with `--port`.
