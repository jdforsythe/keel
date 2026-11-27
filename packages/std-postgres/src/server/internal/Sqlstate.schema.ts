import { s } from "@keel/schema";

/** An SQLSTATE: the five characters of a database error's `code`, carried into `postgres.database` by `parse`. */
export const Sqlstate = s.string({ min: 5, max: 5 });
