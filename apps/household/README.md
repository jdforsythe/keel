# Household

A shared shopping list and receipts book for one home, built with Keel one layer at a time. Each layer is a range of commits with its own tests; check out the last commit of a layer to see the app at that point.

Run every command from `apps/household`.

| command | does |
|-|-|
| `pnpm dev` | `keel dev` on port 5173, with the sign-in library's dev secret |
| `pnpm test` | the app's tests under a simulated ctx |
| `pnpm check` | `tsc`, Biome and `keel check` |
| `pnpm build` | `keel build` into `dist/web/server.mjs` |
| `PORT=5211 KEEL_SECRET=<32+ bytes> BETTER_AUTH_SECRET=<32+ characters> KEEL_POSTGRES_URL=pglite:data/postgres node --experimental-webstorage --localstorage-file=data/storage dist/web/server.mjs` | the built app, its data in `data/` |

## Layer 1: scaffold, dev server, docs

`keel scaffold project household --workspace --adapter node` writes the project: one `node` deployable named `web` that renders pages on the server, `tokens.ts` on `brandTokens`, and an empty `app` module. `keel scaffold route app.start --path /` adds the start page, its loader and a route test.

- `modules/app/StartPage.tsx` renders a heading, one line of text from its loader's data, and a link to each page.
- `modules/app/loadStart.server.ts` returns that data, shaped by `StartData.schema.ts`.
- `routes.ts` binds the page, the loader and a `title`, so the served document is titled "Household".
- `test/start.test.ts` renders the route with `renderRoute` and reads the heading by id.

`keel docs` prints the map of every spec section; `keel docs k.head` prints one, and `keel explain <code>` explains a diagnostic.

Check your work: `pnpm test && pnpm check && pnpm build`.

## Layer 2: schema, store, component, widgets

The `shopping` module holds the list. `keel scaffold module shopping`, `keel scaffold store shopping.items`, `keel scaffold transaction shopping.items.add`, `keel scaffold route shopping.list --path /list` and `keel scaffold component shopping/ShoppingList` write the files; the code fills them in.

- `Item.schema.ts` and `ItemsState.schema.ts` describe one item and the list. `items.store.ts` holds the store and three invariants: at most 50 items, unique ids, and one open item per name.
- `add`, `toggle`, `remove` and `show` are the only writes. Adding a name already on the list raises its quantity; putting a bought item back merges it into the open one.
- `ShoppingList.tsx` uses four widgets from `@keel/std-headless`: a `Menu` of staples, `Tabs` for To buy and Bought, a `Disclosure` for help, and a `Toaster` that shows an alert when a write is refused. It takes `ctx` for `ctx.random.id("Item")`, so the module lists the `random` capability.
- The start page links to the list with `shopping.href("shopping.list")`; the `app` module lists `shopping` in `deps`.

Tests: `test/items.test.ts` runs `properties` on each transaction and a bounded `explore`; `test/shoppingList.test.ts` renders the route, opens the menu, adds a staple twice, moves it between tabs and checks the focus order. `tooling/smoke/household.mjs` serves the built app and drives it in Chromium and over HTTP.

The list lives in the browser in this layer: a reload empties it. Layer 4 moves it to the server.

Check your work: `pnpm test && pnpm check && pnpm build`, then, from the repository root, `node --disable-warning=ExperimentalWarning tooling/smoke/household.mjs`; it starts the build itself on a free port.

## Layer 3: forms, text, money, messages

The `receipts` module is a book of what each person paid. `keel scaffold module receipts` and `keel scaffold route receipts.book --path /:locale/receipts` write the start; the module lists `@keel/std-i18n`, `@keel/std-messages`, `@keel/std-money` and `@keel/std-text` in `deps`, so `keel check` runs their rules on it.

- `AppLocale.schema.ts` serves `en-US` and `de-DE`, with `en-US` as the `pathDefault`: `/receipts` is English and `/de-DE/receipts` German. Another locale is a 404.
- `ReceiptsText.schema.ts` declares the message set; `ReceiptsText/en-US.ts` and `ReceiptsText/de-DE.ts` give every key a message, with a `plural` for the count and a `select` for who paid. The loader returns the served locale's entry.
- `NewReceipt.schema.ts` is the form: `shop` is a `line` of up to 60 characters, `note` a `para`, `currency` the `std.money` `Currency`. `BookPage.tsx` binds each field with `form` and posts to the page's own action.
- `recordReceipt.server.ts` reads the amount into minor units (`minorUnits.ts`), answers `keel.fields` for an amount it cannot read, and records the receipt in a server store (`bookStores.ts`) restored from `ctx.storage` on each request.
- Totals print with `formatMoney` and the route's locale: `€12.50` in English, `12,50 €` in German.

