/**
 * Which project files an operation reads: `none`; `docs` (the installed packages' packed docs, the running
 * `@keel/cli`'s map and skills, the agent files; in the Keel repo `spec/` and the cli's skills); `query` (code, spec
 * markdown, `.keel` artifacts, the ledger, the agent files);
 * `ledger` (`query` plus each package's Stryker report `reports/mutation/mutation.json`); `tree` (every text file:
 * structural operations read manifests, `package.json`, `turbo.json`, CI).
 */
export type FileScope = "none" | "docs" | "query" | "ledger" | "tree";
