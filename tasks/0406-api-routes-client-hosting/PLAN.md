# Task 0406: design RFCs for API routes (0385) and client hosting (0375)

**Spec:** k.router, k.topology, k.server, k.services (new: k.api, k.hosting) · **Principles:** 1, 2, 4, 5, 8 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** closed (2026-11-11): RFC 0086 and RFC 0087 accepted

## Facts read before design (nothing run)
- `component` is required by `RouteDef`'s type only; no runtime or check rule reads it.
- `handle.ts` picks JSON by `accept: application/json`; `page.ts` returns loader results before rendering, so stub views never render for service calls.
- Stub views: golden-1 `BoardApi`, `SuggestionsApi`, `DigestApi`, `ActionApi`, `RefreshApi`; std-sessions `SessionsView` (two routes). `apps/sessions` `ops.home` is a real page in a `node` deployable.
- The client build is the project's `vite build` into `dist/`; only `node` deployables get `dist/<name>/`; `createApp` never serves `index.html`.
- `service({ module })` in a browser resolves to the document's origin; golden-1 uses `service({ base: location.origin })`.
- No CORS code in `@keel/server`; preflight 405, cross-origin write 403; caller cookie `SameSite=Lax`, host-only; `buildRequest` sets no `credentials`.
- k.router 1,501, k.topology 1,498, k.server 1,494, k.services 1,495, k.module 1,500 tokens: new text needs new sections.
- Codes reserved by accepted RFCs: E1563, W1564, E1570 to E1575. Free and used here: E1510, E1511, E1565, E1566, W1567.

## Decisions
- D1 two RFCs, 0086 (API routes) then 0087 (client hosting); 0087's allowed origins apply to `api: true` routes only, so 0086 lands first.
- D2 0086 recommends a tagged entry `api: true` inside `manifest()` over a separate declaration: one route table for the generated entry, spreads, path checks and `routes.json`. The user confirms the shape and the name.
- D3 0087 recommends: `dist/<name>/` for a `client` deployable; `KEEL_PEER_<NAME>` at build stamped as a `keel-peer` tag in `index.html`; `KEEL_ALLOW_ORIGINS` on the node side; the caller cookie unchanged with a same-site rule and W1567; `host: '<node>'` on the client deployable as the provided default.
- D4 new spec sections k.api and k.hosting hold the text; the four sections at the cap change by a pointer each, offset by rewording.

- D5 (user, 2026-11-11) 0086: tagged entry `api: true` chosen. In-entry verbs asked about and not taken (RFC 0086 D2 and Alternatives); the user may reopen it.
- D6 (user, 2026-11-11) 0087: `host` on the `client` deployable chosen.
- D7 0087 caller cookie: the user asked how other frameworks handle a cross-site SPA and API. Answer given: (a) Laravel Sanctum's cookie mode requires the SPA and API to share a top-level domain and points cross-site apps to API tokens; (b) Express or Koa with `cors({ origin, credentials: true })` and Rails or Django with their CORS packages need `SameSite=None; Secure` on the session cookie when cross-site, which Safari and Firefox block as a third-party cookie; (c) most cross-site SPAs skip cookies and send a bearer token in `Authorization`, kept in memory or `localStorage`; (d) Next, Remix and SvelteKit serve pages and API from one origin; (e) the common production fix is one domain, with a CDN routing API paths to the server. The caller cookie is an anonymous identity, not a login; a token path belongs to an auth stdlib module. Recommendation unchanged: same-site only with W1567. 
- D8 (user, 2026-11-11) 0087: same-site only accepted; the caller token goes to `tasks/FUTURE.md`.
- D9 (user rule, 2026-11-11) ideas outside the plans are built when the work in hand needs them, else they accumulate in `tasks/FUTURE.md` for after the beta release.

## Verification
- [x] `pnpm check` green with both RFC files
- [x] RFC 0086 accepted with the user's answers recorded
- [x] RFC 0087 `host` answer recorded
- [x] RFC 0087 accepted with the caller cookie answer recorded

## Next action
None here. Implement RFC 0086 in a fresh context (ADR, k.api spec text, conformance-writer, router, server, check, scaffold, golden-1 and std-sessions migration, reviewer and red-team), then RFC 0087 the same way.
