import type { Owner } from "./Owner.ts";

/** Route an unexpected throw to the nearest Boundary; rethrow when there is none. Ignored once `owner` is gone. */
export function report(owner: Owner, error: unknown, at: string): void {
  if (owner.gone) return;
  const c = owner.catcher;
  if (c === null) throw error;
  c.fail(error, at);
}
