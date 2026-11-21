# k.docs: Installed docs
status: implemented

`keel docs` reads the docs of the Keel packages a project has installed: the map, one spec section, one skill, or the lines citing a code. It is the k.cli operation `docs` and the MCP tool `docs` (`sync: true` is `--sync`; a refused write answers E1357); `keel explain` is k.explain.

**Packed files.** Each published `@keel/*` package carries the sections it owns: `docs/<id>.md`, the section's text, and `docs/index.json`, `{ sections: [{ id, title, codes }] }`, `codes` every diagnostic code the section cites. `@keel/cli` also carries `docs/map.json`, `{ sections: [{ id, title, package }] }`, every kernel and std section once, and the published skills, `skills/<name>/SKILL.md`, each opening with `name` and `description` frontmatter.

**Resolution.** The project root is the nearest directory at or above the working directory holding a `package.json`. A package is installed when `node_modules/@keel/<name>/package.json` resolves from the project root, else from the running `@keel/cli`'s folder, and its `name` is `@keel/<name>`. The installed packages are the `@keel/*` names in `dependencies` and `devDependencies` of the project root's `package.json` and of `@keel/cli`'s. The map and the skills come from the running `@keel/cli`; a section comes from the package that `map.json` names, or for an id the map lacks, the installed package whose `index.json` lists it, at the version installed. A package's `docs/`, `docs/*.json`, `docs/<id>.md` or `skills/<name>/SKILL.md` whose real path leaves the package's real folder, or over 1,000,000 bytes, is absent and never read.

**Forms.**
| form | prints |
| --- | --- |
| `keel docs` | a `docs.entry` per section of `map.json` and of each installed `index.json`, once, then one per skill |
| `keel docs <id>` | one section (`k.router`, `std.tables`) as `docs.section`, or one skill (`keel-client`) as `docs.skill`: the file's text verbatim |
| `keel docs --for <code>` | a `docs.cite` per line citing the code, in the installed sections whose `index.json` lists it |
| `keel docs --sync` | the agent files (k.scaffold) |

`docs.entry` is `{ kind, id, title, package, installed }`, compact `k.router Routes @keel/router`, with ` not installed` after it when `installed` is false; a skill's entry has its name as `id`, its `description` up to the last `;` as `title` (all of it when there is none), `@keel/cli` and `true`. `docs.section` `{ kind, id, package, version, text }` and `docs.skill` `{ kind, id, version, text }` print `text` in compact. `docs.cite` is `{ kind, code, id, line, text }`, compact `k.cli:43 <text>`, `text` cut at 160 characters. A code no installed section cites gives no `docs.cite`, exit 0. More than one of `<id>`, `--for` and `--sync`, or an id that is neither a section nor a skill, is E1052, exit 2.

**The Keel repo.** When a directory at or above the working directory holds `spec/00-map.md`, `keel docs` reads that tree: the map is `spec/00-map.md` as one `docs.section` with id `map`, a section `spec/kernel/<id>.md` or `spec/std/<id>.md`, a skill `packages/cli/skills/<name>/SKILL.md`, `--for` every line of `spec/**.md`.

**See lines.** A diagnostic's `see` prints as `see: keel docs <id>` in compact and pretty; json keeps the id.

**Budgets** (`tooling/budgets.json`). `docs.map` 1,200 and `docs.for` 400 count the compact output of `keel docs` and `keel docs --for E1451`; `docs.section` 1,700 and `docs.skill` 2,500 count the `text` of every section and skill; `docs.agents` 600 counts the Keel block of `AGENTS.md`. The `docs` tool counts toward `mcp.tools-list` (k.cli).

**Rules.** E1065 the section's package is not installed; the message names the package to add · E1066 an installed package has no `docs/<id>.md` for a section `map.json` gives it, or no readable `docs/index.json`, or `@keel/cli` has no `docs/map.json`; the message names the package and its version.

**Conformance.**
- With fixture packages under `node_modules/@keel/`, `keel docs <id>` prints that package's `docs/<id>.md` byte for byte, exit 0; in json, one `docs.section` with the package's `version`.
- A package present only under `@keel/cli`'s own `node_modules` resolves: `keel docs <its id>` prints its section.
- With `@keel/std-tables` installed nowhere, `keel docs std.tables` emits E1065 naming `@keel/std-tables`, exit 1, and `keel docs` lists `std.tables` with `installed: false`.
- An installed package lacking the file for its `map.json` section emits E1066 naming the package and version, exit 1.
- A `docs/` or `docs/<id>.md` linked outside its package is absent (E1066); a package folder linked into a store reads.
- An installed package whose `index.json` lists an id `map.json` lacks: `keel docs` lists it and `keel docs <id>` prints it.
- `keel docs` emits a `docs.entry` per `map.json` section in map order, then one per skill; `keel docs keel-client` prints `skills/keel-client/SKILL.md` byte for byte.
- A skill whose `description` is `Build pages; E1401, E19xx` is listed with `title` `Build pages`.
- `keel docs --for <code>` prints each line citing the code in the installed sections listing it and none from a package not installed; a code cited nowhere prints no `docs.cite`, exit 0.
- `keel docs nope` and `keel docs k.cli --for E1051` emit E1052, exit 2. `keel spec` emits E1051.
- Under a root with `spec/00-map.md` and no `node_modules/@keel/` docs, `keel docs k.cli` prints `spec/kernel/k.cli.md` and `--for` reads `spec/`.
- The MCP tools include `docs`, not `spec`; `docs` on `{ id: 'k.cli' }` yields the records of `keel docs k.cli --format=json`.
- A diagnostic with `see` `k.ui` prints `see: keel docs k.ui` in compact and pretty, and `"see":"k.ui"` in json.
