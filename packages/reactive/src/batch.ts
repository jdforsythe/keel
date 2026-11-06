import { flush } from "./internal/flush.ts";
import { rt } from "./internal/rt.ts";

/**
 * Group writes into one commit: effects run once, after the outermost batch returns. If `fn` throws,
 * the commit still runs and `fn`'s error is the one rethrown.
 */
export function batch<T>(fn: () => T): T {
  rt.depth++;
  let out: T;
  try {
    out = fn();
  } catch (error) {
    rt.depth--;
    try {
      flush();
    } catch {
      // The first error wins; the commit's own error is secondary to the one that aborted `fn`.
    }
    throw error;
  }
  rt.depth--;
  flush();
  return out;
}
