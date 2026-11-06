import type { KeelError } from "@keel/schema";

/** A `keel.unexpected` error value (k.errors) for failures the router detects itself. */
export function unexpected(message: string): KeelError<"keel.unexpected", Readonly<Record<string, never>>> {
  return { code: "keel.unexpected", message, data: {} };
}
