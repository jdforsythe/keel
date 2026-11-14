import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "./Board.schema.ts";

/**
 * `api.showList` on `board` (`boardStores`): mark list `id` shown again (a removal undone or compensated, `removal`); an
 * unknown id leaves the board unchanged. A concurrent write rebases: showing carries no value the writer read.
 */
export const showList = (board: Store<Board>) =>
  transaction(
    board,
    "api.showList",
    s.object({ id: s.id("TodoList") }),
    (state, p) =>
      state.lists.some((l) => l.id === p.id)
        ? { ...state, lists: state.lists.map((l) => (l.id === p.id ? { ...l, hidden: false } : l)) }
        : state,
    { concurrent: "rebase" },
  );
