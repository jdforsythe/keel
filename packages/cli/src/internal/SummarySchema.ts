import { s } from "@keel/schema";

/** The trailer record: last line of every command. No timing, so equal input gives byte-identical output. */
export const SummarySchema = s.object({
  kind: s.literal("summary"),
  ok: s.boolean(),
  name: s.string(),
  counts: s.record(s.int()),
});
