import { s } from "@keel/schema";

/**
 * One line of `check.ndjson`: a diagnostic by code and place (its message and fix text left out, so no app value
 * reaches the bundle), or the run's summary.
 */
export const CheckLine = s.union("kind", [
  s.object({
    kind: s.literal("diag"),
    code: s.string({ min: 5, max: 5 }),
    path: s.string().optional(),
    line: s.int().optional(),
    col: s.int().optional(),
    see: s.string().optional(),
  }),
  s.object({ kind: s.literal("summary"), ok: s.boolean(), name: s.string(), counts: s.record(s.int()) }),
]);
