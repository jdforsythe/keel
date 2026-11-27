import type { KeelError } from "@keel/schema";
import { s } from "@keel/schema";
import { DB_CLASSES } from "./DB_CLASSES.ts";
import { DB_OPS } from "./DB_OPS.ts";

/**
 * A storage call that failed, its data the driver, the operation and what `driverFault` says of the driver's error,
 * every field closed; it never leaves std.db, where it is a defect's `cause`.
 */
export const DbFailed = s.error(
  "db.failed",
  s.object({ driver: s.enum(["sqlite", "postgres"]), op: s.enum(DB_OPS), class: s.enum(DB_CLASSES), errcode: s.int() }),
);
export type DbFailed = KeelError<
  "db.failed",
  {
    readonly driver: "sqlite" | "postgres";
    readonly op: (typeof DB_OPS)[number];
    readonly class: (typeof DB_CLASSES)[number];
    readonly errcode: number;
  }
>;
