import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { ListDraft } from "../todos/ListDraft.schema.ts";
import { addList } from "./addList.ts";

/** `POST /api/lists`: add a list with a ctx-minted id. */
export const postList = action({ input: ListDraft }, (input, _at, ctx) => {
  const r = tx(addList, { id: ctx.random.id("TodoList"), name: input.name });
  return r.ok ? ok(null) : err(r.error);
});
