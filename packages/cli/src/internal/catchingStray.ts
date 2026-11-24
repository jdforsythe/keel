import { type TestDiag, testResults } from "@keel/testing";

/**
 * Runs `work`, holding the process's `uncaughtException` and `unhandledRejection` for as long as it takes, and returns
 * what it resolved to (undefined when it threw) with one T0001 per error that reached the process or that `work` threw:
 * a run that dies on a stray socket error or a crash in vitest reports the cause instead of Node's crash trailer. Each is
 * made by `testResults`, located at its first app frame (never a `node_modules` one).
 */
export async function catchingStray<T>(
  root: string,
  work: () => Promise<T>,
): Promise<{ readonly value: T | undefined; readonly strays: readonly TestDiag[] }> {
  const caught: unknown[] = [];
  const hold = (e: unknown): void => {
    caught.push(e);
  };
  process.on("uncaughtException", hold);
  process.on("unhandledRejection", hold);
  let value: T | undefined;
  try {
    value = await work();
  } catch (e) {
    caught.push(e);
  } finally {
    process.off("uncaughtException", hold);
    process.off("unhandledRejection", hold);
  }
  return { value, strays: testResults([], caught, root).diagnostics };
}
