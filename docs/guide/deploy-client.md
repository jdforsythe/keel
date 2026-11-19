# Deploy a client

A `client` deployable builds to plain files. This guide shows three ways to ship them, from the least to the most to set up. The examples use `apps/golden-1`: `web` is the `client` deployable and `api` is the `node` deployable that owns the data.

`keel build` writes `dist/web/`: `index.html`, `assets/` (every file named with a content hash) and `keel-mark.svg`. Every URL in it is root-absolute or absolute, so the files belong at the root of an origin. Nothing in them names a server.

`keel build` runs `keel check` first and stops on an error. No environment value is written into these files except the `KEEL_PEER_<NAME>` origins below; `import.meta.env` holds only Vite's `MODE`, `DEV`, `PROD`, `SSR` and `BASE_URL`, so configuration the browser reads comes through a module's `clientStd`. The `node` modules' server-only files (`*.server.*`, `*.guard.*`) are never in them: a browser build that would hold one fails with E1007.

## 1. The node host

Name the `node` deployable that serves the client:

```ts title="topology.ts"
export default topology({
  web: { modules: ["todos"], adapter: "client", host: "api" },
  api: { modules: ["api", "digest"], adapter: "node" },
});
```

`keel build` copies the client into `dist/api/` as well. `dist/api/server.mjs` then answers `GET /` and any other page request that matches none of its routes with `index.html` (200, `no-cache`), serves `assets/*` as `immutable`, and keeps an unmatched API or event-stream request a 404.

```sh
pnpm --filter ./apps/golden-1 build
KEEL_SECRET=<32+ random bytes> PORT=4181 pnpm --filter ./apps/golden-1 api
```

One process, one origin, one Dockerfile (`deploy/api/Dockerfile` copies `dist/api/`). The page and the API share an origin, so there is no allowed origin to configure and the caller cookie works. Use this unless you want the client on a CDN. `dist/web/` is still written, so moving to a static host later is a deploy change and a one-line edit of `topology.ts`.

## 2. A static host and a node API on one site

Put `dist/web/` on a static host at `https://app.example.com` and run `api` at `https://api.example.com`. Three settings connect them.

1. At build time, tell the client where `api` is. `KEEL_PEER_API` is the key a `node` deployable already reads; for a client it becomes a tag in `index.html`:

   ```sh
   KEEL_PEER_API=https://api.example.com pnpm --filter ./apps/golden-1 build
   ```

   ```html
   <meta name="keel-peer" data-deployable="api" content="https://api.example.com">
   ```

   `service({ module: "api" })` in the browser then calls that origin and sends `credentials: 'include'`. With no `KEEL_PEER_API` at build it calls the page's own origin. The tag is the one unhashed file, so a deploy step can rewrite its `content` and one build serves several environments. A value that is not an http(s) origin fails the build with E1565, naming the key and no value.

2. On the server, allow the client's origin:

   ```sh
   KEEL_ALLOW_ORIGINS=https://app.example.com
   ```

   It takes a comma-separated list of origins, matched exactly (`*` and a value with a path are E1560). A listed origin may call API routes (`api: true`) with credentials and send writes; it gets nothing on pages or assets, and a preflight runs no guard, loader or action.

3. Share the registrable domain. `app.example.com` and `api.example.com` are same-site, so the browser sends and stores the caller cookie (`HttpOnly; SameSite=Lax`) on the API requests, and `caller`-scoped features such as undo work.

Set `KEEL_ORIGIN=https://api.example.com` on `api` as well, as for any deployment.

### A cross-site split loses the caller

If the client sits on a domain that is not same-site with the API (a bucket's own hostname and `api.example.com`), browsers neither send nor store the cookie. `caller` is empty on reads and new on every write, and undo does not work. The server logs W1567 once per origin when it sees a request from an allowed origin with `Sec-Fetch-Site: cross-site`. Two fixes:

- put both on one registrable domain, as in this section;
- serve both from one origin, through the node host (section 1) or a CDN rule that sends `/api/*` to `api`.

## 3. One static host, end to end

Any static host works if it does three things:

- returns the files of `dist/web/` at the origin's root;
- returns `/index.html` with status 200 for a path that is no file, because the router matches paths in the browser;
- caches `assets/*` as immutable and everything else as `no-cache`.

Keel generates no file for a host; these three lines are the whole contract. As an example, nginx on a machine you control, with the API on the same site as in section 2:

```nginx title="/etc/nginx/conf.d/app.conf"
server {
  listen 80;
  server_name app.example.com;
  root /srv/app;

  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  location / {
    add_header Cache-Control "no-cache";
    try_files $uri /index.html;
  }
}
```

1. Build with the peer tag: `KEEL_PEER_API=https://api.example.com pnpm --filter ./apps/golden-1 build`.
2. Copy the folder: `rsync -a --delete apps/golden-1/dist/web/ app.example.com:/srv/app/`.
3. Start `api` with `KEEL_SECRET`, `KEEL_ORIGIN=https://api.example.com` and `KEEL_ALLOW_ORIGINS=https://app.example.com`.
4. Check the three duties: `curl -sI https://app.example.com/` and `curl -sI https://app.example.com/lists/x` both answer `200` with `cache-control: no-cache`; a file under `/assets/` answers `cache-control: public, max-age=31536000, immutable`.

TLS comes from your host or a proxy in front of it. This nginx file is a sketch of the contract, not something `keel build` checks, and it was not run for this guide. Other hosts express the same three rules in their own settings.

## Limits

- A client served under a path prefix (`https://example.com/app/`) is not supported: URLs are root-absolute and there is no `base` option.
- One `client` deployable per host.
- A CDN in front of a `node` deployable as a cache has not been tried.
- `keel dev` runs one process on one origin, so none of this applies to it.
- `host` names a `node` deployable; naming a `client` deployable, an unknown name, or one host for two clients is E1566.
