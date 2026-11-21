# RFC 0151: `keel docs` reads installed docs; the scaffold writes agent files

Status: implemented (ADR-0173). Implements ADR-0173 on k.cli and k.scaffold.

## Problem
An agent in a user's project has the installed packages and the scaffold output. `keel spec` reads `spec/**.md` from the project, which only the Keel repo has, so everywhere else it answers I1055. Every diagnostic prints `see: keel spec <id>` in pretty output, which leads nowhere; the MCP `spec` tool has the same gap. The app skills sit in the repo's `.claude/skills/` and ship in no package. `keel scaffold project` writes no `AGENTS.md`, no `CLAUDE.md` and no skills, so a fresh project tells its agent nothing about how to read Keel.

## Proposal

### D1. `keel docs` replaces `keel spec`
One operation, `docs`, in `@keel/cli`, served as `keel docs` and the MCP tool `docs`. `spec` is removed from the operations, so `keel spec` is E1051 and the MCP tool list has no `spec`. New section k.docs holds the operation; k.cli's command table points at it.

| form | prints | budget |
| --- | --- | --- |
| `keel docs` | one `docs.entry` per section (id, title, owner package, installed or not), then one per skill | `docs.map` 1,300 |
| `keel docs <id>` | one section (`docs.section`) or one skill (`docs.skill`), the file's text verbatim | `docs.section` 1,500, `docs.skill` 2,300 |
| `keel docs --for <code>` | one `docs.cite` per line citing the code, across installed sections | `docs.for` 400 |
| `keel docs --sync` | rewrites the agent files (D5) | |

### D2. Sources: installed packages
Each published package carries `docs/<id>.md` for the sections it owns and `docs/index.json`, `{ sections: [{ id, title, codes }] }`. `@keel/cli` carries `docs/map.json`, `{ sections: [{ id, title, package }] }`, and `skills/<name>/SKILL.md`. A package resolves from the project root's `node_modules`, then from the running `@keel/cli`'s folder. The installed set is the `@keel/*` names in `dependencies` and `devDependencies` of the project's `package.json` and of `@keel/cli`'s. A section is read at the installed version of its owner. An id `map.json` lacks is read from the installed package whose `index.json` lists it, so a std package newer than the cli is still readable.

A directory at or above the working directory holding `spec/00-map.md` (the Keel repo) switches `keel docs` to that tree: `spec/`, and `packages/cli/skills/` for skills. `pnpm spec` stays the repo's own tool.

### D3. Codes
- **E1065** the section's package is not installed; the message names the package to add. Exit 1.
- **E1066** an installed package has no `docs/<id>.md` for a section `map.json` gives it, or no readable `docs/index.json`, or `@keel/cli` has no `docs/map.json`; the message names the package and version. Exit 1. This is the version-skew case (a cli newer than an installed package) and the unpacked workspace link.
- An id that is neither a section nor a skill, or more than one of `<id>`, `--for`, `--sync`, stays E1052, exit 2, as `keel spec` answers it now.
- **E1355** (k.scaffold) `AGENTS.md` has a start or end marker without the other, or one twice; `--sync` writes nothing.
- **W1356** (k.scaffold) an agent file differs from what `--sync` writes, or the block is malformed; fix `keel docs --sync`.
- **E1357** (k.scaffold) a write a symlink would carry out of the project (D9); the edit set is refused, nothing written. Exit 1.

E1065 and E1066 are the next free codes of the E105x block after k.evidence's E1064 (E1058, named once in RFC 0091's alternatives, stays unused). E1355 and W1356 follow k.scaffold's E1354; E1357 follows W1356. A warning gets its own number rather than sharing E1355's.

### D4. `see:` lines
Compact and pretty print a diagnostic's `see` as `see: keel docs <id>`; json keeps the bare id. Compact gains 10 characters per diagnostic with a `see`: the `check.injected10` fixture measures 2,207 characters (552 tokens) today and about 2,307 (577 tokens) after, under its 600.

