---
"@keel/cli": minor
"@keel/compiler": minor
"@keel/server": minor
"@keel/check": patch
---

k.cli Inspect (RFC 0017): a running dev app serves `GET /__keel/inspect` (`{ live, graph, stores, ids, a11y, routes }`). The Vite plugin serves it on dev and preview servers and the generated dev entry posts the live graph and stores; `createApp` serves it in `dev` mode (`artifacts` option names the `.keel` directory). `keel inspect [url]` summarizes it (E1056 when the target is unreachable or not an inspect document; `Io.fetch`). `explain E1056`.
