/**
 * Which project files an operation reads: `none`; `query` (code, spec markdown, `.keel` artifacts, the ledger);
 * `tree` (every text file: structural operations read manifests, `package.json`, `turbo.json`, CI).
 */
export type FileScope = "none" | "query" | "tree";
