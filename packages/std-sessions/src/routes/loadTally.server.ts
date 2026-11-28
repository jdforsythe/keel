import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { readTally } from "../monitor/internal/readTally.ts";
import { sessions } from "../sessions.contract.ts";

/**
 * `GET /sessions/tally` (`sessions.tally`, std.monitor Read; behind guard `sessions.reader`): the `Tally` the
 * `monitor` runner stored, else `{ v: 1, from: 0, to: 0, tx: {} }`.
 */
export const loadTally = loader(sessions, "sessions.tally", {}, async (_args, ctx) =>
  ok((await readTally(ctx)) ?? { v: 1, from: 0, to: 0, tx: {} }),
);
