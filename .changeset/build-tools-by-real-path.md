---
"@keel/cli": patch
---

`keel build` runs the project's Vite, and the Tauri and Capacitor tools, with Node on the real path of the installed package, so a `node_modules` that is a link from elsewhere builds. A tool that is not installed still runs through `npx --no-install`.
