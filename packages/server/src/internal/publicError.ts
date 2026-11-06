import type { KeelError } from "@keel/schema";
import type { Mode } from "./Mode.ts";

/**
 * The error as it may leave the server: in production a `keel.unexpected` loses its message (it becomes
 * `unexpected`) and its data (no cause, no stack). Every other error is a value and passes unchanged.
 */
export function publicError(e: KeelError<string, unknown>, mode: Mode): KeelError<string, unknown> {
  return mode === "production" && e.code === "keel.unexpected" ? { code: e.code, message: "unexpected", data: {} } : e;
}
