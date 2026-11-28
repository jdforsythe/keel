import { action } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";
import { writeFor } from "@keel/std-offline";
import { tx } from "@keel/store";
import { api } from "./api.contract.ts";
import { boardStores } from "./boardStores.ts";

/**
 * `POST /api/lists/:listId/todos`: add an open todo with a ctx-minted id, with the write's key and base; an unknown
 * list is `keel.notFound`; a write queued under an owner other than `""` (golden-1 has no sign-in) is
 * `offline.signin`.
 */
export const postTodo = action(
  api,
  "api.addTodo",
  { stores: boardStores },
  (input, { params, caller, stores }, ctx) => {
    const { listId } = params;
    if (!stores.board.get("lists").some((l) => l.id === listId)) return err(keelError.notFound.make({}));
    const { write, ...draft } = input;
    const w = writeFor(write, "");
    if (!w.ok) return err(w.error);
    const r = tx(stores.addTodo, { ...draft, id: ctx.random.id("Todo"), listId }, { meta: { caller }, ...w.value });
    return r.ok ? ok({}) : err(r.error);
  },
);
