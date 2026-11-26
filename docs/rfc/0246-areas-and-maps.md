# RFC 0246: k.docs: areas, a two-level map and lookups by code, name and term

Status: accepted (ADR-0272), accepted by the orchestrator on 2026-11-26, to be confirmed by the operator. Amends k.docs (opening, Packed files, Areas, Titles, Forms, records, The Keel repo, Budgets, Conformance), the glossary (`area`), the map row of k.docs. From backlog 1100, 0807 and 1043 (`tasks/p1/weaknesses.md` Lane 16) and the app trials' `keel docs` finding.

## Decisions
- D1: three levels. The map (`spec/00-map.md`) lists areas; an area map (`spec/areas/<area>.md`) lists its sections with what each holds; a section is one file. Fourteen areas (table below).
- D2: limits from principle 8: map 400 + one area 500 + one section 3,100 = 4,000. `spec.section` stays 3,100.
- D3: one source per fact. A section's title and status live only in its first two lines; an area file holds `| id | holds |`; the map row holds an area's id and title. Area maps are printed by joining them, so a status or title is never edited twice and never drifts.
- D4: the map is not the only index. `--for` takes a code (as now), a code block (`E155x`), an API name or a glossary term. The code ranges table leaves the map; `--for <block>` replaces it.
- D5: the published form is the same structure: `keel docs` lists areas and skills, `keel docs <area>` lists an area, `keel docs <id>` prints a section. `pnpm spec` prints what `keel docs` prints in the repo: one implementation, one measurement.
- D6: titles in full words, checked (D0021): a clipped word is refused with the words to use. A full map or area splits; no title is shortened to fit.

## Problem
Principle 8: no task needs more than 4,000 tokens of spec in context. What an agent loads today:
- `pnpm spec --map` prints `spec/00-map.md`: 1,643 of its 1,660 tokens (`spec.map`). It holds the code ranges table (about 430 tokens), one row per kernel section (82) and a pointer to `spec/std/README.md` for the stdlib: 1,456 more tokens and 39 rows. Seeing every section id costs 3,099 tokens before a section is read.
- `keel docs` in an app prints one `docs.entry` per section and skill: 1,689 of 1,690 tokens (`docs.map`). The app trials (`tasks/p1/app-trials.md`, finding 2) show an agent reading 10 to 17 sections and spending 20 to 25 of 80 turns on docs; one dump went over the tool-result size.
- Sections: 122 on the main line, median 1,527 tokens, twelve within 100 of the 3,100 limit (k.drive 3,100, k.check and k.shell 3,098). Map plus std index plus the largest section is 6,199.

The map has no room, and each lane met the limit by cutting other rows. `lane-r-e2e` turned "Proving invariants" into "Proofs", "Accessibility" into "A11y", "Secrets, personal data" into "Secrets, pii", "Server dependencies" into "Server deps", "Library publishing" into "Library pack"; `lane-r-look` turned "Checker, diagnostics" into "Checker", "Server dependencies" into "Server deps", "Surface compatibility" into "Compatibility"; both cut k.compat and k.server-deps differently, so they conflict at merge. The kernel map's "one line" column is already one word per row (`signals`, `codecs`, `log`), and 36 map titles differ from their section's own title (k.drive is "Driving a simulation" in its file and "Sim clock drive" in the map). Two copies of title and status also drift: std.contracts reads `conformance-covered` in its file and `proposed` in the std index. A lane may not raise the limit (briefs: a token limit is never raised), so every new section degrades titles further. Backlog 1100 asks for a section bound that keeps map plus section under 4,000; 0807 notes `pnpm spec` and `tooling/budgets.mjs` measure separately.

Lookups today: `pnpm spec --for X` (`tooling/spec.mjs`) prints up to 10 lines of `spec/**.md` containing the string; `keel docs --for <code>` prints the lines citing a code in the sections whose `index.json` lists it; `keel explain <code>` gives a `see` id. An API name or a glossary term has no lookup in an app: `keel docs --for` only reads codes from the index, and the glossary is not shipped.

