import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Tally } from "./Tally.schema.ts";
import { readTally } from "./internal/readTally.ts";

/** Loader of `sessions.tally` (std.monitor): the stored `Tally`, else `{ v: 1, from: 0, to: 0, tx: {} }`. */
export const loadTally = loader({ output: Tally }, async (_args, ctx) =>
  ok((await readTally(ctx)) ?? { v: 1, from: 0, to: 0, tx: {} }),
);
