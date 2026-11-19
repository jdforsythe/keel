import { stdSlot } from "./internal/stdSlot.ts";
import type { StdOperation } from "./types/StdOperation.ts";

/**
 * Fill a command name k.cli reserves for a stdlib package (k.cli extension point). The only reserved name is
 * `session`; any other name throws. Filling it with another operation throws E1053; the same operation again is a
 * no-op (HMR safe).
 */
export function stdCommand(name: string, op: StdOperation): void {
  if (name !== "session") throw new Error(`E1053 std command ${name.slice(0, 24)} is not reserved`);
  if (stdSlot.op !== undefined && stdSlot.op !== op) throw new Error("E1053 std command session registered twice");
  stdSlot.op = op;
}
