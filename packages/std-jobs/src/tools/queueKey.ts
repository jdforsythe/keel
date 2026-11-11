import { type RuleDef, defineRule } from "@keel/check";
import { callsOf } from "./internal/callsOf.ts";
import { editOf } from "./internal/editOf.ts";
import { keyFindings } from "./internal/keyFindings.ts";

/**
 * E2501 (std.jobs, k.check registry): a `queue` call outside `modules/<id>/jobs.server.ts`, or a key of its table not
 * prefixed by the module id. The fix prefixes the key.
 */
export const queueKey: RuleDef = defineRule({
  code: "E2501",
  see: "std.jobs",
  message: (f) =>
    f.data?.home === undefined
      ? `queue key '${String(f.data?.key).slice(0, 24)}' is not prefixed by module '${String(f.data?.id).slice(0, 24)}'`
      : "queue outside modules/<id>/jobs.server.ts",
  explain:
    "One queue per module, in modules/<id>/jobs.server.ts, keyed by module-prefixed ids. " +
    "Fix: queue({ send }) -> queue({ 'orders.send': send }).",
  check: ({ file, ast }) => keyFindings(file, callsOf(ast, "@keel/std-jobs", "queue"), "jobs.server.ts", 0),
  fix: editOf,
});
