import type { InspectorDef } from "./InspectorDef.ts";
import { inspectors } from "./inspectors.ts";

/**
 * Register a named, schema-typed section of the inspect document (k.cli Inspector hooks, extension point). Every
 * inspect request reads it with the app's `ctx` into `sections[id]`. A second registration of an `id` throws E1057.
 */
export function inspector<T>(def: InspectorDef<T>): void {
  if (inspectors.has(def.id)) throw new Error(`E1057 inspector section ${def.id} registered twice`);
  inspectors.set(def.id, { schema: def.schema, read: def.read });
}
