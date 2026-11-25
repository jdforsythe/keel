import { currentTask } from "./currentTask.ts";

/**
 * The `meta` record of the test running now under vitest (the task's custom metadata, which vitest hands to its
 * reporters as `testCase.meta()`), or `undefined` outside a test (a hook, or no vitest). Read and write its fields
 * with `Reflect`.
 */
export function currentTestMeta(): object | undefined {
  const task = currentTask();
  const meta = task !== undefined && "meta" in task ? task.meta : undefined;
  return typeof meta === "object" && meta !== null ? meta : undefined;
}