### D5. Agent files (k.scaffold)
`keel scaffold project` (not `--workspace`) and `keel docs --sync` write, from the running `@keel/cli`:
- `AGENTS.md` with the Keel block between the lines `<!-- keel:start -->` and `<!-- keel:end -->`, at most 600 tokens (`docs.agents`): the reading path (`keel docs`, `keel explain`), the commands, the rules every Keel file follows, and each skill's name and `.claude/skills/<name>/SKILL.md` path. Text outside the block is the user's.
- `CLAUDE.md`: the single line `@AGENTS.md`, only when nothing exists at the path. An existing `CLAUDE.md`, a symlink to a file included, is kept and never written (a linked file stays byte for byte); a dangling symlink is refused with E1357 and with it the whole set.
- `.claude/skills/<name>/SKILL.md`: a copy of each skill `keel docs` lists.

`--sync` replaces the block in place, appends it when `AGENTS.md` has none, creates absent files, rewrites every copy, and writes all files or none. `keel check` reports W1356, at the file's path, line 1, for the block and for each copy that `--sync` would change, a missing copy included, only in a project whose `AGENTS.md` holds the block.

### D6. Budgets
`tooling/budgets.json` gains `docs.map` 1,300, `docs.section` 1,500, `docs.skill` 2,300, `docs.for` 400 and `docs.agents` 600. ADR-0173 gives `docs.map` 1,200; the listing of 87 sections with their packages and seven skills measures 1,254. `docs.map` and `docs.for` measure the compact output of `keel docs` and `keel docs --for E1451` (the fixture `spec.for` measures now); `docs.section` and `docs.skill` measure the `text` of each section and skill; `docs.agents` the block. The MCP `docs` description counts toward the existing `mcp.tools-list` 1,750.

### D7. A skill's title in the map is its description before the codes
A published skill's `description` reads "<what the skill is for>; <diagnostic codes>". The codes after the last `;` let a host match the skill to a diagnostic; a reader of the map gains nothing from them, and with the seven published skills they put `keel docs` at 1,358 tokens against `docs.map` 1,200. A skill's `docs.entry` carries the description up to its last `;` as `title`, the whole description when it has none, in every form (compact, pretty, json). `keel docs <skill>` still prints the skill verbatim, frontmatter and codes included. `docs.map` stays 1,200. Runner-up: raise `docs.map`, rejected; the map loads in every session that reads it.

### D8. Reads stay inside the package
`keel docs` resolves each package folder's real path once (under pnpm `node_modules/@keel/<name>` is itself a link into the store, and that reads). A `docs/` folder, `docs/index.json`, `docs/map.json`, `docs/<id>.md` or `skills/<name>/SKILL.md` whose real path is not inside that real folder is absent: never read, so not listed, and E1066 where a section needs it. The same holds for the repo's `packages/cli/skills/`. Runner-up: refuse any link inside a package, rejected; it breaks workspace links and the pnpm store layout.

### D9. Writes never follow a link out of the project
Before writing, the binary checks every path of the edit set: an existing target that is a symlink, or a nearest existing ancestor whose real path is outside the project root's real path (a dangling link included), refuses the whole set with E1357 per path, and no file is written. This guards every command whose effects the binary applies (`keel docs --sync`, `keel scaffold project`, the codemods, `build`), not only the agent files. All or nothing matches k.scaffold's atomic edit sets and `--sync`'s all-or-none; runner-up: skip only the linked files and write the rest, rejected because `--sync` and every scaffold operation promise all files or none. A link that stays inside the project is followed.

### D10. An installed package's name matches its folder
A package whose `package.json` `name` is not `@keel/<folder>` is not installed: E1065 for its sections, and its `index.json` is not used. A misnamed or planted folder under `node_modules/@keel/` cannot speak for another package.

### D11. A docs or skill file over 1,000,000 bytes is absent
A packed section is capped at 1,500 tokens and a skill at 2,300, so a file a thousand times that is not a doc; reading it would only cost memory. It is treated as absent (E1066 where a section needs it). The project's own agent files are not capped, so `--sync` never mistakes a large `AGENTS.md` for a missing one.

### D12. A CRLF `AGENTS.md` keeps CRLF
When `AGENTS.md` holds a CRLF line ending, the Keel block is written in CRLF, replaced or appended, so a second `--sync` changes nothing and the file keeps one line ending.

