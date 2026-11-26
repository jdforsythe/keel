import type { KeelError } from "@keel/schema";

/** A storage call that failed, named by driver, operation and the database's own error code; it never leaves std.db. */
export type DbFailed = KeelError<"db.failed", null>;
