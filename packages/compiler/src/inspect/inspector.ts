import type { InspectorDef } from "./InspectorDef.ts";
import { inspectors } from "./inspectors.ts";

/**
 * Register a named, schema-typed section of the inspect document (k.inspect Inspector hooks, extension point). Every
 * inspect request reads it with the app's `ctx` into `sections[id]`. A second registration of an `id` throws E1057,
 * unless the first was made before `inspectorsReload`: a module `keel dev` evaluates again replaces its section.
 */
export function inspector<T>(def: InspectorDef<T>): void {
  if (inspectors.get(def.id)?.carried === false) throw new Error(`E1057 inspector section ${def.id} registered twice`);
  inspectors.set(def.id, { schema: def.schema, read: def.read, carried: false });
}
