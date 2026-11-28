# ADR-0132: cli conformance test plumbing (RFC 0109)

**Status:** accepted (user for the decisions, orchestrator for the choices, 2026-11-17).

**Context.** Two cli conformance files start a real `keel dev` child. They probe it with the global `fetch` and leave response bodies unread, so undici keeps sockets to a child that may be starting or dying; one cli run failed on `setTypeOfService EINVAL` outside any test. They end the child with one `SIGTERM` and an unbounded wait, and one case never ends its child; `keel dev` children were found running after passing runs.

**Decision.**
- D1: an `rfc:0109` commit may change plumbing only in `dev-port-0091.test.ts` and `topology-keel-dev-one-origin.test.ts`: no assertion, `// Spec:` line or fixture changes.
- D2: each file's HTTP goes through a local `get` on `node:http`: no keep-alive, a 10 s socket timeout, a handled error, the body read to its end or destroyed.
- D3: each started child is tracked and ended in `afterEach` by process group, `SIGTERM` then `SIGKILL` after 10 s, and awaited; an `exit` hook kills any left.

**Alternatives.**
- `fetch` with body cancel and an abort signal: keeps undici's pool, the suspect.
- A shared helper file: couples two suites for a few dozen lines.

**Consequences.**
- No response body or client socket outlives its request in these files.
- A child outlives its test only when the worker itself is killed; `pnpm orphans` covers that case.
