import type { KeelError } from "@keel/schema";
import { s } from "@keel/schema";
import { DriverCode } from "./DriverCode.schema.ts";

/**
 * A storage call that failed, its data the driver, the operation and the database's own error code; it never leaves
 * std.db, where it is a defect's `cause`.
 */
export const DbFailed = s.error("db.failed", s.object({ driver: s.string(), op: s.string(), code: DriverCode }));
export type DbFailed = KeelError<"db.failed", { readonly driver: string; readonly op: string; readonly code: string }>;
