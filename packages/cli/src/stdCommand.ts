import { stdSlot } from "./internal/stdSlot.ts";
import type { StdOperation } from "./types/StdOperation.ts";

/**
 * Fill a command name k.cli reserves for a stdlib package (k.cli extension point). The reserved names are `session`
 * and `report`; any other name throws. Filling one with another operation throws E1053; the same operation again
 * is a no-op (HMR safe).
 */
export function stdCommand(name: string, op: StdOperation): void {
  if (name !== "session" && name !== "report")
    throw new Error(`E1053 std command ${name.slice(0, 24)} is not reserved`);
  const filled = stdSlot.get(name);
  if (filled !== undefined && filled !== op) throw new Error(`E1053 std command ${name} registered twice`);
  stdSlot.set(name, op);
}
