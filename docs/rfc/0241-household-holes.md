# RFC 0241: a control's value in `find`, token names at `keel check`, a package's files above their folder

Status: implemented (ADR-0263), accepted by the orchestrator on 2026-11-25. Amends k.testing (Harness, Conformance), k.ui (Style props, Rules, Conformance), k.a11y-static (Tokens, Token names, Conformance), k.server-deps (Files a bundled package reads, Rules, Conformance), the map. From `apps/household` (backlog 1107, 1114, 1118).

## Decisions
- D1 (1107): `find(id)` gains `value`: the live DOM `value` of an `input` (not `checkbox`, `radio` or `file`), a `textarea` or a `select`, as a string; absent on every other element but a host element, whose `value` k.host-element already defines. `text` stays the trimmed text content.
- D2 (1114): `keel check` judges every token name an app file writes as a string literal (a token prop, a responsive key, a `look`) against the project's tokens: a name its groups lack is E1801 at the literal. With no `tokens.ts` every such name is E1801, its message ending `: the project has no tokens.ts`. A `tokens.ts` that is E1807 has no name judged. No new code.
- D3 (1114): the clause lives in k.a11y-static (Token names), the section that already says how `keel check` reads `tokens.ts`; k.ui points to it. k.ui is at 2,856 of 3,100 tokens and the paragraph with its group table would take it past the limit.
- D4 (1118): a bundled package file's literal `new URL('../x', import.meta.url)` that stays inside its package's folder is served: `keel build` copies the file into `dist/<name>/` at the path with its leading `../` segments removed and rewrites that one argument in the bundle to `./` and that path. A path that leaves the package's folder stays E1014, message `reads <f>, outside its package`.

## Problem
**1107.** k.testing says `find(id)` returns `{ id, role, name, text, state }`. `openHarness.ts` builds `text` from `textContent`, which an `<input>` never has and a `<textarea>` holds only as its default. So a household test that typed into the item field, or rendered it prefilled, read `text: ''` and could not assert the value. `Found` already carries `value?: JsonValue` for host elements (k.host-element Harness), unset on every other element.

**1114.** E1801 for a token name at a use exists only inside `compileStyles` (`@keel/ui/css`), which `evaluateProject` runs when the project has a `tokens.ts`. There an unknown name is an evaluation problem: `keel dev` and the plugin's `buildStart` print it as a warning, `vite build` throws at `renderStart` with no source position, and `keel check` reports nothing (`runCheck.ts` hands the tokens to E1804, E1809 and the `base` and look half of E1801, `missingLook.ts`). With no `tokens.ts`, `entrySource` skips `compileStyles`, so no command reports anything, and k.a11y-static says nothing is judged for contrast. In the household, a page styled with names no `tokens.ts` defined had a clean `keel check`, a CSS file with no rules for them, and every 1.4.3 item at `none`.

A survey of the tree: every app and example with a `modules/` folder has a `tokens.ts` but `tooling/fixtures/injected10-app`, which writes no style literal. A library's own folder reads its root `tokens.ts` (k.library-pack Own folder), which `keel scaffold library` writes.

**1118.** k.server-deps copies a file a bundled package names inside the reading file's folder and makes anything above that folder E1014, a limit it states. PGlite 0.5's `dist/contrib/<ext>.js` each read `new URL("../<ext>.tar.gz", import.meta.url)`, the archive beside `dist/index.js`. So an app cannot load a PGlite contrib extension in a built server. The limit holds because the bundle resolves every argument against `server.mjs`: `../x.tar.gz` lands in `dist/`, outside `dist/<name>/`.

## Proposal
### `find(id).value` (k.testing Harness)
`value` is the element's DOM `value` property, read when `find` runs, so it is what a person typed or what the markup prefilled, untrimmed. The elements are the ones whose value is a string a person edits or picks: an `input` other than `checkbox`, `radio` and `file`, a `textarea`, a `select` (its first selected option's value, the DOM's rule). A checkbox's or radio's state is already `state.checked`; a file input's value is a browser-made path. Every other element has no `value` key, as today.
```ts
const t = render(ItemForm, { props: { name: 'Milk' } })
expect(t.find('item.name').value).toBe('Milk')
await t.fire('item.name', { type: 'input', value: 'Milk 2' })
expect(t.find('item.name').value).toBe('Milk 2')
expect(t.find('item.name').text).toBe('')
```
`Found` keeps `value?: JsonValue`; a control's is a `string`. `text` is unchanged.

