/** `.gitignore` of a library: build and tool output, and the host project `keel test --e2e` writes (k.e2e Libraries). `.keel/ledger.json` is committed. */
export function libraryGitignore(): string {
  return "node_modules\ndist\n.turbo\ncoverage\nreports\n.keel/e2e-host-*/\n";
}
