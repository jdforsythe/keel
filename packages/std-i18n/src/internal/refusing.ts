import { attempt } from "@keel/schema";
import { refuse } from "../../unsafe/refuse.ts";

/** The text `run()` writes, or the `RangeError` `refuse` throws for `fn` naming what `run` threw (an input `Intl` refuses). */
export function refusing(fn: string, run: () => string): string {
  const r = attempt(run);
  return r.ok ? r.value : refuse(fn, r.error.data.cause);
}
