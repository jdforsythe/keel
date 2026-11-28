import { type RuleDef, defineRule } from "@keel/check";
import { keyFindings } from "@keel/std-jobs/tools";
import { callsOf } from "./internal/callsOf.ts";
import { editOf } from "./internal/editOf.ts";

/**
 * E2552 (std.schedules, k.check registry): a `schedule` call outside `modules/<id>/schedules.server.ts`, or a key of
 * its table not prefixed by the module id. The fix prefixes the key.
 */
export const scheduleKey: RuleDef = defineRule({
  code: "E2552",
  see: "std.schedules",
  message: (f) =>
    f.data?.home === undefined
      ? `schedule key '${String(f.data?.key).slice(0, 24)}' is not prefixed by module '${String(f.data?.id).slice(0, 24)}'`
      : "schedule outside modules/<id>/schedules.server.ts",
  explain:
    "One schedule table per module, in modules/<id>/schedules.server.ts, keyed by module-prefixed ids. " +
    "Fix: schedule(jobs, { nightly }) -> schedule(jobs, { 'orders.nightly': ... }).",
  check: ({ file, ast }) =>
    keyFindings(file, callsOf(ast, "@keel/std-schedules", "schedule"), "schedules.server.ts", 1),
  fix: editOf,
});
