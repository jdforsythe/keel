import type { Mode } from "../types/Mode.ts";

/** A registered formatter with its record type erased: `render` is undefined when the record does not fit the schema. */
export type Entry = { readonly render: (mode: Mode, record: unknown) => string | undefined };