## Proposal
### Three levels
| level | file | printed by | holds | limit |
| --- | --- | --- | --- | --- |
| map | `spec/00-map.md` | `pnpm spec`, `keel docs` | how to look up; one row per area: id, title | `spec.map` 400, `docs.map` 900 |
| area | `spec/areas/<area>.md` | `pnpm spec <area>`, `keel docs <area>` | one row per section: id, title, status, holds | `spec.area` 500, `docs.area` 500 |
| section | `spec/kernel/<id>.md`, `spec/std/<id>.md` | `pnpm spec <id>`, `keel docs <id>` | the section | `spec.section` 3,100, `docs.section` 3,100 |

Arithmetic: a task loads the map, one area and the section it needs: 400 + 500 + 3,100 = 4,000. The map at 14 areas measures 343 tokens (rows about 17 each), so three more areas fit before a split; an area of 13 sections with 90-character `holds` measures about 425, room for 15. `docs.map` holds the areas (about 240) and the skill entries (472 today); the skill list is not spec text, so 900 leaves it room without touching principle 8's sum. When a map or area reaches its limit, the area splits in two; that moves rows between files and shortens nothing.

The map's text, in full:

```md
# Keel spec map

`pnpm spec <area>` lists an area's sections with status (proposed, implemented, conformance-covered, frozen) and contents; `pnpm spec <id>` prints a section. `--for` finds sections by code (`E1042`), code block (`E155x`), API name (`renderRoute`) or glossary term (`"identity mount"`). Codes: kernel E1xxx, stdlib E2xxx, tooling E0xxx, review R1xxx.

| area | holds |
|-|-|
| values | Schemas, formats, value types, locales and message sets |
...
```

An area file:

```md
# data
| id | holds |
|-|-|
| k.persist | storage drivers, durable stores, replicas and `watch` |
| k.sync | heads, concurrent writes, rebase and connectivity |
```

`pnpm spec data` prints `# data: Durable storage, concurrent writes and app data`, then `| id | title | status | holds |` with title and status read from each section's first two lines. Ids never collide: a section id has a dot, an area id is one lowercase word, a skill name starts with `keel`.

### Lookups
`--for <key>`, in `pnpm spec` and `keel docs` alike:
- a code (`E1042`, `W1608`, `R1053`): the citing lines, as today (`docs.cite`).
- a code block (`E155x`, `E15xx`): one `docs.code` per code of the block a section cites, with the sections citing it. This is how a writer finds a free code; the map's code ranges table goes.
- anything else: the glossary entry whose term equals the key ignoring case (`docs.term`, with the section ids it cites), then up to five sections holding the key in a code span (`docs.hit`, by count of spans). `renderRoute` finds k.testing first; `identity mount` prints its glossary line naming k.mount and k.testing.

`keel explain <code>` keeps its `see` id. `@keel/cli` packs `docs/glossary.json` from `docs/GLOSSARY.md`, so a term resolves in an app. Hits are computed from the packed section text at query time; `index.json` is unchanged.

### Published form
`keel docs` prints a `docs.area` per area (`data Durable storage, concurrent writes and app data, 6 sections`) and the skill entries: about 710 tokens against 1,689. `keel docs data` prints the area and its sections' `docs.entry` rows, each with `holds` and ` not installed` where it applies. `map.json` becomes `{ areas: [{ id, title, sections: [{ id, title, package, holds }] }] }`. An index id the map lacks lists under area `other`. In the repo, `pnpm spec` runs the same operation as `keel docs` (`tooling/spec.mjs` calls `run(["docs", ...])`), which closes 0807: one renderer, one count.

### Titles
A title names what the section holds, in full words. `tooling/titles.json` holds `clipped` (a clipped form and the words that replace it: `a11y` accessibility, `deps` dependencies, `compat` compatibility, `e2e` end-to-end, `pii` personal data, `sim` simulation, `config` configuration, `env` environment, `impl` implementation, `info` information, `repo` repository, `auth` authentication, `i18n` locales) and `names` (words that are the name a thing goes by: `CLI`, `MCP`, `LSP`, `API`, `CSP`, `DOM`, `JSON`, `HTML`, `CSS`, `URL`, `CI`, `WCAG`, `OpenAPI`, `SQLite`, `PGlite`, `GitHub`, `iOS`, `Z3`). `docs-pack --check` (in `pnpm check`) reports:
- D0019: a section in no area, or in two.
- D0020: an area file no map row names, a map row with no area file, or an area row naming no section.
- D0021: in a section title, an area title or a `holds` text, outside backticks: a `clipped` word (the message gives the words to use), or a word mixing letters and digits or holding two capitals that is neither a diagnostic code nor in `names`; a `holds` over 90 characters.

