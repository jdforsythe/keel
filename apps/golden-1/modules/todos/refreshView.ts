import type { Ctx } from "@keel/ctx";
import { type KeelError, type Result, ok } from "@keel/schema";
import { tx } from "@keel/store";
import type { BoardView } from "./BoardView.schema.ts";
import { hydrate } from "./hydrate.ts";
import { todosApi } from "./todosApi.ts";

/** Read the board from `GET /api/lists` into `todos.view` (`todos.hydrate`); every loader and write ends here. */
export async function refreshView(ctx: Ctx): Promise<Result<BoardView, KeelError<string, unknown>>> {
  const r = await todosApi().lists({}, ctx);
  if (!r.ok) return r;
  const data = r.value.results["api.lists"].value;
  const h = tx(hydrate, data);
  return h.ok ? ok(data) : h;
}
