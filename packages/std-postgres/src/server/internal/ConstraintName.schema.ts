import { s } from "@keel/schema";

/**
 * The name of a broken constraint (a not-null violation's column), carried into `postgres.constraint` by `parse`: a
 * Postgres identifier, at most 63 characters.
 */
export const ConstraintName = s.string({ max: 63 });
