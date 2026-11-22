# Walkthrough app findings

## Status

| Finding | Status |
| --- | --- |
| L1-1 | fixed: fix(compiler): a node deployable's resume entry imports the atomic CSS, so a built node app links its stylesheet |
| L1-2 | fixed: fix(scaffold): a workspace project's scripts call keel and its package.json names @keel/cli; a fresh scaffold passes its own scripts |
| L1-3 | fixed: fix(scaffold): a workspace project's scripts call keel and its package.json names @keel/cli; a fresh scaffold passes its own scripts |
| L1-4 | fixed: fix(cli): keel explain of a stdlib code loads the project's std deps, so E2406 and its kind explain themselves |
| L1-5 | fixed: docs(skills): createApp, Select options, storage flag, explore, scope, API shapes, plural zero, Money; spec map names keel docs |
| L1-6 | fixed: fix(cli): keel with no command names the commands to try |
| L1-7 | fixed: docs(skills): createApp, Select options, storage flag, explore, scope, API shapes, plural zero, Money; spec map names keel docs |
| L1-8 | filed as backlog 1020 |
| L2-1 | filed as backlog 1012 (the stale-artifact message names its source: fix(check): a stale surface.json names the source that changed) |
| L2-2 | answered in the skills (keel-client A11y: no base element takes `role`) |
| L2-3 | answered in the skills (keel-testing `explore`) |
| L2-4 | filed as backlog 1016 |
| L2-5 | filed as backlog 1017 |
| L2-6 | open |
| L3-1 | fixed: fix(forms): a keel.fields answer to a native post re-renders the bound controls with the submitted values and errors, kept at resume |
| L3-2 | answered in the skills (keel-deploy, Run `server.mjs`) |
| L3-3 | answered in the skills (keel-client A11y: `Select options`) |
| L3-4 | filed as backlog 1009 (the `zero` rule is answered in keel-client) |
| L3-5 | filed as backlog 1018 |
| L3-6 | answered in the skills (keel-client Forms: `initial` is partial) |
| L3-7 | filed as backlog 1010 |
| L4-1 | fixed: fix(testing): renderRoute raises a page render throw no errorElement caught, so a tx in a component body names its E1201 |
| L4-2 | answered in the skills (keel-server: `createApp` options) |
| L4-3 | filed as backlog 1008 |
| L4-4 | filed as backlog 1019 |
| L4-5 | answered in the skills (keel-server) |
| L4-6 | filed as backlog 1014 |
| L4-7 | answered in the skills (keel-testing: `scope`) |
| L4-8 | answered in the skills (keel-server: a service call runs in process) |
| W-1 | filed as backlog 1021 |
| L5-1 | open |
| L5-2 | open |
| L5-3 | open |
| L6-1 | fixed: rfc:0185 renderRoute user signs in a page's own requests; household's list and token panel tests drive the page |
| L6-2 | open |
| L6-3 | open |
| L6-4 | open |
| L6-5 | open |
| L6-6 | open |

Fixed 10, answered in the skills 9, filed as backlog 11, open 9.

Each finding: what I tried, where, the command and its output, what I expected, whether docs or skills misled. Kinds: fault (framework behaves against its spec), docs (docs or skills gap), rough (works, but an app author trips on it).

## Layer 1

### L1-1 fault: a built node page has no stylesheet
- Tried: `pnpm build`, then `PORT=5211 KEEL_SECRET=... node dist/web/server.mjs` and `curl localhost:5211/`.
- Saw: the page's elements carry atomic classes (`<main id="app.start" class="k-p-4 k-gap-2">`), `dist/web/assets/` holds only `entry-*.js`, and the head has no `<link rel="stylesheet">`. The page renders unstyled.
- Expected: `keel docs k.ui` says "The compiler emits one atomic class per (prop, token, breakpoint, state) ... into one CSS file", and `keel docs k.head` says the head holds a stylesheet link for each `.css` file the entry chunk names.
- The scaffold's `index.html` imports `@keel/ui/fonts`; a node deployable never serves that file, so the brand fonts are absent too.