### Token names at `keel check` (k.a11y-static Token names)
A token prop's groups, as `vocabulary.ts` holds them: `p`, `px`, `py`, `m`, `mx`, `my`, `gap` in `space`; `w`, `h` in `size`, then `space`; `bg`, `fg` in `color`; `radius`, `font`, `fontSize`, `weight`, `shadow`, `border` in the group of their name. In an app file `keel check` reads, on a base element or `Part`:
- each string literal given as a token prop, directly, as a value of a responsive object, under `states`, or in a part style of `styles`;
- each key of a responsive object but `base`;
- each `look` written as a string literal (today's `missingLook`, which judges it only with tokens).

A name in none of its prop's groups, a key that is no `breakpoint` token and a look that `look` lacks are each one E1801 at the literal or key, no fix:
```
E1801 modules/items/ItemRow.tsx:12:15 fg="nope" is not a color token
E1801 modules/items/ItemRow.tsx:14:22 breakpoint "xl" is not a breakpoint token
E1801 modules/items/ItemRow.tsx:9:10 p="2" is not a space token: the project has no tokens.ts
```
`<value>` is clipped at 20 units, which keeps the longest message (`breakpoint`, with the suffix) within 89. A keyword prop (`direction`, `align`, `justify`, `wrap`, `textAlign`) is closed by its type and not judged here. A computed value (`fg={tone}`) is not read; its `TokenName` type and the render hold it.

A `tokens.ts` that is E1807 gives no tokens; judging every use against nothing would bury the one error to fix, so no name is judged there. With no `tokens.ts` at all, a project that writes no token name is clean; one that does is told at each use. `keel build` runs `keel check` first (k.boundary Build gate), so it exits 1 at the source position before evaluation runs; the evaluation's own E1801 stays as the build's second line of defence.

A library file in an app is read as the app's (k.library) and judged against the app's tokens; a library's own folder against its root `tokens.ts`.

### A package's files above their folder (k.server-deps)
A literal `<a>` that names a path above the reading file's folder and inside its package's folder is copied into `dist/<name>/` at that path normalized with its leading `../` segments removed, and the bundled call's argument is rewritten to `./` and that path. For PGlite, `contrib/amcheck.js`'s `../amcheck.tar.gz` lands at `dist/<name>/amcheck.tar.gz`, beside `pglite.data`, as the package lays them out from `dist/index.js`. The package's folder is a library's real folder, else the folder its name names under the last `node_modules/` (`node_modules/@electric-sql/pglite/`), so `../` from a file directly in it, or `/x`, stays E1014, message `reads <f>, outside its package`. Two copies landing on one path with other bytes are E1014 as today. No other text of the bundle is rewritten.

The stated limit becomes: a package that reads a file outside its own folder, or two reads whose copies land on one path with other bytes.

## Alternatives
- **1107: `text` gives an input's value.** One field would mean two things, and a `textarea`'s text content is its default, not its value; `value` already exists on `Found` for host elements.
- **1107: `state.value`.** `state` mirrors the a11y tree's states (`A11yState`); a value is no ARIA state.
- **1114: a new code for "no `tokens.ts`".** One fault, a name no token declares, is E1801 already; the message says why.
- **1114: a warning.** A warning never fails a run (OUTPUT.md), which is how the household's names went unnoticed.
- **1114: the clause in k.ui.** Over its limit; trimming 180 tokens of k.ui would touch clauses conformance quotes.
- **1118: copy to `dist/` above `dist/<name>/`.** A deployable's files would leave its folder, and two deployables would share them.
- **1118: keep each package file's own module URL.** The bundle has one `import.meta.url`; it would mean not bundling the package.

## Spec diff
Applied in this commit.
- k.testing (`implemented` until its clause lands): `find(id)` gains `value`; Conformance #28. Trimmed without changing meaning to fit 3,100 tokens: the two `resumeDocument` bullets merged, the pointer paragraph headed `Elsewhere`, shorter wording in a11y, `location()`, `url`, Failure output and E1720.
- k.ui (`implemented`): Style props points to k.a11y-static Token names for E1801 at a use; Rules E1801 names the second case; Conformance #28.
- k.a11y-static (`implemented`): intro and Tokens sentences; new paragraph Token names; Conformance #5 gains its no-`tokens.ts` E1801s; #9 and #10 new.
- k.server-deps (stays `implemented`): package's folder defined; the `../` bullet; the stated limit; E1014's message `outside its package`; Conformance #11.
- Map: three status cells to `implemented`. No row, no code block.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/testing/conformance/find-value.test.ts`: k.testing#28.
- `packages/check/conformance/token-names-e1801.test.ts`: k.a11y-static#9, #10 and the E1801 half of #5; k.ui#28. `fixtures-by-code.ts` keeps its E1801 fixture.
- `packages/cli/conformance/server-deps-files.test.ts`, which holds #6, extended with #11.
- Existing cases: check conformance fixtures that write token literals with no `tokens.ts` now carry E1801s; tests selecting by code are unaffected, and the writer gives a whole-clean fixture a `tokens.ts` or drops the literal.

## Migration
None. No app is released.

## Token impact
k.testing 3,040 to 3,100; k.ui 2,856 to 2,936; k.a11y-static 1,542 to 2,108; k.server-deps 2,790 to 3,036. The map shrinks by six tokens. `keel explain E1801` gains its second case.

## Build plan
- `packages/testing/src/internal/openHarness.ts`: `find` adds `value` for the three controls.
- `packages/check/src/rules/missingLook.ts` (or a new `unknownToken.ts` beside it): the token-prop, responsive-key and look reads; with no project `tokens.ts` the suffixed messages; none when the tokens artifact is absent and `tokens.ts` exists. The group table from `@keel/ui`'s `vocabulary` is the one source. `EXPLANATIONS.ts` E1801 entry.
- `packages/compiler/src/internal/bundledFiles.ts`: package folder, the `../` copy path, the new message; `packages/compiler/src/vite.ts`: a `transform` on bundled package files in the server environment rewriting each such literal before bundling.
- Docs: `keel-testing` and `keel-client` skills, `@keel/testing` and `@keel/check` READMEs, changesets, `tasks/BACKLOG.md`.

## For the operator
1. **D3, Token names in k.a11y-static, not k.ui.** Recommended: keep; k.ui is at its limit and k.a11y-static already says how check reads `tokens.ts`.
2. **D2, no new code.** Recommended: keep E1801 with the suffixed message.
3. **D4, the bundle is rewritten for `../` reads.** Recommended: yes; it is the one way PGlite's contrib extensions serve from `dist/<name>/`.
