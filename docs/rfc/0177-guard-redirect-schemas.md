# RFC 0177: k.guards: a guard redirect's carried params fit the target's schemas, checked when the route table is built

Status: draft (ADR-0199 proposed). For backlog 0330 (work package guard-redirect-schemas, `tasks/p1/weaknesses-triage.md`).

## Decisions
- D1: the check runs where the schemas are objects, not text: `manifest` (and `routeTable` for a chain it joins across modules) compares, for each page whose chain holds a page or layout guard with `redirect`, every field of the `redirect` route's `params` with the page's field of the same name. A missing field or one that does not fit throws E1508 naming the page, the `redirect` route and the field. `bindTable` already throws E1508 for a page guard without `redirect` and a redirect to an API entry; this is the same place and code.
- D2: `keel build` and `keel dev` evaluate each `routes.ts` once (k.compiler Build-time evaluation) and keep a thrown E code with its file, so the finding reaches the build, not only a denial at run time. Every test that builds the table (`renderRoute`, `createApp`, `createRouter`) sees it too.
- D3: "fits" is a closed, decidable relation stated in the spec (k.guards Carried params): the same node; the same type with the same options (an `id` of the same brand); an `enum` or `literal` each of whose values the target's node parses; a `string`, `number` or `int` whose `min` and `max` lie within the target's of the same type. Anything else, a format type or a union with different members included, does not fit. Conservative: a pair it refuses may be safe (an `id` into an unbounded `string`); the author then declares the same schema on both, which the golden apps already do.
- D4: the missing-field case moves from the denial to the table, with the mismatch: one check, one time. The run-time read in `carriedParams` stays as a guard against a table built some other way; through `manifest` and `routeTable` it is unreachable, and the Rules line no longer lists it under run time.
- D5: the static half of E1508 in `keel check` (`guardRedirectLoops.ts`) is unchanged. It reads literals; the static readers follow `params` schemas through consts and imports (k.contract Static reading) but a schema built by a call or taken from a package reads as nothing, and `routes.json` holds JSON Schema, where an `id`'s brand is gone. The binding holds every schema exactly.
- D6: backlog 1000 (`routes.json` writes `guard: null` for no guard and for a guard without `redirect`) is not folded in. This change writes no artifact; 1000 changes `routesArtifact`'s `guard` value and its four readers (`routeLiterals`, `routesMismatch`, `evaluateProject`, `RouteEntry`) under k.compiler and k.router Artifacts. See For the operator.
- D7: k.guards reads `implemented` until the conformance-writer and the build land (RFC 0170 D7): clause 4 is at `none` in the ledger, and `keel ledger --diff` refuses a `conformance-covered` section with such a clause (E1707). Nothing becomes `frozen`.

## Problem
A guard denial redirects to its `redirect` route with the matched route's same-name params (k.guards). `carriedParams` (`packages/router/src/internal/carriedParams.ts`) copies each field the target's `params` declare from the matched route's decoded params, checking presence only, and `encodeHref` encodes them with the target's schema (`packages/server/src/internal/runGuards.ts`, the client router alike). So:
- `/users/:id` with `s.id('User')`, guarded, redirecting to `/recipes/:id` with `s.id('Recipe')`: the user id lands as a recipe id. Ids check no brand at run time, so it encodes and the target page loads with a foreign id.
- A matched `s.enum(['a', 'b', 'c'])` carried to a target `s.enum(['a', 'b'])`: `encode` of `'c'` throws, and the denial is a 500 `keel.unexpected`. It shows only when a guard denies on that one value, which tests and reviews rarely reach.
- A missing field is E1508 at the denial (500 on the server), the same late shape.
The static half of E1508 (`packages/check/src/internal/guardRedirectLoops.ts`) checks the redirect target and loops through literals; it reads no `params`.

## Proposal
```ts
// modules/users/users.contract.ts
export const users = contract('users', {
  'users.home': { path: '/users' },
  'users.show': { path: '/users/:id', params: s.object({ id: s.id('User') }) },
  'users.wait': { path: '/users/wait/:id', params: s.object({ id: s.id('Recipe') }) },
})
// modules/users/routes.ts
export const routes = manifest(users, {
  'users.home': { component: Home },
  'users.wait': { component: Wait },
  'users.show': { component: Show, guard: signedIn },          // signedIn redirects to 'users.wait'
})
// E1508 users.show: guard redirect to "users.wait" carries param "id", which does not fit
// (keel build: routes.ts, with that message; a test building the table: the same throw)
```
Fit, per field `f` of the `redirect` route's `params` and the page's `params` field `f` (D3):

| page's node | target's node | fits |
|-|-|-|
| the same schema | | yes |
| `s.id('User')` | `s.id('User')` / `s.id('Recipe')` | yes / no |
| `s.enum(['a'])`, `s.literal('a')` | `s.enum(['a', 'b'])`, `s.string()` | yes |
| `s.enum(['a', 'b', 'c'])` | `s.enum(['a', 'b'])` | no |
| `s.int({ min: 1 })` | `s.int()` | yes |
| `s.string()` | `s.string({ max: 8 })` | no |
| (absent) | any | no (missing) |

