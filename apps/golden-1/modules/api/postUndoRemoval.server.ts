import { action } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { api } from "./api.contract.ts";
import { removalStores } from "./removalStores.server.ts";

/**
 * `POST /api/removals/:flow/undo`: send `undo` to a removal still `hidden`, which then shows its list again
 * (`restore`). A removal past `hidden`, or none, is `keel.notFound`.
 */
export const postUndoRemoval = action(
  api,
  "api.undoRemoval",
  { stores: removalStores },
  (_input, { params, caller, stores }) => {
    const { flow } = params;
    const at = stores.removal.store.get("instances")[flow];
    if (at?.state !== "hidden") return err(keelError.notFound.make({}));
    const r = tx(stores.removal.events.undo, { id: flow, payload: {} }, { meta: { caller } });
    return r.ok ? ok({}) : err(r.error);
  },
);
