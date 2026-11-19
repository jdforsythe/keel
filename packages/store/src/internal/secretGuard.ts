import type { Schema } from "@keel/schema";
import { secretPathOf } from "@keel/schema/internal";

/** Throws E1303 when the state schema of store `id` holds `s.secret` anywhere: state never holds a secret. */
export function secretGuard(id: string, schema: Schema<unknown>): void {
  const at = secretPathOf(schema.node);
  if (at !== null)
    throw new Error(
      `E1303: store ${id}: state schema holds s.secret at ${at === "" ? "(root)" : at}; state never holds a secret`,
    );
}
