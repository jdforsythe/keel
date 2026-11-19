import { type RuleDef, defineRule } from "@keel/check";
import { runnersEdits, runnersFindings } from "@keel/std-jobs/tools/internal";

/**
 * E2553 (std.schedules, k.check registry): a module with `schedules.server.ts` whose literal `runners` lacks
 * `schedules` (fix adds it, with its import), or that has no `runners.server.ts`.
 */
export const runnersLackSchedules: RuleDef = defineRule({
  code: "E2553",
  see: "std.schedules",
  message: "runners lacks schedules; the module's schedules never fire",
  explain:
    "Schedules fire where runners.server.ts lists them. " +
    "Fix: export const runners = [jobs] -> export const runners = [jobs, schedules].",
  check: ({ file, ast, project }) => runnersFindings(file, ast, project, "schedules"),
  fix: runnersEdits,
});
