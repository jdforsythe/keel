import { type RuleDef, defineRule } from "@keel/check";

/**
 * E2554 (std.schedules, k.check registry): a `schedule` entry whose `job` is not in its queue or not its module's, or
 * whose `input` the job's schema refuses. `schedule` throws it when the module loads; the registry holds its
 * explanation.
 */
export const scheduleEntry: RuleDef = defineRule({
  code: "E2554",
  see: "std.schedules",
  message: "schedule entry job or input refused",
  explain:
    "An entry's job is a key of the queue, prefixed by the entry's module id, and its input parses. " +
    "Fix: 'orders.nightly': { cron: '0 3 * * *', job: 'orders.digest', input: { id: 'a' } }.",
  check: () => [],
});
