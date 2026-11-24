# ADR-0248: k.check-cache: the type pass keeps results across processes, keyed by content (RFC 0226)

**Status:** accepted (orchestrator, 2026-11-24, for the operator to confirm).

**Context.** To keep the cli conformance files inside their bounds under load, a disk cache of the type pass was built that reuses an entry while the files it read keep their modification times. In a scratch project it hid an E1751 after a rewrite with the old time, a dependency's `package.json` change, and a new file shadowing a resolution. `keel check` is the gate, and k.check promised an incremental pass with no cross-process text.

**Decision.**
- k.check-cache: entries in `<root>/node_modules/.cache/keel/` when `node_modules` exists, `check()`'s `typeCache` folder otherwise; on by default and in CI; no flag; no output marker.
- An entry is named by a hash of the format version, `@keel/check`'s version and code bytes, the TypeScript version, compiler options, root, case sensitivity, the checked files' paths and texts and the dropped codes.
- An entry records every file system question the pass asked and its answer (bytes as SHA-256, existence, real paths, listings) and is used only when all of them answer the same again. No modification time is read. The in-process memo follows the same probes.
- A hit is byte-identical to a run with the folder deleted, stated as a law with a property test. A broken entry is a miss and is rewritten; writes are a rename; 32 entries per folder, least recently written dropped.
- The batched cli conformance changes are taken with guards that every E1562 is attributed to an entry; E1562's message starts with its entry id. The test bound stays the fixed rule of `docs/TESTING.md`.

**Alternatives.** No cache, the tests sharing work alone; mtimes with guards (size, inode, a racy window); off in CI or opt-in; a flag or a hit marker; a timeout scaled by a measured cold start.

**Consequences.** A hit costs reading and hashing every file the pass read (tens of milliseconds). Stored diagnostics may quote source lines; a forged entry is trusted as `node_modules` is. Node's compile cache in `bin.ts` stays, with `engines` at `>=22.1`. k.check-cache reads `proposed` until it is built and its eight clauses are covered.
