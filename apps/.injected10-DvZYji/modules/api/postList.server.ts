import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { writeFor } from "@keel/std-offline";
import { tx } from "@keel/store";
import { ListWrite } from "./ListWrite.schema.ts";
import { Nothing } from "./Nothing.schema.ts";
import { boardStores } from "./boardStores.ts";

/**
 * `POST /api/lists`: add a list with a ctx-minted id, recorded with this caller (undo, `postUndo`) and the write's key
 * and base; a write queued under an owner other than `""` (golden-1 has no sign-in) is `offline.signin`.
 */
export const postList = action(
  { input: ListWrite, output: Nothing, stores: boardStores },
  (input, { caller, stores }, ctx) => {
    const w = writeFor(input.write, "");
    if (!w.ok) return err(w.error);
    const r = tx(stores.addList, { id: ctx.random.id("TodoList"), name: input.name }, { meta: { caller }, ...w.value });
    return r.ok ? ok({}) : err(r.error);
  },
);
