# Household

A shared shopping list and receipts book for one home, built with Keel one layer at a time. Each layer is a range of commits with its own tests; check out the last commit of a layer to see the app at that point.

Run every command from `apps/household`.

| command | does |
|-|-|
| `pnpm dev` | `keel dev` on port 5173 |
| `pnpm test` | the app's tests under a simulated ctx |
| `pnpm check` | `tsc`, Biome and `keel check` |
| `pnpm build` | `keel build` into `dist/web/server.mjs` |
| `PORT=5211 KEEL_SECRET=<32+ bytes> node dist/web/server.mjs` | the built app |

## Layer 1: scaffold, dev server, docs

`keel scaffold project household --workspace --adapter node` writes the project: one `node` deployable named `web` that renders pages on the server, `tokens.ts` on `brandTokens`, and an empty `app` module. `keel scaffold route app.start --path /` adds the start page, its loader and a route test.

- `modules/app/StartPage.tsx` renders a heading and one line of text from its loader's data.
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

Tests: `test/items.test.ts` runs `properties` on each transaction and a bounded `explore`; `test/shoppingList.test.ts` renders the route, opens the menu, adds a staple twice, moves it between tabs and checks the focus order. `smoke/drive.mjs <origin>` drives the built app in Chromium.

The list lives in the browser in this layer: a reload empties it. Layer 4 moves it to the server.

Check your work: `pnpm test && pnpm check && pnpm build`, then start the build and run `node smoke/drive.mjs http://localhost:5211`.

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

The pages that come next, storage that survives a restart, sign-in and personal data, live updates and offline writes, attach to these modules: `savedStores.ts`, `bookStores.ts` and `householdStores.ts` are the stores a durable storage keeps, and `setUp.guard.ts` is where a signed-in user replaces the household check.
