import type { RequestScope } from "./RequestScope.ts";

/**
 * Run `fn` synchronously in the request scope. Its stores register in that scope's own registry (k.store `isolate`),
 * so overlapping requests may create stores with the same id; a store created after an `await` has no owner (E1203).
 */
export function inRequest<T>(rq: RequestScope, fn: () => T): T {
  return rq.scope.run(fn);
}
