import type { Owner } from "./Owner.ts";
import { isPromiseLike } from "./isPromiseLike.ts";
import { report } from "./report.ts";

/** Run a handler: a throw, or a rejection of the promise it returns, goes to the nearest Boundary. */
export function guard(owner: Owner, at: string, fn: () => unknown): void {
  let out: unknown;
  try {
    out = fn();
  } catch (error) {
    report(owner, error, at);
    return;
  }
  if (isPromiseLike(out)) Promise.resolve(out).catch((error: unknown) => report(owner, error, at));
}
