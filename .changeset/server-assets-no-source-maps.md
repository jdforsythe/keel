---
"@keel/server": patch
---

Production `createApp({ assets })` neither reads nor serves a `*.map` file under `assets/`, at any depth, whatever built the folder; a request for one is 404 like any path the build does not hold.
