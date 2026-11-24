# RFC 0224: k.user: a sign-in returns only to a page its own origin answers; E1592

Status: accepted (ADR-0246), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Amends k.user (Identity source, Rules, Conformance), the map. From backlog 1077.

## Decisions
- D1: a return target is a page the origin of the `handle` answers. A page another origin serves is never one. `Href` stays root-relative, and `pageHref` and its rules are unchanged.
- D2: the tables an identity source may join with `routeTable(routes, thatTable)` are those whose pages its origin answers: a `client` deployable through `servedBy`, a `node` peer through forwarding (k.topology).
- D3: one new code, E1592, an error at the import, no fix diff: `identity.server.ts`, or a project file it imports, imports the `routes` of a module that a `static` deployable, or a `client` one without `servedBy`, serves.
- D4: no runtime change and no bytes. A cross-origin `next` is already refused by `pageHref` (rule 1: not exactly one leading `/`), and the handle falls back to its own page.
- D5: the docs show the same-origin pattern: serve the `client` deployable from the identity deployable with `servedBy` (`examples/shell-mount`), or reach a `node` peer through forwarding.

## Problem
`handle.fn(request, ctx, { routes })` gets the table of its own deployable. `examples/shell-mount` joins the `client` deployable's table (`routeTable(routes, web)`) because `web` is `servedBy: 'api'`: the pages are on the origin that ran the sign-in. Nothing says what happens when the pages are on another origin: a `client` deployable on a static host at `https://app.example` and the identity deployable at `https://api.example`. An author can join that table too; `pageHref` then answers `/notes`, a root-relative `Href` the browser reads against `https://api.example`, where no such page is. It is not an open redirect, since the value is still built from a table, but it is a wrong value nothing catches, and the natural next step, an absolute return URL, is one.

What the tree holds:
- k.router Links: an `Href` starts with one `/`; `pageHref` refuses `https://…` and `//…`.
- k.mount Origins: cookies are per origin, so a sign-in is unseen by a deployable the browser reaches on another origin; an app serves one public origin and forwards to peers. E1581 and E1589 refuse a `static` deployable, and a `client` one without `servedBy`, beside `identity.ts`.
- k.deploy: `KEEL_PEER_<NAME>` is required per other `node` deployable (E1560), so a built `node` deployable always forwards its peers' paths. `keel dev` serves every deployable on one origin.
- `examples/compose-peers`: two `node` deployables, sign-in at `web` only; no join. `examples/shell-mount`: the `servedBy` join.

## Proposal
### Why a sign-in does not return across origins
A sign-in through `handle` on origin A sets its library's cookie on A. A page on origin B runs its own `identify` against B's cookies, which hold no sign-in. Returning the person to B after a sign-in on A lands them on B signed out. A return across origins is therefore not a feature the seam can give honestly: the session itself does not cross. Libraries that do cross-origin sign-in (OAuth redirect URIs, a shared parent-domain cookie) own that flow inside `handle`, with their own allow-lists; Keel does not route around them.

### The rule
In k.user, Identity source, after the `servedBy` sentence:

> A page another origin serves is never a return target: an `Href` is root-relative and `pageHref` answers only a page of its table, so the only tables to join are those of deployables whose pages this origin answers: a `client` one through `servedBy`, a `node` peer through forwarding (k.topology). A `static` deployable, or a `client` one without `servedBy`, is on another origin: to return to its pages, serve them from a `node` deployable (`servedBy`) (k.mount Origins).

### E1592
`identity.server.ts`, or a project file it imports (transitively, outside `node_modules`), importing a module's `routes` (`modules/<id>/routes.ts`, or a stdlib package's `./routes` export) where a `static` deployable, or a `client` one without `servedBy`, serves that module. At the import, in `keel check` and `keel build`. Message: `E1592 <id> pages are on another origin; a sign-in cannot return there`. Fix: none (the fix is a topology choice: `servedBy`, or moving the module).

An import is the check because a table can only reach `routeTable` through one: the generated entry builds the deployable's own table, and the only other source of a module's table is its `routes` export. The rule is independent of `identity.ts`, so a `handle` without a mount is covered too; with `identity.ts`, E1589 at the deployable and E1592 at the import both report, at different places.

### What each value is
- `pageHref` returns a root-relative `Href` built from the joined table, unchanged. In `keel dev` it resolves against the one dev origin; in a built `node` deployable against the origin the browser used for `handle` (`KEEL_ORIGIN` when set); in a shell, against the `servedBy` origin the sign-in runs on (k.return). No absolute URL is ever produced.
- A `node` peer whose table is joined is always configured in a build: a missing `KEEL_PEER_<NAME>` stops the server (E1560). Its page answers at this origin by forwarding.
- The return value travels as now: a `next` search key holding a root-relative path, set by a guard redirect (k.guards) or a page's own contract `href`; on the way back `handle.fn` reads it and writes `location` from `pageHref(joined, next)`, else a fallback `Href`.

