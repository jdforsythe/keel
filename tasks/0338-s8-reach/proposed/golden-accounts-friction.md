# golden-2 accounts: documentation friction

The `accounts` module in `apps/golden-2`: sign-up and sign-in pages, `POST /api/tokens`, `GET /api/me`, a service client and two test files. Built from the skills, `packages/std-credentials/README.md`, `pnpm spec`, `keel explain` and the code of `apps/golden-1` and `apps/golden-2`. No file under `packages/*/src`, `packages/*/test`, `packages/*/conformance` or `docs/rfc` was read.

Ordered by cost, highest first.

## 1. Carrying a signed-in caller from a page into a service call
- **Trying:** sign in on a page, then call `POST /api/tokens` through the `accounts` service client as that signed-in caller.
- **Read:** keel-server (`caller` is a hash of the signed cookie), keel-testing (`renderRoute(..., { caller })`), keel-api (route sim `ctx.net` `/api/*` to `app.fetch`), k.server, k.services.
- **Missing:** nothing says that a service client sends no cookie, so every call it makes is a new caller. `renderRoute`'s `caller` is a raw string, but `createApp` hashes a cookie, so a session written under `renderRoute` cannot be reached from `app.fetch`. No skill shows how a test carries the cookie.
- **Unstuck:** used the cookie jar in `apps/golden-1/test/simApi.ts` (`req.headers.set("cookie", jar)` in the `ctx.net` route; its comment explains that happy-dom drops `cookie` set at construction). Signed in with a FormData document POST through `app.fetch`, read `set-cookie`, and ran the test under `// @vitest-environment node`.
- **Smallest fix:** a keel-testing line: "A caller across requests: POST a form through `app.fetch`, keep `set-cookie`, set `cookie` on each request in the `ctx.net` route; `renderRoute`'s `caller` is not a cookie hash." Better still, a `@keel/testing` cookie-jar helper.

## 2. How a signed-in user ties to `caller`
- **Trying:** tie the signed-in user to the request "the way the skills say a server store knows who is calling".
- **Read:** keel-server, keel-compliance, k.server, k.guards.
- **Missing:** the skills mention `caller` only for `undoWhere`. They give no pattern for a session (a store keyed by `caller`). keel-server says `""` before the first write and does not say whether that first write already has a caller. k.server does say it ("else of a fresh one set as a cookie on a write").
- **Unstuck:** added an `accounts.sessions` store of `{ caller, userId }`, written by the sign-in action and read by the token action and the page loader.
- **Smallest fix:** one keel-server line: "Signed in = a server store row keyed by `caller`; a write gets a caller (cookie set on the response) even with no cookie."

## 3. How an API route denies, and guard or loader
- **Trying:** deny `/api/me` for no token, an unknown token and an expired one "the way the skills say an API route denies".
- **Read:** keel-api, keel-compliance, std-credentials README (`return err(denied)`, `denied` undefined), k.api, k.guards.
- **Missing:** the skills never say how an API route denies. k.api says a guard denial is 403 `keel.denied`, but not whether the guard's message or data reach the body. A guard's result does not reach the loader, so a guard plus a loader runs `check` twice. Nothing says a loader `err` `keel.denied` is 403 too; the k.server status table implies it.
- **Unstuck:** the loader returns `err({ code: 'keel.denied', message })` and the client sees `api.status` 403.
- **Smallest fix:** in keel-api and in the README example, define `denied` and state the status, and say whether to check in a guard or in the loader.

## 4. Reading the log in a test
- **Trying:** assert that no log line or diag holds the password or the token.
- **Read:** keel-testing (no log at all), keel-compliance ("log `write` lines" in the canary test, with no way to get them), k.server Log (`createApp({ log: { format, write } })`).
- **Missing:** keel-testing does not cover the log. `renderRoute` has no log option, so the page tests cannot assert anything about the log.
- **Unstuck:** `createApp({ ..., log: { format: 'json', write } })` in `tokens.test.ts`, where the sign-up, sign-in (with a wrong password too), mint and `me` requests also run.
- **Smallest fix:** a keel-testing line naming `createApp({ log: { write } })`, and a `log` option or `r.log()` on `renderRoute`.

## 5. Module placement on scaffold
- **Trying:** `keel scaffold module accounts`.
- **Read:** keel skill, k.scaffold.
- **Wrong:** it puts the module in the first deployable (`web`, `client`). Pages with `stores` there are E1558. The keel skill does not name `keel codemod place`; it appears only in the keel-deploy description and k.scaffold.
- **Unstuck:** `keel codemod place accounts --to api --adapter node`.
- **Smallest fix:** `--to <deployable>` on `scaffold module`, or one keel-skill line naming `codemod place`.

