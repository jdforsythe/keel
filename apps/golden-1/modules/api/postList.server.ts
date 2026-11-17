import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { ListWrite } from "./ListWrite.schema.ts";
import { Nothing } from "./Nothing.schema.ts";
import { boardStores } from "./boardStores.ts";

/**
 * `POST /api/lists`: add a list with a ctx-minted id, recorded with this caller (undo, `postUndo`) and the write's key
 * and base.
 */
export const postList = action(
  { input: ListWrite, output: Nothing, stores: boardStores },
  (input, { caller, stores }, ctx) => {
    const r = tx(
      stores.addList,
      { id: ctx.random.id("TodoList"), name: input.name },
      { meta: { caller }, ...input.write },
    );
    return r.ok ? ok({}) : err(r.error);
  },
);
