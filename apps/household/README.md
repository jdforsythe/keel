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
- `recordReceipt.server.ts` reads the amount with `parseMoney` in the route's locale, answers `keel.fields` for an amount it cannot read, and records the receipt in a server store (`bookStores.ts`) restored from `ctx.storage` on each request.
- Totals print with `formatMoney` and the route's locale: `€12.50` in English, `12,50 €` in German.

Tests: `test/receipts.test.ts` renders both locales, submits a bad and a good receipt, reads the same book in German, and runs `properties` over the page; the amount reader is `parseMoney` (`@keel/std-money`).

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
- `signedIn.guard.ts` sends the list, the receipts book, the setup page and the profile to `/signin?next=<path>` until someone signs in; a sign-in goes on to `next` when it is a page of the app (`pageHref`). `member.guard.ts` answers 403 to an API request no member made.
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

## Layer 8: live updates with two members

Two members of one household with the list open see each other's changes without a reload (`keel docs std.channels`, `std.live`).

- `listChannel.schema.ts` declares the channel `shopping.live` at `/api/items/events` with no params and no `message`, so nothing is published from a browser. `shopping.contract.ts` writes its stream entry out, `shopping.events`, an `events: true` GET whose `output` is the channel's `events`.
- The list is app data in Postgres, and its one write transaction names the channel it changes. `changeList.server.ts`, which the add, toggle and remove actions share, ends with `await t.changed(listChannel, {})`: std-postgres sends it with `pg_notify` inside the transaction, so it is delivered once the transaction commits and never for one that rolls back.
- `listEvents.server.ts` is `channelRoute(shopping, listChannel, { id: 'shopping.events', follows: [shoppingDb], member })`, where `member` is true for a signed-in member. Each committed change reaches every open member stream as `{ kind: 'changed' }`, on every replica that shares the database. A visitor's stream gets `{ kind: 'closed', reason: 'denied' }` and ends.
- `ShoppingList.tsx` calls `live` with the page's origin: after each `changed`, its own changes included, the page re-reads `GET /api/items` with its own cookie and commits the answer to the client store `shopping.copy` through `hydrate`. The server render shows the loader's list until the first read commits.
- The status line above the menu (`shopping.live`, a `role="status"` region) says Live, Connecting, Offline or Signed out. Live is green, Offline red, the other two have an ochre border. Before each change reaches an open stream the server asks who the stream's cookie belongs to now, so after a sign-out in another tab the next change closes the stream `denied`: the page says Signed out and shows nothing new until it is loaded again.
- No personal data rides the channel: `changed` names nothing, neither an item, a member, the database nor a cookie.

Tests: `test/live.test.ts` opens Grace's list with `renderRoute` and `user`, and changes the list as Ada through the API: Grace's page shows the add, the purchase and the removal. Ada's raw stream gets `changed` with no item or name in it when Grace's page adds; a visitor's stream gets only `denied`; a member signed out keeps hearing `changed` and is refused the list. Taking the sim network offline shows Offline, and back online the page catches up. `properties` runs on `hydrate`. `test/replicas.test.ts`, on Postgres 17 only (`KEEL_TEST_POSTGRES_URL`), serves two replicas on one URL: an add on one reaches a stream open on the other. `test/reconnect.sim.test.ts` follows the list under `simulate` with 25 schedules of drops, delays, lost responses, 503s and offline windows, and after each the page's copy is the server's list and the status is Live. The smoke opens the list in two browser contexts: Ada adds Bread and Grace's page shows it with no reload, Grace buys it and Ada's page moves it to Bought, both pages say Connecting while the server is killed and Live once it is back, Grace's browser offline says Offline, and a sign-out in Grace's other tab turns her page to Signed out with no new item.

Try it: start the built app, make two accounts, and sign in as each in two browser windows, one of them private. Open `localhost:5211/list` in both and add a staple in one: the other shows it within a second. Stop the server with `kill -9 <pid>`: both say Connecting. Start it again: both say Live, and a new item reaches both.

Check your work: `pnpm test && pnpm check && pnpm build`, then the smoke from the repository root.

## Layer 9: the weekly staples, in the background

Every Saturday at 08:00 UTC the app puts the household's staples back on the list: Milk, Bread, Eggs, Rice and Apples, one every two seconds, so a member with the list open watches them arrive. The setup page shows the last run and its outcome, and a member may run it now (`keel docs std.workflows`, `std.jobs`, `std.schedules`).

