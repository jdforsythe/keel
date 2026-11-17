---
"@keel/cli": patch
---

`keel build` runs Vite with `NODE_ENV=production` whatever the shell or a project `.env` sets, so it always writes the production client.
