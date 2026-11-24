# RFC 0211: `keel dev` polls under `KEEL_DEV_POLL`; what `files` counts in the `check` and `build` trailers

Status: accepted (ADR-0233), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Amends k.topology (Dev watcher, Conformance), k.check (Trailer, Conformance), k.deploy (Build, Conformance), the map. From backlog 1057 and 1059.

## Decisions
- D1: `keel dev` polls for file changes when `KEEL_DEV_POLL` is `1`: it passes Vite `server.watch` `usePolling: true` and `interval: 100` over the project's own `server.watch`. Unset, empty or `0`: Keel passes no `server.watch`. Any other value: one E1560 naming the key, no server, exit 1.
- D2: `keel dev` reads no `CHOKIDAR_USEPOLLING`. The cli suite sets `KEEL_DEV_POLL=1`.
- D3: the two trailers keep counting different things, and each command's section says what its count is: `keel check` counts every file it checked (code files and `.keel/*.json` artifacts, tests and tool configs among them); `keel build` counts the root project's app sources, the files the `.keel/` artifacts derive from.
- D4: the clauses go in k.topology (Local topology's neighbour), k.check and k.deploy, not k.cli: k.cli's own conformance caps `keel docs k.cli` at 1,500 tokens, and the section is at about 1,495.

## Problem
1057. `keel dev` passes Vite `server.watch: { usePolling: true }` when `CHOKIDAR_USEPOLLING` is set and is not empty, `0` or `false` (`packages/cli/src/internal/viteServer.ts`). No spec sentence says so. The cli suite depends on it (`packages/cli/vitest.config.ts`): this machine's file-event service drops events, and a dev test that waits for a reload after an edit then waits forever. Containers with bind mounts and network file systems drop events the same way, so a person needs the switch too. The variable is the watcher library's name, read by Keel, with a truthiness rule nobody wrote down; every other variable a Keel process reads is `KEEL_*` (`KEEL_DEV_DIR`, `KEEL_INSPECT_ORIGINS`, `KEEL_SECRET`, `KEEL_PEER_<NAME>`).

1059. Both trailers print `files`. `keel check` counts each code file and `.keel/*.json` artifact under `paths`, tests and config files included (`checkCommand.ts`). `keel build` counts the root project's files that `isSourcePath` accepts (`buildCommand.ts`), the rule the `.keel/` artifacts derive from: no test, declaration or tool config, no file under a skipped or dot folder, none of a nested project. On one tree the two numbers differ and neither section says why. docs/OUTPUT.md says only that a trailer carries counts.

## Proposal
### Dev watcher (k.topology)
`keel dev` reads `KEEL_DEV_POLL` once at start, in its own process.
- `1`: Vite's inline config gets `server.watch` `{ usePolling: true, interval: 100 }`. Vite merges the inline config over the project's, so these two keys win and the project's other `server.watch` keys (`ignored`, `binaryInterval`) stay. 100 ms is the watcher's own default interval, quick enough for an edit-reload loop on one app.
- Unset, empty or `0`: no `server.watch` is passed; the project's Vite config decides, as it does for every other watcher setting.
- Any other value (`true`, `yes`, `2`, ` 1`): one E1560 naming `KEEL_DEV_POLL` and not the value, no port opened, exit 1. E1560 is the code `keel dev` already uses for a port in use and `server.mjs` for a `DeployEnv` value it cannot read; a value that is not one of three exact forms is a mistake to show, not to guess at.

E1007 is not touched: the value is read by the CLI process only, no browser file reads it, and a one-character value is below k.bundle's 8-character `environment value` floor in any case.

### Trailer counts
- k.check gains **Trailer**: the summary's `files` counts every file `keel check` checked: each code file (`*.ts`, `*.tsx`, `*.mts`, `*.cts`, `*.js`, `*.jsx`, `*.mjs`) and `.keel/*.json` artifact under `paths`, in every project there, tests, declarations and tool configs among them.
- k.deploy's Build gains: the summary's `files` counts the root project's app sources, the files its `.keel/` artifacts derive from: each code file outside a nested project root (k.topology) that is not a test, a declaration or a tool config, and has no path segment that starts with `.` or is `node_modules`, `dist`, `coverage`, `reports`, `test`, `tests` or `conformance`.

Each number answers its own command's question: how much did the check read, how much did the build compile. A reader comparing them sees why they differ.

## Alternatives
- Keep `CHOKIDAR_USEPOLLING`: a third-party name read by Keel, a truthiness rule to document, and a watcher detail Keel's spec would then own across Vite upgrades. Rejected.
- Remove the behaviour and have the cli suite pass polling through a test fixture's `vite.config.ts`: covers the suite but leaves a person in a container with a hand edit to every app's Vite config. Rejected.
- `KEEL_DEV_POLL=<ms>` as the interval: a second knob nobody asked for; a project that wants another interval sets `server.watch` itself with the variable unset.
- Make both trailers count the same set: either `check` would stop counting the tests and artifacts it checks, or `build` would count files it never compiles. Rejected.
- Put the clauses in k.cli: breaks k.cli's `<= 1,500 tokens` case; raising that cap trades a budget agents rely on for two paragraphs that fit where their commands are already described.

## Spec diff
- `spec/kernel/k.topology.md`: **Dev watcher** paragraph after Local topology; Conformance k.topology#16 and #17.
- `spec/kernel/k.check.md`: **Trailer** paragraph after Flags; Conformance k.check#14. Status `implemented` until it is covered.
- `spec/kernel/k.deploy.md`: one sentence at the end of Build; Conformance k.deploy#13. Status `implemented` until it is covered.
- `spec/00-map.md`: k.check and k.deploy rows read `implemented`.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/cli/conformance/topology-dev-poll-0211.test.ts`: k.topology#16 and #17.
- `packages/cli/conformance/check-trailer-files-0211.test.ts`: k.check#14.
- `packages/cli/conformance/build-trailer-files-0211.test.ts`: k.deploy#13.

## Migration
None. Nothing is released.

## Token impact
- Spec: k.topology grows by about 210 tokens, k.check by about 200, k.deploy by about 200. k.cli unchanged. The map is unchanged in size.
- No new code, no `explain` entry.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the four bullets. 3. Build:
- `packages/cli/src/internal/viteServer.ts`: read `KEEL_DEV_POLL`; `1` gives `{ usePolling: true, interval: 100 }`; another value other than empty or `0` is E1560 before `createServer`. Its unit test `packages/cli/test/viteServer.test.ts` and `packages/cli/test/mutation-io-bin.test.ts` follow.
- `packages/cli/vitest.config.ts`: `KEEL_DEV_POLL: '1'` in place of `CHOKIDAR_USEPOLLING`.
- The trailer counts need no code change; the conformance confirms them.
- Docs: the `keel-deploy` skill's `keel dev` lines and the `@keel/cli` README name `KEEL_DEV_POLL`; a changeset; `tasks/BACKLOG.md` 1057 and 1059; the active plan's D110.

## For the operator
1. **A Keel name, `KEEL_DEV_POLL`, with `1` the only value that turns polling on.** Recommended: yes; it follows every other variable a Keel process reads, and a strict value is an error you see.
2. **A fixed 100 ms interval, project's other watcher keys kept.** Recommended: yes; a project needing another interval sets `server.watch` itself.
3. **The trailers keep different `files` counts, each stated in its command's section.** Recommended: yes.
4. **The text sits in k.topology, k.check and k.deploy rather than k.cli**, to keep `keel docs k.cli` under its 1,500-token cap.
