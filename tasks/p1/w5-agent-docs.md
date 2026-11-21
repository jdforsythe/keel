# W5 build plan: agent docs and tooling

Builds steps 2 to 5 of workstream W5 (`tasks/p1/PLAN.md`) on the delivery path of ADR-0173, and sets up the golden-3 run as the first test of that path. Step 6 (`public-docs` for Codex) reuses the eval mode defined here.

## What exists

- **Retrieval.** `pnpm spec <id> | --map | --for <code>` (`tooling/spec.mjs`) reads the repo's `spec/`. `keel spec` (`packages/cli/src/internal/specCommand.ts`) does the same from the project's files, so outside the repo it answers I1055. `keel explain <code>` reads `@keel/check/explain`, which ships. `keel mcp` serves one tool per operation, `spec` and `explain` among them. Budgets (`tooling/budgets.json`): section 1,500, map 1,200, `--for` 400, explain 300, MCP `tools/list` 1,750.
- **Spec.** 55 kernel and 30 std sections, about 427 KB (107,000 tokens), each at most about 1,500 tokens.
- **Packages.** 40 packages, every `files` is `dist` (plus native or font folders); no docs ship besides each README.
- **Scaffold.** `keel scaffold project` writes `package.json`, `tokens.ts`, `topology.ts`, `vite.config.ts`, module `app`, turbo, CI and deploy files. No `AGENTS.md`, no `CLAUDE.md`, no skills.
- **Skills.** 19 in `.claude/skills/`, 13 about app work and 6 about building Keel itself:

| skill | bytes | kind of work |
|-|-|-|
| keel | 2,388 | app shape: files, routes, guards, tokens, topology, rules; skill index |
| keel-forms | 2,351 | forms, fields, actions, field errors |
| keel-widgets | 2,376 | std-headless widgets, std-tables |
| keel-text | 1,184 | std-messages, formatting, titles |
| keel-api | 3,014 | API modules, services, OpenAPI |
| keel-server | 3,061 | loaders, actions, server stores, identity, runners |
| keel-storage | 2,895 | durable storage, workflows, prove, shells and build targets |
| keel-writes | 2,841 | concurrent and offline writes, conflicts |
| keel-realtime | 1,641 | live loaders, channels, live views |
| keel-testing | 3,424 | `@keel/testing`: render, renderRoute, a11y, sim |
| keel-correctness | 1,852 | properties, explore, simulate, statecharts, rungs |
| keel-deploy | 2,755 | build, server env, hosting, place |
| keel-compliance | 2,392 | pii marks, secrets, CSP, evidence |
| keel-architecture | 2,196 | repo: package map, boundaries |
| keel-package-dev | 922 | repo: kernel package work |
| keel-conformance | 711 | repo: conformance tests |
| keel-handoff | 857 | repo: checkpoints |
| keel-review | 669 | repo: PR review |
| keel-red-team | 445 | repo: adversarial pass |

  Each app skill cites repo paths (`pnpm spec`, `apps/`, `--workspace`) that a user's project lacks. Skill evals live in `evals/skills/<name>.json`.
- **Evals.** `evals/run.ts` runs `claude -p` with the repo root as its working directory and a prompt of TASK.md, `spec-slice.txt` and one skill's text. The agent sees the repo's `CLAUDE.md`, `.claude/skills/`, `spec/`, `docs/` and every package source. golden-3's `TASK.md` tells it to read `docs/COMPLIANCE.md`, `.claude/skills/`, `packages/<name>/README.md` and to scaffold with `--workspace`; its `pass.ts` judges `apps/golden-3` from the repo root.

## Skill split (step 4)

Seven published skills, source `packages/cli/skills/<name>/SKILL.md`. Target size counts the whole file at chars / 4. Each skill holds the task-shaped rules and one compiling example per main API, and sends the agent to `keel docs <id>` for exact signatures.