A page's chain is the page and its layouts (k.routes Layouts); an API entry's guard denies with 403 and redirects nowhere, so API entries are not checked. A guard on a layout checks every page under it; `manifest` checks the pages of its own contract, `routeTable` (or a manifest served alone) the pages of one module under another module's layout, as it resolves E1506 for those chains.

Message: `E1508 <page>: guard redirect to "<target>" carries param "<field>", <which the page lacks | which does not fit>`.

## Alternatives
- **The static half in `keel check`, as the backlog line suggests.** Rejected (D5): it would need a second schema reader that compares nodes, and still miss call-built and package schemas. The table check sees all, and `keel build` reports it.
- **Parse at the denial: run the target's `params.parse` on the carried values and treat a failure as E1508.** Smaller code. Rejected: still a 500 that shows only on a denial, the finding itself; an `id` of another brand still passes.
- **Brand ids at run time.** Rejected: a k.schema change for every id, far outside a guard finding.
- **Declare carried params on the guard (`guard({ redirect, params })`).** Rejected: new API under the provisional freeze for what the two contracts already state.
- **Value-set subset for every type (formats, unions, records).** Rejected: not decidable in general; D3's table covers what a path param uses.

## Spec diff
Applied in this commit:
- **k.guards** (status `implemented`, D7): new paragraph Carried params (D1 to D3); Rules: "E1508 a guard's literal `redirect` route is under that guard, or (route table) a carried param missing or not fitting, or (runtime) a guard redirect loop"; Conformance gains bullet 4. Bullet 1 is unchanged: its E1508 for a missing param now fires when the table is built.
- **Map**: the k.guards row reads `implemented`.

Clause:
- k.guards #4: `manifest` throws E1508 naming the page, the `redirect` route and the field when a guarded page lacks a field of the `redirect` route's `params`, or carries `s.id('User')` to `s.id('Recipe')`, `s.enum(['a', 'b', 'c'])` to `s.enum(['a', 'b'])` or `s.string()` to `s.string({ max: 8 })`; it throws none for the same schema, `s.enum(['a'])` to `s.enum(['a', 'b'])`, `s.literal('a')` to `s.string()` or `s.int({ min: 1 })` to `s.int()`; `routeTable` throws E1508 for a page of one module under another module's guarded layout.

## New codes
None: E1508 gains a case.

## Conformance diff
By the `conformance-writer`, under `rfc:0177`, from `pnpm spec k.guards` (with `pnpm spec k.routes` for layouts across modules and `pnpm spec k.compiler` for build-time evaluation):
- `packages/router/conformance/guard-carried-params-e1508.test.ts` (new): clause 4, each pair through `manifest`, the cross-module case through `routeTable`.
- `packages/router/conformance/guard-denied-redirect.test.ts`: the case "a guard redirect to a route with a param the matched route lacks is E1508" builds its table with `manifest`, which now throws E1508 there; the case changes to expect the throw (a modification, so the commit carries `rfc:0177`). Other guard suites (`packages/router/conformance/guard-redirect-loop-e1508.test.ts`, `packages/server/conformance/guard-redirect-loop-e1508.test.ts`, whose property already accepts a `manifest` E1508) are rerun and revised only where a generated table now throws.
- Optional: `packages/cli/conformance/` a `keel build` case whose `routes.ts` carries a param that does not fit, reported as E1508 with the file (exit 1).

## Build
- `@keel/router`: `internal/bindTable.ts` checks own-contract chains after the redirect-to-API check; `routeTable`'s join checks cross-module chains where it resolves E1506; a new `internal/paramFits.ts` holds D3 over schema nodes. `carriedParams` keeps its presence check. Size line re-based if it moves.
- `@keel/check`: the `keel explain` row for E1508 names the route-table case (at most 120 tokens).
- Docs: the `keel-server` skill's guard paragraph (a redirect's params must fit), `packages/router/README.md`.
- Ledger: k.guards #4 is in `tooling/ledger/ledger.json` at `none` (this commit); the build raises it and k.guards goes back to `conformance-covered`.

## Token impact
k.guards 1,495 to 2,835 characters (709 tokens). Map 1,361 tokens (one status word shorter). No new code.

## For the operator
1. Both golden apps' guards (`editable` to `todos.index`, no params; `cook` to `recipes.index`, the same `LocaleParams` on both sides) fit. Recommendation: accept; the build lane confirms with `keel build` of each app.
2. Backlog 1000 (D6). Recommendation: its own small RFC, `routes.json` `guard` as `{ redirect: string | null }` or `null`, with the readers in `@keel/compiler` and `@keel/check` changed in one build.
3. D3 refuses some safe pairs (an `id` into an unbounded `string`). Recommendation: accept until an app needs one; widening the table is a later, additive change.
