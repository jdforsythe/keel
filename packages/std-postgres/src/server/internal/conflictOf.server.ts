import type { Conflict } from "../../Conflict.ts";
import type { DatabaseError } from "../../DatabaseError.ts";

/**
 * `keel.conflict` whose `cause` is the `postgres.database` error of the last run (std.postgres-errors): `40001` or
 * `40P01`. Its data is `null`, which no schema of `s.error` holds, so it is built as `causedBy` builds one.
 */
export function conflictOf(cause: DatabaseError): Conflict {
  return Object.freeze({ code: "keel.conflict", message: "A concurrent write got there first", data: null, cause });
}
