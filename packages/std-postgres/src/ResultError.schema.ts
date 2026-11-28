import type { KeelError } from "@keel/schema";
import { s } from "@keel/schema";

/** A row that fails its statement's schema (std.postgres): its 0-based index and the issues' paths and rules, no value. */
export const ResultError = s.error(
  "postgres.result",
  s.object({
    row: s.int(),
    issues: s.array(s.object({ path: s.array(s.union([s.string(), s.int()])), rule: s.string() })),
  }),
);
export type ResultError = KeelError<
  "postgres.result",
  {
    readonly row: number;
    readonly issues: readonly { readonly path: readonly (string | number)[]; readonly rule: string }[];
  }
>;
