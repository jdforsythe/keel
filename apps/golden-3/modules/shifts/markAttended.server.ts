import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { Attendance } from "./Attendance.schema.ts";
import { board } from "./board.ts";
import { isOrganizer } from "./isOrganizer.ts";
import { shifts } from "./shifts.contract.ts";

export const markAttended = action(
  shifts,
  "shifts.attend",
  { input: Attendance, stores: board },
  async (input, { caller, params, stores }, ctx) => {
    if (!(await isOrganizer(ctx, caller))) return err({ code: "keel.denied", message: "organizers only", data: null });
    if (!stores.board.get("signups").some((x) => x.id === params.signupId)) {
      return err({ code: "keel.notFound", message: "no such sign-up", data: null });
    }
    const done = tx(stores.markAttended, { id: params.signupId, attended: input.attended }, { meta: { caller } });
    if (!done.ok) return err(done.error);
    return ok(shifts.href("shifts.roster"));
  },
);
