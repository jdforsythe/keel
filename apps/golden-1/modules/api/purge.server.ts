import type { Ctx } from "@keel/ctx";
import { err, ok } from "@keel/schema";
import { commitStores } from "@keel/server";
import { tx } from "@keel/store";
import { PurgeFailed } from "./PurgeFailed.schema.ts";
import type { RemovalData } from "./RemovalData.schema.ts";
import { boardStores } from "./boardStores.ts";

/**
 * The `purging` step of `removal`: delete the list and its todos in one commit of the board (`api.purgeList`). Its
 * `ok` is the `purged` payload; any failure is `api.purgeFailed`, which `removal` retries and then compensates.
 */
export const purge = async (data: RemovalData, ctx: Ctx) => {
  const id = data.list;
  if (id === undefined) return ok({});
  const r = await commitStores(ctx, boardStores, (S) => {
    const t = tx(S.purgeList, { id });
    return t.ok ? ok(null) : err(t.error);
  });
  return r.ok ? ok({}) : err(PurgeFailed.make({ cause: r.error.code }));
};
