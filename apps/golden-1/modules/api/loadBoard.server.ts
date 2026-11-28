import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import type { Removal } from "./Removal.schema.ts";
import { api } from "./api.contract.ts";
import { removalStores } from "./removalStores.server.ts";

/**
 * `GET /api/lists` (`api.lists`): every list and todo, whether `POST /api/undo` would undo this caller's last write, the head, and
 * the removals not yet ended, in one read of the board and `api.removal`.
 */
export const loadBoard = loader(api, "api.lists", { stores: removalStores }, async ({ caller, stores }) => {
  const { board } = stores;
  const canUndo = board.log().at(-1)?.meta?.caller === caller;
  const removals: Removal[] = [];
  for (const [flow, i] of Object.entries(stores.removal.store.get("instances"))) {
    const list = i.data.list;
    if (list !== undefined && (i.state === "hidden" || i.state === "purging" || i.state === "restoring"))
      removals.push({ flow, list, state: i.state });
  }
  return ok({ lists: board.get("lists"), todos: board.get("todos"), canUndo, head: board.head(), removals });
});
