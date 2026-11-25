import { currentTask } from "./currentTask.ts";

/**
 * The timeout in ms of the vitest test running now and the epoch time in ms the runner started it at (before its
 * hooks), or `undefined` outside a test (a hook, or no vitest) and for a test with no timeout.
 */
export function currentTestBound(): { readonly timeout: number; readonly startedAt: number } | undefined {
  const task = currentTask();
  if (task === undefined || !("type" in task) || task.type !== "test") return undefined;
  const timeout = "timeout" in task ? task.timeout : undefined;
  const result = "result" in task ? task.result : undefined;
  const startedAt =
    typeof result === "object" && result !== null && "startTime" in result ? result.startTime : undefined;
  if (typeof timeout !== "number" || typeof startedAt !== "number") return undefined;
  return Number.isFinite(timeout) && timeout > 0 ? { timeout, startedAt } : undefined;
}
