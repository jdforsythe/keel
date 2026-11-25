/**
 * The vitest task running now, read from vitest's worker global (`__vitest_worker__.current`), or `undefined` outside
 * one (a hook, module scope, or no vitest). vitest gives the global no type, so it is read as `unknown` and each
 * caller narrows the fields it reads (`type`, `timeout`, `result.startTime`, `meta`, `onFinished`).
 */
export function currentTask(): object | undefined {
  const worker: unknown = Reflect.get(globalThis, "__vitest_worker__");
  if (typeof worker !== "object" || worker === null || !("current" in worker)) return undefined;
  const task = worker.current;
  return typeof task === "object" && task !== null ? task : undefined;
}
