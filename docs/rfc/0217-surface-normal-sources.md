# RFC 0217: k.compat: `sources` hashes each file's normal form, so a formatter's change is not E1005

Status: accepted (ADR-0239), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Amends k.compat (Surface, a new Sources paragraph, Conformance), the map. From backlog 1015.

## Decisions
- D1: `sources` keeps its place and its shape (`{ [path]: "fnv1a:…" }`); each value is the hash of the file's normal form instead of its text. `version` stays 2.
- D2: the normal form is a JSON value built from the file's syntax tree, hashed with `hashOf` as an artifact's `data` is. `keel check` computes it from a parse, never by evaluating code.
- D3: it drops comments, whitespace, line endings, a byte order mark, parentheses, semicolons, trailing commas, member separators, quote style and escapes (literals are their cooked values), number spelling, regular expression flag order, the quoting of non-computed keys, JSX text spelling, and import layout (declaration order, place, specifier order and split).
- D4: it keeps everything else in source order, object property order and types among them; import bindings as a set of (source, attributes, type or value, imported name, local name); side-effect imports in their order among themselves.
- D5: the form is Keel's own encoding, not the parser's serialization; a Keel release that changes it changes recorded hashes, and `keel check` reports E1005 until `keel build`, as for any artifact. No TypeScript compiler is involved.

## Problem
`keel build` writes `.keel/surface.json` with `sources`: each project file the surface run evaluated (every file Vite transformed while loading the contracts and `routes.ts` files: 150 in `apps/household`, 92 in `apps/golden-1`), with `hashOf(text)`. `keel check` reads it (`staleSource`, `packages/check/src/internal/compat/staleSource.ts`): a missing or changed file makes the surface stale, which is E1005 (`generatedEdits.ts`, "is stale, X changed; run keel build") and skips every `--base` comparison on that surface (`compatChecks.ts`).

So a byte that cannot change the surface still makes it stale. Biome's import sort, a re-indent, a comment, a quote change in any of those 150 files is E1005 until `keel build` runs, and `keel build` then rewrites `surface.json` with new hashes and no other change: a diff in a generated file for a change that has no effect on it. In one evening four lanes regenerated `apps/*/.keel/surface.json` after a formatter pass.

What E1005 protects here is real and stays: the surface is what `keel check --base` compares against the deployed one (E1562, E1563, W1564), and what agents read for the HTTP and store surface. A surface that no longer matches its code gives wrong verdicts there. The check must notice a change that can alter the surface, and should not notice one that cannot.

## Proposal
### What is hashed
Each `sources` value is `hashOf(normalForm(file))`. The normal form is built from the file's syntax tree, parsed as the compiler parses it (by extension, TypeScript and JSX; oxc), by a walker in `@keel/compiler/internal` that both `keel build` (the surface run) and `keel check` (`staleSource`) call, so the two cannot disagree.

### What the form drops
Exactly what a formatter changes without changing meaning:
- comments; whitespace and line breaks; line ending style; a byte order mark;
- parentheses (the tree carries grouping), semicolons (the tree carries statement boundaries, so an ASI hazard still shows as a different tree), trailing commas, interface and type literal member separators, a union's leading `|`;
- quote style and escapes: a string, template or JSX attribute literal is its cooked value; a template's raw text (for tagged templates) with `\r\n` read as `\n`, as the language reads it;
- number spelling: a number is its value (`1_000`, `1e3`, `1000.0`), a bigint its decimal;
- regular expression flag order (Biome and Prettier sort flags);
- a non-computed property key's quoting (`a`, `'a'`, `"a"` are one; a number key is its value's string);
- JSX text spelling: text under the JSX whitespace rule the compiler applies (`cleanJsxText`), entities decoded, an expression child holding only a string literal read as text, adjacent text joined, empty text dropped. This is what Prettier's and Biome's JSX re-wrapping and `{" "}` insertion change;
- import layout: the order of import declarations, their place among other statements (imports are hoisted), the order of specifiers, and how specifiers are split among declarations (Biome 2 merges declarations from one source).

