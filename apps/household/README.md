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