## 6. `@keel/std-credentials` not installed, and nothing says to add it
- **Trying:** import `@keel/std-credentials`.
- **Read:** keel-compliance ("in `deps`"), the README.
- **Missing:** the skill and the README say to list it in the manifest's `deps`, not in `package.json` `dependencies`. keel-storage says the latter for `@keel/std-db` (E1572). `tsc` failed with TS2307 on every import, while `keel check` reported only E1005 (stale artifacts): no rule ties a std package in `deps` to `dependencies`.
- **Unstuck:** added `"@keel/std-credentials": "workspace:*"` to `apps/golden-2/package.json`. To verify without `pnpm install`, I made the link `pnpm install` would make: `apps/golden-2/node_modules/@keel/std-credentials -> ../../../../packages/std-credentials`.
- **Smallest fix:** a README and skill line ("add to `dependencies` too"), and an E1572-style check for every `@keel/std-*` in `deps`.

## 7. `If` children must be a function
- **Trying:** `<If when={...}><Text/></If>`.
- **Read:** keel skill ("`<If when>`").
- **Missing:** the children are a thunk; `tsc` says `Type 'Node' is not assignable to type '() => Node'`. Found `{() => (...)}` in `CatalogPage.tsx`.
- **Smallest fix:** write `<If when={c}>{() => <X/>}</If>` in the keel skill.

## 8. Password control attributes
- **Trying:** the form control attributes for an `s.secret` password.
- **Read:** keel-compliance, keel-forms, k.a11y, k.forms.
- **Missing:** keel-compliance requires `autocomplete` only for `.pii` controls. Nothing names `type="password"` or `autocomplete="current-password"` / `"new-password"` for a secret field, and nothing says whether `Autofill` accepts them (it does: `tsc` and the render checks pass).
- **Smallest fix:** a keel-forms line: "`s.secret` field: `Input type="password" autocomplete="current-password"` (sign-in) or `"new-password"` (sign-up)."

## 9. Import order rule against Biome
- **Trying:** follow keel-api's "import `routes.ts` first (tests too)".
- **Wrong:** `biome check` (part of the app's `check`) reorders imports, so the rule cannot hold. It also moved the `// @vitest-environment node` comment, which was attached to the first import, to the middle of the file, where it no longer applies. In this module the order did not matter.
- **Smallest fix:** say when the cycle bites (a test importing a `*.server.ts` before `routes.ts`) and how to keep the order under Biome. Tell test writers to leave a blank line after the environment comment.

## 10. Example app contradicts the forms skill
- **Trying:** a `Form` with children.
- **Read:** keel-forms (JSX `<Form ...>children</Form>`), `apps/golden-2/modules/recipes/NewRecipePage.tsx` (`Form({...})` called as a function, with the comment "Router `Form` expects Node children ... (compiler D31)").
- **Wrong:** the example says JSX does not work, but JSX does work (tsc, renderRoute and SSR tests pass).
- **Smallest fix:** drop the workaround and its comment in `NewRecipePage.tsx`.

## 11. Stored snapshot shape for assertions
- **Trying:** read the stored password from `ctx.storage`.
- **Read:** keel-server and keel-testing, which name the key `keel.store.<id>`.
- **Missing:** the value's shape, `{ state, log, initial }`. Found it in `apps/golden-1/test/simApi.ts`.
- **Smallest fix:** a keel-testing line with the shape, or a `@keel/testing` `saved(ctx, store)` reader.

## 12. Service module base in a node-environment test
- **Trying:** route a `service({ module: 'accounts' })` call in a `@vitest-environment node` test.
- **Read:** keel-api (route `new URL('/api/*', location.href)`).
- **Missing:** there is no `location` under node. The base there is `http://accounts.keel.invalid` (k.services, and `ssrNode.test.ts`), which keel-api does not mention.
- **Smallest fix:** keel-api: "outside a browser and a bound ctx, route `http://<module>.keel.invalid/api/*`".

## 13. `mint` `expiresAt` type
- **Trying:** answer `expiresAt` in an `output` of `s.int()`.
- **Missing:** `expiresAt` is `number | null` even when `ttl` is a number, so the `output` field must be `.nullable()` or the app must narrow it. The README does not say.
- **Smallest fix:** overloads on `mint` (a number `ttl` gives `expiresAt: number`), or a README line.

## 14. Capabilities `credentials(ctx)` needs
- **Trying:** fill `capabilities` in `module.ts` (the scaffold writes `[]`).
- **Missing:** neither the README nor keel-compliance says which capabilities `hash`, `mint` and `check` use (the clock, randomness). Copied `["clock", "random", "storage"]` from `kitchen`, and the checker said nothing either way.
- **Smallest fix:** a README line, and a check if capabilities are enforced.

## 15. Scaffolded API route for a write-only endpoint
- **Trying:** `keel scaffold route accounts.tokens --path /api/tokens --api` for a POST-only route.
- **Wrong:** it always writes a GET loader and a test that GETs. There is no flag for an action-only route. The test goes to `test/accounts.tokens.route.test.ts` with a one-module topology, which does not match the app's tests.
- **Unstuck:** deleted the loader and the four scaffolded tests, and wrote `test/accounts.test.ts` and `test/tokens.test.ts`.
- **Smallest fix:** `--action POST` on `scaffold route --api`, writing an action with `output: s.object({})` and a POST test.
