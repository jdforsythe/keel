import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { ListDraft } from "./ListDraft.schema.ts";
import { todosApi } from "./todosApi.ts";

/** POST on `todos.index`: `POST /api/lists` on the `api` deployable, then revalidate (`loadIndex` re-reads). */
export const createList = action(ListDraft, async (input, _at, ctx) => {
  const r = await todosApi().createList({ body: input }, ctx);
  return r.ok ? ok(null) : err(r.error);
});
