/**
 * Whether the project `project` (k.ledger-items Projects: `packages/cli`, `apps/golden-1`, `.`) lies inside a ledger
 * `scope` prefix: the empty scope holds every project, and a scope inside the project's folder (`packages/a/src`) or
 * one that is a prefix of it (`packages/`) holds it too; `.`, the ledger's own folder, holds every path. An app item
 * scope such as `golden-2:` holds no package.
 */
export function projectInScope(project: string, scope: string): boolean {
  const dir = project === "." ? "" : `${project}/`;
  return dir.startsWith(scope) || scope.startsWith(dir);
}
