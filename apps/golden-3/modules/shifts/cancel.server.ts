import { action } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { tx } from "@keel/store";
import { board } from "./board.ts";
import { shifts } from "./shifts.contract.ts";

export const cancel = action(
  shifts,
  "shifts.signup",
  { input: s.object({}), stores: board },
  async (_input, { caller, params, stores }) => {
    const own = stores.board
      .get("signups")
      .some((x) => x.id === params.signupId && caller !== "" && x.owner === caller);
    if (!own) return err({ code: "keel.notFound", message: "no such sign-up", data: null });
    const done = tx(stores.cancel, { id: params.signupId, owner: caller }, { meta: { caller } });
    if (!done.ok) return err(done.error);
    return ok(shifts.href("shifts.mine"));
  },
);
