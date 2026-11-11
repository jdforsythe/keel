# Task 0375: client hosting (RFC 0087)

**Spec:** k.hosting (new), k.topology, k.server, k.services · **Principles:** 1, 2, 5, 8 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open

## Decisions
- D1 the spec text is RFC 0087's proposal as accepted (user D1 `host`, D3 same-site caller cookie); no shape is added here.
- D2 size budgets are re-based after the kernel change with measured bytes in the commit (WORKFLOW RFC default 7).

- D3 golden-1's client calls `service({ module: 'api' })` as RFC 0087's Migration says; that needs `todos` to depend on `api`, so the shared schemas move into `api` and the dependency flips (api owned `deps: ['todos']`, a cycle otherwise, E1153). Made without the user (away); listed in HANDOFF.
- D4 k.hosting also states: an origin is its own serialization with a trailing `/` allowed; a path under `/assets/` stays 404 on a host.

## Steps
- [x] 1 ADR-0110, k.hosting spec text, pointers in k.topology, k.server, k.services, map row
- [x] 2 conformance-writer: `packages/server/conformance/hosting-0087.test.ts`
- [x] 3 kernel: compiler and cli (`dist/<name>/` for a `client` deployable, `keel-peer` tag, E1565, copy into the host), server (`allow`, `KEEL_ALLOW_ORIGINS`, W1567, `host` document fallback, E1566), services (peer origin in a browser, `credentials`), scaffold (CI job, deploy files), check (E1566, explain rows)
- [ ] 4 migration: golden-1 and golden-2 `host`, `service({ module })` in golden-1's client, READMEs, `docs/guide/deploy-client.md`, `docs/guide/build-golden-1.md`, `docs/THREAT-MODEL.md`
- [ ] 5 reviewer and red-team; findings to the backlog
- [ ] 6 spec status, changeset, ledger, budgets, backlog, handoff

## Verification
- [ ] `pnpm check` green
- [ ] `pnpm test` green, `hosting-0087` conformance included
- [ ] `pnpm build` green; evals `golden-1-api` and `golden-2` converge
- [ ] ledger not lowered, 0 uncovered; unsafe count unchanged or justified
- [ ] `node dist/api/server.mjs` of golden-1 answers `GET /` with the app

## Next action
Step 4 (golden-1 schema move running) and step 5 (reviewer and red-team running); then one kernel fix pass (`/assets/` 404 on a host is known), ledger, backlog, handoff, push.
