import type { RouterCore } from "./RouterCore.ts";
import { active } from "./active.ts";

/** Run a render with `core` as the active router, restoring the previous one afterwards. */
export function withActive<T>(core: RouterCore, fn: () => T): T {
  const prev = active.core;
  active.core = core;
  try {
    return fn();
  } finally {
    active.core = prev;
  }
}
