import { invariant, store } from "@keel/store";
import { Board } from "./Board.schema.ts";
import { cancelTx } from "./cancelTx.ts";
import { markAttendedTx } from "./markAttendedTx.ts";
import { signUpTx } from "./signUpTx.ts";

/** The server's one store, `shifts.board`, and its bound transactions; the factory every loader and action names. */
export function board() {
  const seed = Board.parse({
    shifts: [
      { id: "s1", title: "Sorting donations", when: "Saturday 9:00 to 12:00", slots: 4 },
      { id: "s2", title: "Packing boxes", when: "Saturday 13:00 to 16:00", slots: 4 },
      { id: "s3", title: "Delivery helpers", when: "Sunday 10:00 to 14:00", slots: 2 },
    ],
    signups: [],
  });
  const shifts = store(Board, seed.ok ? seed.value : { shifts: [], signups: [] }, { id: "shifts.board" });
  invariant(shifts, (b) => {
    const ids = new Set(b.signups.map((x) => x.id));
    if (ids.size !== b.signups.length) return false;
    return b.signups.every((x) => {
      const shift = b.shifts.find((y) => y.id === x.shiftId);
      return shift !== undefined && b.signups.filter((y) => y.shiftId === x.shiftId).length <= shift.slots;
    });
  });
  return { board: shifts, signUp: signUpTx(shifts), cancel: cancelTx(shifts), markAttended: markAttendedTx(shifts) };
}
