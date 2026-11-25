/**
 * Whether a rule `defineRule` registered runs on this call (k.check-cache In one process): always, unless the package
 * that defined it is a library (k.library) that `importDeps` imported first in this process (`byDeps`) and is not in
 * `scope` (`stdInScope`). A rule the caller registered, and one whose origin cannot be told (`null` or absent: a
 * bundled build, no frame outside `@keel/check`), runs.
 */
export function ruleInScope(
  owner: string | null | undefined,
  scope: ReadonlySet<string>,
  byDeps: ReadonlySet<string>,
): boolean {
  return owner === undefined || owner === null || !byDeps.has(owner) || scope.has(owner);
}