### L1-2 rough: the workspace scaffold's package.json cannot run `keel`
- Tried: `keel scaffold project household --workspace --adapter node`, then `pnpm build` with `"build": "keel build"`.
- Saw: the scaffold writes `"build": "vite build"`, no `dev` script, `"check": "tsc --noEmit && biome check modules test"` (no `keel check`) and no `@keel/cli` dependency. With `keel build` as the script, pnpm runs whatever `keel` is on `PATH` (`Error: unknown command "build" for "keel"` from an unrelated binary).
- Expected: scripts that call `keel build`, `keel dev`, `keel check`, and `@keel/cli` in `devDependencies`. Fixed in the app by adding both.

### L1-3 rough: a fresh scaffold's `check` and `test` scripts fail before the first test exists
- `pnpm check` on the fresh project: Biome prints `test internalError/io INTERNAL ... No such file or directory (os error 2)` because `test/` does not exist.
- `pnpm test` with no tests: `ok 0 tests, 0 failed, 0 skipped` then `[ELIFECYCLE] Test failed.` (vitest exits 1 on no files), while `keel test` exits 0 on the same tree.
- Expected: the scaffold writes a first test, or both runners agree.

### L1-4 docs: `keel explain E2406` does not know a code the docs cite
- `keel explain E2406` prints `E2406 is not a known code; keel docs --for E2406 lists spec lines citing it.`
- `keel docs k.head` and the `keel-client` skill both name E2406 (a literal in a route `title` with `@keel/std-messages`).

### L1-5 docs: `keel docs` points app authors to a repo-only command
- `keel docs` (the map) says `owner: pnpm spec --for <code>`. An app has no `pnpm spec`; the app-side command is `keel docs --for <code>`.

### L1-6 rough: `keel` with no arguments prints an error, not the commands
- `keel` prints `E1051 no command given; see keel docs k.cli` and exits 1. A command list would save a step.

### L1-7 docs: the coverage plan names `keel new`
- `tasks/p1/feature-coverage.md` layer 1 says `keel new`; the command is `keel scaffold project <name>` (`keel new` is E1051).

### L1-8 rough: `keel dev` and the build serve different documents for a node deployable
- `keel dev --port 5199` on the fresh project serves the scaffold's `index.html` (a header with the mark and the literal app name, an empty `#app`, the client entry). The built `server.mjs` renders the route on the server and ignores `index.html`. The header and its literal text appear in dev only.

## Layer 2

### L2-1 rough: `keel check` is not clean after an edit until `keel build` runs, and `--quiet` hides why
- After editing a component, `keel check` reports `E1005 .keel/ids.json:1:1 generated .keel/ids.json does not match its sources; run keel build` (also `a11y.json`, `deps.json`, `routes.json`, `styles.json`, `surface.json`). The app's `check` script runs `keel check --quiet`, which prints only `fail check 35 files, 1 errors, 0 warnings`, with no diagnostic line, so the reader cannot tell which file is stale.
- Expected: `keel check` regenerates or names a single command; `--quiet` keeps error lines (OUTPUT.md quiet mode drops ok lines).

### L2-2 docs: k.ui says `role` is a base-element prop; `Text` rejects it
- Tried: `<Text id="shopping.failed" role="alert">` for an error line (`modules/shopping/ShoppingList.tsx`).
- `tsc`: `TS2322 ... Property 'role' does not exist on type ...`. `keel docs k.ui` lists `role` among the props "read at build". Used a `Toaster` with an `alert` item instead, which the docs do describe.

### L2-3 docs: what to assert after a bounded `explore`
- `explore(txs, { depth: 5, payloads })` returns `complete: false` (the depth bound was hit), so the skill's `expect(r.complete).toBe(true)` does not apply. The skill says a broken invariant is E1708 but not whether it throws or lands in the result. I asserted `depth` and the state count (`test/items.test.ts`).

