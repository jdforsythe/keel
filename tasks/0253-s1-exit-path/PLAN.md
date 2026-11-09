# Task 0253 + 0251 + 0256: S1 exit path

**Spec:** std.sessions (upload origin, recorder lifetime) · k.reactive (detached scope) · k.module / k.ctx (client start) · **Gate:** S1 exit · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-09)

## Deliverables
- [ ] 0253 uploads are same-origin: spec and READMEs say so; an app that records mounts `@keel/std-sessions/routes` in its own node deployable and the Action's `url` is that app (one way; no cross-origin upload, no forwarder)
- [ ] 0251 the recorder outlives the component that called `record`: a detached scope owned by the ctx (kernel, RFC); a failed upload never becomes an uncaught page error
- [ ] 0256 first-load errors are recorded: design in the RFC; the API shape goes to the user before implementation if it is a new hand-written surface

## Steps
1. [ ] One opus agent: rfc:0074 + ADR-0063 (0251 kernel change, 0253 text, 0256 proposal), conformance, implementation of 0251 and 0253; 0256 implemented only if it needs no new user-facing API.
2. [ ] Root checks; reviewer + red-team; commit; push.
3. [ ] User: pick a host for apps/sessions; deploy; live run.

## Decisions
- D1: 0253 is answered by the existing way: the recording app serves its own ingest routes (E2005 already requires node). A central multi-app ingest service is out of scope for S1.

## Verification
- [ ] `pnpm check`, `pnpm test` green; ledger 0 lowered, 0 uncovered; unsafe 6

## Next action
Wait for the agent; integrate; reviewer + red-team.
