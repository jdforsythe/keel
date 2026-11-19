import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "./Board.schema.ts";

/**
 * `api.addList` on `board` (`boardStores`): append a list; a duplicate id leaves the board unchanged. A concurrent write
 * rebases: a list with a fresh id holds on any board.
 */
export const addList = (board: Store<Board>) =>
  transaction(
    board,
    "api.addList",
    s.object({ id: s.id("TodoList"), name: s.string({ min: 1, max: 60 }) }),
    (state, p) =>
      state.lists.some((l) => l.id === p.id)
        ? state
        : { ...state, lists: [...state.lists, { id: p.id, name: p.name }] },
    { concurrent: "rebase" },
  );