### L2-4 rough: a failed test leaks its render into the next one
- The first version of `test/shoppingList.test.ts` failed an `expect` before `page.dispose()`. The next test failed at `renderRoute` with `E1703 landmark-unique: <main id="shopping.page"> Landmarks should have a unique role`, because the first page was still in the document. The real failure was one line up in the output. Expected: the harness disposes a test's render at test end.

### L2-5 rough: `fire(tab, keydown)` does nothing until the tab has focus
- `fire("shopping.view.tab.toBuy", { type: "keydown", key: "ArrowRight" })` left the selection; a `fire(..., { type: "focus" })` first made it work. This matches APG Tabs (focus sends `open`), but `fire` could focus the target as a browser does on a key press, or the skill could say so.

### L2-6 rough: a loader's literal data does not fit a schema `enum`
- `ListText` had `key: s.enum([...])` inside an array; the loader returning `{ key: "milk", ... }` failed `tsc` with a 20-line `TS2769` (the literal widened to `string`) and `keel check` reported `E1515 shopping.list: loader does not fit the entry it is bound at` in `routes.ts`, away from the cause. Used `s.string` for the key.

## Layer 3

### L3-1 fault: a server `keel.fields` answer on a node page loses the values and shows no error
- Tried: the receipts form (`modules/receipts/BookPage.tsx`), whose action (`recordReceipt.server.ts`) answers `err({ code: "keel.fields", data: { amount: "Write the amount ..." } })` for `12.345`.
- Without JS: `curl -H 'Sec-Fetch-Site: same-origin' --data-urlencode shop="Corner shop" --data-urlencode amount=12.345 -d currency=EUR -d paidBy=alex localhost:5211/receipts` answers 422 with `<input type="text" id="receipts.new:amount" autocomplete="off" data-k="" name="amount">` (no `value`, no `aria-invalid`) and an empty `<span data-k="" id="receipts.new:amount:error">`. The values and the error are present only in `#k-state` (`"form":{"values":{...},"errors":{"amount":"..."}}`).
- With JS (Chromium, `smoke/drive.mjs`): a submit the schema accepts goes out as a native document POST (Playwright `resourceType` `document`, no `x-keel` header), the 422 document loads, and after resume the field is empty with no `aria-invalid` and an empty error text. The reader sees the form cleared and no reason.
- Expected (`keel docs k.forms`): with JS, the client submits, and on `keel.fields` "exactly those field errors are set"; without JS "the server ... re-renders the page with the submitted values ... and errors".
- The harness disagrees with the build: the same flow in `renderRoute` (`test/receipts.test.ts`, "refuses an amount with three decimals") sets `invalid: true` on the field.
- A schema-level error (empty shop) works with JS: the client shows `Required` and sends nothing.

### L3-2 docs: the built server needs a storage flag the deploy skill does not name
- `node dist/web/server.mjs` (the command `keel-deploy` gives) answers 500 on every page with `stores`: `keel.unexpected loader receipts.book threw: Error: ctx.storage: this runtime has no localStorage; run node with --experimental-webstorage --localstorage-file=<path>`. The error says what to do, and the generated `deploy/web/Dockerfile` passes both flags, but `keel-deploy` and `keel docs k.deploy`'s run section list only env variables. `keel build` gives no hint.

### L3-3 docs: `Select` options have no documented shape
- `keel docs k.ui`, `k.a11y`, `k.forms` and `keel-client` name `Select` but never its `options`. `{ value, text }` failed (`TS2353 ... 'text' does not exist in type 'Option'`); `{ value, label }` compiled, found by guessing.

