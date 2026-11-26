import { refuse } from "../../unsafe/refuse.ts";

/** `run()`, or the `RangeError` `refuse` throws for `fn` with the message of whatever `run` throws (an input `Intl` refuses). */
export function refusing<T>(fn: string, run: () => T): T {
  try {
    return run();
  } catch (e) {
    return refuse(fn, e instanceof Error ? e.message : String(e));
  }
}
