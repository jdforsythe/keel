const STD_PACKAGE = /^@keel\/std-/;

/**
 * Whether a rule `defineRule` registered runs on this call (k.check-cache In one process): always, unless the package
 * that defined it is known, is a `@keel/std-*` package, and is not in `scope` (`stdInScope`). An origin that cannot be
 * told (`null` or absent: a bundled build, no frame outside `@keel/check`) runs.
 */
export function ruleInScope(owner: string | null | undefined, scope: ReadonlySet<string>): boolean {
  return owner === undefined || owner === null || !STD_PACKAGE.test(owner) || scope.has(owner);
}