The check catches the clipped forms; it cannot catch a full word that drops meaning ("Proofs"). What prevents that is structural: there is one title, the section's own, and the area that lists it has room.

## Area table
Every section, main line and open lanes (lane sections marked *). Count is main line + lanes.

| area | title | sections | count |
| --- | --- | --- | --- |
| values | Schemas, formats, value types, locales and message sets | k.schema, k.formats, std.money, std.temporal, std.text, std.brands, std.i18n, std.messages, std.copy | 9 |
| state | Reactivity, stores, transactions, capabilities and state charts | k.reactive, k.store, k.ctx, k.owner, k.errors, std.statecharts, std.geo | 7 |
| client | Components, the compiler, bundles, served documents and forms | k.component, k.compiler, k.boundary, k.bundle, k.runtime, k.resume, k.claim, k.defaults, k.place, k.head, k.forms | 11 |
| routes | Routes, the module contract, guards and API routes | k.router, k.contract, k.routes, k.guards, k.prefix, k.api, std.health, std.contracts | 8 |
| ui | Styling, widgets, host elements and accessibility | k.ui, k.looks*, k.schemes*, k.a11y, k.a11y-static, k.aria, k.roles, k.host-element, k.host-code, std.headless, std.options, std.lists, std.tables | 11 + 2 |
| server | The thin server, users, the identity mount, services and jobs | k.server, k.leave, k.user, k.mount, k.mount-scope, k.serverlog, k.services, k.openapi, k.server-deps, std.jobs, std.schedules, std.workflows | 12 |
| deploy | Deployables, deploy files, client hosting and native shells | k.topology, k.deploy, k.hosting, k.compat, k.shell, k.scaffold-shell, k.return, k.opening, k.links, std.shells, std.capacitor, std.tauri | 12 |
| data | Durable storage, concurrent writes and app data | k.persist, k.sync, k.data, std.db, std.postgres, std.postgres-changes | 6 |
| live | Channels, live views, the outbox and races | std.channels, std.channels-limits, std.live, std.offline, std.outbox, std.outbox-owner, std.conflicts | 7 |
| tools | The checker, explanations, the CLI, installed docs and scaffold | k.check, k.check-cache, k.explain, k.host, k.cli, k.docs, k.scaffold, k.scaffold-service, std.report, std.timings | 10 |
| testing | The harness, exploration, proofs, simulation and end-to-end tests | k.testing, k.test-run, k.requests, k.model, k.prove, k.sim, k.drive, k.drive-law, k.e2e*, k.e2e-page* | 8 + 2 |
| evidence | The ledger, evidence bundles, sessions and production tallies | k.ledger, k.ledger-items, k.evidence, std.sessions, std.sessions-served, std.sessions-redact, std.multi, std.monitor | 8 |
| security | Headers, origins, secrets, personal data, escapes and unsafe | k.security, k.origins, k.privacy, k.reveal, k.privacy-reads, std.tokens, k.review, k.escapes, k.unsafe | 9 |
| libraries | Module manifests, libraries, publishing and grants | k.module, k.library, k.library-pack, k.parity, k.library-pages*, k.grants*, k.code-grants*, k.approvals* | 4 + 4 |

122 + 8 = 130 sections. Largest area: ui, 13. `holds` for std rows starts from the std index's one-line text, rewritten in full words; kernel rows are written from each section's first paragraph.

