/**
 * Which project files an operation reads: `none`; `query` (code, spec markdown, `.keel` artifacts, the ledger);
 * `ledger` (`query` plus each package's Stryker report `reports/mutation/mutation.json`); `tree` (every text file:
 * structural operations read manifests, `package.json`, `turbo.json`, CI).
 */
export type FileScope = "none" | "query" | "ledger" | "tree";
