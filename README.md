<p align="center">
  <img src="docs/brand/keel-logo-lockup.svg" alt="Keel" width="320" />
</p>

# Keel

Keel is a full-stack web framework whose primary author is a coding agent. It has 21 packages under `packages/` (15 kernel, 6 `std-*`); `tooling/ledger/ledger.json` lists 225 spec clauses: 63 have property tests, 147 have example tests, and 15 have no test yet. It records 6 `unsafe` uses. Of the 25 spec sections under `spec/`, 19 carry the status `conformance-covered`, 5 are `implemented` (one clause each still short of the strict verdict, backlog 0138), and 1 is `proposed`. `keel ledger --diff` fails the build if a covered section ever has an untested clause (E1707). Status: pre-0.1, nothing is stable. The brand and voice rules are in `docs/BRAND.md` and `docs/VOICE.md`.

## Start here

Read order for an agent on a fresh start: `docs/HANDOFF.md`, `docs/PRINCIPLES.md`, `docs/GLOSSARY.md`, `docs/ARCHITECTURE.md`. Load the `keel-architecture` skill, then run `/resume`. Retrieve spec and ADR sections with `pnpm spec <topic>` instead of reading `spec/` or `docs/adr/` whole.

Commands: `pnpm check` · `pnpm test` · `pnpm build` · `pnpm eval` · `pnpm spec <topic>`. Each prints compact structured output (`docs/OUTPUT.md`); pass `--format=pretty` for a human.

First run: `pnpm install && pnpm check`.

## Documents

- [docs/VISION.md](docs/VISION.md): what Keel is for.
- [docs/PRINCIPLES.md](docs/PRINCIPLES.md): the rules every change is judged against.
- [docs/BRAND.md](docs/BRAND.md): palette, type, layout, voice rules.
- [docs/VOICE.md](docs/VOICE.md): how every sentence is written; enforced by `tooling/voice-lint.mjs`.
- [docs/ROADMAP.md](docs/ROADMAP.md): milestones and exit criteria.

## Golden apps

- [apps/golden-1](apps/golden-1/README.md): a todo app with a client deployable (`web`) and a node API (`api`, port 4181).
- [apps/golden-2](apps/golden-2/README.md): a recipe box with the same two deployables (API on port 4191).

To run one, from its directory (`apps/golden-1` or `apps/golden-2`): `pnpm api` starts the API server, and `npx vite` serves the client and proxies `/api` to it. Production steps are in each app's README.

## Layout

`docs/` (PRDs, principles, ADRs, process) · `spec/` (kernel and stdlib sections with status) · `tasks/` (backlog, per-task plans) · `packages/` (kernel) · `apps/` · `evals/` (agent benchmark) · `tooling/` (budgets, dependency rules, lints) · `.claude/` (skills, subagents, commands, hooks).