### What the form keeps
- Each binding an import declaration makes, as a member of a set: source, attributes (sorted), `type` or value (`import type { X }` and `import { type X }` are one), imported name (`default`, `*` for a namespace) and local name. So the import set is kept and its order is not: adding, removing or renaming a binding changes the hash.
- Each declaration with no specifier (`import './p.ts'`, `import {} from './p.ts'`), in its order among the file's other such declarations. Its evaluation order can matter; Biome and TypeScript's organize-imports treat it as a barrier and do not move it.
- Everything else in source order: statements, object properties (key order is observable: `Object.keys`, JSON, a schema's field order), arguments, array elements and holes, class members, JSX attributes and children, `export` lists, type annotations and declarations.

Types are kept although they cannot change an evaluated surface: dropping them would make the form TypeScript-aware beyond the parse, and a type edit that is not a formatter's is rare enough to pay one `keel build` for. The order of binding imports relative to side-effect imports is dropped: a reorder that moves a bound module's evaluation past a side-effect import is not seen. Keel's surface is sorted-key JSON of schemas, and a module whose top level depends on a sibling import's evaluation order is outside what a module top level does in Keel (k.compiler Build-time evaluation); a formatter does not move side-effect imports.

### Determinism
- Across platforms: line endings and a BOM are dropped, literals are cooked values, the form is canonical JSON, the hash is FNV-1a over its UTF-8 text. No path separator enters it (paths are keys, `/`-separated as today).
- Across parser versions: the walker emits Keel's own encoding: per node, its ESTree type and the named fields above, in a fixed order. A parser upgrade that keeps the ESTree shape keeps every hash. The parser is a locked dependency of `@keel/compiler`; an upgrade that changes the shape, or a Keel release that changes the form, changes recorded hashes, and `keel check` reports E1005 on each surface until `keel build`, as it does for any artifact the compiler writes differently. A unit test in `@keel/compiler` pins the form of a fixed source to an exact hash, so such a change is seen in the release that makes it.
- Across TypeScript versions: no TypeScript compiler takes part; the TypeScript version an app pins does not touch the form.

### Cost
`keel check` builds the form only for files a surface lists (150 at most in the tree today), one tree walk each over the parse `keel check` already makes of that file when it compiles the project. The walk is linear in the tree, with no I/O beyond the files `keel check` already reads. The k.check budget (under 1s warm on golden app 1, 92 listed files) is measured in the build; an incremental run may cache a file's form by its text hash.

### What the user sees
Nothing new: no code, no message. A formatter pass over app code leaves `keel check` clean and `keel build` writes `surface.json` byte for byte the same. An edit that changes a kept part is E1005 as today, naming the file. Existing `surface.json` files are regenerated by the build.

## Alternatives
- **(a) Hash the evaluated surface and recompute it in `keel check`.** `keel check` never evaluates app code (k.check Pipeline); it cannot recompute the surface, so it could only compare the file's own `hash`, which it already does.
- **(c) Drop `sources`, staleness a `keel build` concern only.** Then a stale surface checks clean, `keel check --base` compares a surface that no longer describes the code, and an agent reads a wrong one. E1005 is the one place that catches it before CI.
- **A token stream (tokens without comments and whitespace).** Parentheses, semicolons and trailing commas are tokens a formatter adds and removes; dropping `;` tokens makes `a\n(b)` and `a;\n(b)` one, a missed change.
- **Hash only contracts and `*.server.ts` files.** Schemas live in `*.schema.ts` and other evaluated files; a change there would go unseen. And the bytes problem remains for the files kept.
- **Run `keel build` after the formatter.** Couples two tools, costs a Vite run per format, and still writes a diff in a generated file for a change that has none.
- **Strip types too.** Fewer rebuilds on type-only edits, at the cost of a TypeScript-aware form. Not proposed.

## Spec diff
Applied in this commit.
- k.compat (to `implemented` until its four new clauses are covered): Surface says `sources` holds each file's normal-form hash; a new **Sources** paragraph defines the form, what it drops and keeps, its encoding, a missing or unparsable file, and that `keel check` builds it only for listed files; Conformance gains four clauses.
- Map: the k.compat row reads `implemented`. No size change.
- No new code, no glossary term, no new section. k.compiler is unchanged: E1005 on a stale surface is still "a `.keel/` file older than its sources", with "older" read through the form.
- Ledger: new rows for the four clauses at `none`, regenerated on the main line, not by hand.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/cli/conformance/surface-normal-sources.test.ts`: the first two new clauses (after a real `keel build` of a small project, the listed edits, alone, then `keel check`) and the `.tsx` clause; the build is `keel build`, as `compat-0092.test.ts` runs it.
- `packages/cli/conformance/surface-normal-base.test.ts`: the `--base` clause.
- Existing cases: none reads a `sources` value; `a changed byte of .keel/surface.json is E1005` is unchanged.

## Migration
None. Every `.keel/surface.json` in the tree is regenerated by `keel build` in the build.

## Token impact
- Spec: k.compat grows by about 1,100 tokens to about 2,450, of the 3,400-token section budget (`ok budgets 302 measured`). The map is unchanged in size.
- `keel explain E1005`: unchanged wording ("a .keel/ file older than its sources").
- `@keel/compiler`: one walker; `@keel/check` gains no dependency (it already imports `@keel/compiler/internal`). Size measured in the build against each package's budget.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the four clauses. 3. Build:
- `packages/compiler/src/internal/sourceForm.ts` (new): `sourceForm(path, text)` returns the normal form or `undefined` when the file does not parse; `sourceHash(path, text)` its `hashOf`. Exported from `@keel/compiler/internal`, with a pinned-vector unit test.
- `packages/cli/src/internal/surfaceRun.ts`: `sources[path] = sourceHash(path, text)`; `surfaceOf.ts` doc comment.
- `packages/check/src/internal/compat/staleSource.ts`: compare `sourceHash`, `undefined` counting as changed; reuse the compile parse where `check.ts` holds it.
- Regenerate every `apps/*/.keel/surface.json` and `examples/*/.keel/surface.json`.
- Docs: `docs/guide/build-golden-1.md` (the E1005 paragraph: a formatter's change is not stale), the `@keel/check` README if it names content hashes, a changeset, `tasks/BACKLOG.md` (1015).

## For the operator
1. **Normal form over dropping `sources`.** Recommended: yes; E1005 is what keeps `--base` verdicts and agents' reads true, and a parse-only form costs `keel check` one walk per listed file.
2. **Types kept.** Recommended: yes; a type edit costs one `keel build`, and the form stays a syntax-tree walk with no TypeScript knowledge.
3. **Binding imports reorder freely around side-effect imports.** Recommended: yes; side-effect imports keep their order among themselves, formatters do not move them, and Keel's surface does not depend on sibling evaluation order.
