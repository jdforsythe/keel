# client-only-api

A front end with no server of its own. `topology.ts` has one deployable, `web`, with `adapter: "client"`: no `node` deployable, no `identity.ts`, no sign-in. The home page is fixed copy. The releases page reads the five latest Node.js releases from GitHub's public API, from the reader's browser, and shows a loading line, the list, a line for no releases, or an alert when GitHub fails.

GitHub's origin is declared once, under `origins.connect` in `topology.ts`, with its reason. With it, `keel check` accepts the literal `base` in `modules/app/githubApi.ts` (without it, E1571), and the policy the build writes reads `connect-src 'self' https://api.github.com`. The browser refuses a request to any other origin.

The client in `githubApi.ts` sends `x-keel: 1` with each call, so the browser asks GitHub with a CORS preflight first. An API whose preflight does not allow that header refuses the call, and the page shows its alert.

## Hosting

`keel build` writes `dist/web/`: `index.html`, hashed `assets/`, `keel-mark.svg` and `csp.txt`. There is no `server.mjs`. Put the folder on any static host and set it to:

- send the line in `csp.txt` as the `Content-Security-Policy` header;
- answer `/index.html` with 200 for a path that is no file, so a reload of `/releases` works;
- cache `assets/*` as immutable and the rest as `no-cache`.

The pages make no request to a Keel server path such as `/__keel/user`.

## Run it

Run `keel check`, `keel test` and `keel build`, then serve `dist/web` with a static file server and open `/`.

`test/clientOnly.test.ts` answers GitHub through `ctx.net` routes and records every request the pages make: one call to GitHub per visit to the releases page, and nothing else.
