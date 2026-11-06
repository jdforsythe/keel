import type { FormatterDef } from "../types/FormatterDef.ts";
import type { Mode } from "../types/Mode.ts";
import type { Entry } from "./Entry.ts";

/** Erase a formatter's record type: the record is parsed by its schema first, and json is that schema's encoding. */
export function entryOf<T>(def: FormatterDef<T>): Entry {
  return {
    render: (mode: Mode, record: unknown): string | undefined => {
      const parsed = def.schema.parse(record);
      if (!parsed.ok) return undefined;
      if (mode === "json") return JSON.stringify(def.schema.encode(parsed.value));
      return mode === "compact" ? def.compact(parsed.value) : def.pretty(parsed.value);
    },
  };
}
