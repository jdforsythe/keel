import { s } from "@keel/schema";
import { type Store, transaction } from "@keel/store";
import type { Board } from "./Board.schema.ts";

/** Set a sign-up's attendance. */
export function markAttendedTx(board: Store<Board>) {
  return transaction(
    board,
    "shifts.markAttended",
    s.object({ id: s.id("Signup"), attended: s.boolean() }),
    (state, p) => ({
      ...state,
      signups: state.signups.map((x) => (x.id === p.id ? { ...x, attended: p.attended } : x)),
    }),
  );
}
