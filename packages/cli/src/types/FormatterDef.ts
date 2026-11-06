import type { Schema } from "@keel/schema";

/** A formatter for one record kind: `json` is always the record encoded by `schema`; compact and pretty render one record. */
export type FormatterDef<T> = {
  readonly schema: Schema<T>;
  readonly compact: (record: T) => string;
  readonly pretty: (record: T) => string;
};
