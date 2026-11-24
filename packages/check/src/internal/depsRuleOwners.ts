/**
 * The `@keel/std-*` packages whose rules `defineRule` registered while `importDeps` imported the package first in this
 * process (k.check-cache In one process): their rules run only while the project's `deps` reach the package.
 */
export const depsRuleOwners: Set<string> = new Set();
