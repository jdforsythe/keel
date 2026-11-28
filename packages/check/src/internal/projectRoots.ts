import type { SourceFile } from "../types/SourceFile.ts";

/**
 * The absolute folder each project array `check()` builds is rooted at (its `root` option), so a rule's reach
 * resolves the project's specifiers on disk (`reachResolve`). A project array no `check()` call made has none.
 */
export const projectRoots = new WeakMap<readonly SourceFile[], string>();
