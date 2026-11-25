---
"@keel/check": minor
"@keel/cli": minor
"@keel/compiler": patch
---

`keel ledger` counts `unsafe` and `hostElements` over each library's files (k.library Ledger), a file the project's own read holds counted once; it shows an installed library's ledger `exports` as `ledger` records with `evidence: 'library <version>'`, after the project's and outside the summary counts, the written `exports` and `rungs`, and `--diff`; the written file ends with `libraries`. `keel check` reports E1162 at each `deps` entry naming an installed library whose `.keel/ledger.json` is missing, not a JSON object, fails its shape, or disagrees with the app's counts. The ledger file's read shape takes `version` 1, a `rung` among the six names, and optional `negativeTypes` and `libraries`. `@keel/check` exports `ledgerCount`, `LedgerFileSchema` and `readLibraryLedger`. A folder under `node_modules` is never a project root (`projectDirs`).
