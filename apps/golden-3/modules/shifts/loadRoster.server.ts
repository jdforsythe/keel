import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Board } from "./Board.schema.ts";
import { board } from "./board.ts";
import { shifts } from "./shifts.contract.ts";

/** Every shift and every sign-up; the route's guard admits organizers only. */
export const loadRoster = loader(shifts, "shifts.roster", { output: Board, stores: board }, async ({ stores }) =>
  ok({ shifts: stores.board.get("shifts"), signups: stores.board.get("signups") }),
);
