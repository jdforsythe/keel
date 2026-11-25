# RFC 0238: library entries, store makers, a library's lifted E1207, std-workflows' server entry

Status: accepted (ADR-0260), accepted by the orchestrator on 2026-11-25, to be confirmed by the operator. Amends RFC 0163 (k.library: a library's files are read as the app's, D4) for three rules a library meets as an app module does not, and std.workflows for where its entry runs. Amends k.module (E1151, Conformance #23), k.leave (Store makers, Conformance #15 and #16), k.check (App code), k.reactive (API, Rules, Conformance #21), k.library (In an app, E1151) and std.workflows (API, Conformance #9). No new code; no glossary term.

## For the operator
1. **An entry needs no `public.exports` line.** Recommended: `public.exports` lists file stems, and an entry is no file, so listing it is E1154; the library's `exports` map is already the one place a package names its entries. Reverse by letting `public.exports` name entries; every library with `./tools` or `./server` then lists them twice.
2. **A store maker is judged at its callers, not in the library.** Recommended: the classes a maker's store holds are the caller's, so only the caller's call can be judged. Reverse by keeping E1107 at the library's `store` call; std-statecharts' `chart` then reports in every app that lists it, with nothing the app can change.
3. **E1207 joins the lifted codes for a library's file only.** Recommended: k.parity already places a library's detached scope under its `unsafe/`; an app module keeps E1207 inside its lifted ranges, so an app still cannot detach a scope.
4. **std-workflows' whole entry is server-only.** Recommended: its API is server code (E2351); no `./server` subpath, so no app import moves. A client file loses the value `WorkflowsInstances` (the inspector's schema) from the entry; none imports it.

## Decisions
- D1: a subpath a library's `package.json` `exports` names as written, with no `*`, other than `.`, is an entry. An import of `@<scope>/<name>/<entry>` is no E1151, whatever `public.exports` lists; E1152 still asks for the `deps` entry. Any other subpath, one a `./*` pattern reaches among them, names a file and `public.exports` judges its stem, as today.
- D2: in a library's file that is neither server-only nor test code, a `store` call, or a call of a store maker, whose state schema the static read (k.privacy-reads) can take but for parts that are each a parameter of the top-level function holding the call, or a non-computed member of one, makes that function a store maker. The library's call is not judged; each call of the maker in judged code is, at the call's first character, its state schema read at the caller's arguments by the maker's argument paths.
- D3: the arguments of `s.enum` and `s.literal` of `@keel/schema` are values, not read, in every state schema E1107 reads.
- D4: E1207 is not reported inside a lifted range of a library's file (`node_modules/<name>/<f>`, k.library In an app); an app module's lifted range still reports it. structure-lint S0014 counts an E1207 finding the app's reading makes in a library package's lifted range as an escape (k.unsafe: "a lifted code the app's reading makes").
- D5: `@keel/std-workflows`' entry `.` is `src/index.server.ts`. A value import of the package in client-reachable code is E1004; a type-only import is none.

## Problem
Moving the stdlib onto the library format (RFC 0163 slice 4, `tasks/p1/std-on-the-format.md` lane 1) put four packages under the app's reading of every rule. Four rules then reported code an author could not fix:
1. **E1151 and E1154 together.** std-workflows imports `@keel/std-jobs/tools` (9 sites in `src/tools/`), std-schedules the same (3). E1151 asked for `tools` in std-jobs' `public.exports`; listing it there is E1154, as no file exports `tools`. A library's subpath entry had no way to be public. The same holds for an app importing `@keel/std-channels/server` once std-channels is a library.
2. **E1107 at std-statecharts `src/chart.ts:80`.** `chart(id, spec)` builds its store from `s.object({ state: s.enum(states), data: spec.data })`: `spec` is the caller's, so the read answers `'unknown'` and E1107 reports `store state not readable at spec` in every app that lists the package. The read cannot know the classes; the caller's schema holds them. `s.enum([first, ...rest])` over `spec.states` was unreadable too, though an enum's members are strings, never a `.pii()` node.
3. **E1207 at std-statecharts `src/chart.ts:92`.** A chart declared at module level owns a detached scope, as kernel and stdlib code may (k.reactive). Read as a module's file it is E1207, and k.check lifts no E1207, so even k.parity's answer (put it under `unsafe/`) still reported it.
4. **E1551 and E1107 in std-workflows.** `commitStores` outside a `*.server.ts` file is E1551, and `compileStores.ts:42` is E1107. Renaming the internal files and `workflow.ts` to `*.server.ts` clears both, and then `src/index.ts`, a client file, re-exports a server-only file: E1004.

