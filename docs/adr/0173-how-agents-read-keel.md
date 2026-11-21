# ADR-0173: how agents read Keel (decision O2)

**Status:** proposed (for the orchestrator to accept; the command change goes through an RFC on k.cli and k.scaffold).

**Context.** An agent in a user's project has the installed packages and the scaffold output, and nothing of this repo: no `spec/`, no `.claude/skills/`, no `docs/`. Today `keel spec` reads `spec/**.md` from the project, so outside the repo it answers I1055 (nothing to read); diagnostics print `see: keel spec <id>`, which leads nowhere; the MCP `spec` tool has the same gap. The app skills live in `.claude/skills/` and ship nowhere. Each package publishes `dist` (and its README) only. Packages version on their own (no changesets `fixed` group), so a user's project can hold `@keel/router` and `@keel/std-tables` at different versions. The `keel explain` catalog already ships, in `@keel/check/explain`.

**Decision.**
- **Docs ship in the packages and are read from `node_modules`.** Each published package carries the spec sections it owns under `docs/` with a `docs/index.json` (section id, title line, codes cited), added to its `files`. A std section ships in its std package. A kernel section ships in the kernel package that implements it; a section with no single package (k.errors, k.boundary, k.module, k.topology, k.security, k.check, k.ledger and the like) ships in `@keel/cli`. One table, `tooling/docs-owners.json`, maps every section to one package, and `pnpm check` fails when a section has no owner or two. `@keel/cli` also ships the map (`docs/map.md`, every section with its owner package) and the published skills (`skills/<name>/SKILL.md`). The `docs/` copies are built from `spec/` at pack time and are not committed.
- **One retrieval command, `keel docs`, replaces `keel spec`** (one way, principle 1; `docs` is the word a user's agent tries first, principle 9). It reads the version installed in the project:
  - `keel docs`: the map, with each section marked installed or not, and the skills. Budget 1,200 tokens.
  - `keel docs <id>`: one section (`k.router`, `std.tables`) or one skill (`keel-client`). Budget 1,500 tokens for a section, 2,300 for a skill.
  - `keel docs --for <code>`: the lines that cite a code, across installed packages. Budget 400.
  - `keel explain <code>`: unchanged, 300.
  - A section whose package is not installed is an error that names the package to add. A diagnostic's `see:` line prints `keel docs <id>`.
  - Packages resolve from the project root (its direct `@keel/*` dependencies), then from `@keel/cli`'s own dependencies for kernel packages the project reaches only through it.
  - A project with `spec/00-map.md` at its root (the Keel repo) reads `spec/` instead; `pnpm spec` stays the repo's own tool.
  - `keel mcp` exposes the same operation as its `docs` tool, inside the 1,750-token `tools/list` budget. MCP is the third path, for harnesses that prefer tools; nothing depends on it.
- **The scaffold writes the agent entry files.** `keel scaffold project` writes:
  - `AGENTS.md`: a Keel block between `<!-- keel:start -->` and `<!-- keel:end -->`, at most 600 tokens, holding the reading path (`keel docs`, `keel explain`), the commands, the rules every Keel file follows, and the skill index with each skill's path. The rest of the file is the user's.
  - `CLAUDE.md`: the single line `@AGENTS.md`.
  - `.claude/skills/<name>/SKILL.md`: generated copies of the published skills for Claude Code.
  - Codex reads `AGENTS.md` natively and gets the skill index there; when Codex documents a repo skills directory, the same copies go there too.
  - `keel docs --sync` rewrites the Keel block and the copies from the installed `@keel/cli`. `keel check` warns, with that command as the fix, when the copies differ from the installed version.
- **One source for skills.** The published skills' source is `packages/cli/skills/<name>/SKILL.md`. The repo's `.claude/skills/<name>/` for those names are generated copies made by the same sync, checked fresh by `pnpm check`, so the repo's agents read exactly what users read. The repo-only skills (keel-architecture, keel-package-dev, keel-conformance, keel-handoff, keel-review, keel-red-team) stay in `.claude/skills/` as their own source and ship nowhere.
- **The site and `llms.txt` render the same files.** The docs site builds each version's pages from `spec/` and `packages/cli/skills/`, and publishes `llms.txt` listing the map, each section and each skill as plain Markdown URLs, for an agent with no project. No agent instruction points at the site; the installed docs are the one path an agent is told about.

**Alternatives.** Scored on version match with installed code, offline and sandbox use, tokens per lookup, one source, Claude and Codex and other agents, and package size.
- *Hosted site fetched over the network.* Version match only if the agent picks the right versioned URL, which it does not know; no use offline or in a network-closed sandbox; an HTML page costs more tokens than the section it holds, and `llms.txt` helps only with the index. One source and every agent with web access, and no package cost. Kept as the reading path for an agent with no project.
- *MCP server only.* Version match and offline, and cheap per call, but the tool list sits in every turn (up to 1,750 tokens), each harness needs configuring before the first lookup, and some sandboxes run no extra process. It reads the same files under this decision, so it stays as a third path.
- *Skills only.* Loaded by description and cheap, but a skill is a summary: the spec is about 107,000 tokens across 85 sections, and a skill cannot hold the exact API a task needs. Skills alone also ship nowhere, so they match no version. Under this decision skills are the task-shaped entry and `keel docs` holds the detail.
- *The whole spec in `@keel/cli`.* One lookup place, but the docs then describe the cli's release, not the router or std package the project installed; with packages versioned on their own that drifts. Rejected for sections; kept for the map, the skills and the cross-cutting sections.
- *A separate `@keel/docs` package.* Same drift, and one more dependency a project must remember to upgrade.
- *Keep `keel spec` and add `keel docs`.* Two commands for one job (principle 1).
- *Symlinked skills into `node_modules`.* No staleness, but symlinks into `node_modules` break on Windows and in commits; generated copies with a freshness warning keep the project self-contained.

**Consequences.**
- An agent in a fresh project reads the docs of the installed version with no network and no setup; every lookup stays inside the output budgets of docs/OUTPUT.md.
- The published spec text is user-facing copy: docs/BRAND.md voice applies to `spec/` as it does to skills, and the no-history rule matters more.
- A docs fix reaches users only in a package release; a patch release carries docs-only changes, and an installed old version keeps its old text.
- Skills live in `@keel/cli` and teach APIs of other packages; a project holding a std package far from the cli's release can read a skill that is ahead or behind. The skill points at `keel docs <id>` for the exact API, which is always the installed one.
- Tarballs grow by the Markdown of their sections (the spec is about 430 KB raw in all); the `size` budgets, which measure bundled code, do not change.
- `keel spec` is gone from the public CLI; every `see:` line, the MCP tool name, k.cli, k.scaffold and the skills change in one RFC.
- golden-3 runs against this path: built from packed tarballs in a directory outside the repo, judged inside it (tasks/p1/w5-agent-docs.md).
