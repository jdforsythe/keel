import type { KeelError } from "@keel/schema";
import { s } from "@keel/schema";

/** A unique, foreign key, check or not-null violation (std.postgres): the constraint's name (a not-null violation's column) and its kind. */
export const ConstraintError = s.error(
  "postgres.constraint",
  s.object({ constraint: s.string(), kind: s.enum(["unique", "foreign", "check", "notNull"]) }),
);
export type ConstraintError = KeelError<
  "postgres.constraint",
  { readonly constraint: string; readonly kind: "unique" | "foreign" | "check" | "notNull" }
>;
