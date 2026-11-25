import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "./Board.schema.ts";

/** Remove a sign-up, only when `owner` is the one who made it. */
export function cancelTx(board: Store<Board>) {
  return transaction(board, "shifts.cancel", s.object({ id: s.id("Signup"), owner: s.string() }), (state, p) => {
    if (!state.signups.some((x) => x.id === p.id && x.owner === p.owner)) return state;
    return { ...state, signups: state.signups.filter((x) => x.id !== p.id) };
  });
}