## Proposal
- k.module Rules: E1151 excepts a library's entries (D1), the fix unchanged. k.library In an app: E1151 reads "an app file imports only its entries and its `public.exports`".
- k.leave: a **Store makers** paragraph after E1107 (D2, D3), stating where the read looks: the caller's argument at each parameter, then the object literal field each member names, through a `const` bound to one; a destructured parameter stands for its whole argument; a step that cannot be taken reads the value reached so far; a missing argument reads nothing; an argument the read cannot take is E1107 `store state not readable at <part>; …` at the call. Makers are found by name through imports and the library's entries, or as a namespace member (`c.chart`); a maker that calls a maker is one.
- k.check App code: in a library's file E1207 is a lifted code too (D4). k.reactive: only kernel and stdlib code, and a library's lifted ranges, create a detached scope; E1207's Rules entry names the exception.
- std.workflows API: the entry is the server-only `src/index.server.ts` (D5).

## Alternatives
- **No change: each library restructures instead.**
  - Entries: std-jobs would have to expose its tool readers as files (`@keel/std-jobs/keyFindings`, through `./*`), each listed in `public.exports`: one subpath per helper, a public surface wider than `./tools` and a second path to the same code. std-channels' `./server` cannot become a file without moving every app import. Rejected.
  - Store makers: `chart` would take a schema the library can read, which means no schema from its caller; the chart's `data` would be typed `unknown` and validated by hand, or each app would write its own `store` call and lose `chart`'s single entry. Or `chart` would move under `unsafe/` with E1107 lifted, and E1107 would then check nothing for every chart's data, the classes the caller passes among them. Both rejected: the first gives up the API, the second the check.
  - E1207: no restructure clears it. A chart's scope must outlive its creator; nesting it in the creator's scope disposes it with the first component that declared it.
  - std-workflows: a `./server` subpath, as std-channels and std-postgres have, clears E1004 and moves every app import of `workflow` and `flows`; the bare entry would then hold types only. Rejected: the package has no client value to keep at `.`.
- **Entries listed in `public.exports`.** One list for files and entries; E1154 would accept a name the `exports` map holds. Rejected: it writes each entry twice, and a library could list an entry its `exports` lack, which the check would have to catch as a third code path.
- **Store makers declared by the library** (a `storeMaker(fn, paths)` marker, or a field in `module.ts`). Explicit, but a new API whose paths the author writes by hand and can get wrong, and the check would still have to verify them against the function. Inferring them from the read that already runs gives the same paths with nothing to write. Rejected.
- **E1207 lifted in every lifted range.** Simpler, one code list. Rejected: an app would detach a scope by wrapping it in `unsafe(`, which k.reactive keeps to kernel, stdlib and library code.
- **E1207 skipped in every library file**, ranges or not. Rejected: k.parity asks a library to put a detached scope under `unsafe/` with its justification, so the escape counts in the ledger as any other does.

