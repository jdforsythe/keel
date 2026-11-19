# Future features

Ideas that come up outside the current plans. An idea is built at once only when the work in hand needs it; otherwise it waits here and the list is worked after the beta release, before 1.0 or after it. An idea taken up moves to `tasks/BACKLOG.md` with an id. Each line: the idea, where it came from, what it would need. A line that names a backlog id is also tracked there.

## Routing and server
- A caller token for cross-site clients: the server returns the caller token in a response header, the client keeps it and sends it in a request header, so a `client` deployable on a static host that is cross-site to its API keeps one caller. RFC 0087 D3. Needs a decision on where the client stores a token that `HttpOnly` withholds today; fits an auth stdlib module.
- Serve API handlers from the `@keel/services` `endpoints` schema: one schema per API, handlers typed from it, E1561 and E1562 gone. RFC 0086 Alternatives. Replaces `loader` and `action` for JSON; a stage of its own.
- In-entry verbs for API routes (`{ path, GET, POST }`). RFC 0086 D2. Needs an answer to the circular initializer of ADR-0052.
- Per-route document titles, a custom icon or extra head links, and serving all of `public/` in production. RFC 0078 Open questions; backlog 0305 (user decisions).
- Params passed to `errorElement`. RFC 0079 Known limits. Waits for a k.router split.
- A locale picked from `Accept-Language`. RFC 0079 Known limits. Needs request headers in loaders.
- `service({ module })` GET results without the `{ id, results }` envelope. Backlog 0339. Needs an RFC amendment.
- Invalid search values answered with 422 instead of defaults. Backlog 0275.
- A cap on concurrent event streams. Backlog 0364.
- A broker for stream and channel fan-out across replicas. RFC 0081 and RFC 0085 Known limits.
- An optimistic client view with log entries replicated to clients. RFC 0081 Alternatives. Needs a generic apply endpoint and client rebase rules.
- More conflict policies (`last-writer`, path-level `merge`, `first-writer`). RFC 0081 Alternatives. Needs a state diff per write.
- Channel messages resumed for members that were disconnected. RFC 0081 Known limits.
- Jobs declared at the route level (`routes.jobs`). RFC 0080 Alternatives.

## Data and storage
- Secrets through `ctx` for app-owned API tokens. RFC 0080 Known limits.
- An append-only audit table past `logLimit`. RFC 0085 Alternatives. Needs a retention schema, since it keeps personal data.
- Derived migrations for computed state changes. RFC 0085 Known limits.
- Workflows sharded past one snapshot. RFC 0085 Known limits.
- Encryption at rest in std.db. RFC 0085 D7.
- Storage compare-and-set for jobs and ingest on several replicas. RFC 0080 and RFC 0070 Known limits; backlog 0370.
- Locale-aware money input parsing (`12,50 €`). RFC 0079 Known limits.
- Temporal extras: `PlainTime`, `inZone`, `addDuration`, `between`. RFC 0079 Alternatives.
- Right-to-left locales. RFC 0079 Known limits. Needs a `dir` rule in k.ui.
- Nested and parallel statechart states, with history. RFC 0082 Alternatives.
- Collaborative text editing (a CRDT or a hierarchical model). RFC 0081 Alternatives.

## UI
- Virtual rows for tables. RFC 0084 D3; `aria-rowcount` and `aria-rowindex` are kept so it can be added.
- Popup, menu and toast placement by anchor. RFC 0084 Known limits. Waits for CSS anchor positioning in every supported engine.
- Widget patterns not shipped: grid, treegrid, tree, slider, radio group, menubar, submenus, date picker, Listbox range selection, manual tab activation, toast actions. RFC 0084 Known limits.
- Several tables per route with their own query state. RFC 0084 Known limits.
- Accent-folding typeahead and hover-pause on toasts. RFC 0084 Known limits.
- App icons for the shells generated from the brand mark. RFC 0085 Known limits.

## Services
- Retries, caching, auth with token refresh, and interceptors, as stdlib modules. k.services Not here.
- `@keel/std-streams` (topics, replay by id, reconnect). RFC 0080 D5; live loaders and std.channels cover the present need.

## Tooling
- Real browser sessions merged into multi-user groups. RFC 0081 Known limits. Needs server-side ordering.
- State-space reduction and cross-store model checking. RFC 0082 Known limits.
- Network faults past delay and the four listed (partial bodies, duplicate delivery). RFC 0082 Known limits.
- Plan schemas for std.geo and the `session` capability. RFC 0082 Known limits.
- Firefox in the browser gate. RFC 0083 Known limits.
- A programmatic entry to start `keel dev` from a test. Backlog 0346.
- `keel dev` flags and module replacement in place of a full reload. Backlog 0377, 0400.

## Deploy and platforms
- A `client` deployable served under a path prefix (a `base` option). RFC 0087 Known limits.
- Several `client` deployables on one host, and a CDN cache in front of a `node` deployable. RFC 0087 Known limits.
- Deploy files per static host (bucket policy, `_redirects`). RFC 0087 Alternatives.
- Build settings per deployable (base image, registry, replica count), registry push, and deploy order in generated CI. RFC 0080 Known limits.
- Signing, notarization and store upload for shell artifacts. RFC 0085 D4.
- Windows CI builds and automated replay on iOS and macOS. RFC 0085 Known limits.
- A Postgres service in generated compose. RFC 0085 D5.

## Security
- Extra CSP origins (a CDN, analytics). RFC 0083 Proposal.
- A served or meta CSP for `client` and `static` deployables. RFC 0083 D6.
- Sigstore or another third-party signer, and a CSP report service. RFC 0083 D3.
- Redaction of copied or derived personal data. RFC 0083 and RFC 0073 Known limits; backlog 0257.
- A secret per deployable, so one leak does not forge callers everywhere. Backlog 0353.
- Envelope encryption under a key read from the environment, for a credential the app must present later (an OAuth refresh token, a pasted API key); today such a value is written only from a file under `unsafe/`.
- A types mode for E1112, so the rule reads a payload field's schema and follows a value into a helper's parameter. Built only if an app needs it: a rule that reports differently by mode is harder to predict than either mode alone.
- `Number.MAX_SAFE_INTEGER` and `Number.MIN_SAFE_INTEGER` in `prove`'s fragment, so a guard can name the edge instead of a schema `max`.
- An app-chosen token prefix as a second `std` key of `@keel/std-tokens`; today every token starts `keel_`.
- `prove` from any thread: Z3 in a child process that `prove` starts, so a runner on worker threads can prove; today a worker call is refused (E1721). Costs a process start and a serialised query per call.
- A static rule for E1256: `keel check` reports a `tx` reached from a `*.server.ts` loader, guard or action whose transaction is bound to a module-level store, across imports (as `refreshView.ts` and `hydrate.ts` sit two files from the loader). Today the check is at run time only.
