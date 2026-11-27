import { action } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { api } from "./api.contract.ts";
import { removalStores } from "./removalStores.server.ts";

/**
 * `POST /api/lists/:listId/remove`: hide the list and start its removal (`removal`) in one commit, recorded with this
 * caller. An unknown or already hidden list is `keel.notFound`.
 */
export const postRemove = action(
  api,
  "api.removeList",
  { stores: removalStores },
  (_input, { params, caller, stores }, ctx) => {
    const { listId } = params;
    const list = stores.board.get("lists").find((l) => l.id === listId);
    if (list === undefined || list.hidden === true)
      return err(keelError.notFound.make({}));
    const hidden = tx(stores.hideList, { id: listId }, { meta: { caller } });
    if (!hidden.ok) return err(hidden.error);
    const started = tx(
      stores.removal.start,
      { id: ctx.random.id("Flow"), data: { list: listId } },
      { meta: { caller } },
    );
    return started.ok ? ok({}) : err(started.error);
  },
);
