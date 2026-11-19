import { isReadable } from "./isReadable.ts";
import { isRecord } from "./isRecord.ts";

/** True for a signal or computed, or a record (a responsive or `states` value) holding one at any depth. */
export function holdsReadable(x: unknown): boolean {
  return isReadable(x) || (isRecord(x) && Object.values(x).some(holdsReadable));
}
