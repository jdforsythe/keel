import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { board } from "./board.ts";
import { ShiftList } from "./ShiftList.schema.ts";
import { shifts } from "./shifts.contract.ts";

export const loadIndex = loader(shifts, "shifts.index", { output: ShiftList, stores: board }, async ({ stores }) => {
  const signups = stores.board.get("signups");
  return ok({
    items: stores.board.get("shifts").map((shift) => ({
      ...shift,
      open: Math.max(0, shift.slots - signups.filter((x) => x.shiftId === shift.id).length),
    })),
  });
});
