import type { Ctx } from "@keel/ctx";
import { type Factory, openStores } from "@keel/store/internal";
import type { RequestScope } from "./RequestScope.ts";
import { notePii } from "./notePii.ts";

/**
 * The request's instance of `factory` (`openStores`, k.server Server state), each restored store's `.pii()` values
 * joining the request's (`notePii`; k.privacy Server log).
 */
export function openFactory(ctx: Ctx, rq: RequestScope, factory: Factory): Promise<unknown> {
  return openStores(ctx, rq, factory, (schema, state) => notePii(rq.pii, schema, state));
}
