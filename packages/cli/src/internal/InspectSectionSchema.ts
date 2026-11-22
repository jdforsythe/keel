import { s } from "@keel/schema";

/**
 * `keel inspect`: one inspector section of the target app, its schema's `doc()` and its value (k.cli Inspector hooks);
 * `deployable` names the deployable that serves it when the document holds `deployables`.
 */
export const InspectSectionSchema = s.object({
  kind: s.literal("inspect.section"),
  id: s.string(),
  deployable: s.string().optional(),
  doc: s.string(),
  value: s.json(),
});
