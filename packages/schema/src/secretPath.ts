import type { Schema } from "./Schema.ts";
import { secretPathOf } from "./internal/secretPathOf.ts";

/** The dotted object-key path of the first `s.secret` node in `schema` (`""` at the root), null when none (k.parity). */
export function secretPath(schema: Schema<unknown, boolean>): string | null {
  return secretPathOf(schema.node);
}
