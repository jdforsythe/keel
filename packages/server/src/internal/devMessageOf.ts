import type { KeelError } from "@keel/schema";

/** The first `keel.unexpected` message among `errors` (shown in the dev panel only), else null. */
export function devMessageOf(errors: readonly (KeelError<string, unknown> | null | undefined)[]): string | null {
  return errors.find((e) => e?.code === "keel.unexpected")?.message ?? null;
}
