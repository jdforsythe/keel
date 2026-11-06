import { stores } from "@keel/store";
import type { RequestScope } from "./RequestScope.ts";

/**
 * Run `fn` synchronously in the request scope and record the ids of the stores it created. The diff of the
 * registry is race-free because `fn` does not yield; a store created after an `await` has no owner (E1203).
 */
export function inRequest<T>(rq: RequestScope, fn: () => T): T {
  const before = new Set(stores().keys());
  try {
    return rq.scope.run(fn);
  } finally {
    for (const id of stores().keys()) if (!before.has(id)) rq.created.add(id);
  }
}
