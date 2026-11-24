---
"@keel/cli": patch
---

`keel dev` reads `KEEL_DEV_POLL`: `1` asks Vite for a polling file watcher (`usePolling: true`, `interval: 100`, merged over the project's own `server.watch`), for a container, a network file system, or a machine that drops file events; unset, empty or `0` leaves the watcher to the project's Vite config; any other value is one E1560 and `keel dev` exits 1. Keel no longer reads `CHOKIDAR_USEPOLLING`.
