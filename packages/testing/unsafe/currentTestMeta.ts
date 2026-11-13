import { unsafe } from "./unsafe.ts";

interface Worker {
  readonly current?: { readonly meta?: Record<string, unknown> };
}

/**
 * The `meta` record of the test running now under vitest (the task's custom metadata, which vitest hands to its
 * reporters as `testCase.meta()`), or `undefined` outside a test (a hook, or no vitest).
 */
export function currentTestMeta(): Record<string, unknown> | undefined {
  return unsafe(
    "vitest keeps the running task on its worker global, which @keel/testing reads without depending on vitest; `meta` is its documented reporter channel",
    () => {
      const worker = Reflect.get(globalThis, "__vitest_worker__") as Worker | undefined;
      return worker?.current?.meta;
    },
  );
}
