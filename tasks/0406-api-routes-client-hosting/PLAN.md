# Task 0406: design RFCs for API routes (0385) and client hosting (0375)

**Spec:** k.router, k.topology, k.server, k.services (new: k.api, k.hosting) · **Principles:** 1, 2, 4, 5, 8 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** RFCs drafted, waiting on the user's answers

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

## Verification
- [x] `pnpm check` green with both RFC files
- [ ] user answers 0086 Open questions 1, 2 and 0087 Open questions 1 to 3
- [ ] RFCs marked accepted, answers recorded as decisions in each

## Next action
Record the user's answers in the two RFCs and mark them accepted. Then open the implementation task for 0086: ADR, spec text for k.api, conformance-writer from k.api, then router, server, check and scaffold, golden-1 and std-sessions migration. 0087 follows the same order.