- `restockChart.ts` is the run as a chart: `putting` puts one staple back, `resting` waits, and the last staple ends it in `done`; a staple whose step fails five times ends it in `failed` with the code. Its data (`RestockData.schema.ts`) holds the staples, the next one, how many went back, who started the run and when.
- `restock.server.ts` is `workflow('shopping.restock', ...)`: the step of `putting` is `putBack`, the wait of `resting` lasts 2,000 ms, and a run is kept eight days after it ends. Each staple's step is a job of its own, because the move back to `putting` enters the state again.
- `putBack.server.ts` writes the list in Postgres in one transaction: the staple goes back by the rule in `putBackIn.ts` (a staple still to buy stays as it is, a bought one goes back to buy, a new one joins), and a `restocks` row keyed by the step's `key` (`migrations/0002-restocks.sql`) records what it did. A step that runs again after a crash finds its row and answers what the first run did, so each staple goes back once. The transaction ends with `t.changed(listChannel, {})` (`writeList.server.ts`), so every open list hears each staple arrive.
- `jobs.server.ts` is the queue: the workflow's jobs and `shopping.startRestock`, which starts a run in one `commitStores`. `schedules.server.ts` enqueues it at `0 8 * * 6`; a server that was down at that time starts one run when it is back (`missed: 'once'`). `startRun.ts` starts nothing while a run goes, and the schedule starts one run a day at most, so a start job that runs again after a crash starts no second run. `runners.server.ts` lists the queue, `flows(jobs, [restock])` and the schedule.
- The runs live in the workflow's store in `ctx.storage`, beside the job queue and the schedule's mark: Keel's own state (`keel docs k.persist`). The list they change is app data in Postgres.
- `GET /api/restock` answers the latest run (`runsOf.ts`), `POST /api/restock` is Run now, and `/api/restock/events` is the channel `shopping.runsLive`, whose `channelRoute` watches the workflow's store, so each step's save reaches the page. The setup page's loader asks for the runs through `shoppingApi`, in process, and `RestockPanel.tsx` shows them, re-reads them on each save, and has the Run now button. Its status line (`shopping.restock.live`, a `role="status"` region) says Live, Connecting, Offline or Signed out, as the list's does. The setup module lists `shopping` in `deps`.

Tests: `test/restock.test.ts` runs Run now through the API (one job per staple, two seconds apart, the run ends once), a staple still to buy and a bought one, a visitor's 403, the staples arriving on Grace's open list, and the setup page under `renderRoute` with `app` and `user` from no run to Done. `test/restock.sim.test.ts` stops the server at eleven points of a run and starts another on the same storage and database, and each time the run ends done with each staple back once; under `simulate`, refused commits and delays make steps run again and no staple goes back twice; the schedule fires at Saturday 08:00, and after three Saturdays down it starts one run. `test/restockChart.test.ts` explores the chart from a five-staple run and runs `properties` on its events. `test/serve.ts` passes the module's runners to `createApp`, as the built entry does. The smoke selects Run now on the setup page, kills the server with SIGKILL once a staple is back, starts it again, and finds the run done once and each staple on the list once.

Try it: start the built app, sign in, and open `localhost:5211/list` in one window and `localhost:5211/setup` in another. Select Run now: the staples arrive on the list one by one. Stop the server with `kill -9 <pid>` halfway and start it again: the run goes on from the staple it reached, and the setup page says `Done: 5 of 5 staples handled`.

Check your work: `pnpm test && pnpm check && pnpm build`, then the smoke from the repository root.

## Layer 10: session recordings, tallies and the evidence bundle

Each page a member opens records what happens on it, so a fault a member hits arrives with the steps that led to it (`keel docs std.sessions`, `std.monitor`, `k.evidence`).

- `topology.ts` places the `sessions` module of `@keel/std-sessions` in `web`, so the app serves the ingest itself: `POST /sessions` takes a recording, and `GET /sessions/list` and `GET /sessions/tally` answer a reader. The `app` module lists `@keel/std-sessions` in `deps` and the `observe` and `session` capabilities; its `readers` list in `module.ts` is empty, so both reads answer 403 to every member until an operator adds the hash of their caller cookie.
- `app/RecordingNote.tsx` sits under every page of `app.frame`. In the browser it calls `record(ctx, { upload })` with the page's own `/sessions`: the recorder keeps navigations, clicks, typed values, transactions and errors, and posts the recording on the first error the page reports. A document is one recording; the next page starts its own.
- The note, What this page records, lists the newest 12 events as the recorder kept them (`app/eventLine.ts`) and counts them in a `role="status"` line. It shows the recording and nothing else: a value typed into a field marked `.pii()` reads `x` repeated, because that is what the recording holds. Password fields and `s.secret` values are masked the same way.
- `app/runners.server.ts` lists `monitor`: it counts each commit of a server store by its transaction's name, `setup.household.name` and the weekly run's steps, into `sessions.tally`, once a minute and at shutdown. The tally holds names and counts.
- `keel evidence` runs `keel check`, `keel test` and the ledger over the app and writes a signed bundle. Its `pii.json` lists every marked path of the `members` schemas and the four sinks (session recordings, inputs, the log, the bundle) with the rung of the clause that redacts each; `security.json` holds the headers and the policy `web` sends; `a11y.json` the result per route.

