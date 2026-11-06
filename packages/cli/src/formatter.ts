import { entryOf } from "./internal/entryOf.ts";
import { registry } from "./internal/registry.ts";
import type { FormatterDef } from "./types/FormatterDef.ts";

/**
 * Register the formatter for one record kind (k.cli extension point). Each kind has exactly one formatter:
 * a second registration, kernel kinds included, throws E1053. `json` is never hand-formatted: it is the record
 * encoded by `schema` as one NDJSON line.
 */
export function formatter<T>(kind: string, def: FormatterDef<T>): void {
  if (registry.has(kind)) throw new Error(`E1053 formatter kind ${kind} registered twice`);
  registry.set(kind, entryOf(def));
}
