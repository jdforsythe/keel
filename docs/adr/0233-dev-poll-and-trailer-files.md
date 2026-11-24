# ADR-0233: `keel dev` polls under `KEEL_DEV_POLL`; each trailer states what `files` counts (RFC 0211)

**Status:** accepted (orchestrator, 2026-11-24, for the operator to confirm).

**Context.** `keel dev` turned on Vite's polling watcher when `CHOKIDAR_USEPOLLING` was set, with no spec sentence; the cli suite depends on it because this machine drops file events, and containers and network file systems do too. The `check` and `build` trailers both print `files` and count different sets, with no sentence for either.

**Decision.**
- `keel dev` reads `KEEL_DEV_POLL` at start: `1` passes Vite `server.watch` `usePolling: true` and `interval: 100` over the project's own `server.watch`; unset, empty or `0` passes nothing; any other value is one E1560 naming the key, no server, exit 1. Keel reads no `CHOKIDAR_USEPOLLING`; the cli suite sets `KEEL_DEV_POLL=1`. The clause sits in k.topology beside Local topology.
- `keel check`'s `files` counts every file it checked: code files and `.keel/*.json` artifacts under `paths`, tests, declarations and tool configs among them (k.check Trailer).
- `keel build`'s `files` counts the root project's app sources, the files its `.keel/` artifacts derive from (k.deploy Build).

**Alternatives.**
- Keep the watcher's own variable, or remove the behaviour and route the suite through a fixture's Vite config: a third-party name in Keel's spec, or no switch for a person in a container.
- An interval as the value; one count for both trailers; the text in k.cli, whose `keel docs k.cli` case caps it at 1,500 tokens.

**Consequences.** A shell that exported `CHOKIDAR_USEPOLLING` for Keel sets `KEEL_DEV_POLL=1` instead. `KEEL_DEV_POLL=true` fails `keel dev` at start. k.check and k.deploy read `implemented` until their new clauses are covered.
