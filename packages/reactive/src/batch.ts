import { flush } from "./internal/flush.ts";
import { rt } from "./internal/rt.ts";

/** Group writes into one commit: effects run once, after the outermost batch returns. */
export function batch<T>(fn: () => T): T {
  rt.depth++;
  try {
    return fn();
  } finally {
    rt.depth--;
    flush();
  }
}
