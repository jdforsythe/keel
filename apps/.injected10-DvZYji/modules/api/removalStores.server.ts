import type { Ctx } from "@keel/ctx";
import { boardStores } from "./boardStores.ts";
import { removal } from "./removal.server.ts";

/**
 * The board (`boardStores`) and the removal instances (`api.removal`) as one request's server state: hiding a list and
 * starting its removal is one `commit`, and `loadBoard` reads both from one cut.
 */
export function removalStores(ctx: Ctx) {
  return { ...boardStores(), removal: removal.stores(ctx) };
}
