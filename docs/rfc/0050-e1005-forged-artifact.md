# RFC 0050: `keel check` compares `.keel/` artifacts with the current sources (E1005 forged and stale)

Status: accepted (ADR-0039)

## Problem
- **Red team H2 (2026-11-07, backlog 0124).** E1005 missed a forged artifact. If you change `data` and recompute `hash`, `keel check` reports nothing. Repro: `check([{ path: ".keel/routes.json", source: canonicalJson({ data, hash: hashOf(data) }) + "\n" }])` returned `[]`.
- **Why.** `generatedEdits` checked only that a file was self-consistent: canonical bytes, and `hash === hashOf(data)`. It compared with the compiler's hashes only when the caller passed `artifacts.hashes`. No caller did: `runCheck` passed none. `check()` already compiled the code files, but never used the result for E1005.
- **The clause was false in spirit.** "Changing any byte of a file under `.keel/` makes `keel check` report E1005" held for one changed byte. It did not hold for a forged file, where many bytes change, the hash is recomputed and the file stays self-consistent.
- **Staleness was undefined.** An artifact built before a source changed was also self-consistent. Nothing said whether that was E1005.

## Proposal
1. **compiler: `artifactHashes(files, { topology })`.** A new public export of `@keel/compiler`. It takes root-relative project files and compiles the app sources among them. Nothing is evaluated or written. It returns `{ [fileName]: hash }` for the `.keel/` artifacts the compiler writes.
   - **App sources** are defined by one predicate, `isSourcePath`. `listSources`, which the Vite plugin uses, now uses it too, so `keel check` and the writer read the same set of files.
   - **`routes.json` is left out** when a routes manifest (`modules/<m>/routes.ts`) exists. Deriving it evaluates `routes.ts`, and k.check never evaluates app code (rfc:0023). With no manifest, `routes.json` is `{}`, and that is compared.
2. **check: E1005 compares with the current sources.** For a root `.keel/<name>.json`, `generatedEdits` also requires `hash === expected[name]` whenever `expected[name]` is known.
   - **Where `expected` comes from.** The caller's `artifacts.hashes` when that is an object. Otherwise `check()` derives it from `files` with `artifactHashes`, and only when a root artifact is checked, so the cost is zero otherwise.
   - **Nested `.keel/` dirs** (`apps/a/.keel/...`) are checked for self-consistency only. Their sources resolve from another root.
   - **The message says how to fix.** A self-consistent file with the wrong hash gets `generated .keel/<name> does not match its sources; regenerate`, and no fix: only a rebuild can write it. A file that is not self-consistent keeps `hand edit to generated .keel/<name>; revert and regenerate`. When only the bytes differ, the canonical-bytes fix stays.
3. **cli: hashes from the whole project.** When a `.keel/` file is among the checked files, `runCheck` passes `artifacts.hashes = artifactHashes(project, { topology })`. So `keel check .keel` compares against every source, not only the checked paths. A compile of golden-1 costs about 10 ms warm.
4. **Staleness is E1005** (decision). A file you forge and a file built before a source changed have the same shape: self-consistent, with a hash that is not what the current sources compile to.
   - **Why not tell them apart.** That needs provenance in the artifact, such as a hash of its sources. The forger can write that stamp as easily as the data. Any "stale" warning would be the forger's way out, and a forged file would drop to a warning.
   - **Why not skip stale files.** Then nothing would detect a forgery at all.
   - **So both get one code, and the fix is the same: regenerate.** The message names the sources, not a hand edit. The Vite plugin rewrites `.keel/` on every dev change, so a live project is never stale. Committed artifacts (the golden apps) must be rebuilt with their sources, which is the intent of read-only generated output.

5. **Amendment (backlog 0142): one source rule.** `keel build` compiled every code file except `*.test.*` and `*.config.[cm]?[jt]s`. That included `test/`, `tests/`, `conformance/` and dot dirs, so ids in `test/fixtures/Widget.tsx` reached `ids.json`. `artifactHashes` did not count them, so E1005 fired right after `keel build`, and rebuilding never cleared it.
   - **The rule.** `isSourcePath` is now the one rule, exported from `@keel/compiler`. A source is a JS/TS module with no dot segment and no `node_modules`, `dist`, `coverage`, `reports`, `test`, `tests` or `conformance` segment. It is not a `*.test.*`/`*.spec.*` file, a declaration (`.d.ts`, `.d.mts`, `.d.cts`) or a tool config (`*.config.*`, any extension).
   - **Who uses it.** `keel build`, `artifactHashes`, and the Vite plugin, in both `listSources` and the merge in `flush`. A module Vite transforms outside the rule is still lowered, but it never feeds `.keel/`.
   - **Which side won.** The Vite plugin's skip dirs, because test fixtures are not app code. `keel build`'s config exclusion, because tool configs are not app code either.
   - **Effect.** The Vite plugin no longer lists `vite.config.ts`, which has no JSX and contributed nothing. `keel build` no longer compiles test trees or dot dirs. The golden apps' artifacts are unchanged.

