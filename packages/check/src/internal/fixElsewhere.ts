import type { Finding } from "../types/Finding.ts";

/**
 * A kernel rule's fix that edits a file of the project other than the finding's (E1817's in `tokens.ts`): the
 * unified diff its `check` computed, keyed by the finding it returned. `runRules` attaches it to the diagnostic.
 */
export const fixElsewhere = new WeakMap<Finding, string>();
