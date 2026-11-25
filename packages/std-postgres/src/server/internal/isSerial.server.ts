import { field } from "./field.server.ts";

/** Whether a driver error is a serialization failure (40001) or deadlock (40P01). */
export function isSerial(e: unknown): boolean {
  const code = field(e, "code");
  return code === "40001" || code === "40P01";
}
