# golden-2

The recipe box, in `en-US`, `de-DE` and `ja-JP`. `topology.ts` defines two deployables:

- `web` (`client`, `servedBy: 'api'`): the browser app, built to `dist/web/` and copied into `dist/api/`, so `api` serves it.
- `api` (`node`): the `kitchen` module at `/api/recipes`, `/api/catalog/<locale>` and `/api/tally/currency`, and the `accounts` module: its sign-up and sign-in pages, `/api/tokens` and `/api/me`, and the sign-in library at `/api/auth`; and the `health` module of `@keel/std-health` at `/health`.

## Pages
- `/` (`recipes.index`): every recipe, or only favorites.
- `/recipes/<id>` (`recipes.show`): one recipe and its favorite toggle.
- `/recipes/new` (`recipes.new`): the new-recipe form.
- `/catalog` (`recipes.catalog`): a recipe finder (`Combobox`), a currency filter (`Listbox` in a `Disclosure`) and two tabs (`Tabs`). The Recipes tab holds a `DataTable` sorted by title, price, minutes or date, searched by title (`TableSearch`), filtered to favorites, paged five at a time, with a row menu (`Menu`: open, or open in another locale) and row selection; "Add selected to the list" adds the selection to the shopping list and raises a toast. The Shopping list tab holds the list, "Find the nearest market" and "Clear the list", which asks first (`Dialog`). "Find the nearest market" reads the device's position through the `geo` capability of `@keel/std-geo` and names the closest of three markets (`markets.ts`) with its distance in kilometers; when the browser gives no position it says so. The position stays in the page: nothing sends or stores it. The query lives in the URL (`sort`, `dir`, `page`, `q`, `currency`, `favorite`); the `api` deployable applies it (`applyQuery`), so a page holds five rows. The shopping list and the toasts are client stores (`recipes.list`, `recipes.toasts`) that last for the tab; `BoxShell` shows the toasts (`Toaster`).

