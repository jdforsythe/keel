import { s } from "@keel/schema";

/** `keel inspect`: one live store of the target app, its log length and last transaction (k.inspect). */
export const InspectStoreSchema = s.object({
  kind: s.literal("inspect.store"),
  id: s.string(),
  entries: s.int(),
  last: s.string().optional(),
});
