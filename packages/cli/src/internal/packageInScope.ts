/**
 * Whether the package `pkg` (`packages/<pkg>/`) lies inside a ledger `scope` prefix: the empty scope holds every
 * package, and a scope inside the package's directory (`packages/a/src`) or one that is a prefix of it (`packages/`)
 * holds it too. An app scope such as `golden-2:` holds none.
 */
export function packageInScope(pkg: string, scope: string): boolean {
  const dir = `packages/${pkg}/`;
  return dir.startsWith(scope) || scope.startsWith(dir);
}