Tests: `test/receipts.test.ts` renders both locales, submits a bad and a good receipt, reads the same book in German, and runs `properties` over the page; `test/minorUnits.test.ts` covers the amount reader.

A server store needs storage. Start the build with `node --experimental-webstorage --localstorage-file=<path> dist/web/server.mjs`, as `deploy/web/Dockerfile` does.

## Layer 4: routes, a guard, a server API, services

The list moves to the server, and both pages wait until the household has a name.

- `shopping.contract.ts` gains four API entries beside the page: `GET /api/items`, `POST /api/items`, `POST /api/items/:id/toggle` and `DELETE /api/items/:id`. `routes.ts` binds each to a loader or an action in its own `*.server.ts` file; each runs over `savedStores.ts`, a server store with the list's three invariants, and answers the whole list.
- `addTo.ts` and `toggleIn.ts` hold the list rules once, for the server transactions and their tests.
- `shoppingApi.ts` is `service({ contract: shopping })`. `ShoppingList.tsx` calls it from the menu and the row buttons and shows the list each call answers; the page's loader reads the same store, so a reload keeps the list. The client store keeps only the tab on show.
- The `setup` module holds the household's name: a page at `/setup` with a form, a `GET /api/household` entry, and `setUp.guard.ts`. The guard asks the household API through `setupApi` and redirects to `/setup?next=<path>` until the name is set. The list and the receipts book bind it.

Tests: `test/serve.ts` serves the whole `web` deployable over a sim ctx with `createApp`, so a page under `renderRoute` and the API it calls share one storage. `test/guard.test.ts` checks the redirect, the setup form and the household API; `test/shoppingList.test.ts` drives the list through the API; `test/items.test.ts` and `test/view.test.ts` run `properties` and `explore` on the transactions.

Over HTTP, with the build running on port 5211:

```sh
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' localhost:5211/list      # 302 to /setup?next=%2Flist
curl -s -H 'Sec-Fetch-Site: same-origin' --data-urlencode name='Elm Street' localhost:5211/setup
curl -s -H 'accept: application/json' -H 'x-keel: 1' -H 'content-type: application/json' -d '{"name":"Bread"}' localhost:5211/api/items
curl -s localhost:5211/api/items
```

## Layer 5: Postgres app data and a restart

The list and the receipts are records that grow as the household uses the app, so they are app data (`keel docs k.data`) and live in Postgres through `@keel/std-postgres`. The household's name is one setting, so it stays a server store.

- `shoppingDb.server.ts` is `database("shopping.db")` and `receiptsDb.server.ts` is `database("receipts.db")`. Each module lists `@keel/std-postgres` in `deps` and its database in `capabilities`.
- `modules/shopping/migrations/0001-items.sql` makes the `items` table, with a unique index on the names still to buy; `modules/receipts/migrations/0001-receipts.sql` makes `receipts`. They run at the first query, in order, once.
- `listOf.server.ts` reads the list. `changeList.server.ts` reads it, applies one rule from `addTo.ts` or `toggleIn.ts` (or a removal) and writes the rows that changed, in one serializable transaction, so two members changing the list at once both apply. The API actions and the page loader call these two.
- `bookOf.server.ts` reads the book newest first; `recordReceipt.server.ts` counts and inserts in one transaction and refuses a 201st receipt with `keel.fields`.
- `keel build` copies each module's `migrations/` into `dist/web/modules/`, and `server.mjs` reads them from there. `KEEL_POSTGRES_URL` picks the database: `pglite:<folder>` for PGlite on disk, `postgres://...` for a server. `keel dev` keeps PGlite in `.keel-dev/postgres`.

Tests: `test/setup.ts` awaits `ready()`, so every sim ctx gets its own migrated, empty databases in memory. `test/items.test.ts` drives the list API: quantities, the merge of a bought item put back, the 50-item limit, and 80 seeded changes that keep the list's three rules. The smoke kills the built server with SIGKILL while a write is in flight, starts it again over the same folder, and finds the list, the receipts and the name; with docker running it does the same on a throwaway `postgres:17`.

Try it: start the built app with the command in the table, open `localhost:5211/list`, name the household and add Milk. Stop the server with `kill -9 <pid>` and start it again: Milk is still on the list, kept in `data/postgres`.

## Layer 6: sign-in, personal data, API tokens

Keel signs no one in. The app mounts a sign-in library, Better Auth, through the identity seam (`keel docs k.user`, `k.mount`), and the `members` module holds the pages and the data around it.

