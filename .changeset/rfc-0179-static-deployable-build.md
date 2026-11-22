---
"@keel/cli": minor
"@keel/compiler": minor
"@keel/server": minor
---

`keel build` writes `dist/<name>/` for each `static` deployable: every route's document as its own `createApp` answers a GET at build (production, memory storage, caller `''`), at `index.html` for `/` and `<path>/index.html` otherwise, plus `404.html`, the islands' resume entry under `assets/`, `keel-mark.svg` and `csp.txt`. A route that answers other than 200 at build fails it with E1588, naming the route id and the status. The build's server bundle (`@keel/server/internal/prerender`) is not shipped, and the documents carry no nonce. `keel dev` serves a `static` deployable's paths through its dev `createApp`, as it does a `node` one's.