## Accounts
Keel authenticates no one; this module is an example of plugging an established sign-in library, [Better Auth](https://www.better-auth.com) (`better-auth`, pinned), into the identity seam. Two project files beside `topology.ts` hold the wiring:
- `identity.ts`: `identityMount('/api/auth')`, the path the pages post to.
- `identity.server.ts`: `identify` answers who made a request, the user an `Authorization: Bearer` API token acts for or else the user of the library's session cookie; `handle` mounts the library at `/api/auth`. A JSON call passes through unchanged. A page's form post is sent to the library as JSON and answered with a 303 that carries the library's `set-cookie`: to the sign-in page on success, back to the posting page with `?error=credentials` or `?error=invalid` on a refusal. What was typed never goes into a URL.

Handlers read `user`; nothing in the app stores a password or a session.
- `/account/signup` (`accounts.signup`): a name, an email and a password, validated in the page, then posted by the browser to `/api/auth/sign-up/email`. A sign-up does not sign in, and an email that already has an account gets the same answer as a new one.
- `/account/signin` (`accounts.signin`): an email and a password posted to `/api/auth/sign-in/email`; signed in, the page names the account and shows a sign-out form (a POST to `/api/auth/sign-out`).
- `POST /api/tokens` (`accounts.tokens`): for a user signed in by cookie, mints a token with `@keel/std-tokens` that lasts 30 days and answers `{ token, id, expiresAt }`, the only time the token text leaves; the `accounts.tokens` store holds its id, digest and user. No user, or a request that presents a token, is 403 `keel.denied`.
- `GET /api/me` (`accounts.me`): the email of the request's `user`, by session cookie or by bearer token; neither, or an unknown, tampered or expired token, is 403 `keel.denied`.

At each sign-in the library accepts, `identity.server.ts` saves the user's id and email in the `accounts.profiles` store, and `/api/me` reads them there. Only `identity.server.ts` imports the library: a loader's imports are bundled into the browser code of the pages that use it, so no loader or page module imports the library.

The pages are served in the three locales, their copy in `modules/accounts/AccountsText/<locale>.ts`.

The library keeps users, password hashes and sessions in its own `node:sqlite` database, outside `ctx.storage`, and creates its tables with its own migration at the first request. Its ids, tokens, timestamps and session expiry come from its own clock and randomness, not the sim ctx; tests use an in-memory database per ctx and assert none of them.

Environment, read on the server only:
- `BETTER_AUTH_SECRET`: 32 or more random characters, signing the session cookie. Required unless `AUTH_FIXTURE` is `test` (the vitest config sets it) or `dev` (`pnpm dev` sets it), which use fixed values; `NODE_ENV` never does. Without it the server prints `accounts.secret` and exits 1 at start.
- `AUTH_DATABASE_PATH` (optional): the database file. Default `auth.sqlite` beside the web storage file (`/data/auth.sqlite` in the image, `apps/golden-2/auth.sqlite` under `pnpm api`); `pnpm dev` uses `.keel-dev/auth.sqlite`.
- `KEEL_ORIGIN`, when set, is also the library's base URL.

## Locales
`modules/recipes/AppLocale.schema.ts` lists the served locales. `en-US` URLs carry no prefix (`/`, `/recipes/<id>`); the others do (`/de-DE`, `/ja-JP/recipes/<id>`), and `/en-US/...` redirects to the unprefixed URL. Every string the recipe pages show is in `modules/recipes/RecipesText/<locale>.ts`, and the account pages' in `modules/accounts/AccountsText/<locale>.ts`. To add a locale, add it to `AppLocale` and `AccountsLocale` and write one file in each.

## Dev
Run `pnpm dev` from `apps/golden-2`. `keel dev` serves `web` with hot reload and the `api` deployable on one origin; storage lives in `.keel-dev/`. `GET /__keel/inspect` (and `keel inspect`) shows the `api` deployable's inspector sections. Its `timings.recent`, from `@keel/std-timings`, holds `kitchen.catalog.query`, the catalog query. The recipes pages time how long they waited for each `kitchen` call (`recipes.api.catalog`, `recipes.api.box`) in the page's own `timings.recent`, which the `api` deployable's section of the same id replaces in this document.

The `kitchen` module counts the box's recipes by price currency each time `/api/recipes`, `/api/catalog/<locale>` or `/api/tally/currency` reads the box (`currencyTally`, `tallyOf` of `@keel/std-report`) and serves the tally as the inspector section `kitchen.box.currency` of the `api` deployable's dev app. `keel report <url>` against `keel dev` prints it as `kitchen.box.currency EUR=2 JPY=1`, then `ok report 1 tallies`.

`GET /api/tally/currency` (`kitchen.tally.currency`) answers the same tally from a build as well: a loader with `output: Tally`, so the body is the loader's answer holding it. Like the kitchen's other reads it has no guard and anyone may call it; the tally holds currency codes and counts, nothing of a recipe or a person. `keel report http://localhost:8080/api/tally/currency` against `pnpm api` prints `kitchen.box.currency EUR=2 JPY=1`, then `ok report 1 tallies`.

Each module lists `@keel/std-brands` in `deps`, so `keel check` holds every id brand (`s.id('Recipe')`, `ctx.random.id('Recipe')`) to PascalCase (E2101, with a fix).

## Production
1. `pnpm --filter ./apps/golden-2 build` runs `keel build`. It writes:
   - the `.keel/` artifacts, `surface.json` among them;
   - `dist/web/`, the `web` client as static files;
   - `dist/api/`: `server.mjs`, the generated entry with every dependency bundled, beside a copy of the `web` client, `routes.json` and `std.json`;
   - `deploy/api/Dockerfile` and `deploy/compose.yaml`, from `topology.ts`.
2. `pnpm api` runs `dist/api/server.mjs`, with `ctx.storage` in `.api.storage`. It serves the whole app: `GET /` returns the client's `index.html`. It reads `KEEL_SECRET` (32 or more random bytes, required), `PORT` (default 8080) and `KEEL_ORIGIN` (the public origin) from the environment, and exits with E1560 when one is missing or invalid; it also needs `BETTER_AUTH_SECRET` (Accounts).
3. `GET /health` (`health.status`) answers 200 while the server runs: a page that says `ok`, or, asked for `application/json`, `{ status: 'ok', at }` with the server clock's time. It reads no storage. Point a container or load balancer probe at it.
4. On SIGTERM or SIGINT the server stops listening and exits 0.

`docker compose -f deploy/compose.yaml up` builds and runs the same entry in `node:22-slim`, with storage and `auth.sqlite` on the `api-data` volume. The generated compose file lists Keel's variables only: give `BETTER_AUTH_SECRET` to the `api` service in an override file.