| skill | scope | spec sections it draws on | from | target |
|-|-|-|-|-|
| keel | read first: app shape, files and one export per file, the rules, the reading path (`keel docs`, `keel explain`), the commands, the skill index | k.module, k.topology, k.schema, k.errors, k.component, k.router, k.check, k.scaffold | keel (rewrite: drop repo paths and `--workspace`) | 900 |
| keel-client | components, routes on the page, forms, widgets, tables, text and locales, head, a11y | k.component, k.ui, k.forms, k.router, k.head, k.a11y, k.aria, std.headless, std.tables, std.messages, std.text, std.i18n | keel-forms, keel-widgets, keel-text (merge) | 2,000 |
| keel-server | loaders and actions, server stores, guards on a node deployable, identity, API modules, services, OpenAPI | k.server, k.store, k.guards, k.api, k.services, k.openapi, k.user, k.mount, k.ctx | keel-api, keel-server (merge) | 2,000 |
| keel-data | durable storage, concurrent and offline writes, conflicts, realtime, workflows | k.topology (storage), k.persist, k.sync, std.db, std.workflows, std.offline, std.outbox, std.conflicts, std.channels, std.live | keel-storage (storage and workflows part), keel-writes, keel-realtime (merge) | 2,000 |
| keel-testing | tests and correctness: render, renderRoute, sim, properties, explore, statecharts, ledger rungs | k.testing, k.sim, k.model, k.prove, k.ledger, std.statecharts | keel-testing, keel-correctness (merge) | 2,000 |
| keel-deploy | build, deployables, env, hosting, place, shells | k.deploy, k.hosting, k.host, k.shell, k.place, k.bundle, std.shells | keel-deploy, keel-storage (shells and `--target` part) | 1,500 |
| keel-compliance | pii marks, secrets and reveal, what leaves, CSP limits, sessions redaction, evidence | k.privacy, k.reveal, k.leave, k.security, k.evidence, k.serverlog, std.sessions | keel-compliance (reconcile) | 1,500 |

The six repo skills stay in `.claude/skills/` as their own source and do not ship. The repo's copies of the seven are generated (ADR-0173). The 13 old app skill names go; their `evals/skills/*.json` merge into one file per new skill.

Each skill lane reconciles its skill with the spec (backlog 0222): every API, option and code it names is read from the section, not from the old skill.

## Lanes

At most two test-running lanes at once. "Tests" means the lane runs a package or tooling suite; `pnpm check --quiet` alone does not count.

| lane | step | tier | owns | tests | depends on |
|-|-|-|-|-|-|
| L1 RFC | 2, 3 | opus | `docs/rfc/NNNN-keel-docs.md`; spec diffs to k.cli (the `docs` operation replacing `spec`, its sources, codes, budgets, MCP tool name, `see:` lines) and k.scaffold (`AGENTS.md`, `CLAUDE.md`, skill copies, `--sync`, the drift warning); `tooling/budgets.json` keys `docs.*` | no | ADR-0173 accepted |
| L2 pack | 2 | sonnet | `tooling/docs-pack.mjs` (builds `packages/*/docs/` and `docs/index.json` from `spec/` at pack time, the cli map), `tooling/docs-owners.json`, `files` in every `package.json`, `.gitignore`, the owner-coverage check in `pnpm check` | tooling tests | ADR-0173 accepted |
| L3 conformance | 2, 3 | sonnet (conformance-writer) | `packages/cli/conformance/` and `packages/scaffold/conformance/` files for the RFC's clauses | runs them red, one file at a time | L1 merged |
| L4 cli | 2, 5 | sonnet | `packages/cli/src/internal/docsCommand.ts` (from `specCommand.ts`), package resolution, operations entry, `see:` printer, MCP tool description; `pnpm check` budget tests for `docs.*` | cli suite | L2, L3 |
| L5 scaffold | 3 | sonnet | `packages/scaffold/src/templates/agentsMd.ts`, `claudeMd.ts`, the skill-copy writer, `keel docs --sync`, the drift warning in `keel check` | scaffold suite | L3 |
| S1 to S7 skills | 4 | opus for `keel`, sonnet for the other six | `packages/cli/skills/<name>/SKILL.md` and `evals/skills/<name>.json`, one skill per lane | no (`pnpm eval --skill <name> --runner none` and `pnpm check --quiet`) | split above; re-run the docs checks once L6 lands |
| L6 docs checks | 4 | sonnet | `tooling/docs-check.mjs` in `pnpm check` (the checks below), the generator of `.claude/skills/` copies, removal of the 13 old app skills | tooling tests | L2 |
| L7 eval public mode | ready | sonnet | `evals/run.ts` public mode, `evals/public/` (pack, project setup, isolation probe, transcript audit, import into `apps/`), `evals/tasks/golden-3/TASK.md` public form, `evals/README.md` | eval with `--runner none` | L4, L5 |