Titles restored: every map title becomes the section's own. The 36 main-line rows that differ go back (k.store "Store and transactions", k.drive "Driving a simulation", k.model "Exploring a store's transactions", k.user "Request user and caller lifetime", k.security "Response headers, CSP and the caller cookie", ...). From the lanes: k.prove "Proving invariants", k.a11y "Accessibility", k.privacy "Secrets and personal data", k.server-deps "Server dependencies", k.library-pack "Library publishing", k.compat "Surface compatibility", k.review "Review of escapes", k.compiler "Compiler and artifacts", k.check "Checker and diagnostics", k.persist "Storage and durable state", k.deploy "Production entry and deploy files", k.looks "Library looks", k.schemes "Color schemes", k.e2e "End-to-end tests", k.e2e-page "End-to-end pages".

## Alternatives
- Raise `spec.map` and `docs.map`: refused by the briefs, and it breaks principle 8 (the sum is already 6,199).
- One map, fewer columns (drop status and the one-line text): buys about 500 tokens once; at one row per section the map grows with every section and the problem returns in a few lanes.
- An `area:` and `holds:` line in every section's head, maps fully generated: one fewer file per area, but about 25 tokens on each of twelve sections already within 100 of 3,100, forcing splits now; an area file costs nothing there and conflicts only where two lanes add to one area, as adjacent appended rows.
- A search command over all text (`--for` as grep): what `pnpm spec --for` is today; unranked, it fills ten lines with mentions and misses the defining section.
- Keep the code ranges table: its blocks span areas (E155x names eleven sections in three areas), so it cannot sit under one area, and `--for <block>` gives the taken codes exactly.

## Spec diff
- k.docs: opening sentence; Packed files (`map.json` areas, `glossary.json`); new Areas and Titles paragraphs; Forms (`<area>`, `--for <block>`, `--for <name>`); records `docs.area`, `docs.entry` with `holds`, `docs.code`, `docs.term`, `docs.hit`; E1052 covers an unknown area; The Keel repo (area maps, `pnpm spec`); Budgets (the three levels and the sum); Conformance (three bullets reworded, seven added). Status `implemented` until the new clauses are covered.
- The map: the k.docs row's status. The rest of the map, the area files and the std index are the builder's (Migration).
- Glossary: `area`.

## Conformance diff
In `packages/cli/conformance/` (k.docs; `docs-areas.test.ts`, `docs-for-keys.test.ts`, and `docs-repo-tree.test.ts` for the repo bullet), each from the k.docs text:
- Changed: "With `@keel/std-tables` installed nowhere ... `keel docs <area>` for the area `map.json` gives `std.tables` lists it with `installed: false`."; "An installed package whose `index.json` lists an id `map.json` lacks: `keel docs` ends its areas with `other` ..."; "`keel docs` emits a `docs.area` per `map.json` area in map order, then a `docs.entry` per skill, and no section's `docs.entry` ...".
- New: the area listing (`keel docs a`), `--for E155x` and `--for E15xx`, `--for renderRoute` counts and the plain-text exclusion, the glossary term ignoring case and the empty match, E1052 for an unknown area, the repo area map, MCP `{ id: 'a' }`.
- Tooling (`tooling/test/docs-pack.test.ts`, not conformance): D0019, D0020, D0021 each on a fixture tree; `map.json` and `glossary.json` shapes; `pnpm spec <area>` output equals `keel docs <area>` in the repo.

