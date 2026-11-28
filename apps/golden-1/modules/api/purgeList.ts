import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "./Board.schema.ts";

/**
 * `api.purgeList` on `board` (`boardStores`): delete list `id` and every todo in it, the `purging` step of a removal
 * (`purge`); an unknown id leaves the board unchanged. A concurrent write rebases: deleting carries no value the
 * writer read.
 */
export const purgeList = (board: Store<Board>) =>
  transaction(
    board,
    "api.purgeList",
    s.object({ id: s.id("TodoList") }),
    (state, p) => ({
      lists: state.lists.filter((l) => l.id !== p.id),
      todos: state.todos.filter((t) => t.listId !== p.id),
    }),
    { concurrent: "rebase" },
  );
