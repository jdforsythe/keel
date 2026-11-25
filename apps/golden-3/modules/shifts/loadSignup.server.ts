import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { Board } from "./Board.schema.ts";
import { board } from "./board.ts";
import { shifts } from "./shifts.contract.ts";

/** One sign-up of the caller's, with its shift; another's id or an unknown one is `keel.notFound`. */
export const loadSignup = loader(
  shifts,
  "shifts.signup",
  { output: Board, stores: board },
  async ({ caller, params, stores }) => {
    const signup = stores.board
      .get("signups")
      .find((x) => x.id === params.signupId && caller !== "" && x.owner === caller);
    const shift = signup === undefined ? undefined : stores.board.get("shifts").find((x) => x.id === signup.shiftId);
    if (signup === undefined || shift === undefined)
      return err({ code: "keel.notFound", message: "no such sign-up", data: null });
    return ok({ shifts: [shift], signups: [signup] });
  },
);
