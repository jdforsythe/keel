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
