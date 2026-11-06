import type { KeelError } from "@keel/schema";

/** The standard slots (k.ui): these names carry these signatures everywhere (E1806). */
export type StandardSlots = {
  readonly loading?: () => Node;
  readonly empty?: () => Node;
  readonly error?: (e: KeelError<string, unknown>) => Node;
};
