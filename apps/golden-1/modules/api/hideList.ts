import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "./Board.schema.ts";

/**
 * `api.hideList` on `board` (`boardStores`): mark list `id` hidden while its removal waits (`removal`); an unknown id
 * leaves the board unchanged. A concurrent write rebases: hiding carries no value the writer read.
 */
export const hideList = (board: Store<Board>) =>
  transaction(
    board,
    "api.hideList",
    s.object({ id: s.id("TodoList") }),
    (state, p) =>
      state.lists.some((l) => l.id === p.id)
        ? { ...state, lists: state.lists.map((l) => (l.id === p.id ? { ...l, hidden: true } : l)) }
        : state,
    { concurrent: "rebase" },
  );