## Alternatives
The ADR-0173 alternatives (hosted site, MCP only, skills only, the whole spec in `@keel/cli`, a `@keel/docs` package, keeping `keel spec`, symlinked skills) stand. Choices this RFC adds, each for the orchestrator to confirm or reverse:
- **A new section k.docs.** k.cli is at 5,972 of its 6,000 characters, so the operation cannot live there; k.docs follows k.opening and k.serverlog. The map row is paid for by shortening seven section titles in the map only (`Implied path prefix` to `Path prefix`, "and" to a comma in four, `Request user, caller`, `Production entry`); the section headers keep their titles.
- **`docs/map.json`, not `docs/map.md`.** ADR-0173 names `map.md`. `keel docs` has to join the map with what is installed, so the map is data; JSON matches `index.json` and needs no table parser. The agent reads the map through `keel docs`, never the file.
- **`--for` reads sections, not skills.** The spec is the authority for a code; skills summarize. A code comes from a rule of an installed package, so its section is installed. Runner-up: cite skill lines too.
- **An id the map lacks reads from an installed `index.json`.** Packages version on their own; without this a std package newer than the cli has sections no command reaches. Runner-up: map only, E1052.
- **Unknown id stays E1052.** One code for "no such id" in the CLI, as now. Runner-up: a new E1067.
- **Repo detection walks up from the working directory.** Apps inside the repo (`apps/golden-1`) run `keel docs` from their own folder and have no packed `docs/`. The eval public mode builds its project under the OS temp folder, outside the repo, so it never matches.
- **`--workspace` writes no agent files.** A repo app reads the repo's own `CLAUDE.md` and `.claude/skills/`.
- **The drift warning is opt-in by the block.** Without that, every repo app and every project that deleted its agent files would carry W1356 forever, and a clean `keel check` would no longer be one line. A project that removes the block opts out.
- **`--sync` creates `CLAUDE.md` only when nothing exists there, and never removes a copy.** It cannot tell a stale Keel copy from a user's skill of a similar name. Open question below.
- **`see:` changes in compact too.** ADR-0173 says the `see:` line prints `keel docs <id>`; compact is what an agent reads, and the cost fits `check.injected10`.
- **`docs.section` and `docs.skill` measure the text, not the command output.** A section at its 1,500 cap plus the trailer line would otherwise breach, and a skill at its 2,300 target likewise.

## Spec diff
- New `spec/kernel/k.docs.md` (Installed docs, 5,326 characters, status `implemented`): packed files, resolution, the four forms and their records, a skill's entry titled by its description up to the last `;` (D7), the repo case, `see:` lines, budgets, E1065 and E1066, twelve Conformance bullets. `spec/00-map.md`: a k.docs row after k.cli, k.docs added to the E105x owners, and seven titles shortened as above (4,797 characters, 1,200 tokens).
- `spec/kernel/k.cli.md` (5,972 to 5,935 characters): the `spec` row becomes `docs [id]` / `--for <code>` / `--sync`, "installed docs (k.docs)"; the bullet `keel spec k.cli` becomes `keel docs k.cli`. Status `conformance-covered` becomes `implemented`, here and in the map, until the conformance commit.
- `spec/kernel/k.docs.md` (5,326 to 5,660 characters): Resolution gains the name match (D10) and the real-path and size rule (D8, D11); one Conformance bullet for D8.
- `spec/kernel/k.scaffold.md` (5,990 to 5,997 characters): Rules gain E1357 (D9); to fit, an edit set lists "the sorted paths it creates, changes, deletes" and the project bullet reads "writes only under `<name>/`". D12 has no spec text; the section is full.
- `spec/kernel/k.scaffold.md` (4,779 to 5,985 characters): `project` lists the agent files and `--workspace` drops them; new **Agent files** paragraph (D5); Rules gain E1355 and W1356; three Conformance bullets. Status `implemented`, here and in the map. The section is now at its limit; the paragraph and bullets are written tight to fit, and no other text was cut.
- `spec/kernel/k.check.md`: **explain and spec** becomes **explain and docs**, and `keel spec --for` becomes `keel docs --for`, reading installed spec lines (5,996 characters). `spec/kernel/k.explain.md`: its pointer to that paragraph follows the rename.
- `tooling/budgets.json`: the five `docs.*` keys. `spec.section` and `spec.map` stay; they gate the repo's `spec/` files. `spec.for` stays until L4 moves its measurement to `docs.for` and removes it with `keel spec`.

