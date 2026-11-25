import type { Store } from "@keel/store";
import { transaction } from "@keel/store";
import { Signup } from "./Signup.schema.ts";
import type { Board } from "./Board.schema.ts";

/** Add a sign-up; an unknown shift, a full shift or a repeated id leaves the state unchanged. */
export function signUpTx(board: Store<Board>) {
  return transaction(board, "shifts.signUp", Signup, (state, p) => {
    const shift = state.shifts.find((x) => x.id === p.shiftId);
    if (shift === undefined) return state;
    if (state.signups.some((x) => x.id === p.id)) return state;
    if (state.signups.filter((x) => x.shiftId === p.shiftId).length >= shift.slots) return state;
    return { ...state, signups: [...state.signups, p] };
  });
}
