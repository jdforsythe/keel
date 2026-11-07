# golden-1

The todo app. `topology.ts` defines two deployables:

- `web` (`client`): the browser app, built to `dist/`.
- `api` (`node`): `server.ts`, on port 4181 (`KEEL_API_PORT` overrides).

## Dev
Run these from `apps/golden-1`:
- `pnpm api` starts the `api` server. Add `NODE_ENV=development` for dev mode.
- `npx vite` serves `web` and proxies `/api` to the `api` server.

## Production
1. `pnpm --filter ./apps/golden-1 build` runs `keel build`. It writes three things:
   - the `.keel/` artifacts;
   - `dist/`, the `web` client;
   - `dist/api/`, the `api` client build: the resume entry and its islands, hashed `assets/`, and `.vite/manifest.json` (k.server Build, RFC 0048).

   The `api` build runs after the `web` one, because building `web` empties `dist/`.
2. `NODE_ENV=production node --experimental-webstorage --localstorage-file=apps/golden-1/.api.storage apps/golden-1/server.ts` starts the `api` server.
   - It loads the client manifest once, at startup. If `dist/api` is missing, startup fails with E1555, so run step 1 first.
   - It serves `/assets/*` with `cache-control: public, max-age=31536000, immutable`.
3. `npx vite preview --port 4180` (in `apps/golden-1`) serves `dist/` and proxies `/api` to 4181.