Waves:
1. L1, L2 and S1 to S7 at once. L2 is the one test lane; the skill lanes edit Markdown only.
2. L3, then L6 with L3 still open (one test lane each).
3. L4 and L5 together (two test lanes). Skill lanes re-run the docs checks and fix what they flag.
4. L7 alone, then the golden-3 run.

## Checks that keep docs true

All in `pnpm check`, under the `D` (docs-freshness) prefix, next free numbers:
- Every fenced `ts` or `tsx` block in a published skill type-checks as a module against the workspace packages under the strict profile. A block tagged `ts fragment` is not compiled; at most two per skill.
- Every `import { … } from '@keel/…'` in a skill, in a fence or a code span, names an export the package has.
- Every diagnostic code a skill or `AGENTS.md` block cites exists in the `@keel/check/explain` catalog or in a spec section; a block range (`E19xx`) needs at least one code in it.
- Every section id a skill cites (`keel docs k.router`) exists.
- No published skill, scaffold template or packed `docs/` file names a repo-only path or command: `pnpm spec`, `spec/`, `docs/`, `apps/`, `packages/`, `.claude/`, `--workspace`.
- Size at or under the skill's target; `name` and `description` frontmatter present; the description names the kind of work and the codes.
- `.claude/skills/<name>/` equals `packages/cli/skills/<name>/` for the seven.
- `tooling/docs-owners.json` maps every section to exactly one package that exists.
- The voice lint (V0003) covers `packages/cli/skills/` and the `AGENTS.md` template.
- Skill evals (`pnpm eval --skill <name>`) stay as they are, one per published skill.

## Ready for the golden-3 run

What must exist:
- `keel docs` in `@keel/cli` with the map, sections, skills and `--for`, inside its budgets, reading installed packages.
- Every publishable package's `pnpm pack` tarball carries its `docs/`; `@keel/cli`'s carries the map and the seven skills.
- `keel scaffold project` (standalone) writes `AGENTS.md`, `CLAUDE.md` and `.claude/skills/`; a fresh standalone project built from the tarballs, outside the repo, passes `keel check`, `keel test` and `keel build`.
- The seven skills pass the docs checks and `pnpm eval --skill <name> --runner none`; the five golden-3 needs (keel, keel-client, keel-server, keel-compliance, keel-testing) also pass with `--runner claude`.
- The eval public mode below, with `--runner none` reaching `pass.ts` without a harness error.

What changes in `evals/`:
- **Public mode** (`task.json` `"docs": "public"`, golden-3 the first task to set it). The harness packs every publishable package into a scratch folder, makes a project with `keel scaffold project golden-3` from the packed `@keel/cli` in a fresh directory under the OS temp folder (outside the repo, so no parent `CLAUDE.md` or `.claude/` is found), points each `@keel/*` dependency at its tarball through `overrides` in the project's `pnpm-workspace.yaml`, and installs with `--offline` from the shared store.
- **The prompt** is the public TASK.md alone: no `spec-slice.txt`, no skill text prepended, no repo path. The agent reads what a user's agent reads: `AGENTS.md`, `CLAUDE.md`, the copied skills, `keel docs`, `keel explain` and the READMEs in `node_modules`.
- **golden-3's TASK.md** drops `docs/COMPLIANCE.md`, `.claude/skills/<name>`, `packages/<name>/README.md`, `pnpm spec` and the `--workspace` scaffold step; the project already exists; scripts take the standalone form. The app's requirements stay word for word.
- **Isolation.** `claude` runs with the project as its working directory and project settings only (`--setting-sources project`). Before the first iteration a probe asks the agent for its loaded skills and memory files and fails the run (a new `V` code) when anything outside the project shows. The run uses `--output-format stream-json`; after each iteration an audit fails the run when any tool call reads a path under the repo root or the user's `~/.claude`. `--dangerously-skip-permissions` stays, so the audit is the guard, not a sandbox.
- **Feedback per iteration** comes from the project's own `pnpm check` and `pnpm test`, not the repo root's.
- **Judging.** After each iteration the harness imports the project into `apps/golden-3/` (sources, tests and config; `@keel/*` to `workspace:*`; the workspace script form) and runs the existing `pass.ts` from the repo root unchanged. The converged app is then the golden app in the repo.
- **Results** record `docs: "public"`, the probe and audit outcomes, and the packed versions.
- A `codex` runner joins in step 6 under the same mode.

