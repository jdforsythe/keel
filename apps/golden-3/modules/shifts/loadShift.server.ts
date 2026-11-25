import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { board } from "./board.ts";
import { ShiftOpen } from "./ShiftOpen.schema.ts";
import { shifts } from "./shifts.contract.ts";

export const loadShift = loader(
  shifts,
  "shifts.show",
  { output: ShiftOpen, stores: board },
  async ({ params, stores }) => {
    const shift = stores.board.get("shifts").find((x) => x.id === params.shiftId);
    if (shift === undefined) return err({ code: "keel.notFound", message: "no such shift", data: null });
    const taken = stores.board.get("signups").filter((x) => x.shiftId === shift.id).length;
    return ok({ ...shift, open: Math.max(0, shift.slots - taken) });
  },
);
