# golden-2

The recipe box, in `en-US`, `de-DE` and `ja-JP`. `topology.ts` defines two deployables:

- `web` (`client`, `host: 'api'`): the browser app, built to `dist/web/` and copied into `dist/api/`, so `api` serves it.
- `api` (`node`): the `kitchen` module at `/api/recipes` and `/api/catalog/<locale>`.

## Pages
- `/` (`recipes.index`): every recipe, or only favorites.
- `/recipes/<id>` (`recipes.show`): one recipe and its favorite toggle.
- `/recipes/new` (`recipes.new`): the new-recipe form.
- `/catalog` (`recipes.catalog`): a recipe finder (`Combobox`), a currency filter (`Listbox` in a `Disclosure`) and two tabs (`Tabs`). The Recipes tab holds a `DataTable` sorted by title, price, minutes or date, searched by title (`TableSearch`), filtered to favorites, paged five at a time, with a row menu (`Menu`: open, or open in another locale) and row selection; "Add selected to the list" adds the selection to the shopping list and raises a toast. The Shopping list tab holds the list and "Clear the list", which asks first (`Dialog`). The query lives in the URL (`sort`, `dir`, `page`, `q`, `currency`, `favorite`); the `api` deployable applies it (`applyQuery`), so a page holds five rows. The shopping list and the toasts are client stores (`recipes.list`, `recipes.toasts`) that last for the tab; `BoxShell` shows the toasts (`Toaster`).

## Locales
`modules/recipes/AppLocale.schema.ts` lists the served locales. `en-US` URLs carry no prefix (`/`, `/recipes/<id>`); the others do (`/de-DE`, `/ja-JP/recipes/<id>`), and `/en-US/...` redirects to the unprefixed URL. Every string the pages show is in `modules/recipes/RecipesText/<locale>.ts`. To add a locale, add it to `AppLocale` and write one file there.

## Dev
Run `pnpm dev` from `apps/golden-2`. `keel dev` serves `web` with hot reload and the `api` deployable on one origin; storage lives in `.keel-dev/`.

## Production
1. `pnpm --filter ./apps/golden-2 build` runs `keel build`. It writes:
   - the `.keel/` artifacts, `surface.json` among them;
   - `dist/web/`, the `web` client as static files;
   - `dist/api/`: `server.mjs`, the generated entry with every dependency bundled, beside a copy of the `web` client, `routes.json` and `std.json`;
   - `deploy/api/Dockerfile` and `deploy/compose.yaml`, from `topology.ts`.
2. `pnpm api` runs `dist/api/server.mjs`, with `ctx.storage` in `.api.storage`. It serves the whole app: `GET /` returns the client's `index.html`. It reads `KEEL_SECRET` (32 or more random bytes, required), `PORT` (default 8080) and `KEEL_ORIGIN` (the public origin) from the environment, and exits with E1560 when one is missing or invalid.
3. On SIGTERM or SIGINT the server stops listening and exits 0.

`docker compose -f deploy/compose.yaml up` builds and runs the same entry in `node:22-slim`, with storage on the `api-data` volume.
