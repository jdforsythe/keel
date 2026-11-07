import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { ListDraft } from "./ListDraft.schema.ts";
import { todosApi } from "./todosApi.ts";

/** POST on `todos.index`: `POST /api/lists` on the `api` deployable, then revalidate (`loadIndex` re-reads). */
export const createList = action({ input: ListDraft }, async (input, { url }, ctx) => {
  const r = await todosApi(new URL(url).origin).createList({ body: input }, ctx);
  return r.ok ? ok(null) : err(r.error);
});
