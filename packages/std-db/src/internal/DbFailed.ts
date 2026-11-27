import type { KeelError } from "@keel/schema";

/**
 * A storage call that failed, its data the driver, the operation and the database's own error code; it never leaves
 * std.db, where it is a defect's `data`.
 */
export type DbFailed = KeelError<"db.failed", { readonly driver: string; readonly op: string; readonly code: string }>;
