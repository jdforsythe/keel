# RFC 0186: k.guards Client: a guard in a `client` deployable or a shell learns the reader from one read per session

Status: accepted (ADR-0208). From scenario finding S3-2 (`tasks/p1/scenario3-findings.md`). Builds on RFC 0185 (the harness's cookie jar), which its testing clause uses.

## Decisions
- D1: a `node` deployable with an identity source answers `GET /__keel/user` with `{ user }`, `identify`'s answer for that request, and `cache-control: no-store`. It needs `x-keel: 1`, which a page on another site cannot send without a CORS preflight the server never grants; without it, 403 `keel.denied`. With no identity source the path is the route table's 404. An `identify` throw, bad answer or timeout answers as k.user says (500, 503).
- D2: a `client` deployable's router whose modules import `identity.ts` (the same test `shellMount` and the mount table use) reads that entry from its page's origin: once before its first guard runs, and again after each mount request's answer in a shell, before it acts on the redirect. A guard that runs while a read is in flight waits for it. In a browser a sign-in or out through the mount is a document navigation, so the new document's router reads it then; a shell stays on one document, so the mount answer is the moment.
- D3: the router's guards, loaders and actions get that `user`. Before any answer, after a failed fetch and after an answer other than 200 it is `''`. A router with no `identity.ts` sends nothing and `user` is `''`, as now.
- D4: the client's `user` is navigation convenience, never authority. The router holds it in memory only: never `ctx.storage`, a log, a URL or a std.sessions recording. Each API the page calls runs its own guards on its own `identify`. A guard that lets a stale reader through costs one denied API call; one that redirects a reader who signed in elsewhere costs one detour.
- D5: a sign-in or out the router does not take part in (an API route of the app's that revokes a session, another tab, a session expiring on the server) shows at the next document load or mount answer. No polling, no event, no API to refresh.
- D6: under `renderRoute`, the `user` option stands for the answer and no GET is sent. Without it the router reads the entry through the harness's net as in production: in shell mode through the cookie jar (RFC 0185), so S3-1's round trip shows a signed-in guard after the mount's 303.
- D7: k.guards goes from `conformance-covered` to `implemented` until clauses 4 to 7, in the ledger at `none`, are covered. Nothing becomes `frozen`.

## Problem
`examples/shell-mount` (on `lane-scen3`) has a guarded note page in a `client` deployable with `shells.tauri`. The guard household writes for a `node` page, `user === '' ? err(...) : ok(null)`, always redirects there, because k.user gives `''` "on a `client` deployable" and k.guards gives `''` when "client-only". So the example's guard calls `meApi.me({}, ctx)`, the app's own `GET /api/me`, on every guarded navigation. Each author of a client or shell app writes that call, its failure handling and its cost: one round trip per navigation, and none of it is in a skill.

As specified, then: no section says how a guard on a page a `client` deployable or a shell serves learns who is signed in. golden-2's `web` (a `client` deployable, `servedBy: 'api'`) has no guard that needs the reader; its `cook` guard reads `ctx.storage`. golden-1 has a shell and one guard, `editable`, which does not read the user.

What the client can know: in a browser the session cookie is `HttpOnly` and on the server's origin; in a shell it is in the native cookie store (k.shell), which page code cannot read. The only party that can say who the reader is, is `identify` on the `node` deployable that mounts `handle`, the same origin the page reaches (k.mount Origins).

## Proposal
k.guards gains a **Client** paragraph (D1 to D6) and four clauses. k.user's identity source runs for `/__keel/user` and its User paragraph points a `client` deployable's `user` at k.guards Client. k.return's mount answer is followed by a fresh read.

For an app author, the guard a `node` page uses works on a `client` page and in a shell, unchanged:
```ts
export const signedIn = guard({ redirect: "notes.signin" }, async ({ user }) =>
  user === "" ? err({ code: "keel.denied", message: "sign in first", data: null }) : ok(null),
);
```
The app writes no `/api/me` for its guards, and the client sends one `GET /__keel/user` per document (and per sign-in or out in a shell), not one per navigation. The API routes the page calls keep their own guards.

## Alternatives
- **Status quo, with a documented pattern** (a guard calls the app's own "me" route; the skill shows it with a cache in a module store). Rejected: it keeps the call per navigation or moves cache invalidation onto every author, and the guard a `node` page uses still cannot move to a `client` page.
- **A user hint the identity seam hands the client, signed and not secret** (a JS-readable cookie, a `<meta>` in the served `index.html`, or a header on each answer). Rejected: the client holds no secret, so it cannot check a signature, and signing adds nothing to a value that grants nothing on the client. A cookie Keel sets breaks k.mount's "Keel sets no cookie on a `handle` response" and k.user's "never writes a credential"; a shell cannot read the native store from page code; `index.html` is bundled in a shell and served by a static host for a `client` deployable without `servedBy`; and `x-keel-user` is never sent to a browser (k.user User header).
- **The app names a contract method that answers the user** (`identityMount(path, { user: api.me })`), read by the router as D2 says. Rejected: the same read and refresh rules, plus app code and a new option for what `identify` already answers.
- **A read before every navigation** (the kernel does what the example does). Rejected: it is the cost S3-2 names.
- **A client-side session store the router persists** (so an offline shell starts signed in). Rejected: it keeps a user id in `ctx.storage`, outside k.privacy's reach, and grants nothing the API would honour.

## Spec diff
Applied in this commit:
- **k.guards** (`implemented`, D7): the `caller` and `user` sentence points a `client` deployable at Client; a **Client** paragraph; Conformance gains clauses 4 to 7.
- **k.user**: Identity source: `identify` runs for `/__keel/user` (k.guards Client), never for other `/__keel/*` paths. User: on a `client` deployable, `user` is k.guards Client's.
- **k.return**: Mount requests: after reading the answer's status and `location`, the router reads `user` again before it acts on them.
- **Map**: the k.guards row reads `implemented`.
- **Ledger**: `k.guards#4` to `#7` at `none`.

## Conformance diff
By the `conformance-writer`, under `rfc:0186`, from the spec text alone:
- k.guards 4 (`packages/server/conformance/`): `createApp` with `identify` answering `'u1'`: `GET /__keel/user` with `x-keel: 1` is 200 `{ "user": "u1" }` with `cache-control: no-store`, one `identify` call; without `x-keel: 1`, 403 `keel.denied` and `identify` uncalled; with no identity source, 404.
- k.guards 5 (`packages/router/conformance/`): a client router over a module that imports `identity.ts`, its sim net answering `/__keel/user` with `'u1'`: a guard on the first navigation and on a second gets `'u1'`, and the net saw one GET. Answered 500, or the fetch rejecting: `''`. A router over modules that import no `identity.ts` sends no GET, and its guard gets `''`.
- k.guards 6 (`packages/testing/conformance/`): under `renderRoute(id, { routes, shell: true, ctx })`, `ctx.net` routing the origin to a `createApp` whose `handle` answers a mount `Form` POST 303 to a page guarded by `user !== ''`, with `set-cookie: s=1`, and whose `identify` answers `'u1'` for a request carrying `s=1`: a second `/__keel/user` GET carries `s=1`, and the target page renders without a redirect.
- k.guards 7 (`packages/testing/conformance/`): `renderRoute(id, { routes, user: 'u1' })` over a module that imports `identity.ts`: its guard gets `'u1'`, and no `/__keel/user` GET is sent.
Spec topics: `pnpm spec k.guards`, `pnpm spec k.user`, `pnpm spec k.return`; for context `pnpm spec k.mount`, `pnpm spec k.shell`, `pnpm spec k.server`.

## Build
- `@keel/server`: answer `GET /__keel/user` beside `/__keel/csp`, through the same `identify` call path (`userOf`), only when an identity source is given.
- `@keel/router`: in the client router, a user cell per router: started at router start when the identity mounts table is not empty, awaited by guard runs, reset by `mountRequests` after each answer and before it acts; `user` handed to guards, loaders and actions from it.
- `@keel/testing`: with `user`, the cell is set and no read starts; RFC 0185's shell front carries the read.
- `examples/shell-mount`: `signedIn.guard.ts` reads `user`; `meApi.ts` stays for the note page if it needs it, else goes. S3-1's tests (RFC 0185) assert the guard after sign-in.
- Docs: keel-client and keel-server (guards on a `client` deployable, what the client `user` is and is not), keel-testing (tests that count requests see one `/__keel/user` GET per router start).
- Existing router-mode tests that assert every request a page sends, over a module importing `identity.ts`, gain the one GET, or pass `user`.

## Known limits
- An app whose `identify` reads a bearer token the app attaches per call (k.services `bearer`, a shell's secure-storage plugin) gets `''` from the router's read, which carries cookies only; its guards keep calling its API with the token.
- An offline shell starts with `user` `''` until the read succeeds, so a guard redirects to sign-in; an app that wants offline pages guards them otherwise.
- `user` reaches the page as `identify` answers it, often an email: page script on that origin can read it, as it can read any loader's output.

## For the operator
- What an app author sees changes: on a `client` deployable and in a shell, a guard's (and a loader's or action's) `user` is the signed-in reader instead of always `''`, and a `client` app with `identity.ts` sends one `GET /__keel/user` per document load and per mount answer. The guard a `node` page uses now works on a client page.
- A new kernel entry, `/__keel/user`, exposes `identify`'s answer to same-origin page script. Keel still reads, writes and stores no credential; the answer is the user id the app's own source returns. It rests on a client never authorizing: the spec says so in D4's words, and the API still guards. The kernel, not a std package, owns the entry.
- `identify` runs once more per session (per document in a browser).

## Migration
None: unreleased.

## Token impact
k.guards 1,495 to 3,576 characters. k.user 7,367 to 7,420 and k.return 5,274 to 5,320 (on RFC 0185's text). All within the 1,875-token section budget.
