import { unsafe } from "./unsafe.ts";

/**
 * Awaits `run`; when it throws, `recover` answers whether it handled the throw, and when it did not the original error
 * is rethrown unchanged.
 */
export function recovering(run: () => Promise<void>, recover: (x: unknown) => Promise<boolean>): Promise<void> {
  return unsafe(
    "std.offline ends a flush that met an unknown throw by rethrowing that very error once the flush is released, while a rejected storage write is recovered in place, so the catch must see the original error that attempt would replace",
    async () => {
      try {
        await run();
      } catch (x) {
        if (!(await recover(x))) throw x;
      }
    },
  );
}
