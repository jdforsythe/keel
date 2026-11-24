# RFC 0226: k.check-cache: the type pass keeps results across processes, keyed by content

Status: accepted (ADR-0248), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Adds k.check-cache; amends k.check (Pipeline, one sentence), k.compat (Rules, E1562's message), the map. Decides the conformance changes and the bound rule of backlog 1079.

## Decisions
- D1: Keel has a type cache, as a specified part of `keel check`, keyed by content. The mtime cache the lane built is replaced, not kept.
- D2: An entry records every file system question the pass asked and its answer (file bytes as SHA-256, existence, real paths, listings); it is used only when all of them, asked again, answer the same. No modification time is read.
- D3: On whenever the project root has `node_modules`, in `node_modules/.cache/keel`; on in CI too. No flag and no output marker: a hit is byte-identical to a cold run, and deleting the folder clears it.
- D4: The in-process memo of `check()` is held to the same probes.
- D5: Four of the five proposed conformance changes are taken with guards; the bound rule stays the fixed one in `docs/TESTING.md`. The measured scaling is not built.

## Problem
Backlog 1079: the cli conformance files that spawn `keel` time out at 120 s under load. The lane cut work three ways. One of them, a disk cache of the type pass, changes what a kernel tool does with no spec text and no conformance. It reuses an entry while every file `getSourceFile` returned, plus the root `package.json` and the `node_modules` folder, keeps its modification time. A stale entry hides an error, and `keel check` is the gate.

### Review of the built cache
Run in a scratch project under `$TMPDIR` with `node packages/cli/src/bin.ts check` (the first project of the Conformance below). Each "shown" row: the warm run printed `ok check 1 files, 0 errors, 0 warnings`; a run with the folder deleted printed `E1751 modules/a/a.ts:3:14 TS2322 Type 'string' is not assignable to type 'number'.`

| hole | verdict |
| --- | --- |
| A file rewritten with its old modification time (`cp -p`, `tar`, rsync, a CI cache restore, a rewrite within the clock tick of a coarse file system; npm extracts every package file with one fixed time) | real, shown |
| A dependency's `package.json` changed (`types`, `exports`): `readFile` reads are not recorded, only `getSourceFile` | real, shown |
| A new file that shadows a resolution (`foo/sub.ts` beside `foo/sub.d.ts`), below the top level of `node_modules`; paths probed and found absent are not recorded | real, shown |
| A well-formed entry with its diagnostics removed | real, shown; out of scope (D3: trusted as `node_modules` is) |
| A truncated entry | not a hole: JSON fails, a miss, the right E1751 printed |
| Workspace links (`@keel/*` to `packages/*/src`): a file read through the link is stamped at its real path, so an edit to it is seen; a new file or a `package.json` change in the target is the two real holes above | real, argued |
| A deleted file: a read file that is gone stamps -1 and misses; an absent-probed one is the shadowing hole | partly real, argued |
| TypeScript version | covered (in the key) |
| Keel version: the key stamps `@keel/check`'s own code by mtime and size, so a same-size edit restored with its time is missed; the pass's code is all in `@keel/check` | real but narrow, argued |
| Node version | not a hole: the pass's answers do not depend on it |
| Check options and rule set | covered: the pass sees only files and the dropped codes, both in the key; `--code`, `--limit` and rules run after it |
| Environment | not a hole: compiler options are fixed and resolution goes through the host |
| Two writers at once | not a hole: a pid-named temporary file and a rename; eviction can delete another's fresh entry, a miss |
| A cache copied between machines | real with the holes above: entries carry absolute paths and mtimes, and a CI cache restores both |
| Time moved backwards | not a hole for results (mtimes are compared for equality); it changes only which entry eviction drops |
| The in-process memo and parsed-file cache (`typeCheck.ts` `memo`, `disk`) revalidate by mtime too | real, argued: an editor or `keel mcp` session has every hole above |

## Proposal
A content key, as in **Spec diff**. The pass already reads every file it depends on; hashing those bytes (about 4 MB for this monorepo's kernel graph and the TypeScript libs) and asking the recorded existence questions again costs tens of milliseconds against a 2 s program. A hit replays the probes and returns the stored result; a miss runs the pass with a recording host and writes the entry.

The law: for any inputs and any folder state, `keel check` with the cache prints the bytes and exit code a run with the folder deleted prints. It is the spec's opening sentence and the property in Conformance.

What is stored: absolute paths, SHA-256 hashes and the diagnostics `keel check` prints (messages and fixes may quote source lines). The folder sits under `node_modules`, which no package publishes and no repository commits.

### Items 2 and 3 of the lane
- `bin.ts` enabling Node's compile cache is sound: V8 checks each cached entry against the source's hash and its own version and flags, entries go to `os.tmpdir()/node-compile-cache`, never the user's project, and `NODE_DISABLE_COMPILE_CACHE=1` turns it off. `module.enableCompileCache` exists from Node 22.1.0 and the root `engines` says `>=22`: the named import fails to link on 22.0. No spec.
- `tooling/vitest-config.ts` sizing a package's own run from the load is sound and is tooling, as `docs/TESTING.md` Test concurrency describes for `pnpm test`; that paragraph gains the package run. No spec.

### Conformance changes of `tasks/0963-to-p1/proposed/1079-cli-spawn.md`
1. `compat-support.ts` `projectMany`, `e1562Of`, `baseSurfaceOnce`: taken. `e1562Of` reads the entry id at the start of the message, which the code does and k.compat did not say; k.compat's E1562 rule now says it.
2. `compat-accepts-property.test.ts`, six pairs per run in one project: taken with guards. Each pair is still judged by its own entry and, when accepted, still gets its 20 `gen(B)` values, so the clause holds per pair. Two guards: in the first test, the per-entry counts sum to the run's E1562 count (no E1562 goes unattributed, so a message format change cannot make pairs look accepted); in the widening test, the run's whole E1562 list is empty, not each entry's. The proposal's claim that the six pairs are the six runs' pairs is not so (one array draw is not six draws); the comment says only "six pairs drawn from the same arbitraries".
3. `E1562-base-output-removed.test.ts`, the three fields as three entries in one pass: taken with one guard. It covers every field where `constantFrom` could repeat one, and asserts one E1562 per entry; it also asserts the run's E1562 count is 3, so "one E1562" stays one and not more.
4. `compat-0092.test.ts:59` `baseSurfaceOnce`: taken. The base tree is the same in every run and the case rebuilds before reading. It rests on a base `surface.json` being a function of the tree alone; the key is every file of the tree.
5. `E1562-base-route-change.test.ts` `baseSurfaceOnce`: taken, on the same ground.

`surface-normal-sources` needs no change: its `build` after each `check` hits the cache.

### The bound rule
One rule: the fixed bounds `docs/TESTING.md` states (a test declares its timeout; the watchdog kills at `allowed × 2 + 30 s`). The measured scaling is not built: a second rule, and a cold `keel --version` measures the machine, not a file's work. With the batching each file does a number of spawns fixed by its cases (6 and 5 in the batched files), and the builder measured each file at 4.5 to 22.9 s alone under load 38 to 56, well inside its 120 s at the loads measured.

## Alternatives
- No cache; the tests share work alone. Rejected: k.check promises an incremental pass, `keel check` after `keel build` is the generated CI's sequence, and `surface-normal-sources` (about 90 spawns of check then build over one tree) halves only with it. A sound cache is cheap to state.
- Keep mtimes with a guard (size, inode, a "racy" window as git uses): each guard closes one hole; none closes the unrecorded probes, and restored times defeat all of them.
- Off in CI, or opt-in: a second behaviour to test and document. A content key is safe to restore from a CI cache.
- A flag or an output marker for a hit: a flag is a second way to clear it; a marker breaks "two runs on an unchanged tree produce identical output".

## Spec diff
Applied in this commit.
- New `spec/kernel/k.check-cache.md` (status proposed): Where, Key, Probes, Entries, eight Conformance bullets.
- k.check Pipeline: "Across processes, step 1 reuses results kept on disk (k.check-cache)."
- k.compat Rules, E1562: "naming the id" becomes "its message starting with the id". Behaviour unchanged.
- `spec/00-map.md`: one row.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/cli/conformance/check-cache.test.ts`: k.check-cache#1 to #5 and #8 (spawned `keel check`, a scratch project per case).
- `packages/check/conformance/check-cache.test.ts`: k.check-cache#6 and #7 (`check()` in process).
- The five changes above, with their guards, in `packages/cli/conformance/compat-support.ts`, `compat-accepts-property.test.ts`, `E1562-base-output-removed.test.ts`, `compat-0092.test.ts`, `E1562-base-route-change.test.ts`. Each keeps its `// Spec:` header and `SLOW` of 120 s.

## Migration
None; unreleased.

## Token impact
- Spec: k.check-cache about 1,300 tokens; k.check grows by about 15 to under 3,100; k.compat by 4.
- `spec.map` re-based 1,500 to 1,510 (1,501 with the row); `docs.map` 1,560 to 1,570 (1,564).
- `@keel/check` size: measure against its 65 kB in the build.

## Build plan
1. This commit: RFC, ADR, spec text, map and budgets. 2. `conformance-writer`: the eight clauses and the five changes. 3. Build:
- `packages/check/src/internal/typeCache.ts`: key and entry as specified; `ownCode` hashes bytes; no `mtimeOf`; entry format version 1.
- `packages/check/src/internal/typeCheck.ts`: a recording host over `getSourceFile`, `readFile`, `fileExists`, `directoryExists`, `realpath` and `getDirectories` (the `jsx-runtime` probe through it too); `memo` validated by replaying probes; the `disk` parsed-file map keyed by content, not mtime.
- `packages/check/src/types/CheckOptions.ts` and `packages/cli/src/internal/runCheck.ts`: doc comments say content, not mtime; `keel build`'s check passes the same folder.
- `packages/cli/src/bin.ts`: root and cli `engines` `>=22.1`, or call `enableCompileCache` only where it exists.
- `docs/TESTING.md` Test concurrency: a package's own run sizes itself from the load.
- `packages/check/test/type-cache-disk.test.ts` rewritten to the probes; the changeset reworded; `tasks/BACKLOG.md` 1079.

## For the operator
1. **Keel has the cache, keyed by content.** Recommended: yes; removing it costs `surface-normal-sources` and every check-after-build its type pass.
2. **On by default, in CI too, no flag, no marker.** Delete `node_modules/.cache/keel` to clear it.
3. **Stored diagnostics may quote source lines** (TS messages, fixes) under `node_modules`. Recommended: accept; it is what the terminal printed.
4. **A forged entry is trusted.** Recommended: accept; `node_modules` already runs code.
5. **No load-scaled timeout.** The fixed bounds stay the one rule.
