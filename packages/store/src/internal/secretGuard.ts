import { type Schema, secretPath } from "@keel/schema";

/** Throws E1303 when the state schema of store `id` holds `s.secret` anywhere: state never holds a secret. */
export function secretGuard(id: string, schema: Schema<unknown>): void {
  const at = secretPath(schema);
  if (at !== null)
    throw new Error(
      `E1303: store ${id}: state schema holds s.secret at ${at === "" ? "(root)" : at}; state never holds a secret`,
    );
}
