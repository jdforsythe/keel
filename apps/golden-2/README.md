# golden-2

The recipe box. `topology.ts` defines two deployables:

- `web` (`client`): the browser app, built to `dist/`.
- `api` (`node`): `server.ts`, on port 4191 (`KEEL_API_PORT` overrides). It serves the `kitchen` module at `/api/recipes`.

## Dev
Run these from `apps/golden-2`:
- `pnpm api` starts the `api` server. Add `NODE_ENV=development` for dev mode.
- `npx vite` serves `web` and proxies `/api` to the `api` server.

## Production
1. `pnpm --filter ./apps/golden-2 build` runs `keel build`. It writes three things:
   - the `.keel/` artifacts;
   - `dist/`, the `web` client;
   - `dist/api/`, the `api` client build (k.server Build, RFC 0048).
2. `NODE_ENV=production node --experimental-webstorage --localstorage-file=apps/golden-2/.api.storage apps/golden-2/server.ts` starts the `api` server.
   - It loads the client manifest once, at startup. If `dist/api` is missing, startup fails with E1555, so run step 1 first.
   - It serves `/assets/*` with `cache-control: public, max-age=31536000, immutable`.
3. `npx vite preview --port 4190` (in `apps/golden-2`) serves `dist/` and proxies `/api` to 4191.