## Conformance diff
One `rfc:0151` commit by the `conformance-writer`, red. Tests go through `keel` with fixture project files (as `packages/cli/conformance/fixtures.ts` does), never the implementation. A fixture package is `node_modules/@keel/<name>/package.json` with a `version`, `docs/index.json` and `docs/<id>.md`; the cli fixture adds `docs/map.json` and `skills/<name>/SKILL.md`.

`packages/cli/conformance/` (k.docs):
- `keel docs <id>` prints the owner package's `docs/<id>.md` byte for byte, exit 0; json is one `docs.section` carrying `id`, `package` and the fixture's `version`.
- A package present only under `node_modules/@keel/cli/node_modules/@keel/<name>/` resolves for `keel docs <its id>`.
- `@keel/std-tables` installed nowhere: `keel docs std.tables` is E1065 naming `@keel/std-tables`, exit 1; `keel docs` lists `std.tables` with `installed: false`, and compact shows ` not installed` on that line.
- An installed package lacking the file for its `map.json` section: E1066 naming the package and version, exit 1. A cli fixture with no `docs/map.json`: E1066 naming `@keel/cli`.
- An installed package whose `index.json` lists an id `map.json` lacks: `keel docs` lists it and `keel docs <id>` prints it.
- `keel docs` emits one `docs.entry` per `map.json` section in map order, then one per skill with `package` `@keel/cli`; `keel docs keel-client` prints that `SKILL.md` byte for byte as `docs.skill`.
- A skill whose `description` is `Build pages; E1401, E19xx` is listed with `Build pages`: `title` `Build pages` in json, and the compact line `<name> Build pages @keel/cli`; `keel docs <name>` still prints the full description in the skill's text.
- `keel docs --for <code>` prints every line citing the code in installed sections whose `index.json` lists it, as `<id>:<line> <text>`, and no line from a package not installed; a code nothing cites prints no `docs.cite`, exit 0.
- `keel docs nope` and `keel docs k.cli --for E1051` are E1052, exit 2. `keel spec k.cli` is E1051, exit 2.
- A tree with `spec/00-map.md` at its root and no packed docs: `keel docs k.cli` prints `spec/kernel/k.cli.md`, `keel docs` prints the map as `docs.section` id `map`, and `--for` reads `spec/`.
- The MCP tools include `docs` and not `spec`; calling `docs` with `{ id: 'k.cli' }` yields the records of `keel docs k.cli --format=json`.
- A diagnostic with `see` `k.ui` prints `see: keel docs k.ui` in compact and pretty, and `"see":"k.ui"` in json.
- `spec-and-explain.test.ts`: the k.cli bullet becomes `keel docs k.cli` <= 1,500 tokens, and the `--for` case moves to `keel docs --for` with fixture packages.

- Through `keel` in a real temp project whose `package.json` names `@keel/evil`: `node_modules/@keel/evil/package.json` (`name` `@keel/evil`) with `docs` a symlink to an outside folder holding `index.json` (listing `zz`) and `zz.md`: `keel docs zz` exits non-zero and its output holds no text of `zz.md`, and `keel docs` lists no `zz`. With a real `docs/` whose `index.json` lists `zz` and whose `zz.md` is a symlink to an outside file: `keel docs zz` is E1066 naming `@keel/evil`, exit 1, without the outside text.
- `node_modules/@keel/<name>` itself a symlink to a package folder outside the project (the pnpm store layout): `keel docs <its id>` prints its `docs/<id>.md` byte for byte, exit 0.

