import type { Ctx } from "@keel/ctx";
import { err, ok } from "@keel/schema";
import { commitStores } from "@keel/server";
import { tx } from "@keel/store";
import type { RemovalData } from "./RemovalData.schema.ts";
import { boardStores } from "./boardStores.ts";

/**
 * The `restoring` step of `removal`, after an undo or a failed purge: show the list again in one commit of the board
 * (`api.showList`). Its `ok` is the `restored` payload; any failure is `api.restoreFailed`.
 */
export const restore = async (data: RemovalData, ctx: Ctx) => {
  const id = data.list;
  if (id === undefined) return ok({});
  const r = await commitStores(ctx, boardStores, (S) => {
    const t = tx(S.showList, { id });
    return t.ok ? ok(null) : err(t.error);
  });
  return r.ok
    ? ok({})
    : err({ code: "api.restoreFailed", message: "The list could not be shown again", data: { cause: r.error.code } });
};
