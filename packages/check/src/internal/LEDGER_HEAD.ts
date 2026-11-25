import { s } from "@keel/schema";
import { RUNG } from "./RUNG.ts";

/**
 * The keys of k.ledger File every read judges, in File's order: `version` 1, the `unsafe` and `hostElements` counts,
 * and `exports`, an item with a field missing or of another type failing it.
 */
export const LEDGER_HEAD = {
  version: s.literal(1),
  unsafe: s.int(),
  hostElements: s.int({ min: 0 }),
  exports: s.array(s.object({ pkg: s.string(), name: s.string(), file: s.string(), rung: RUNG })),
};
