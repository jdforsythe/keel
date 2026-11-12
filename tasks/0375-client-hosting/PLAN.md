# Task 0375: client hosting (RFC 0087)

**Spec:** k.hosting (new), k.topology, k.server, k.services · **Principles:** 1, 2, 5, 8 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** closed (2026-11-12)

## Decisions
- D1 the spec text is RFC 0087's proposal as accepted (user D1 `host`, D3 same-site caller cookie); no shape is added here.
- D2 size budgets are re-based after the kernel change with measured bytes in the commit (WORKFLOW RFC default 7).

- D3 golden-1's client calls `service({ module: 'api' })` as RFC 0087's Migration says; that needs `todos` to depend on `api`, so the shared schemas move into `api` and the dependency flips (api owned `deps: ['todos']`, a cycle otherwise, E1153). Made without the user (away); listed in HANDOFF.
- D4 k.hosting also states: an origin is its own serialization with a trailing `/` allowed; a path under `/assets/` stays 404 on a host.

## Steps
- [x] 1 ADR-0110, k.hosting spec text, pointers in k.topology, k.server, k.services, map row
- [x] 2 conformance-writer: `packages/server/conformance/hosting-0087.test.ts`
- [x] 3 kernel: compiler and cli (`dist/<name>/` for a `client` deployable, `keel-peer` tag, E1565, copy into the host), server (`allow`, `KEEL_ALLOW_ORIGINS`, W1567, `host` document fallback, E1566), services (peer origin in a browser, `credentials`), scaffold (CI job, deploy files), check (E1566, explain rows)
- [x] 4 migration: golden-1 and golden-2 `host`, `service({ module })` in golden-1's client, READMEs, `docs/guide/deploy-client.md`, `docs/guide/build-golden-1.md`, `docs/THREAT-MODEL.md`
- [x] 5 reviewer and red-team; findings to the backlog
- [x] 6 spec status, changeset, ledger, budgets, backlog, handoff

## Verification
- [x] `pnpm check` green
- [x] `pnpm test` green, `hosting-0087` conformance included
- [x] `pnpm build` green; evals `golden-1-api` and `golden-2` converge
- [x] ledger not lowered, 0 uncovered; unsafe count unchanged or justified
- [x] `node dist/api/server.mjs` of golden-1 answers `GET /` with the app

## Outcome
- D5 k.hosting is `implemented`, not `conformance-covered`: clause 2's `service({ module })` half has package tests and no conformance assertion (backlog 0423).
- D6 the reviewer requested two changes (a bad `allow` entry throws E1560; `/assets/` stays 404 on a host), both applied; red-team 0419 to 0422 fixed in the batch; 0423 to 0431 filed.
- D7 the fix pass made `@keel/server` import a function that parsed `topology.ts`, which put `oxc-parser` in `dist/<name>/server.mjs`; split into `hostProblems` (server) and `hostLiteralProblems` (build, check), with `packages/server/test/productionEntryBundle.test.ts`.
- D8 golden-1: the eight contract schemas live in `api`; `todos` has `deps: ['api']`; the client calls `service({ module: 'api' })`.
- Trailers: `ok check 57 tasks`, `ok test 56 tasks`, `ok build 32 tasks`, `ok ledger --diff 640 items, 628 verified, 7 unsafe, 0 warnings, 0 lowered, 0 uncovered`; evals `golden-1-api` and `golden-2` converged (runner none). Smoke: golden-1 `dist/api/server.mjs` started from another directory on port 4183: `GET /` 200 html, `/api/lists` 200 json, `/assets/missing.js` 404, `/no/such/page` 200 html.
- Not run: mutation on server, compiler, check, services; Docker and compose; a real static host; a real browser against the built app; the `KEEL_PEER_API` split end to end.

## Next action
None here. Next: the rest of 0374-0386 and 0392-0400 (`tasks/BACKLOG.md`).
