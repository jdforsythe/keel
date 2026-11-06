import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { ListDraft } from "./ListDraft.schema.ts";
import { addList } from "./addList.ts";

/** POST on `todos.index`: add a list with a fresh id, then revalidate. */
export const createList = action(ListDraft, (input, _at, ctx) => {
  const payload = addList.schema.parse({ id: ctx.random.uuid(), name: input.name });
  if (!payload.ok) return err(payload.error);
  const r = tx(addList, payload.value);
  return r.ok ? ok(null) : err(r.error);
});
