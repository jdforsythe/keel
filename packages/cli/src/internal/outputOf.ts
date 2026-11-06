import { type Schema, s } from "@keel/schema";
import { DiagSchema } from "./DiagSchema.ts";
import { SummarySchema } from "./SummarySchema.ts";

type Variant = Schema<{ readonly kind: string }>;

/** An operation's output schema: its record stream, diagnostics and the summary always among the kinds. */
export function outputOf(...extra: Variant[]): Schema<unknown> {
  return s.object({ records: s.array(s.union("kind", [DiagSchema, SummarySchema, ...extra])) });
}
