import type { Ctx } from "@keel/ctx";
import { type KeelError, type Result, ok } from "@keel/schema";
import { tx } from "@keel/store";
import type { BoardView } from "../api/BoardView.schema.ts";
import { hydrate } from "./hydrate.ts";
import { todosApi } from "./todosApi.ts";
import { view } from "./view.ts";

/**
 * Read the board from `GET /api/lists` into `todos.view` (`todos.hydrate`); loaders and Undo end here. Offline, the
 * read cannot go out and the answer is the board as last served, so a page still opens while writes wait in the outbox.
 */
export async function refreshView(ctx: Ctx): Promise<Result<BoardView, KeelError<string, unknown>>> {
  const r = await todosApi.lists({}, ctx);
  if (!r.ok && r.error.code === "api.network" && !ctx.net.online())
    return ok({
      lists: view.get("lists"),
      todos: view.get("todos"),
      canUndo: view.get("canUndo"),
      head: view.get("head"),
    });
  if (!r.ok) return r;
  const h = tx(hydrate, r.value);
  return h.ok ? ok(r.value) : h;
}
