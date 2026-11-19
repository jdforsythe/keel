import { action } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { tx } from "@keel/store";
import { ListParams } from "./ListParams.schema.ts";
import { removalStores } from "./removalStores.server.ts";

/**
 * `POST /api/lists/:listId/remove`: hide the list and start its removal (`removal`) in one commit, recorded with this
 * caller. An unknown or already hidden list is `keel.notFound`.
 */
export const postRemove = action(
  { input: s.object({}), params: ListParams, stores: removalStores },
  (_input, { params, caller, stores }, ctx) => {
    const { listId } = params;
    const list = stores.board.get("lists").find((l) => l.id === listId);
    if (list === undefined || list.hidden === true)
      return err({ code: "keel.notFound", message: `No list ${listId}`, data: { listId } });
    const hidden = tx(stores.hideList, { id: listId }, { meta: { caller } });
    if (!hidden.ok) return err(hidden.error);
    const started = tx(
      stores.removal.start,
      { id: ctx.random.id("Flow"), data: { list: listId } },
      { meta: { caller } },
    );
    return started.ok ? ok(null) : err(started.error);
  },
);
