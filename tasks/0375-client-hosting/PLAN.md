# Task 0375: client hosting (RFC 0087)

**Spec:** k.hosting (new), k.topology, k.server, k.services · **Principles:** 1, 2, 5, 8 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open

## Decisions
- D1 the spec text is RFC 0087's proposal as accepted (user D1 `host`, D3 same-site caller cookie); no shape is added here.
- D2 size budgets are re-based after the kernel change with measured bytes in the commit (WORKFLOW RFC default 7).

## Steps
- [x] 1 ADR-0110, k.hosting spec text, pointers in k.topology, k.server, k.services, map row
- [ ] 2 conformance-writer: `packages/server/conformance/hosting-0087.test.ts`
- [ ] 3 kernel: compiler and cli (`dist/<name>/` for a `client` deployable, `keel-peer` tag, E1565, copy into the host), server (`allow`, `KEEL_ALLOW_ORIGINS`, W1567, `host` document fallback, E1566), services (peer origin in a browser, `credentials`), scaffold (CI job, deploy files), check (E1566, explain rows)
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
Steps 2 and 3 run together: conformance-writer and the kernel agent.