- `identity.ts` is `identityMount("/api/auth")`. `identity.server.ts` is `identity({ identify, handle })`: `handle` hands the library's endpoints every request under `/api/auth`, turning a page's form post into the JSON the library takes and answering with a 303 and the library's cookie; `identify` answers the member of an API token when the request carries `authorization`, else the member of the session cookie, else `''`.
- `authOf.server.ts` opens the library over its own `auth.sqlite`, beside the web storage file; `authSettings.server.ts` reads `BETTER_AUTH_SECRET`, and a server without one prints `members.secret` and exits. Accounts, password hashes and sessions live only there.
- `/signup` and `/signin` post natively to the mount (`SignupPage.tsx`, `SigninPage.tsx`); the passwords are `s.secret` (`Registration.schema.ts`, `Credentials.schema.ts`), and a refusal comes back as `?error=credentials`, never with a typed value in the URL.
- `signedIn.guard.ts` sends the list, the receipts book, the setup page and the profile to `/signin?next=<path>` until someone signs in; a sign-in goes on to `next` when it is a path on this origin. `member.guard.ts` answers 403 to an API request no member made.
- The first sign-in writes the member's row in Postgres (`migrations/0001-members.sql`). `/profile` (`ProfilePage.tsx`) edits the name and phone, marked `.pii("name")` and `.pii("contact")` in `Profile.schema.ts`, with `autocomplete` on each control. Keel keeps them out of log lines and error text; the database stores them as written. No client store holds personal data, so the modules list no `clientPii`.
- `TokenPanel.tsx` mints an API token through `POST /api/tokens` and shows it once: `postToken.server.ts` mints it with `tokens(ctx).mint({ ttl })`, keeps its id, digest and expiry in `api_tokens` and answers `reveal(token)`. `bearerUser.server.ts` finds the row with `tokens(ctx).idOf` and verifies it with `check`, which refuses an expired token. Revoking deletes the row.

Tests: `test/serve.ts` serves the app with its identity source and signs a member up and in. `test/signin.test.ts` covers the cookie, `next`, a wrong password, sign-out and a cross-site post; `test/tokens.test.ts` mints, calls, revokes, expires, tampers with and chains tokens; `test/profile.test.ts` saves the profile, runs `properties` on the page, and checks that typed personal data reaches no log line. The smoke signs up and in in Chromium, mints a token, calls the API with it, revokes it and is refused, and types distinctive values into the profile, then searches the server's log and every file in its data folder but the database for them.

Try it: with the built app running, make an account at `localhost:5211/signup` and sign in. On `/profile`, select Make a token and copy it, then run `curl -s -H "authorization: Bearer <token>" localhost:5211/api/items`. Select Revoke and run the same `curl`: it answers 403.

## Layer 7: the frame and the brand

Every page renders in a frame layout that puts the Keel brand (`docs/BRAND.md`) on it. `tokens.ts` is `brandTokens`; `topology.ts` lists `@keel/ui/fonts` in `styles`, so the served stylesheet carries Source Serif 4 and JetBrains Mono.

- `app.frame` (`app/AppFrame.tsx`) is the one frame around every signed-in page of every module. `app` lists `members`, `receipts`, `setup` and `shopping` in `deps`, so its masthead makes a link from each module's contract: List, Receipts, Setup and Profile, then a Sign out button; a visitor on the start page gets Sign in and Make an account instead. The list, the receipts book, the setup form and the profile each name `layout: 'app.frame'` in their binding and list no `app` in `deps` (k.routes Layouts). Its loader (`app/loadFrame.server.ts`) answers the copy (`members/shellText.ts`), the household's name and whether a member is signed in.
- `members.frame` (`members/VisitorFrame.tsx`) frames the sign-in and sign-up pages: the masthead with Sign in and Make an account, no member navigation and no household name.
- Both render `members/Masthead.tsx`: the mark, the app's name and the household's name, the navigation the frame passes, a hairline, and the page in a centred column that narrows to the screen on a phone.
- Pages set their type scale and spacing with style props: headings `xl` on a phone and `2xl` from `md`, secondary copy in `textSecondary`, numbers and controls in `mono`. Forms sit in a white card with a hairline border; text controls have a `control` border that darkens on hover and focus; a refusal shows in an Error Crimson box and a saved profile in a Verified Green one.
- The list and the receipts book are rows on white, divided by hairlines; the list's rows stack their buttons under the name on a phone. An empty list, an empty book and no tokens each show a bordered note. The `Menu`, `Tabs`, `Toaster` and `Disclosure` take their parts' styles through `styles`.

Tests: `test/start.test.ts`, `test/shoppingList.test.ts`, `test/receipts.test.ts` and `test/profile.test.ts` read the frame's links first in the focus order; a page in `app.frame` renders over the joined `webRoutes` (`test/serve.ts`). The smoke checks that the frame's computed font is Source Serif 4 and that the font loads.

Check your work: `pnpm test && pnpm check && pnpm build`, then the smoke from the repository root.
