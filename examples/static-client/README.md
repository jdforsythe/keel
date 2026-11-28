# static-client

A client-only app: `topology.ts` has one deployable, `web`, with `adapter: "client"`, and no server. `keel build` writes `dist/web/`: `index.html` (written by Keel), hashed `assets/` and `csp.txt`, the policy your host sends as the `Content-Security-Policy` header. Any static file server can host the folder; the loader in `modules/app/loadHome.server.ts` runs in the browser.

`test/home.test.ts` renders the page. Run `keel check`, `keel test` and `keel build`, then serve `dist/web` with a static file server and open `/`.
