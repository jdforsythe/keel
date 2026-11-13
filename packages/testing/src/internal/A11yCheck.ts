import type { A11yRun } from "../types/A11yRun.ts";

/** A render check as the harness records it in the running test's `meta.a11y`; the reporter adds the test. */
export type A11yCheck = Pick<A11yRun, "route" | "component" | "rules" | "violations">;
