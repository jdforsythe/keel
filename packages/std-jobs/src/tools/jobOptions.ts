import { type RuleDef, defineRule } from "@keel/check";

/**
 * E2505 (std.jobs, k.check registry): `attempts` or `timeoutMs` of a `job` that is not a positive integer. `job` throws
 * it when the module loads; the registry holds its explanation.
 */
export const jobOptions: RuleDef = defineRule({
  code: "E2505",
  see: "std.jobs",
  message: "attempts or timeoutMs is not a positive integer",
  explain: "Both are whole numbers above zero. Fix: job({ input, attempts: 5, timeoutMs: 30000 }, fn).",
  check: () => [],
});
