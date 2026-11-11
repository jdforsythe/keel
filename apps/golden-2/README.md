# golden-2

The recipe box, in `en-US`, `de-DE` and `ja-JP`. `topology.ts` defines two deployables:

- `web` (`client`): the browser app, built to `dist/`.
- `api` (`node`): the `kitchen` module at `/api/recipes`.

## Locales
`modules/recipes/AppLocale.schema.ts` lists the served locales. `en-US` URLs carry no prefix (`/`, `/recipes/<id>`); the others do (`/de-DE`, `/ja-JP/recipes/<id>`), and `/en-US/...` redirects to the unprefixed URL. Every string the pages show is in `modules/recipes/RecipesText/<locale>.ts`. To add a locale, add it to `AppLocale` and write one file there.

## Dev
Run `pnpm dev` from `apps/golden-2`. `keel dev` serves `web` with hot reload and the `api` deployable on one origin; storage lives in `.keel-dev/`.

## Production
1. `pnpm --filter ./apps/golden-2 build` runs `keel build`. It writes:
   - the `.keel/` artifacts, `surface.json` among them;
   - `dist/`, the `web` client;
   - `dist/api/`: `server.mjs`, the generated entry with every dependency bundled, beside the `api` client build, `routes.json` and `std.json`;
   - `deploy/api/Dockerfile` and `deploy/compose.yaml`, from `topology.ts`.
2. `pnpm api` runs `dist/api/server.mjs`, with `ctx.storage` in `.api.storage`. It reads `KEEL_SECRET` (32 or more random bytes, required), `PORT` (default 8080) and `KEEL_ORIGIN` (the public origin) from the environment, and exits with E1560 when one is missing or invalid.
3. On SIGTERM or SIGINT the server stops listening and exits 0.

`docker compose -f deploy/compose.yaml up` builds and runs the same entry in `node:22-slim`, with storage on the `api-data` volume.