## Alternatives
- **Evaluate `routes.ts` in `keel check`.** That would close `routes.json` in projects with manifests. It breaks k.check "never evaluates app code" (a module that throws at top level must yield only static diagnostics), and it makes check run project code. Left to a k.check RFC if wanted.
- **A provenance stamp with a separate warning for stale files.** Rejected: the stamp can be forged (Proposal 4).
- **A keyed MAC over `data`.** It needs a secret that every checker holds, which a repo cannot keep.
- **Recompile in the CLI only.** That fixes `keel check` but not `check()`, which the backlog repro calls, and not the LSP and MCP callers that reuse it.
- **Verify a caller's `artifacts.hashes` (backlog 0143).** Not done. `artifacts.hashes` is a trusted caller input: `check()` compares against it as given. Only the cli derives it (`runCheck`, from the whole project). Other callers either pass the compiler's own `artifactHashes` or leave it out, and then `check()` derives it.
- **Reuse the compile `check()` already runs.** Its file set includes tests and tool configs, but the writer's file set does not. A separate compile of the app sources is cheap and exact.

## Spec diff
- **k.compiler Artifacts.** Adds "`keel check` recompiles the sources; a differing hash is E1005 (`routes.json` only without a `routes.ts`: it is evaluated)."
- **k.compiler Conformance.** Adds "A compared `.keel/` artifact with changed `data` and recomputed `hash`, or older than its sources, is E1005."
- **Editorial, to stay under 1,500 tokens (1,487 to 1,497).** Non-normative words are cut from Output ("no virtual DOM, no diffing"), Escaping ("Text children become text nodes", URL policy without "the one statement"), the `For` sentence, and the E1004 parenthetical: its rationale and its examples of files outside `modules/` are dropped. No rule changes.
- **Status.** k.compiler stays `conformance-covered`, and the new clause is cited by a conformance test.

## Conformance diff
- **Added** `packages/cli/conformance/artifact-forged-e1005.test.ts`, written by conformance-writer from the spec text. It runs the real binary over a temp project built by `@keel/compiler/vite` and covers:
  - a clean build;
  - a forged `ids.json` and the other derivable artifacts (data from other sources, hash recomputed);
  - a forged `routes.json` in a project without `routes.ts`;
  - a stale `ids.json` after a source edit;
  - `keel check .keel`;
  - the backlog repro through `check()`.
- **Changed** `packages/check/conformance/fix-diffs.test.ts`: the "genuine compiler artifact" fixture now carries the `C.tsx` it was compiled from. Without it, the artifact does not match its (empty) sources and is correctly E1005.
- **Changed** `packages/testing/conformance/compiler-keel-dir-tamper.test.ts`: `check()` now receives the built project's sources with its `.keel/` files, for the same reason.
- **Unit tests.**
  - For 0142, `cli/test/mutation-cmd-build.test.ts` adds "keel build then keel check: no E1005 with ids in test/fixtures and a *.config.ts". It fails with the old build filter. It also moves the source count to the shared rule. `compiler/test/mutation-project-pure.test.ts` adds config and `.d.mts` cases to `listSources`.
  - `check/test/rules.test.ts` and `check/test/mutants.test.ts` move their "intact" fixtures to `{}` data, which is what empty sources compile to.
  - They add cases for: forged; a routes manifest present; a nested dir; forged `ids.json` beside its source.
  - The `hashes null` and `hashes string` cases now derive `expected`, so they are E1005.
- `artifact-tamper-e1005.test.ts` is unchanged and green.

## Migration
- A committed `.keel/` that is older than its sources is now E1005. Run `keel build`, or `vite build` (which also writes `routes.json`), and commit the result. The golden apps and the inspector are current.
- `check()` callers that pass `.keel/` files without their sources get E1005 for every non-empty artifact. Pass the sources, or pass `artifacts.hashes`.
- `keel build` no longer compiles `test/`, `tests/`, `conformance/`, dot dirs, or `*.config.tsx`/`.jsx` files (0142). Ids that live only there leave `ids.json`.
- `@keel/compiler` gains `artifactHashes` and `isSourcePath`. `@keel/check` E1005 gains a second message.

## Token impact
- k.compiler: 1,487 to 1,497 tokens.
- E1005 explain: +8 tokens.
- Diagnostic output is unchanged in size: one record per artifact.

## Amendment (RFC 0055, backlog 0139, 0143, 0144)
- **`artifacts.hashes` is no longer trusted.** Alternatives above kept it as trusted caller input. RFC 0055 drops it: E1005 always derives its hashes, from `CheckOptions.project` (default `files`). A `.keel/<name>.json` the compiler does not write is E1005.
- **Nested `.keel/` dirs are compared.** Each is compared with the sources of the directory that holds it, not only checked for self-consistency. The cli reads them at any depth.
- **`routes.json` beside a `routes.ts`** is W1005 in `keel check` (not verified), and `vite build` warns W1005 before it rewrites a differing one.
