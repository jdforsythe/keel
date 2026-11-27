import type { DatabaseError } from "../../DatabaseError.schema.ts";

/** Whether `e` is a serialization failure (`40001`) or a deadlock (`40P01`), which std.postgres runs again. */
export function isRerun(e: DatabaseError): boolean {
  return e.data.sqlstate === "40001" || e.data.sqlstate === "40P01";
}