### L3-4 docs: a plural `zero` form never shows in English or German
- `count: { plural: "n", zero: "No receipts yet", one: ..., other: ... }` renders `0 receipts` for `n = 0` in `en-US`: `plural` follows `Intl.PluralRules`, which has no `zero` category in English or German. Correct by CLDR, but `std.messages` lists `zero?` beside `one` without saying it applies only to languages that have the category, and offers no exact-match form (ICU's `=0`).

### L3-5 rough: `fire(select, { type: "change", value })` does nothing
- `fire("receipts.new:paidBy", { type: "change", value: "sam" })` type-checks and leaves the field at `alex`; `{ type: "input", value: "sam" }` sets it. A browser fires both for a select.

### L3-6 docs: a form `initial` cannot hold an empty `line`
- `form(NewReceipt, { initial: { shop: "", ... } })` fails `tsc` (`Type 'string' is not assignable to type 'Format<string, "line(1..60)">'`). Leaving `shop` out of `initial` works, which the docs do not say (`initial` reads as the whole value).

### L3-7 docs: no reader from typed decimal text to `Money`
- `std.money` has `Money` in minor units and `formatMoney`, and no way to read what a person types (`12,50`) into minor units. The app writes its own (`modules/receipts/minorUnits.ts`) and keeps the amount a string in the form schema. An app author expects the parse beside the format.

## Layer 4

### L4-1 fault: a `tx` in a component body renders an empty page with no diagnostic
- Tried: seeding the client list store from loader data, `run(tx(hydrate, { items: props.items }))` at the top of `ShoppingList` (the skill's "`tx` the result into a `hydrate` transaction").
- `renderRoute("shopping.list", ...)` resolved with `route().id` `shopping.list` and `a11y()` `[]`; the next `find` failed `E1705 no element with id "shopping.heading"; the render has no ids`. No error, no alert, no diagnostic named the cause; commenting out the one line rendered the page. The component now keeps the items in a `signal` seeded from props and sets it from each API answer.
- Expected: an error that names the write (as E1201 does for an effect), or a documented way to seed a view store from loader data.

### L4-2 docs: `createApp` for tests has no documented signature
- `keel-server` and `keel-testing` say "`createApp` (sim ctx) then `app.fetch(...)`" and name no import or options. `createApp({})` fails `tsc` (`Argument of type '{}' is not assignable to parameter of type 'AppOptions'`) and the type's fields are not in any `keel docs` section I found. The working call, `await createApp({ topology, routes: routeTable(...), ctx, deployable: "web" })` from `@keel/server`, came from `apps/golden-2/test/simApi.ts` (`test/serve.ts`).
- `keel docs k.server` says "Apps import only `topology` and `commitStores` ... from `@keel/server`", which reads as forbidding the import tests need.

### L4-3 docs: a guard's `next` cannot be followed
- The setup guard (`modules/setup/setUp.guard.ts`) redirects to `/setup?next=%2Flist`. The setup action should send the person back to `next`, but an action's `ok` takes an `Href` and the docs give no way to turn the `next` string into one (`matchHref` gives `{ id, params, search }`, and rebuilding needs the target module's contract, which `deps` forbids here: L4-4). The action answers `ok(null)` and the page says where to go.

### L4-4 rough: linking to a page that uses your guard is a dependency cycle
- With the setup guard in the `app` module, `shopping` must list `app` in `deps` to import it, and `app`'s start page must list `shopping` to link to the list: `E1153 modules/app/module.ts:5:10 module deps cycle: app -> shopping -> app`. The guard, the household API and the setup page moved to their own `setup` module, which links to nothing.

### L4-5 docs: an API GET and an API write answer different JSON shapes
- `GET /api/items` answers `{"id":"shopping.items","results":{"shopping.items":{"ok":true,"value":{...}}}}`; `POST /api/items` answers `{"ok":true,"value":{...}}`. `keel docs k.api` states both, `keel-server` shows neither. A test or a curl reader guesses `{ ok, value }` for the GET first.

### L4-6 rough: `keel check` reads scripts beside the app as app code
- `smoke/drive.mjs` (a Playwright script) used `document.getElementById` inside `page.evaluate`: `E1252 smoke/drive.mjs:32:35 document in app code; render with JSX and base elements, effects via ctx`. The script now uses Playwright locators. Expected: `keel check` reads `modules/`, the root config files and tests, not every `.mjs` under the project.

### L4-7 docs: how to test a server store factory
- Calling `savedStores()` at a test file's top level fails `E1203 reactive primitive created outside any scope; wrap it in scope(fn)`. `scope(fn)` returns a `Scope`, not `fn`'s value; `scope(() => undefined).run(() => savedStores())` works. `keel-testing` shows `properties` and `explore` on module stores only.

### L4-8 docs: a service call on a `createApp` ctx never reaches `ctx.net`
- With `ctx.net.route("/api/*", ...)` recording requests, a page under `renderRoute` on the same ctx made its `shoppingApi.add` calls in process: the recorder saw none. Correct per `k.services` ("in process"), but `keel-server`'s "Route a client test's sim `ctx.net` `/api/*` to `app.fetch`" suggests the calls pass through the route.

## Workspace wiring

### W-1 rough (repo tooling): `pnpm ledger` in a fresh worktree rewrites more than the new app
- `pnpm ledger` after adding the app changed 1,286 lines of `tooling/ledger/ledger.json`: the household's 52 exports, and also seven golden-1 and golden-2 export rungs, the `mutation` section and 180 `a11y` items, because this worktree holds no `reports/` from earlier runs. The committed file keeps the master entries and adds only the household's exports; `node tooling/ledger-fresh.mjs` passes on it.

## Layers 5 and 6

### L5-1 docs: a database `transaction`'s error type is fixed by its first `return`
- Tried: in `apps/household/modules/receipts/recordReceipt.server.ts`, `receiptsDb(ctx).transaction(async (t) => { const count = await t.one(...); if (!count.ok) return count; if (count.value.n >= 200) return err({ code: "keel.fields", ... }); return t.run(...) })`.
- `tsc --noEmit`: `error TS2345: Argument of type '(t: Tx) => Promise<... | { readonly ok: false; readonly error: { code: string; message: string; data: { shop: string; }; }; }>' is not assignable to parameter of type '(tx: Tx) => Promise<Result<number, NotFound | StatementError>>'`, followed by a 15-line `TS2769` on the `action` call. The transaction now answers `ok(false)` for a full book and the action maps that to `keel.fields` outside it.
- Expected: `keel docs std.postgres` to say `fn`'s `err` is limited to the statement errors, or `transaction` to take the union of what `fn` returns (the docs say "`err` ... rolls back", which reads as any `err`).

### L5-2 rough: `std.db` Postgres storage takes no `pglite:` URL
- k.data says a setting is a server store and the list is app data, so the household name stays a store while the list and the book move to `@keel/std-postgres`. `keel docs std.db` says `storage: 'postgres'` requires a `postgres:` URL in `KEEL_DATABASE_URL`, while `KEEL_POSTGRES_URL` takes `pglite:<folder>`. A deployable run on a PGlite folder therefore keeps its stores in a second place (`storage: 'file'`, the `--localstorage-file` flags), and the walkthrough cannot show `std.db` on Postgres and a PGlite data folder in one build.
- Expected: one database for both, or the deploy skill naming the split and the reason.

### L5-3 rough: a one-off row schema for a `count(*)` needs its own file
- `const Count = s.object({ n: s.int() })` beside the `sql(Count)` query in `recordReceipt.server.ts` is `E1104 modules/receipts/recordReceipt.server.ts:13:7 schema Count declared outside a *.schema.ts file; move it there`. It is now `ReceiptCount.schema.ts`. Every statement needs a row schema (std.postgres), so each aggregate an action reads costs a file.

### L6-1 fault: under `renderRoute`, a component's API call carries no member
- Tried: `test/shoppingList.test.ts` rendered `shopping.list` with `renderRoute("shopping.list", { routes, params: {}, ctx, user })` on the ctx `createApp` serves (`test/serve.ts`), then `fire("shopping.staples.item.milk", { type: "click" })`. The API entries bind `guard: member` (`user === ''` is `keel.denied`).
- The guard and loader saw `user`; the component's `shoppingApi.add({ body }, ctx)` ran in process with `user` `''`, was answered 403, and the page showed the `shopping.notices.toast.failed` alert. `sent` recorded no request (L4-8), so a net route cannot add the member's cookie or token either. In a browser the same call carries the session cookie and succeeds (the smoke step "menu adds through the API and raises quantity").
- Expected: keel-testing says "the page is the production page"; a signed-in `renderRoute` should make the page's own API calls as that member, or the docs should name how to test a signed-in page whose components call a guarded API. The list's menu, toggle and remove buttons and the token panel's mint and revoke are now proved in Chromium only; the tests drive the same API directly.

### L6-2 rough: under happy-dom a `Response` drops `set-cookie`, so a sign-in test gets no cookie
- `formPost(mount.href("/sign-in/email"), ...)` through `createApp` answered `303 /` with `headers.getSetCookie()` `[]` in a happy-dom test file, and `[cookie]` in a `// @vitest-environment node` file. Page tests (happy-dom) therefore authenticate with an API token minted through `membersApi.mint({ body, user }, ctx)`; cookie tests run under node (`test/signin.test.ts`, `test/tokens.test.ts`). Nothing in keel-testing or keel-server mentions it; golden-2's account tests are node files with no comment saying why.

### L6-3 rough: an external id in an element id breaks `properties`, and an app cannot narrow the string
- `TokenPanel.tsx` used `` id={`members.token.${t.id}`} `` with `TokenInfo.id` `s.string({ min: 1, max: 64 })` (the std.tokens id). `properties(ProfilePage, { runs: 100, seed: 6 })` failed `E1704 ProfilePage: E1703 axe-core rule button-name threw: Failed to execute 'querySele... (seed 6, run 3, shrunk)` with `"tokens":[{"id":"\" ",...}]`.
- An app may not declare a format (E1106) and `@keel/std-tokens` exports no schema for a token id (its form is 16 lowercase hex), so the rows are numbered by position. Expected: a `TokenId` schema from std.tokens, or the harness quoting ids when it queries them (an id with a quote is still a DOM id the app wrote).

### L6-4 docs: when `clientPii` applies is not what the coverage plan expects
- The layer 6 brief asks for `clientPii` "where a client needs them". The profile page's loader answers the member's email, name and phone (`.pii` in `ProfileData.schema.ts`) into the served document, and `keel check` is clean with no `clientPii`: k.leave ties E1107 to a `store` a component file reaches, and loader data is not one. keel-compliance's "Mark data" says `.pii` values "serialize where the app sends them" but does not say that page data in the document needs no listing, so an author cannot tell whether a clean check here is right. The app lists none, and the README says why.

### L6-5 rough: a sign-in library through the identity seam is about a hundred lines the app writes
- `identity.server.ts` turns each native form post into the library's JSON, maps the answer to a 303 with its cookies, carries `next`, and refuses a `next` that is not a path on this origin (`//evil.example/x`, `https://...`: tested in `test/signin.test.ts`). The same code is in golden-2's `identity.server.ts`. The open-redirect check is the app's to remember: k.mount says the `handle` answers "a 303 to a page `Href`" and keel-server says nothing about a guard's `next` after sign-in (L4-3 is the same gap on the setup page).

### L6-6 rough: `formatMessage` takes only a message-set entry
- `formatMessage(props.data.text.signedInAs, { email }, "en-US")` with `signedInAs` a plain `s.string()` in the loader's copy failed `tsc`: `Argument of type 'string' is not assignable to parameter of type 'Message<Readonly<Record<string, string | number>>>'`. The one-locale members pages now join strings in the component; a placeholder in a plain loader string has no documented helper.