`packages/scaffold/conformance/` (k.scaffold):
- `keel scaffold project <name>` writes `AGENTS.md` with exactly one block between the two marker lines, at most 600 tokens (chars / 4), containing `keel docs`, `keel explain` and, for each skill `keel docs` lists, its name and `.claude/skills/<name>/SKILL.md`, and none of `pnpm spec`, `spec/`, `--workspace`; `CLAUDE.md` equal to `@AGENTS.md\n`; one `.claude/skills/<name>/SKILL.md` per listed skill, equal to the `text` of `keel docs <name>`. With `--workspace`, none of the three paths exists.
- After the block, one copy, and a line outside the block are edited, `keel docs --sync` restores the block and the copy and keeps the outside line; a second `--sync` changes no file. In a project without `AGENTS.md` or `CLAUDE.md` it creates both; an existing `CLAUDE.md` stays byte for byte, a `CLAUDE.md` that is a symlink to an outside file included (exit 0, the linked file unchanged); an `AGENTS.md` without a block keeps its text and gains the block after it.
- `keel check` on a fresh scaffolded project reports no W1356. With one copy edited, or removed, it reports one W1356 at that copy's path; with the block edited, one at `AGENTS.md`. A project whose `AGENTS.md` has no block reports none.
- An `AGENTS.md` with a start line and no end line: `keel docs --sync` is E1355, exit 1, and no file changes.
- Through `keel` in real temp directories (`mkdtemp` under the OS temp folder), a project with `package.json` and each in turn of: `.claude` a symlink to an outside folder; `.claude/skills` a symlink to an outside folder; `AGENTS.md` a symlink to an outside file; `CLAUDE.md` a dangling symlink. `keel docs --sync` emits E1357 with `path` the linked write, exit 1; the outside folder's listing and every outside file's bytes are unchanged, and no project file is created or changed.
- `keel scaffold project shop` in a temp folder where `shop` is a symlink to an empty outside folder: E1357, exit 1, and the outside folder stays empty.

Every new E code needs an `@keel/check/explain` row (k.check Conformance), so the k.check explain conformance goes red until L4 adds E1065, E1066 and E1355. E1357 has its explain row; k.check's per-code conformance needs a scaffold conformance test asserting it (the two E1357 bullets above).

## Migration
- `@keel/cli`: `docsCommand` replaces `specCommand`; the operation `spec` is removed; `diagCompact` and `diagPretty` print `see: keel docs <id>`; explain rows for E1065, E1066, E1355; record kinds `docs.entry`, `docs.section`, `docs.skill`, `docs.cite` replace `spec.section` and `spec.cite`. `tooling/budgets.mjs` measures `docs.*` and drops `spec.for`.
- `@keel/scaffold`: `AGENTS.md`, `CLAUDE.md` and skill-copy templates; `--sync`; the W1356 check in `keel check`.
- Packing (L2): `docs/` and `docs/index.json` in every package's `files`, `docs/map.json` and `skills/` in `@keel/cli`'s.
- `@keel/check`: the E1357 explain row. `@keel/cli`: `applyWrites` refuses linked writes (D9); `keel docs` reads within each package's real folder, up to 1,000,000 bytes per file (D8, D11), and matches a package's name to its folder (D10).
- Docs once the code lands: `docs/OUTPUT.md` (budget list, record kinds, `keel spec --for`), the `keel` skill, `README.md` and any page naming `keel spec`.
- Users: `keel spec` becomes `keel docs`. An existing project runs `keel docs --sync` once to get the agent files.
- Changesets for `@keel/cli` and `@keel/scaffold`.

## Token impact
k.docs 1,332, new. k.cli 1,484 (was 1,493). k.scaffold 1,497 (was 1,195). k.check 1,499 (was 1,497). Map 1,200 (was 1,200). Each compact diagnostic with a `see` grows by about 3 tokens. The `AGENTS.md` block is at most 600 tokens and loads in every session of a user's agent.

## Open questions
- Whether `--sync` should remove `.claude/skills/<name>/` copies of skills the installed cli no longer publishes, and how it would recognize them (a marker line in each copy is the likely form).
- L6's ban list names `.claude/` for scaffold templates, but the `AGENTS.md` block names `.claude/skills/<name>/SKILL.md` paths by design; the check needs an exception for those paths in the block.
- k.scaffold is at 1,497 of 1,500 tokens; its next change needs a section of its own.

## Known limits
- Marker lines count wherever they stand in `AGENTS.md`, a fenced code block included (k.scaffold: the block is one start line and one end line): a start and end pair inside a fence is replaced as the Keel block. Fence parsing is not added.
