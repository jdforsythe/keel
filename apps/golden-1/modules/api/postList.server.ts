import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { ListDraft } from "./ListDraft.schema.ts";
import { boardStores } from "./boardStores.ts";

/** `POST /api/lists`: add a list with a ctx-minted id, recorded with this caller (undo, `postUndo`). */
export const postList = action({ input: ListDraft, stores: boardStores }, (input, { caller, stores }, ctx) => {
  const r = tx(stores.addList, { id: ctx.random.id("TodoList"), name: input.name }, { meta: { caller } });
  return r.ok ? ok(null) : err(r.error);
});
