# ADR-0272: k.docs: areas, a two-level map and lookups by code, name and term (RFC 0246)

**Status:** accepted (orchestrator, 2026-11-26), to be confirmed by the operator.

**Context.** The spec map (1,643 of 1,660 tokens) and `keel docs` (1,689 of 1,690) list every section, so each new section forced a lane to shorten other rows' titles; lanes shortened different rows and conflict at merge. Map plus stdlib index plus the largest section is 6,199 tokens against principle 8's 4,000. A section's title and status are written twice and drift. An API name or a glossary term has no lookup in an app.

**Decision.**
- Three levels: the map lists areas (`spec/00-map.md`), an area lists its sections with what each holds (`spec/areas/<area>.md`), a section is one file. Fourteen areas; every section in exactly one.
- Limits: `spec.map` 400, `spec.area` 500, `spec.section` 3,100, so map, area and section sum to 4,000; `docs.map` 900 (areas and skills), `docs.area` 500, `docs.section` 3,100.
- A section's title and status live only in its first two lines; area maps print them joined with the area file's `holds`.
- `--for` takes a code, a code block, an API name or a glossary term; the code ranges table leaves the map; `@keel/cli` packs the glossary.
- `keel docs` and `pnpm spec` are one operation with one form for areas, sections and skills.
- Titles in full words; `docs-pack --check` refuses clipped words (D0021) and unplaced sections (D0019, D0020). A full map or area splits; no title is shortened to fit.

**Alternatives.** Raising the limits (refused, and past principle 8); one map with fewer columns (buys one round); an area line in every section head (pushes twelve near-full sections over 3,100); grep as the index (unranked); keeping the code ranges table (its blocks span areas).

**Consequences.** A fresh start reads 343 tokens of map instead of 1,643 to 3,099; `keel docs` prints about 710 instead of 1,689. Lanes add a section by appending one row to one area file. The builder writes the area files, tooling and budgets; open lanes restore the main line's map rows before merging. k.docs reads `implemented` until its new clauses are covered. Backlog 1100 and 0807 close with the build.
