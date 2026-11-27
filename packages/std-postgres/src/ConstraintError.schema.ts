import type { KeelError } from "@keel/schema";

/** A unique, foreign key, check or not-null violation (std.postgres): the constraint's name (a not-null violation's column) and its kind. */
export type ConstraintError = KeelError<
  "postgres.constraint",
  { readonly constraint: string; readonly kind: "unique" | "foreign" | "check" | "notNull" }
>;
