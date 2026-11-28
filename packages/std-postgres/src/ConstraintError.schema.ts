import type { KeelError } from "@keel/schema";
import { s } from "@keel/schema";

/**
 * A unique, foreign key, check or not-null violation (std.postgres): its kind. The constraint's name is no data:
 * `constraintOf` gives it as a member of a list the app wrote.
 */
export const ConstraintError = s.error(
  "postgres.constraint",
  s.object({ kind: s.enum(["unique", "foreign", "check", "notNull"]) }),
);
export type ConstraintError = KeelError<
  "postgres.constraint",
  { readonly kind: "unique" | "foreign" | "check" | "notNull" }
>;
