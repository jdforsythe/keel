---
"@keel/cli": patch
---

`keel dev` asks Vite for a polling file watcher when `CHOKIDAR_USEPOLLING` is set (to anything but empty, `0` or `false`). On macOS Vite's watcher takes file events whatever that variable says, and a busy machine delivers them late or drops them.
