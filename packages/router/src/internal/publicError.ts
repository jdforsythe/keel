import type { KeelError } from "@keel/schema";

/**
 * The error as app code and the page may see it: unless `mode` is `dev`, a `keel.unexpected` loses its message (it
 * becomes `unexpected`) and its data (no cause, no stack). Every other error is a value and passes unchanged.
 */
export function publicError(e: KeelError<string, unknown>, mode: "dev" | "production"): KeelError<string, unknown> {
  return mode !== "dev" && e.code === "keel.unexpected" ? { code: e.code, message: "unexpected", data: {} } : e;
}
