import { s } from "@keel/schema";

/** `keel inspect`: one inspector section of the target app, its schema's `doc()` and its value (k.cli Inspector hooks). */
export const InspectSectionSchema = s.object({
  kind: s.literal("inspect.section"),
  id: s.string(),
  doc: s.string(),
  value: s.json(),
});