### Threats
Each input an attacker controls, and why it cannot choose the destination:
- **`next` in the query.** `pageHref` refuses anything but one leading `/` (no scheme, no `//`, no `\`, no control character, no encoded slash, no dot segment) and builds the answer from a matched page; an absolute or protocol-relative `next` is `err`, and the handle writes its fallback.
- **The `Host` header and the request URL.** `location` is root-relative, so the browser resolves it against the origin it sent the request to; `KEEL_ORIGIN` replaces the request origin where it matters (k.deploy). No host value is copied into `location`.
- **`Origin` and `Referer`.** Not read for the return. A cross-site POST under `handle.path` is 403 before `fn` (k.mount Server).
- **A forwarded request** (`x-keel-forwarded`). A forwarded path never reaches `handle` (k.user), and the peer it reaches builds its own return from its own table.
- **Request body fields.** A `next` in the body takes the same `pageHref`; no body value is a URL Keel follows.
- **`KEEL_PEER_<NAME>` and `KEEL_ALLOW_ORIGINS`.** Operator-set, never read for a return: no declared origin becomes a `location`.

### Opt-in
A check rule only. An app with one origin or no identity source runs a rule that finds no `identity.server.ts` or no such import, ships no byte and sees no diagnostic.

## Alternatives
- **A typed cross-origin page reference.** `peerHref(peer, href)` resolves a page of deployable B against B's declared origin (`KEEL_PEER_<NAME>` in a build, the dev origin in `keel dev`) and returns an absolute `URL` brand; `pageHref(routes, next, { peers })` would accept `https://b.example/x` when the origin is declared and the path matches B's table. It is safe by construction (the origin comes from configuration, the path from a table) but it moves a person to an origin where the sign-in is not seen, so every use needs a second, library-owned cross-origin session step; it widens `Href` or adds a second link type to `ok`, `Link` and `navigate`; and `KEEL_PEER_<NAME>` is a server-to-server URL, often internal (`http://api:8080`), not the public origin the browser should get, so a second variable per peer would follow. Rejected for 1.0; recorded for `tasks/FUTURE.md` if an app needs it.
- **Refuse at runtime only** (`routeTable` or `createApp` throws for a foreign table). It needs the topology at runtime, which a module's table does not carry, and it fails in production where `keel check` could have said so.
- **Make `handle.fn`'s `routes` hold every page the origin answers** (its `servedBy` clients and forwarded peers). It removes the hand join but loads every peer's page modules into the identity deployable; noted, not taken, as it changes RFC 0207's argument and the example.
- **No rule, docs only.** A joined foreign table yields a wrong `location` silently.

## Spec diff
Applied in this commit.
- k.user (to `implemented` until its new clause is covered): two sentences in Identity source, E1592 in Rules, one Conformance clause (the last).
- Map: the k.user row reads `implemented`. E1592 is in the E155x block, which k.user already shares.
- Ledger: the new k.user clause at `none`, written by the orchestrator's regeneration (`ledger-fresh` lists it).
- No glossary term; no budget moves.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/check/conformance/identity-e1592-foreign-routes.test.ts`: the new k.user clause, fixtures built in the test; plus E1592 entries in `packages/check/conformance/fixtures-by-code.ts` if the code table requires every code to have a triggering and a clean fixture.
- No `pageHref` case changes: `https://…` and `//…` refusals are already k.router#18.

## Migration
None. No app is released.

## Token impact
- Spec: k.user grows by about 190 tokens; within the 3,100 section budget. The map is unchanged in size.
- `@keel/check`: one rule over the import graph `identity.server.ts` already has; the E1592 explanation adds to `@keel/check/explain` (re-base it in the build if it overruns).
- Skills: one line in `keel-server` (Identity) and one in `keel-deploy` (one public origin, `servedBy`).

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the new k.user clause. 3. Build:
- `packages/check`: the E1592 rule beside E1581's (`identity.ts` importer check) and E1589's, reusing its topology read; the code in the diagnostic registry and `@keel/check/explain`; `keel build` runs it as it runs E1581.
- Docs: `keel-server` skill (Identity: which tables to join), `keel-deploy` skill (one public origin; `servedBy` for a sign-in's pages), copied to `.claude/skills`; `@keel/server` README if it lists the identity rules; a changeset.
- No app or example changes: `examples/shell-mount` is the clean case, `examples/compose-peers` joins nothing.

## For the operator
1. **Cross-origin return is refused, not supported.** Recommended: refuse. The alternative is the typed peer reference above (an absolute URL brand from the peer's declared public origin); it is safe by construction but returns the person to an origin where they are not signed in, and needs a public-origin variable per peer. Reverse this if a target topology signs in on one origin and lands on another through a library's own cross-origin step.
2. **E1592 is an error, not a warning.** A joined foreign table always yields a `location` that names nothing on the origin it is read against.
