import { action } from "@keel/router";
import { send } from "@keel/std-offline";
import { ListDraft } from "../api/ListDraft.schema.ts";
import { boardOutbox } from "./boardOutbox.ts";
import { formAnswer } from "./formAnswer.ts";
import { view } from "./view.ts";

/** POST on `todos.index`: send `POST /api/lists` through the outbox, based on the board as last read; then revalidate. */
export const createList = action({ input: ListDraft }, async (input, { url }, ctx) => {
  const origin = new URL(url).origin;
  const r = await send(ctx, boardOutbox, origin, "createList", { body: input }, { base: view.get("head") });
  return formAnswer(ctx, "createList", r);
});
