import { unsafe } from "./unsafe.ts";

interface Task {
  readonly type?: string;
  onFinished?: (() => unknown)[];
}
interface Worker {
  readonly current?: Task;
}

/**
 * Registers `end` to run when the vitest test running now ends, passed or failed, after its `afterEach` hooks (as
 * vitest's `onTestFinished`, which may also be registered from a `beforeEach` or `afterEach`). Outside a test (a
 * `beforeAll`, a `describe` body, module scope, or no vitest) nothing is registered.
 */
export function onTestEnd(end: () => void): void {
  unsafe(
    "the running vitest task is on its untyped worker global; its onFinished list is where onTestFinished registers, which a hook may also reach",
    () => {
      const worker = Reflect.get(globalThis, "__vitest_worker__") as Worker | undefined;
      const task = worker?.current;
      if (task?.type !== "test") return;
      task.onFinished ??= [];
      task.onFinished.push(end);
    },
  );
}
