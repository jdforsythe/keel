import { s } from "@keel/schema";

/** A driver's own error code as `driverCode` writes it, carried into `db.failed` by `parse`. */
export const DriverCode = s.string({ min: 1, max: 64 });
