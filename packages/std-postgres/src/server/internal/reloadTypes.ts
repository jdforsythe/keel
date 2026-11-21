import type { Engine } from "./Engine.ts";

/** Reads `pg_type` again into the engine's type cache, as after a migration creates a type. */
export async function reloadTypes(engine: Engine): Promise<void> {
  await engine.tx("read committed", async (c) => {
    await engine.types.load(c);
    return { value: null, commit: false };
  });
}
