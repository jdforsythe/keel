import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Board } from "./Board.schema.ts";
import { board } from "./board.ts";
import { shifts } from "./shifts.contract.ts";

/** The caller's own sign-ups, and the shifts they are for. */
export const loadMine = loader(shifts, "shifts.mine", { output: Board, stores: board }, async ({ caller, stores }) => {
  const signups = stores.board.get("signups").filter((x) => caller !== "" && x.owner === caller);
  return ok({
    shifts: stores.board.get("shifts").filter((x) => signups.some((y) => y.shiftId === x.id)),
    signups,
  });
});
