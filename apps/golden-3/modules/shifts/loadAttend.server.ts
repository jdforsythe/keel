import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { Board } from "./Board.schema.ts";
import { board } from "./board.ts";
import { shifts } from "./shifts.contract.ts";

/** One sign-up with its shift; the route's guard admits organizers only. */
export const loadAttend = loader(
  shifts,
  "shifts.attend",
  { output: Board, stores: board },
  async ({ params, stores }) => {
    const signup = stores.board.get("signups").find((x) => x.id === params.signupId);
    const shift = signup === undefined ? undefined : stores.board.get("shifts").find((x) => x.id === signup.shiftId);
    if (signup === undefined || shift === undefined)
      return err({ code: "keel.notFound", message: "no such sign-up", data: null });
    return ok({ shifts: [shift], signups: [signup] });
  },
);
