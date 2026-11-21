import { action } from "@keel/router";
import { send } from "@keel/std-offline";
import { ListDraft } from "../api/ListDraft.schema.ts";
import { boardOutbox } from "./boardOutbox.ts";
import { formAnswer } from "./formAnswer.ts";
import { todos } from "./todos.contract.ts";
import { view } from "./view.ts";

/** POST on `todos.index`: send `POST /api/lists` through the outbox, based on the board as last read; then revalidate. */
export const createList = action(todos, "todos.index", { input: ListDraft }, async (input, _req, ctx) => {
  const r = await send(ctx, boardOutbox, "createList", { body: input }, { base: view.get("head"), owner: "" });
  return formAnswer(ctx, "createList", r);
});
