import { currentTask } from "./currentTask.ts";

/**
 * Registers `end` to run when the vitest test running now ends, passed or failed, after its `afterEach` hooks (as
 * vitest's `onTestFinished`, which may also be registered from a `beforeEach` or `afterEach`: the task's
 * `onFinished` list). Outside a test (a `beforeAll`, a `describe` body, module scope, or no vitest) nothing is
 * registered.
 */
export function onTestEnd(end: () => void): void {
  const task = currentTask();
  if (task === undefined || !("type" in task) || task.type !== "test") return;
  const list = "onFinished" in task ? task.onFinished : undefined;
  if (Array.isArray(list)) list.push(end);
  else if (list === undefined || list === null) Reflect.set(task, "onFinished", [end]);
}
