import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";
import { Board } from "./Board.schema.ts";
export function boards() {
  const board = store(Board, { lists: [] }, { id: "a.board" });
  const addList = transaction(board, "a.addList", s.object({ name: s.string() }), (st, p) => ({
    lists: [...st.lists, p.name],
  }));
  return { board, addList };
}
