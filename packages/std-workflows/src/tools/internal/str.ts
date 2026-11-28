import type { Opts } from "./Opts.ts";

/** The value of a string literal expression, else undefined. */
export function str(e: Opts): string | undefined {
  return e?.type === "Literal" && typeof e.value === "string" ? e.value : undefined;
}