## Migration
The builder, in this order, in one lane:
1. `spec/00-map.md` rewritten as above; `spec/areas/<area>.md` for the fourteen areas, rows in the table's order with `holds`; `spec/std/README.md` keeps only the file-format sentence (its table moves to the areas, its wave lines go).
2. `tooling/docs-pack.mjs`: `readSections` drops `mapTitle` and `tableTitles`, reads areas; `buildDocs` writes `map.json` areas and `glossary.json`; `--check` adds D0019 to D0021 and `tooling/titles.json`.
3. `packages/cli/src/docs/` (`readDocs`, `docsCommand`, `InstalledDocs`): area ids, `other`, the three `--for` kinds, the new records; repo mode prints area maps. `packages/cli/src/mcp.ts`: the `docs` tool's description names areas (within `mcp.tools-list`).
4. `tooling/spec.mjs` runs `keel docs`; `--map` goes (`pnpm spec` alone is the map). `tooling/budgets.mjs` measures `spec.area` and `docs.area` for every area and the outputs through the one operation; `tooling/budgets.json`: `spec.map` 400, `spec.area` 500, `docs.map` 900, `docs.area` 500 (lowered or new; `spec.section`, `docs.section` 3,100 unchanged).
5. `docs/OUTPUT.md`: the record kinds, the Budgets line, D0019 to D0021. `packages/server/src/internal/seeOf.ts` and `packages/cli/src/internal/explainCommand.ts`, `coverageGaps.ts`: comments that cite the map's Code ranges or status key cite k.docs.
6. Readers: `.claude/skills/keel-architecture` and `keel-package-dev` (`pnpm spec` then `pnpm spec <area>`); the published skills (`packages/cli/skills/*`, copied by `node tooling/docs-check.mjs --write`) name their area beside the sections a first build needs (`keel docs client`), which answers the app trials' finding 2; the `AGENTS.md` block template in `@keel/scaffold`; `README.md`, `CONTRIBUTING.md`, `docs/WORKFLOW.md`; `evals/tasks/*/spec-slice.txt` if they quote map rows. `CLAUDE.md` is the operator's (For the operator).

Open lanes, before and at merge:
- Now, in every lane: stop editing `spec/00-map.md` and `spec/std/README.md` rows other than the lane's own. `lane-r-look` and `lane-r-e2e` restore the main line's map (`git checkout jdforsythe/test-impl -- spec/00-map.md`) and remove their new rows; their sections stay readable with `pnpm spec <id>` (no gate requires a map row), so `spec.map` passes with no trimmed title. `lane-std-sessions` and `lane-std-formats` remove their added rows and keep `spec/std/README.md` one-line edits out of the file. Status changes go in the section's own `status:` line, which every lane already writes.
- Merge order: this lane (text only); then `lane-server-up`, `lane-r-household` and `lane-r-defect` in any order (no map rows beyond status); then the 0246 build; then `lane-std-sessions`, `lane-std-formats`, `lane-r-look`, `lane-r-e2e` in any order. At merge each takes the main line's `spec/00-map.md` and `spec/std/README.md` whole and appends one row per new section to its area file (the table's starred rows), with `holds`; D0019 fails until it does. A lane that merges before the build adds no map row.

## Token impact
| what an agent loads | before | after |
| --- | --- | --- |
| repo, fresh start (the map) | 1,643; 3,099 with the std index | 343 |
| repo, typical task (map, one area, two median sections) | 4,697; 6,153 with the std index | about 3,730 |
| repo, worst case (map, index, largest section) | 6,199 | at most 4,000 |
| app, `keel docs` | 1,689 | about 710 (240 areas, 472 skills) |
| app, `keel docs` then one area | 1,689 | about 1,010 |

k.docs grows from 1,432 to 2,673 tokens (limit 3,100). The k.docs map row shortens by its status. No size budget moves in this pass.

## For the operator
1. Principle 8 is kept, and its arithmetic stated in k.docs Budgets. Recommendation: add to principle 8 "The map, one area and one section fit in it." so the levels' limits are tied to the principle, not to a file.
2. `docs.map` counts the skill entries with the areas; the skill list is not spec, so it sits outside the 4,000. Recommendation: keep.
3. `CLAUDE.md` read order: "retrieve sections with `pnpm spec <topic>`" becomes "`pnpm spec` lists the areas, `pnpm spec <area>` an area, `pnpm spec <id>` a section, `pnpm spec --for <code, name or term>` finds one". Recommendation: apply with the build.
4. Area ids are words app authors type (`keel docs data`). Recommendation: accept the fourteen above; renaming one later is an RFC, as a glossary term is.
5. `pnpm spec --map` and the code ranges table go; `--for E155x` replaces the table. Recommendation: accept.
6. The glossary ships in `@keel/cli` (`docs/glossary.json`). Recommendation: accept; the terms are the words the diagnostics and skills use.
7. Backlog 1100 closes: the sum holds by construction with 3,100. 1043 (std.postgres, 2,763 today) stays a size matter, split when a clause needs the room.