Tests: `test/recording.test.ts` opens the profile as a member, opens the note and types a name and a phone number: the note lists both as `x` repeated; the recording, its upload and the archive `POST /sessions` files it in hold neither, nor the member's email, password or id. A visitor's recording of the start page replays to the same state and fingerprint. A member and a visitor get 403 from the list and the tally, and after one setup save and a minute the tally reads `setup.household.name: 1` with no name in it. The smoke types a phone number on the built profile page and reads it masked in the note. `tooling/smoke/canary.mjs` runs `keel evidence` over the app, searches the bundle for the typed values and runs `keel evidence --verify` on it.

Try it: with the built app running, sign in and open `localhost:5211/profile`. Select What this page records, then type your name: the note adds a line `input members.profileForm:name "xxxxx"`, one `x` per character. Then write the evidence bundle and check it:

```sh
openssl genpkey -algorithm ed25519 -out /tmp/evidence.pem
KEEL_EVIDENCE_KEY="$(cat /tmp/evidence.pem)" pnpm exec keel evidence --out /tmp/household-evidence
grep keyId /tmp/household-evidence/manifest.json
pnpm exec keel evidence --verify /tmp/household-evidence --key <keyId>
node -p 'require("/tmp/household-evidence/pii.json").sinks'
```

Change one byte of any file in the bundle and run the `--verify` line again: it answers E1062 and names the file.

Check your work: `pnpm test && pnpm check && pnpm build`, then the smoke and `node --disable-warning=ExperimentalWarning tooling/smoke/canary.mjs` from the repository root.

## Layer 11: marks made offline, and a conflict shown

A member in the shop marks items bought where the signal drops. Each mark waits on the page, kept in the browser, and goes to the server once the connection is back (`keel docs std.offline`, `std.outbox-owner`, `k.data`). The outbox needs a member to own each mark, so it works on the list behind sign-in, which layer 6 turned on.

- `listOutbox.ts` is `outbox("shopping.outbox", shopping, { limit: 50 })`. The Bought and Back on the list buttons call `send` with the mark, the item's `rev` the page showed as `base`, and the signed-in member's id as `owner`; `drain` runs for that member while the page is open. A mark that waits shows `Bought, waiting to send` under its item, in a `role="status"` line. Adding and removing still go straight to the API.
- `migrations/0003-item-revisions.sql` gives each item a `rev`, which every change raises (`writeList.server.ts`), and a `list_writes` table of the keys of marks that committed.
- `POST /api/items/:id/bought` (`postBought.server.ts`) passes the mark's `write` through `writeFor` with the request's member, so a mark commits only for the member who made it. A request with no one signed in answers `offline.signin`: the outbox keeps the mark queued on the device until that member signs in again. Another member's mark answers `offline.owner`. `markBought.server.ts` then works in one transaction: a key in `list_writes` already committed, so the list comes back unchanged; an item that is gone is 404; an item whose `rev` moved past `base` is 409 `keel.conflict` with the item's `rev` as `head`, and nothing is written.
- `OutboxNote.tsx`, Marks not applied, lists each mark the server refused under the tabs, in a `role="alert"` line. A mark of an item changed at home names the item as it is now and offers Mark it bought (`resolve` with `mine`, which sends it again over the new `rev`) or Leave it as it is (`theirs`). A mark of a removed item, or one another member made on this device, offers Dismiss.

Tests: `test/outbox.test.ts` marks Milk bought with the sim network down, finds it waiting and the server unchanged, and sees it commit once when the network is back. Grace adds one more Milk while Ada's mark waits: Ada's page shows `Milk × 2: someone at home changed this item while your mark waited`, and each choice applies or drops the mark. A removed item, a mark sent twice, a stale `base`, another member's mark and a mark after sign-out each get their answer. `test/outbox.sim.test.ts` runs the offline mark under `simulate`, 30 schedules of drops, delays, lost responses, 503s, failed storage writes and offline windows: the mark commits once or not at all, and when Ada changed the item first it stays as a conflict with `head` 1. Under 15 more schedules Grace signs out with a mark queued: nothing commits while she is out, and once she signs in again the mark commits once. The smoke takes Grace's browser offline, marks Apples bought, finds the line `Bought, waiting to send` and the server unchanged, and finds Apples bought once she is back; then Ada adds Oats while Grace's mark of Oats waits, Grace's page shows the refusal, and Mark it bought applies it.

Try it: start the built app, sign in as two members in two windows, one of them private, and open `localhost:5211/list` in both. In one window open the browser's developer tools and turn the network off. Select Bought on Milk: the row says `Bought, waiting to send`. In the other window add Milk again. Turn the network back on: the first window shows Marks not applied with `Milk × 2`, and Mark it bought moves Milk to Bought in both windows.

Check your work: `pnpm test && pnpm check && pnpm build`, then the smoke from the repository root.
