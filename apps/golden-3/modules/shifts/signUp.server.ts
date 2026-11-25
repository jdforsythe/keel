import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { board } from "./board.ts";
import { shifts } from "./shifts.contract.ts";
import { SignupDraft } from "./SignupDraft.schema.ts";

export const signUp = action(
  shifts,
  "shifts.show",
  { input: SignupDraft, stores: board },
  async (input, { caller, params, stores }, ctx) => {
    const shift = stores.board.get("shifts").find((x) => x.id === params.shiftId);
    if (shift === undefined) return err({ code: "keel.notFound", message: "no such shift", data: null });
    const taken = stores.board.get("signups").filter((x) => x.shiftId === shift.id).length;
    if (taken >= shift.slots) return err({ code: "keel.conflict", message: "This shift is full", data: null });
    const made = tx(
      stores.signUp,
      { ...input, id: ctx.random.id("Signup"), shiftId: shift.id, owner: caller, attended: false },
      { meta: { caller } },
    );
    if (!made.ok) return err(made.error);
    return ok(shifts.href("shifts.mine"));
  },
);
