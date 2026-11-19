# golden-2

The recipe box, in `en-US`, `de-DE` and `ja-JP`. `topology.ts` defines two deployables:

- `web` (`client`, `host: 'api'`): the browser app, built to `dist/web/` and copied into `dist/api/`, so `api` serves it.
- `api` (`node`): the `kitchen` module at `/api/recipes` and `/api/catalog/<locale>`, and the `accounts` module: its sign-up and sign-in pages, `/api/tokens` and `/api/me`, and the sign-in library at `/api/auth`.

## Pages
- `/` (`recipes.index`): every recipe, or only favorites.
- `/recipes/<id>` (`recipes.show`): one recipe and its favorite toggle.
- `/recipes/new` (`recipes.new`): the new-recipe form.
- `/catalog` (`recipes.catalog`): a recipe finder (`Combobox`), a currency filter (`Listbox` in a `Disclosure`) and two tabs (`Tabs`). The Recipes tab holds a `DataTable` sorted by title, price, minutes or date, searched by title (`TableSearch`), filtered to favorites, paged five at a time, with a row menu (`Menu`: open, or open in another locale) and row selection; "Add selected to the list" adds the selection to the shopping list and raises a toast. The Shopping list tab holds the list and "Clear the list", which asks first (`Dialog`). The query lives in the URL (`sort`, `dir`, `page`, `q`, `currency`, `favorite`); the `api` deployable applies it (`applyQuery`), so a page holds five rows. The shopping list and the toasts are client stores (`recipes.list`, `recipes.toasts`) that last for the tab; `BoxShell` shows the toasts (`Toaster`).

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
- `BETTER_AUTH_SECRET`: 32 or more random characters, signing the session cookie. Required outside tests and `keel dev`: without it the server prints `accounts.secret` and exits 1 at start. Tests and `keel dev` use fixed values.
- `AUTH_DATABASE_PATH` (optional): the database file. Default `auth.sqlite` beside the web storage file (`/data/auth.sqlite` in the image, `apps/golden-2/auth.sqlite` under `pnpm api`); `keel dev` uses `.keel-dev/auth.sqlite`.
- `KEEL_ORIGIN`, when set, is also the library's base URL.

## Locales
`modules/recipes/AppLocale.schema.ts` lists the served locales. `en-US` URLs carry no prefix (`/`, `/recipes/<id>`); the others do (`/de-DE`, `/ja-JP/recipes/<id>`), and `/en-US/...` redirects to the unprefixed URL. Every string the recipe pages show is in `modules/recipes/RecipesText/<locale>.ts`, and the account pages' in `modules/accounts/AccountsText/<locale>.ts`. To add a locale, add it to `AppLocale` and `AccountsLocale` and write one file in each.

## Dev
Run `pnpm dev` from `apps/golden-2`. `keel dev` serves `web` with hot reload and the `api` deployable on one origin; storage lives in `.keel-dev/`.

## Production
1. `pnpm --filter ./apps/golden-2 build` runs `keel build`. It writes:
   - the `.keel/` artifacts, `surface.json` among them;
   - `dist/web/`, the `web` client as static files;
   - `dist/api/`: `server.mjs`, the generated entry with every dependency bundled, beside a copy of the `web` client, `routes.json` and `std.json`;
   - `deploy/api/Dockerfile` and `deploy/compose.yaml`, from `topology.ts`.
2. `pnpm api` runs `dist/api/server.mjs`, with `ctx.storage` in `.api.storage`. It serves the whole app: `GET /` returns the client's `index.html`. It reads `KEEL_SECRET` (32 or more random bytes, required), `PORT` (default 8080) and `KEEL_ORIGIN` (the public origin) from the environment, and exits with E1560 when one is missing or invalid; it also needs `BETTER_AUTH_SECRET` (Accounts).
3. On SIGTERM or SIGINT the server stops listening and exits 0.

`docker compose -f deploy/compose.yaml up` builds and runs the same entry in `node:22-slim`, with storage and `auth.sqlite` on the `api-data` volume. The generated compose file lists Keel's variables only: give `BETTER_AUTH_SECRET` to the `api` service in an override file.
