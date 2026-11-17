import { action } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { tx } from "@keel/store";
import { FlowParams } from "./FlowParams.schema.ts";
import { Nothing } from "./Nothing.schema.ts";
import { removalStores } from "./removalStores.server.ts";

/**
 * `POST /api/removals/:flow/undo`: send `undo` to a removal still `hidden`, which then shows its list again
 * (`restore`). A removal past `hidden`, or none, is `keel.notFound`.
 */
export const postUndoRemoval = action(
  { input: s.object({}), params: FlowParams, output: Nothing, stores: removalStores },
  (_input, { params, caller, stores }) => {
    const { flow } = params;
    const at = stores.removal.store.get("instances")[flow];
    if (at?.state !== "hidden")
      return err({ code: "keel.notFound", message: `No removal ${flow} to undo`, data: { flow } });
    const r = tx(stores.removal.events.undo, { id: flow, payload: {} }, { meta: { caller } });
    return r.ok ? ok({}) : err(r.error);
  },
);