## What an app can now do, and what bounds it
- **Import a library's entries without a `public.exports` line.** An app reaches only what the library's `exports` map names whole, which the library ships on purpose; a file reached through a `./*` pattern stays judged by `public.exports`, and every entry import still needs the `deps` entry (E1152). An app's own modules have no `package.json` `exports`, so nothing changes for them.
- **Hide a store's classes behind a library function.** It cannot: the function is a store maker, and each call in the app's client code is judged with the caller's schema. A maker gains no exemption; the library's `store` call is skipped only because its schema is a parameter the read follows to the caller. A caller whose argument the read cannot take is told so at the call (`store state not readable at make(); cannot show its .pii() classes`). What is bounded: a chain of makers calling makers is followed 16 deep, a path of an argument the read cannot step into (a spread, a computed key) reads the value reached so far, and a missing argument reads nothing, so `chart('shop.a')` with no spec is no E1107 (it holds no schema to read). A library's server-only and test files make no maker; their stores never reach `#k-state`.
- **Treat `s.enum` and `s.literal` arguments as unreadable values.** They are values, typed as strings or literals, and no schema node sits in them; reading them could only report a schema the read could not take where none exists.
- **Detach a scope.** An app module cannot: E1207 holds in its `unsafe/` lifted ranges. A library can, inside a justified `unsafe(` range of its `unsafe/` folder, which the ledger counts (`unsafe +1` for std-statecharts' `unsafe/detached.ts`) and structure-lint S0014 sees as an escape. An app writing its own workspace library to reach this does so as for format types (RFC 0237): it gets a library, a manifest, a public surface and every other rule over its files.
- **Import std-workflows in client code.** It can no longer import a value; its types still import anywhere. No client file used one.

## Spec diff
Applied in this commit. The sentences are quoted as they stand in the lane, with their rewrites where the builder's wording did not say what the code does.
- k.module Rules, E1151. Was: "its contract and a package's entries excepted (a subpath its `exports` write whole: `@<scope>/<name>/server` for `./server`, `./tools` alike; one a `./*` pattern reaches is a file)". Now: "E1151 import of a non-public export of another module, its contract and a library's entries excepted (fix adds it to that module's `public.exports`): an entry is a subpath the library's `package.json` `exports` names as written, with no `*` (`@acme/x/server` for `./server`, `@acme/x/tools` for `./tools`), and `public.exports` does not judge it; any other subpath, one a `./*` pattern reaches among them, names a file, judged by its stem". The rewrite says "library's" (only a library has `exports` to read) and that any subpath not an entry is a file, not only a pattern's. Conformance #23. Status `implemented`; the map row follows.
- k.library In an app, third bullet: "E1151 (an app file imports only its entries and its `public.exports`)". Status stays `proposed`.
- k.leave: the builder's sentence ("In a library's file (k.library), a `store` call whose state schema the read cannot take only at parameters of its top-level function, or their members, makes that function a store maker, as does such a call of a store maker; the call is judged at each call of the maker instead (by name through imports, or as a namespace member), read at the argument paths its state schema takes (`spec.data` of `chart(id, spec)`: an object literal's field, through a `const`), at the call. `s.enum` and `s.literal` arguments are values, not read.") becomes the **Store makers** paragraph. Added: server-only and test files make no maker; what a top-level function is; the library's call is not judged; entries are followed; a destructured parameter, a step that cannot be taken and a missing argument; the E1107 a caller's unreadable argument gets; `s.enum` and `s.literal` hold for every state schema, not makers alone. Conformance #15 and #16. Status `implemented`; the map row follows.
- k.check App code. Was: "nor E1207 in a library's file (k.library)". Now: "and in a library's file (one at `node_modules/<name>/<f>`, k.library In an app) neither is E1207". Its clauses are unchanged (k.reactive holds the new one), so its status stays.
- k.reactive API: "so only kernel and stdlib code, and a library's lifted ranges, create one (E1207)". Rules. Was: "is E1207, but in a lifted range of a library's `unsafe/` (k.check App code)". Now: "is E1207, except inside a lifted range of a library's `unsafe/` file (k.check App code)". Conformance #21. Status `implemented`; the map row follows.
- std.workflows API. Was: "The package's entry is server-only, `src/index.server.ts` (k.boundary): a value import of `@keel/std-workflows` from client code is E1004; its types import anywhere." Now: "The package's entry `.` is the server-only file `src/index.server.ts` (k.boundary Server-only): a value import of `@keel/std-workflows` in client-reachable code (k.boundary Reach) is E1004, and a type-only import is none." Conformance #9. Status `implemented`; the `spec/std/README.md` row follows.
- k.unsafe and k.parity are unchanged: S0014 already counts "a lifted code the app's reading makes", and k.parity's By kind already places a library's detached scope under its `unsafe/`.

## Conformance diff
By the `conformance-writer`, from the spec text, under `rfc:0238`. Fixture libraries are written into a temporary project's `node_modules/`; kernel conformance imports no std package.
- `packages/check/conformance/module-E1151-library-entries.test.ts`: k.module#23.
- `packages/check/conformance/leave-E1107-store-makers.test.ts`: k.leave#15 and #16.
- `packages/check/conformance/E1207-library-lifted.test.ts`: k.reactive#21.
- `packages/std-workflows/conformance/entry-server-only.test.ts`: std.workflows#9 (`keel check` over a temporary project that links the package).

## Migration
None: nothing is released.

## Token impact
k.leave about +310; k.module about +230; k.reactive about +190; std.workflows about +90; k.library +5, at 3,100 of 3,100; k.check +10. Map unchanged in size. `@keel/check` is re-based at 89.5 kB (91,196 B) by the builder's commit.

## Build order
1. The builder's commits on `lane-std-jobs` (80dec10a, eb67d499, 449ceb31) hold the implementation and its unit tests.
2. This commit: RFC, ADR, spec text, map rows.
3. `conformance-writer`: k.module#23, k.leave#15 and #16, k.reactive#21, std.workflows#9.
4. The builder un-skips them; a changeset for `@keel/check` and `@keel/std-workflows`.
