// re-exports only: `@keel/testing/a11y`, what `keel test`, `keel ledger` and `keel evidence` read (k.a11y Claims)
export { a11yRules } from "./a11yRules.ts";
export { criteriaOf } from "./criteriaOf.ts";
export { WCAG_CRITERIA } from "./WCAG_CRITERIA.ts";
export { writeA11yReport } from "./writeA11yReport.ts";
export type { A11yCase } from "../types/A11yCase.ts";
export type { A11yRun } from "../types/A11yRun.ts";