## Proposed backlog lines

```
- [ ] P1-06 rfc (medium): `keel docs` replaces `keel spec`: installed-package sources, map, sections, skills, `--for`, codes and `docs.*` budgets, MCP tool `docs`, `see:` lines; k.scaffold writes `AGENTS.md`, `CLAUDE.md`, skill copies and `keel docs --sync` with a drift warning (ADR-0173) · cli, scaffold · k.cli k.scaffold · P1 · P1-03
- [ ] P1-07 tooling (medium): docs packing: `tooling/docs-pack.mjs` builds each package's `docs/` and `docs/index.json` from `spec/` at pack time, `tooling/docs-owners.json` with its coverage check, `files` in every package (ADR-0173) · tooling · k.cli · P1 · P1-03
- [ ] P1-08 conformance (medium): conformance tests for the P1-06 clauses of k.cli and k.scaffold · cli, scaffold · k.cli k.scaffold · P1 · P1-06
- [ ] P1-09 cli (medium): `keel docs` implementation, package resolution from the project root and from `@keel/cli`, MCP tool description inside 1,750 tokens · cli · k.cli · P1 · P1-07 P1-08
- [ ] P1-10 scaffold (medium): `AGENTS.md`, `CLAUDE.md`, `.claude/skills/` copies, `keel docs --sync`, the drift warning in `keel check` · scaffold, cli · k.scaffold · P1 · P1-08
- [ ] P1-11 tooling (medium): docs checks in `pnpm check` (skill samples compile, imports and codes and section ids exist, no repo paths, sizes, copy freshness, voice lint over skills) and the `.claude/skills/` copy generator; remove the 13 old app skills · tooling, skills · k.check · P1 · P1-07
- [ ] P1-12 skills (medium): skill `keel`, read first, rewritten for an installed project (opus) · skills · k.module k.topology k.check · P1 · P1-03
- [ ] P1-13 skills (medium): skill `keel-client` from keel-forms, keel-widgets, keel-text, reconciled with the spec · skills · k.component k.forms std.headless std.tables std.messages · P1 · P1-03
- [ ] P1-14 skills (medium): skill `keel-server` from keel-api and keel-server, reconciled with the spec · skills · k.server k.api k.services · P1 · P1-03
- [ ] P1-15 skills (medium): skill `keel-data` from keel-storage, keel-writes, keel-realtime, reconciled with the spec · skills · std.db std.offline std.channels std.workflows · P1 · P1-03
- [ ] P1-16 skills (medium): skill `keel-testing` from keel-testing and keel-correctness, reconciled with the spec · skills · k.testing k.sim k.prove · P1 · P1-03
- [ ] P1-17 skills (small): skill `keel-deploy` with shells and build targets, reconciled with the spec · skills · k.deploy k.shell std.shells · P1 · P1-03
- [ ] P1-18 skills (small): skill `keel-compliance` reconciled with the spec · skills · k.privacy k.security std.sessions · P1 · P1-03
- [ ] P1-19 evals (large): public docs mode: packed tarballs, standalone project outside the repo, isolation probe, transcript audit, import into `apps/golden-3` for `pass.ts`; golden-3 TASK.md in public form · evals · k.testing · P1 · P1-09 P1-10 P1-11
```

Backlog 0222 closes with P1-19's first converged golden-3 run for Claude; step 6 adds Codex.
